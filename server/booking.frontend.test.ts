import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bookingSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Booking.tsx"),
  "utf8"
);

const cssSource = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8"
);

describe("Eby’s Place staged booking frontend", () => {
  it("advances from style selection into appointment timing", () => {
    expect(bookingSource).toContain("Choose style");
    expect(bookingSource).toContain("Date & time");
    expect(bookingSource).toContain("Your details");
    expect(bookingSource).toContain("Deposit");
    expect(bookingSource).toContain("setStep(1)");
    expect(bookingSource).toContain("Selecting a style automatically moves you to appointment timing.");
  });

  it("requires date and core client details before opening Stripe deposit checkout while keeping postcode optional", () => {
    expect(bookingSource).toContain("canContinueFromDate");
    expect(bookingSource).toContain("canContinueFromDetails");
    expect(bookingSource).toContain("form.addressLine1 && form.city && form.county");
    expect(bookingSource).not.toContain("form.addressLine1 && form.city && form.county && form.postcode");
    expect(bookingSource).toContain("Postcode (optional)");
    expect(bookingSource).not.toContain("<input required value={form.postcode}");
    expect(bookingSource).toContain("Continue to deposit");
    expect(bookingSource).toContain("Pay £20 Deposit");
    expect(bookingSource).toContain("createDepositCheckout.useMutation");
    expect(bookingSource).toContain("window.open(session.checkoutUrl");
  });

  it("keeps the mobile style selector and selected-service note readable without changing booking flow", () => {
    expect(bookingSource).toContain("overflow-hidden rounded-3xl border p-0 text-left");
    expect(bookingSource).toContain("from £{service.priceFrom}");
    expect(bookingSource).toContain("rounded-full border border-primary/30 bg-primary/10");
    expect(bookingSource).toContain("text-[#4a3014]");
    expect(cssSource).toContain(".booking-style-select { width: 100%; max-width: 100%; overflow-wrap: anywhere; white-space: normal; }");
    expect(cssSource).toContain(".booking-selected-service { color: #3a2615; overflow-wrap: anywhere; word-break: normal; }");
    expect(cssSource).toContain("@media (max-width: 640px)");
  });

  it("maps low-contrast white text utilities on light surfaces to readable brand colours", () => {
    expect(cssSource).toContain(".lux-card .text-white\\/68");
    expect(cssSource).not.toContain(".section-pad .text-white\\/70");
    expect(cssSource).toContain(".bg-background .text-white\\/68");
    expect(cssSource).toContain("{ color: #4a3014; }");
  });
});
