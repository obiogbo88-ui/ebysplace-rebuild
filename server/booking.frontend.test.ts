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

  it("requires date and client details before opening Stripe deposit checkout", () => {
    expect(bookingSource).toContain("canContinueFromDate");
    expect(bookingSource).toContain("canContinueFromDetails");
    expect(bookingSource).toContain("Continue to deposit");
    expect(bookingSource).toContain("Continue to £20 Deposit");
    expect(bookingSource).toContain("createDepositCheckout.useMutation");
    expect(bookingSource).toContain("window.open(session.checkoutUrl");
  });

  it("keeps the mobile style selector and selected-service note readable without changing booking flow", () => {
    expect(bookingSource).toContain("booking-style-panel grid gap-5");
    expect(bookingSource).toContain("className=\"booking-style-select\"");
    expect(bookingSource).toContain("booking-selected-service rounded-3xl");
    expect(bookingSource).toContain("text-[#3a2615]");
    expect(cssSource).toContain(".booking-style-select { width: 100%; max-width: 100%; overflow-wrap: anywhere; white-space: normal; }");
    expect(cssSource).toContain(".booking-selected-service { color: #3a2615; overflow-wrap: anywhere; word-break: normal; }");
    expect(cssSource).toContain("@media (max-width: 640px)");
  });

  it("maps low-contrast white text utilities on light sections to readable brand colours", () => {
    expect(cssSource).toContain(".lux-card .text-white\\/68");
    expect(cssSource).toContain(".section-pad .text-white\\/70");
    expect(cssSource).toContain(".bg-background .text-white\\/68");
    expect(cssSource).toContain("{ color: #4a3014; }");
  });
});
