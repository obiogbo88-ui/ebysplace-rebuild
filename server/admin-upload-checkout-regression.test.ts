import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const readSource = (relativePath: string) => readFileSync(join(projectRoot, relativePath), "utf8");

describe("admin upload permissions and checkout failure safeguards", () => {
  it("treats the configured owner email as an admin fallback for bearer-token admin sessions", () => {
    const source = readSource("server/supabaseAuth.ts");

    expect(source).toContain("normalizeEmailCandidate(process.env.EBYSPLACE_ADMIN_EMAIL)");
    expect(source).toContain("normalizeEmailCandidate(process.env.EBYSPLACE_OWNER_EMAIL)");
    expect(source).toContain("normalizeEmailCandidate(process.env.OWNER_EMAIL)");
    expect(source).toContain("const role = isConfiguredAdminEmail(normalizedEmail) ? \"admin\" : \"user\"");
  });

  it("keeps checkout configuration and provider failures behind a safe customer message", () => {
    const source = readSource("server/routers.ts");

    expect(source).toContain("const CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE = \"Payment is currently unavailable. Please contact us to complete your booking.\"");
    expect(source).toContain("throw paymentUnavailableError()");
    expect(source).toContain("Booking checkout session creation failed");
    expect(source).toContain("Shop checkout session creation failed");
    expect(source).not.toContain("Stripe did not return a checkout link. Please try again.");
    expect(source).not.toContain("Live Stripe payments require a live Stripe secret key");
  });

  it("does not expose payment-provider names in customer checkout notifications", () => {
    const source = readSource("server/routers.ts");

    expect(source).toContain("Please complete secure payment in the browser tab to confirm your order.");
    expect(source).toContain("Please complete secure payment to confirm the order.");
    expect(source).not.toContain("Please complete Stripe payment in the browser tab to confirm your order.");
    expect(source).not.toContain("Please complete Stripe payment to confirm the order.");
  });
});
