import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bookingDepositLabel, isPastAppointment } from "../client/src/lib/bookingDisplay";

const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

describe("admin bookings table", () => {
  it("shows deposits in plain English and never reads an abandoned checkout as paid", () => {
    expect(bookingDepositLabel("paid")).toEqual({ label: "Paid", tone: "paid" });
    expect(bookingDepositLabel("checkout_started").label).toBe("Not paid");
    expect(bookingDepositLabel("unpaid").label).toBe("Not paid");
    expect(bookingDepositLabel("failed").label).toBe("Payment failed");
    expect(bookingDepositLabel("refunded").label).toBe("Refunded");
  });

  it("flags appointments before today (UK time) as past", () => {
    const today = new Date("2026-10-01T10:00:00Z");
    expect(isPastAppointment("2026-09-30", today)).toBe(true);
    expect(isPastAppointment("2026-10-01", today)).toBe(false);
    expect(isPastAppointment("2026-10-15", today)).toBe(false);
    expect(isPastAppointment("", today)).toBe(false);
  });

  it("has one status column, only shows paid amounts, and asks before confirming an unpaid booking", () => {
    expect(adminSource).not.toContain("<th>Change status</th>");
    expect(adminSource).not.toContain("<td>{booking.status}</td>");
    expect(adminSource).toContain("<th>Amount paid</th>");
    expect(adminSource).toContain('isPaid && booking.checkoutTotalCharged != null');
    expect(adminSource).toContain('if (status === "confirmed" && !isPaid)');
    expect(adminSource).toContain('label: "Confirm anyway"');
    expect(adminSource).toContain("Appointment date has passed. Mark as Completed if it went ahead.");
  });
});
