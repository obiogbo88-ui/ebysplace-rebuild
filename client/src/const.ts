export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

function normalizeAbsoluteUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).origin;
  } catch {
    return undefined;
  }
}

export function getAuthConfigurationStatus() {
  const oauthPortalUrl = normalizeAbsoluteUrl(import.meta.env.VITE_OAUTH_PORTAL_URL);
  const appId = typeof import.meta.env.VITE_APP_ID === "string" ? import.meta.env.VITE_APP_ID.trim() : "";
  const missing: string[] = [];
  if (!appId) missing.push("VITE_APP_ID");
  if (!oauthPortalUrl) missing.push("VITE_OAUTH_PORTAL_URL");
  return {
    isConfigured: missing.length === 0,
    appId,
    oauthPortalUrl,
    missingMessage: missing.length ? `Admin sign-in is not configured for this deployment. Add ${missing.join(" and ")} in Vercel Environment Variables, then redeploy.` : undefined,
  };
}

// Generate login URL at runtime so redirect URI reflects the current origin.
// Missing App ID is reported explicitly by getAuthConfigurationStatus() instead
// of allowing an invalid OAuth URL to be opened from the admin dashboard.
export const getLoginUrl = () => {
  const { appId, oauthPortalUrl, missingMessage } = getAuthConfigurationStatus();
  if (!appId || !oauthPortalUrl) throw new Error(missingMessage);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL("/app-auth", oauthPortalUrl);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
