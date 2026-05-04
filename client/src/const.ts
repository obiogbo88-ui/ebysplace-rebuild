export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const ADMIN_LOGIN_PATH = "/admin/login";
export const AUTH_TOKEN_STORAGE_KEY = "ebysplace.supabase.access_token";
export const AUTH_EXPIRES_STORAGE_KEY = "ebysplace.supabase.expires_at";
export const RUNTIME_USER_STORAGE_KEY = "ebysplace.runtime.admin_user";

export function getStoredAuthToken() {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const expiresAt = Number(window.localStorage.getItem(AUTH_EXPIRES_STORAGE_KEY) ?? "0");
  if (!token) return null;
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt * 1000 <= Date.now()) {
    clearStoredAuthSession();
    return null;
  }
  return token;
}

export function setStoredAuthSession(accessToken: string, expiresAt?: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, accessToken);
  if (expiresAt) window.localStorage.setItem(AUTH_EXPIRES_STORAGE_KEY, String(expiresAt));
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_EXPIRES_STORAGE_KEY);
  window.localStorage.removeItem(RUNTIME_USER_STORAGE_KEY);
}

export function getAdminLoginUrl(returnTo?: string) {
  const target = returnTo || (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}${window.location.hash}` : "/admin");
  const params = new URLSearchParams();
  if (target && target !== ADMIN_LOGIN_PATH) params.set("returnTo", target);
  const query = params.toString();
  return query ? `${ADMIN_LOGIN_PATH}?${query}` : ADMIN_LOGIN_PATH;
}
