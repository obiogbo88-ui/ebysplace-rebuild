import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("activity session id respects analytics consent", () => {
  let cookieJar = "";
  let local: ReturnType<typeof fakeStorage>;
  let session: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    cookieJar = "";
    local = fakeStorage();
    session = fakeStorage();
    vi.stubGlobal("document", { get cookie() { return cookieJar; }, set cookie(value: string) { const [pair] = value.split(";"); const [name] = pair.split("="); cookieJar = cookieJar.split("; ").filter((p) => p && !p.startsWith(`${name}=`)).concat(pair.endsWith("=") ? [] : [pair]).join("; "); } });
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session, crypto: undefined, location: { protocol: "https:" } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the id in the tab only (never localStorage) when there is no consent or analytics is rejected", async () => {
    const { getActivitySessionId } = await import("../client/src/lib/activityTracking");
    const first = getActivitySessionId();
    expect(first).toMatch(/^sess_/);
    expect(getActivitySessionId()).toBe(first);
    expect(local.getItem("ebysplace_activity_session_id")).toBeNull();
    expect(session.getItem("ebysplace_activity_session_id")).toBe(first);

    const { saveConsent } = await import("../client/src/lib/cookieConsent");
    saveConsent({ analytics: false, marketing: false });
    getActivitySessionId();
    expect(local.getItem("ebysplace_activity_session_id")).toBeNull();
  });

  it("persists the id only after analytics is accepted, and clears it on withdrawal", async () => {
    const { getActivitySessionId, clearPersistentSessionId, hasAnalyticsConsent } = await import("../client/src/lib/activityTracking");
    const { saveConsent } = await import("../client/src/lib/cookieConsent");
    expect(hasAnalyticsConsent()).toBe(false);
    saveConsent({ analytics: true, marketing: false });
    expect(hasAnalyticsConsent()).toBe(true);
    const id = getActivitySessionId();
    expect(local.getItem("ebysplace_activity_session_id")).toBe(id);
    clearPersistentSessionId();
    expect(local.getItem("ebysplace_activity_session_id")).toBeNull();
  });
});

describe("cookie consent wiring", () => {
  it("only records page visits after analytics consent", () => {
    const app = source("client/src/App.tsx");
    const gate = app.indexOf("if (!hasAnalyticsConsent()) return;");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(app.indexOf('eventName: "page_visit"'));
  });

  it("starts optional cookies switched off, clears the persistent id on rejection, and can be reopened", () => {
    const banner = source("client/src/components/CookieConsentBanner.tsx");
    expect(banner).toContain("const [analyticsChecked, setAnalyticsChecked] = useState(false);");
    expect(banner).toContain("if (!analytics) clearPersistentSessionId();");
    expect(banner).toContain("OPEN_COOKIE_SETTINGS_EVENT");
    expect(source("client/src/pages/Home.tsx")).toContain("Cookie settings");
  });
});
