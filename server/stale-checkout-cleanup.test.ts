import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelStaleUnpaidCheckouts = vi.fn();
const logActivity = vi.fn();
const sendOwnerSmsAndWhatsAppSafely = vi.fn();

vi.mock("./db", () => ({ cancelStaleUnpaidCheckouts, logActivity }));
vi.mock("./customerNotifications", () => ({ sendOwnerSmsAndWhatsAppSafely }));

const { runStaleUnpaidCheckoutCleanup, STALE_UNPAID_DAYS } = await import("./staleCheckoutCleanup");

describe("runStaleUnpaidCheckoutCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logActivity.mockResolvedValue(undefined);
    sendOwnerSmsAndWhatsAppSafely.mockResolvedValue(undefined);
  });

  it("waits a week, well after the 24h owner reminders, before cancelling anything", () => {
    expect(STALE_UNPAID_DAYS).toBe(7);
  });

  it("does nothing visible when there is nothing stale", async () => {
    cancelStaleUnpaidCheckouts.mockResolvedValue({ olderThanDays: 7, bookings: [], orders: [], transactions: 0 });
    const result = await runStaleUnpaidCheckoutCleanup();
    expect(cancelStaleUnpaidCheckouts).toHaveBeenCalledWith(7);
    expect(result).toEqual({ cancelledBookings: 0, cancelledOrders: 0, cancelledTransactions: 0 });
    expect(sendOwnerSmsAndWhatsAppSafely).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("tells the owner exactly what was cancelled and how to undo it", async () => {
    cancelStaleUnpaidCheckouts.mockResolvedValue({
      olderThanDays: 7,
      bookings: [{ id: 41, clientName: "Ada", serviceName: "Knotless braids", appointmentDate: "2026-10-12" }],
      orders: [{ id: 88, customerName: "Tolu" }],
      transactions: 2,
    });
    const result = await runStaleUnpaidCheckoutCleanup();
    expect(result).toEqual({ cancelledBookings: 1, cancelledOrders: 1, cancelledTransactions: 2 });
    const summary = sendOwnerSmsAndWhatsAppSafely.mock.calls[0][0] as string;
    expect(summary).toContain("cancelled 2 unpaid checkouts older than 7 days");
    expect(summary).toContain("Booking #41 · Ada · Knotless braids · 2026-10-12");
    expect(summary).toContain("Order #88 · Tolu");
    expect(summary).toContain("change the status back in the admin");
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
      activityType: "auto_cancelled_unpaid_checkouts",
      metadata: { bookingIds: [41], orderIds: [88], transactions: 2 },
    }));
  });

  it("still returns the result if the owner message fails", async () => {
    cancelStaleUnpaidCheckouts.mockResolvedValue({ olderThanDays: 7, bookings: [], orders: [{ id: 5, customerName: "Kemi" }], transactions: 1 });
    sendOwnerSmsAndWhatsAppSafely.mockRejectedValue(new Error("twilio down"));
    await expect(runStaleUnpaidCheckoutCleanup()).resolves.toEqual({ cancelledBookings: 0, cancelledOrders: 1, cancelledTransactions: 1 });
  });
});

describe("cancelStaleUnpaidCheckouts safety rules", () => {
  const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8").replace(/\r\n/g, "\n");
  const start = dbSource.indexOf("export async function cancelStaleUnpaidCheckouts");
  const fn = dbSource.slice(start, dbSource.indexOf("\n}\n", start));

  it("only ever touches unpaid records, and never deletes", () => {
    expect(fn).toContain(`WHERE "status" = 'pending' AND "depositStatus" IN ('unpaid','checkout_started','failed')`);
    expect(fn).toContain(`WHERE "status" IN ('draft','pending_payment')`);
    expect(fn).toContain(`UPDATE "transactions" SET "status" = 'cancelled'\n       WHERE "status" = 'pending'`);
    expect(fn).not.toMatch(/DELETE FROM/);
  });

  it("never goes below three days and runs in one database transaction", () => {
    expect(fn).toContain("Math.max(3, Math.floor(olderThanDays))");
    expect(fn).toContain(`client.query("BEGIN")`);
    expect(fn).toContain(`client.query("ROLLBACK")`);
  });

  it("is wired into the daily cron alongside the reminders", () => {
    const cron = readFileSync(resolve(process.cwd(), "server/dailyAutomations.ts"), "utf8");
    expect(cron).toContain("runStaleUnpaidCheckoutCleanup(),");
  });

  it("still confirms a cancelled booking if the customer pays for it later", () => {
    expect(dbSource).toContain(`set({ depositStatus: "paid", status: "confirmed"`);
  });
});
