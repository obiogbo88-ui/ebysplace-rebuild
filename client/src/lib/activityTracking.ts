const SESSION_KEY = "ebysplace_activity_session_id";

function randomSessionId() {
  return `sess_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
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

