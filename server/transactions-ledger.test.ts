import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("transactions ledger wiring", () => {
  const dbSource = source("server/db.ts");
  const routersSource = source("server/routers.ts");
  const webhookSource = source("server/stripeWebhook.ts");

  it("keeps a separate transaction type for bookings, shop orders and Try-On credits", () => {
    expect(dbSource).toContain('["booking_deposit", "shop_order", "tryon_credits"]');
    expect(routersSource).toContain('type: "booking_deposit"');
    expect(routersSource).toContain('type: "shop_order"');
    expect(routersSource).toContain('type: "tryon_credits"');
    expect(webhookSource).toContain('type: "booking_deposit"');
    expect(webhookSource).toContain('type: "shop_order"');
    expect(webhookSource).toContain('type: "tryon_credits"');
  });

  it("marks abandoned Stripe checkouts as cancelled without downgrading paid rows", () => {
    expect(webhookSource).toContain('event.type === "checkout.session.expired"');
    expect(dbSource).toContain(`AND "status" = 'pending'`);
  });

  it("only clears unpaid records, previews first, and never goes below 24 hours", () => {
    expect(routersSource).toContain("dryRun: z.boolean().default(true)");
    expect(routersSource).toContain("olderThanHours: z.number().int().min(24)");
    expect(dbSource).toContain("Math.max(24, Math.floor(options.olderThanHours ?? 24))");
    expect(dbSource).toContain(`"depositStatus" IN ('unpaid','checkout_started','failed')`);
    expect(dbSource).toContain(`"status" IN ('draft','pending_payment')`);
    expect(dbSource).toContain(`b."depositStatus" IN ('paid','refunded')`);
  });

  it("ranks best-selling and most-booked items from paid records only", () => {
    expect(dbSource).toContain('inArray(orders.status, ["paid", "fulfilling", "shipped", "completed"])');
    expect(dbSource).toContain('eq(bookings.depositStatus, "paid")');
  });
});
