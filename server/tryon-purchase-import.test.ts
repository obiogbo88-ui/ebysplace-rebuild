import { describe, expect, it } from "vitest";
import { collectTryOnPurchases } from "./tryOnPurchaseImport";

const session = (over: Record<string, unknown>) => ({ id: "cs_x", created: 1_750_000_000, amount_total: 299, payment_status: "paid", payment_intent: "pi_x", customer_email: "a@x.com", metadata: { purchase_type: "tryon_credits", credits: "3", customer_email: "a@x.com" }, ...over });

describe("collectTryOnPurchases", () => {
  it("keeps only paid Try-On credit sessions, with amount in pounds", async () => {
    const purchases = await collectTryOnPurchases([
      session({ id: "cs_paid" }),
      session({ id: "cs_unpaid", payment_status: "unpaid" }),
      session({ id: "cs_booking", metadata: { deposit_type: "non_refundable_20_gbp" } }),
      session({ id: "cs_shop", metadata: { order_type: "shop_products" } }),
      session({ id: "cs_big", amount_total: 499, metadata: { purchase_type: "tryon_credits", credits: "6" } , customer_email: "b@x.com" }),
    ]);
    expect(purchases.map((p) => p.stripeCheckoutSessionId)).toEqual(["cs_paid", "cs_big"]);
    expect(purchases[0]).toMatchObject({ amount: 2.99, credits: 3, customerEmail: "a@x.com", stripePaymentIntentId: "pi_x" });
    expect(purchases[1]).toMatchObject({ amount: 4.99, credits: 6, customerEmail: "b@x.com" });
    expect(purchases[0].paidAt.getTime()).toBe(1_750_000_000 * 1000);
  });

  it("works with async iterables such as Stripe auto-pagination", async () => {
    async function* pages() { yield session({ id: "cs_1" }); yield session({ id: "cs_2" }); }
    expect((await collectTryOnPurchases(pages())).length).toBe(2);
  });
});
