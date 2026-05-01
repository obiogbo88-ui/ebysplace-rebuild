import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bookingSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Booking.tsx"),
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
});
