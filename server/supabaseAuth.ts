// @ts-nocheck
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { upsertUser } from "./db";

const ADMIN_EMAIL = (process.env.EBYSPLACE_ADMIN_EMAIL ?? "info@ebysplace.com").trim().toLowerCase();

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

function getSupabaseAuthConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the deployment environment.",
    });
  }

  return { url, serviceRoleKey };
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getDisplayName(user: SupabaseAuthUser, fallbackEmail: string) {
  const metadataName = user.user_metadata?.name;
  return typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : fallbackEmail.split("@")[0];
}

async function supabaseAuthFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await response.text();
  const json = body ? JSON.parse(body) : null;

  if (!response.ok) {
    const message = typeof json?.msg === "string" ? json.msg : typeof json?.message === "string" ? json.message : "Supabase Auth request failed.";
    throw new TRPCError({ code: response.status === 401 || response.status === 400 ? "UNAUTHORIZED" : "BAD_REQUEST", message });
  }

  return json as T;
}

export async function signInAdminWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== ADMIN_EMAIL) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Only the configured Eby’s Place administrator can sign in." });
  }

  const session = await supabaseAuthFetch<SupabaseTokenResponse>("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: normalizedEmail, password }),
  });

  if (!session.access_token || !session.user?.id) {
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
}

export async function authenticateSupabaseRequest(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const user = await supabaseAuthFetch<SupabaseAuthUser>("/user", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!user.id || !user.email) return null;
    const normalizedEmail = user.email.trim().toLowerCase();
    const role = normalizedEmail === ADMIN_EMAIL ? "admin" : "user";
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
    console.warn("[Auth] Supabase bearer token verification failed", error);
    return null;
  }
}
