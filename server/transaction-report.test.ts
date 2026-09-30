import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPaymentBreakdown, shapeMonthlyTotals } from "./transactionReport";

describe("buildPaymentBreakdown", () => {
  it("breaks a booking checkout into items, discount, Stripe fee and net", () => {
    const breakdown = buildPaymentBreakdown(
      { currency: "gbp", amount_subtotal: 4500, amount_total: 4000, total_details: { amount_discount: 500, amount_shipping: 0, amount_tax: 0 } },
      [
        { description: "Booking deposit", quantity: 1, amount_subtotal: 2000, amount_total: 1778 },
        { description: "Home service surcharge", quantity: 1, amount_subtotal: 1500, amount_total: 1333 },
        { description: "Edge control", quantity: 2, amount_subtotal: 1000, amount_total: 889 },
      ],
      { fee: 80, net: 3920 },
    );
    expect(breakdown.lines.map((line) => line.amount)).toEqual([20, 15, 10]);
    expect(breakdown.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(breakdown.subtotal);
    expect(breakdown).toMatchObject({ subtotal: 45, discount: 5, total: 40, stripeFee: 0.8, net: 39.2 });
  });

  it("leaves fee and net unknown when Stripe has not settled the charge", () => {
    const breakdown = buildPaymentBreakdown({ amount_total: 499 }, [{ description: "AI Try-On — 1 credit", quantity: 1, amount_total: 499 }], null);
    expect(breakdown).toMatchObject({ subtotal: 4.99, discount: 0, total: 4.99, stripeFee: null, net: null, currency: "gbp" });
  });

  it("works out net from the fee when Stripe omits net", () => {
    expect(buildPaymentBreakdown({ amount_total: 2000 }, [], { fee: 45 }).net).toBe(19.55);
  });
});

describe("shapeMonthlyTotals", () => {
  const now = new Date(Date.UTC(2026, 8, 1)); // September 2026

  it("totals each type per month and sums them into a monthly grand total", () => {
    const report = shapeMonthlyTotals([
      { month: "2026-09", type: "booking_deposit", count: 3, gross: 60, fees: 1.5, refunded: 0, net: 58.5, missingFees: 0 },
      { month: "2026-09", type: "shop_order", count: 2, gross: 34.98, fees: 0.9, refunded: 10, net: 24.08, missingFees: 0 },
      { month: "2026-09", type: "tryon_credits", count: 4, gross: 19.96, fees: 1.2, refunded: 0, net: 18.76, missingFees: 1 },
      { month: "2026-08", type: "booking_deposit", count: 1, gross: 20, fees: 0.5, refunded: 0, net: 19.5, missingFees: 0 },
    ], 3, now);
    expect(report.map((item) => item.month)).toEqual(["2026-09", "2026-08", "2026-07"]);
    const [september, august, july] = report;
    expect(september.byType.booking_deposit.gross).toBe(60);
    expect(september.byType.shop_order.refunded).toBe(10);
    expect(september.byType.tryon_credits.count).toBe(4);
    expect(september.total).toEqual({ count: 9, gross: 114.94, fees: 3.6, refunded: 10, net: 101.34, missingFees: 1 });
    expect(august.total.gross).toBe(20);
    expect(august.byType.shop_order.gross).toBe(0);
    expect(july.total).toEqual({ count: 0, gross: 0, fees: 0, refunded: 0, net: 0, missingFees: 0 });
  });

  it("rolls back across a year boundary and ignores unknown types", () => {
    const report = shapeMonthlyTotals([{ month: "2025-12", type: "gift_card", count: 1, gross: 50, fees: 1, refunded: 0, net: 49, missingFees: 0 }], 2, new Date(Date.UTC(2026, 0, 1)));
    expect(report.map((item) => item.month)).toEqual(["2026-01", "2025-12"]);
    expect(report[1].total.gross).toBe(0);
  });
});

describe("payment breakdown wiring", () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
  const webhookSource = source("server/stripeWebhook.ts");
  const dbSource = source("server/db.ts");

  it("records the Stripe breakdown after a paid checkout without failing the webhook", () => {
    expect(webhookSource).toContain("syncPaymentBreakdown(config.stripe, session.id).catch(");
  });

  it("tracks refunds from Stripe and subtracts them from net", () => {
    expect(webhookSource).toContain('event.type === "charge.refunded"');
    expect(dbSource).toContain(`COALESCE("netAmount", "amount") - "refundedAmount"`);
  });

  it("groups months in UK time and counts only money actually received", () => {
    expect(dbSource).toContain("AT TIME ZONE 'Europe/London'");
    expect(dbSource).toContain(`WHERE "status" IN ('completed','refunded')`);
  });
});
