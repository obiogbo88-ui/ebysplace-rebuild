const SESSION_KEY = "ebysplace_activity_session_id";
const ADMIN_PATH_PREFIX = "/admin";
const trackingThrottleByKey = new Map<string, number>();

function randomSessionId() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    const randomPart = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `sess_${randomPart}_${Date.now().toString(36)}`;
  }
  return `sess_${Date.now().toString(36)}_${(Date.now() % 9973).toString(36)}`;
}

export function getActivitySessionId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = randomSessionId();
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

export function getBrowserInfo() {
  if (typeof window === "undefined") return { userAgent: "", browser: "", deviceType: "" };
  const userAgent = window.navigator.userAgent || "";
  const lower = userAgent.toLowerCase();
  const browser = lower.includes("edg/") ? "Edge" : lower.includes("opr/") ? "Opera" : lower.includes("chrome/") ? "Chrome" : lower.includes("firefox/") ? "Firefox" : lower.includes("safari/") ? "Safari" : "Unknown";
  const deviceType = /ipad|tablet|kindle|playbook/i.test(userAgent) ? "tablet" : /mobi|android|iphone|ipod|blackberry|windows phone/i.test(userAgent) ? "mobile" : "desktop";
  return { userAgent, browser, deviceType };
}

export function getCurrentPageUrl() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search || ""}`;
}

function normalizeTrackingPath(pathOrUrl: string) {
  const fallbackPath = pathOrUrl || "/";
  try {
    const parsed = new URL(fallbackPath, typeof window !== "undefined" ? window.location.origin : "https://www.ebysplace.com");
    return parsed.pathname || "/";
  } catch {
    return fallbackPath.split(/[?#]/)[0] || "/";
  }
}

export function isAdminPath(pathOrUrl: string) {
  const pathname = normalizeTrackingPath(pathOrUrl).toLowerCase();
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`);
}

export function shouldTrackPublicActivity(pathOrUrl: string) {
  return !isAdminPath(pathOrUrl);
}

export function shouldThrottleTrackingEvent(eventKey: string, throttleWindowMs = 8000) {
  const now = Date.now();
  const previous = trackingThrottleByKey.get(eventKey) || 0;
  if (now - previous < throttleWindowMs) return true;
  trackingThrottleByKey.set(eventKey, now);
  return false;
}

export function createTrackingEventKey(input: {
  eventName: string;
  pagePath: string;
  sessionId: string;
  activityType?: string;
}) {
  const pagePath = normalizeTrackingPath(input.pagePath).toLowerCase();
  return [input.sessionId || "anonymous", input.eventName, input.activityType || "unknown", pagePath].join("|");
}
