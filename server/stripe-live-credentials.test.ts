import Stripe from "stripe";
import { describe, expect, it } from "vitest";

const liveSecret = process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY?.trim();
const livePublishable = process.env.VITE_EBYSPLACE_LIVE_STRIPE_PUBLISHABLE_KEY?.trim();
const liveWebhookSecret = process.env.EBYSPLACE_LIVE_STRIPE_WEBHOOK_SECRET?.trim();

describe("Eby’s Place live Stripe credentials", () => {
  it.runIf(Boolean(liveSecret))("accepts the supplied live Stripe secret key for a lightweight Stripe API call", async () => {
    if (!liveSecret?.startsWith("sk_live_")) {
      throw new Error("EBYSPLACE_LIVE_STRIPE_SECRET_KEY must be a live server secret key that starts with sk_live_.");
    }
    const stripe = new Stripe(liveSecret, { timeout: 10000 });
    const balance = await stripe.balance.retrieve();
    expect(balance.object).toBe("balance");
  }, 15000);

  it.runIf(Boolean(livePublishable))("uses a live publishable key override format", () => {
    if (!livePublishable?.startsWith("pk_live_")) {
      throw new Error("VITE_EBYSPLACE_LIVE_STRIPE_PUBLISHABLE_KEY must be a live publishable key that starts with pk_live_.");
    }
  });

  it.runIf(Boolean(liveWebhookSecret))("uses a Stripe webhook signing secret override format", () => {
    if (!liveWebhookSecret?.startsWith("whsec_")) {
      throw new Error("EBYSPLACE_LIVE_STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret that starts with whsec_.");
    }
  });
});
