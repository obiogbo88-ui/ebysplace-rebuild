import { describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("Supabase media migration secret", () => {
  it.runIf(Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY))("can authenticate to the Supabase storage API and see the ebysplace-media bucket", async () => {
    expect(SUPABASE_URL, "SUPABASE_URL must be configured").toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY must be configured").toBeTruthy();

    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    expect(response.status, `Supabase storage API returned ${response.status}`).toBe(200);
    const buckets = (await response.json()) as Array<{ id?: string; name?: string }>;
    const names = buckets.map((bucket) => bucket.name ?? bucket.id);
    expect(names).toContain("ebysplace-media");
  }, 20000);
});
