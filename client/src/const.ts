export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const DEFAULT_OAUTH_PORTAL_URL = "https://manus.im";

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

// Generate login URL at runtime so redirect URI reflects the current origin.
// The Vercel deployment can omit VITE_OAUTH_PORTAL_URL during early setup; never
// let that configuration gap crash protected pages such as /admin.
export const getLoginUrl = () => {
  const configuredPortal = normalizeAbsoluteUrl(import.meta.env.VITE_OAUTH_PORTAL_URL);
  const oauthPortalUrl = configuredPortal ?? DEFAULT_OAUTH_PORTAL_URL;
  const appId = typeof import.meta.env.VITE_APP_ID === "string" ? import.meta.env.VITE_APP_ID : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL("/app-auth", oauthPortalUrl);
  if (appId) url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
