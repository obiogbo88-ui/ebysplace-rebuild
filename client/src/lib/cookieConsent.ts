import { deleteCookie, getCookie, setCookie } from "./cookies";

const CONSENT_COOKIE_NAME = "ebysplace_cookie_consent";
const VISITOR_ID_COOKIE_NAME = "ebysplace_visitor_id";
const CONSENT_COOKIE_DAYS = 365;

export type CookiePreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export function getStoredConsent(): CookiePreferences | null {
  const raw = getCookie(CONSENT_COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
    };
  } catch {
    return null;
  }
}

export function saveConsent(preferences: { analytics: boolean; marketing: boolean }): CookiePreferences {
  const value: CookiePreferences = { necessary: true, analytics: preferences.analytics, marketing: preferences.marketing };
  setCookie(CONSENT_COOKIE_NAME, JSON.stringify(value), CONSENT_COOKIE_DAYS);
  if (!value.analytics) deleteCookie(VISITOR_ID_COOKIE_NAME);
  return value;
}

function randomVisitorId() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(10);
    window.crypto.getRandomValues(bytes);
    return `vis_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  return `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Only creates/reads the persistent visitor-id cookie when analytics
 * consent has been granted — this is the "tracking cookie" itself, so it
 * must never be set before the visitor has opted in.
 */
export function ensureVisitorCookie(analyticsConsent: boolean): { visitorId: string; isReturningVisitor: boolean } | null {
  if (!analyticsConsent) return null;
  const existing = getCookie(VISITOR_ID_COOKIE_NAME);
  if (existing) return { visitorId: existing, isReturningVisitor: true };
  const next = randomVisitorId();
  setCookie(VISITOR_ID_COOKIE_NAME, next, CONSENT_COOKIE_DAYS);
  return { visitorId: next, isReturningVisitor: false };
}
