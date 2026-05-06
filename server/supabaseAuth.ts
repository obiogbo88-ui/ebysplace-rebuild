// @ts-nocheck
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { upsertUser } from "./db";

function normalizeEmailCandidate(value: string | undefined) {
  const email = value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim().toLowerCase();
  return email || null;
}

function getConfiguredAdminEmails() {
  const configured = [
    normalizeEmailCandidate(process.env.EBYSPLACE_ADMIN_EMAIL),
    normalizeEmailCandidate(process.env.EBYSPLACE_OWNER_EMAIL),
    normalizeEmailCandidate(process.env.OWNER_EMAIL),
    normalizeEmailCandidate(process.env.SMTP_FROM),
    "info@ebysplace.com",
  ].filter((email): email is string => Boolean(email));
  return Array.from(new Set(configured));
}

const ADMIN_EMAILS = getConfiguredAdminEmails();
const PRIMARY_ADMIN_EMAIL = ADMIN_EMAILS[0] ?? "info@ebysplace.com";

function isConfiguredAdminEmail(email: string | undefined) {
  const normalized = normalizeEmailCandidate(email);
  return Boolean(normalized && ADMIN_EMAILS.includes(normalized));
}

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
};

type SupabaseTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  refresh_token?: string;
  user: SupabaseAuthUser;
};

function toTrpcError(error: unknown, fallbackMessage: string) {
  if (error instanceof TRPCError) return error;
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
}

function getSupabaseAuthConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("[Auth] Supabase Auth configuration missing", {
      hasSupabaseUrl: Boolean(url),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the deployment environment.",
    });
  }

  return { url, serviceRoleKey };
}

function getBearerToken(req: Request) {
  const header = req.headers?.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getDisplayName(user: SupabaseAuthUser, fallbackEmail: string) {
  const metadataName = user.user_metadata?.name;
  return typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : fallbackEmail.split("@")[0];
}

function getSafeResetRedirect(origin: string) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported protocol");
    return parsed.origin + "/admin/reset-password";
  } catch {
    return "http://localhost:3000/admin/reset-password";
  }
}

async function supabaseAuthFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseAuthConfig();
  let response: Response;

  try {
    response = await fetch(`${url}/auth/v1${path}`, {
      ...init,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    console.error("[Auth] Supabase Auth network request failed", { path, method: init.method ?? "GET", error });
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Unable to reach Supabase Auth. Check SUPABASE_URL and network access." });
  }

  const body = await response.text().catch((error) => {
    console.error("[Auth] Failed reading Supabase Auth response body", { path, status: response.status, error });
    return "";
  });

  let json: any = null;
  if (body) {
    try {
      json = JSON.parse(body);
    } catch (error) {
      console.error("[Auth] Supabase Auth returned non-JSON response", {
        path,
        status: response.status,
        bodyPreview: body.slice(0, 500),
        error,
      });
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Supabase Auth returned an invalid response." });
    }
  }

  if (!response.ok) {
    const message = typeof json?.msg === "string" ? json.msg : typeof json?.message === "string" ? json.message : "Supabase Auth request failed.";
    console.error("[Auth] Supabase Auth request failed", { path, method: init.method ?? "GET", status: response.status, message });
    throw new TRPCError({ code: response.status === 401 || response.status === 400 ? "UNAUTHORIZED" : "BAD_REQUEST", message });
  }

  return json as T;
}

export async function signInAdminWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    if (!isConfiguredAdminEmail(normalizedEmail)) {
      console.error("[Auth] Rejected admin sign-in for non-admin email", { email: normalizedEmail, configuredAdminEmails: ADMIN_EMAILS });
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Only the configured Eby’s Place administrator can sign in." });
    }

    const session = await supabaseAuthFetch<SupabaseTokenResponse>("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    if (!session.access_token || !session.user?.id) {
      console.error("[Auth] Supabase returned an incomplete admin session", { email: normalizedEmail, hasAccessToken: Boolean(session.access_token), hasUserId: Boolean(session.user?.id) });
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Supabase did not return a valid session." });
    }

    await upsertUser({
      openId: session.user.id,
      email: normalizedEmail,
      name: getDisplayName(session.user, normalizedEmail),
      loginMethod: "supabase_password",
      role: "admin",
      lastSignedIn: new Date(),
    });

    return {
      accessToken: session.access_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
      user: {
        openId: session.user.id,
        email: normalizedEmail,
        name: getDisplayName(session.user, normalizedEmail),
        role: "admin" as const,
      },
    };
  } catch (error) {
    const safeError = toTrpcError(error, "Admin sign-in failed.");
    console.error("[Auth] Admin sign-in failed", { email: normalizedEmail, code: safeError.code, message: safeError.message, stack: safeError.stack });
    throw safeError;
  }
}

export async function requestAdminPasswordReset(email: string, origin: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const genericResponse = {
    success: true as const,
    message: "If this email is the configured Eby’s Place administrator, a Supabase password reset link has been sent.",
  };

  if (!isConfiguredAdminEmail(normalizedEmail)) {
    console.warn("[Auth] Ignored password reset request for non-admin email", { email: normalizedEmail, configuredAdminEmails: ADMIN_EMAILS });
    return genericResponse;
  }

  try {
    const redirectTo = getSafeResetRedirect(origin);
    await supabaseAuthFetch<Record<string, unknown>>("/recover?redirect_to=" + encodeURIComponent(redirectTo), {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail }),
    });
    return genericResponse;
  } catch (error) {
    const safeError = toTrpcError(error, "Unable to send the Supabase password reset email.");
    console.error("[Auth] Password reset request failed", { email: normalizedEmail, code: safeError.code, message: safeError.message });
    throw safeError;
  }
}

export async function updateAdminPasswordWithRecoveryToken(accessToken: string, password: string) {
  const token = accessToken.trim();
  if (!token) throw new TRPCError({ code: "BAD_REQUEST", message: "The password reset link is missing its recovery token." });

  try {
    const user = await supabaseAuthFetch<SupabaseAuthUser>("/user", {
      method: "GET",
      headers: { Authorization: "Bearer " + token },
    });
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!isConfiguredAdminEmail(normalizedEmail)) {
      console.error("[Auth] Rejected password update for non-admin recovery token", { email: normalizedEmail, configuredAdminEmails: ADMIN_EMAILS });
      throw new TRPCError({ code: "UNAUTHORIZED", message: "This reset link is not for the configured Eby’s Place administrator." });
    }

    const updated = await supabaseAuthFetch<SupabaseAuthUser>("/user", {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({ password }),
    });

    await upsertUser({
      openId: updated.id || user.id,
      email: PRIMARY_ADMIN_EMAIL,
      name: getDisplayName(updated.id ? updated : user, PRIMARY_ADMIN_EMAIL),
      loginMethod: "supabase_password",
      role: "admin",
      lastSignedIn: new Date(),
    });

    return { success: true as const, message: "Your admin password has been updated. Please sign in with the new password." };
  } catch (error) {
    const safeError = toTrpcError(error, "Unable to update the admin password from this reset link.");
    console.error("[Auth] Password update failed", { code: safeError.code, message: safeError.message });
    throw safeError;
  }
}

export async function authenticateSupabaseRequest(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const user = await supabaseAuthFetch<SupabaseAuthUser>("/user", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!user.id || !user.email) {
      console.error("[Auth] Supabase bearer token returned an incomplete user", { hasUserId: Boolean(user.id), hasEmail: Boolean(user.email) });
      return null;
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    const role = isConfiguredAdminEmail(normalizedEmail) ? "admin" : "user";
    const localUser = {
      openId: user.id,
      email: normalizedEmail,
      name: getDisplayName(user, normalizedEmail),
      loginMethod: "supabase_password",
      role,
      lastSignedIn: new Date(),
    } as const;

    await upsertUser(localUser);
    return localUser;
  } catch (error) {
    console.error("[Auth] Supabase bearer token verification failed", error);
    return null;
  }
}
