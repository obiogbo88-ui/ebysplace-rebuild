import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendBroadcastEmail } from "./resendEmail";

const content = { subject: "Did you know?", paragraphs: ["We also do weave sew-ins."] };

describe("sendBroadcastEmail rate limiting", () => {
  const originalKey = process.env.RESEND_API_KEY;
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
  });
  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
  });

  it("sends one at a time instead of all at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = (async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return new Response(JSON.stringify({ id: "msg" }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await sendBroadcastEmail(["a@x.com", "b@x.com", "c@x.com"], content, fetchImpl);
    expect(result.deliveredCount).toBe(3);
    expect(maxInFlight).toBe(1);
  });

  it("retries a 429 once and reports addresses that still failed", async () => {
    const attempts: Record<string, number> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const to = JSON.parse(String(init.body)).to[0] as string;
      attempts[to] = (attempts[to] ?? 0) + 1;
      const rateLimited = to === "always@x.com" || (to === "once@x.com" && attempts[to] === 1);
      return rateLimited
        ? new Response(JSON.stringify({ message: "Too many requests. You can only make 10 requests per second." }), { status: 429 })
        : new Response(JSON.stringify({ id: "msg" }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await sendBroadcastEmail(["once@x.com", "always@x.com"], content, fetchImpl);
    expect(attempts["once@x.com"]).toBe(2);
    expect(result.deliveredCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failedRecipients).toEqual(["always@x.com"]);
  }, 15000);
});
