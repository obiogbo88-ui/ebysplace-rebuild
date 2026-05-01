import express, { type Express } from "express";
import Stripe from "stripe";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";

function getStripeWebhookConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return null;
  return { stripe: new Stripe(secretKey), webhookSecret };
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const config = getStripeWebhookConfig();
    if (!config) {
      res.status(503).json({ error: "Stripe webhook is not configured" });
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).json({ error: "Missing Stripe signature" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = config.stripe.webhooks.constructEvent(req.body, signature, config.webhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid webhook signature";
      console.error("[StripeWebhook] Signature verification failed:", message);
      res.status(400).json({ error: message });
      return;
    }

    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      res.json({ verified: true });
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.deposit_type === "non_refundable_20_gbp" && session.id) {
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
          await db.markBookingDepositPaid(session.id, paymentIntentId);
          await notifyOwner({
            title: "Eby’s Place deposit paid",
            content: [
              `A £20 booking deposit has been confirmed through Stripe.`,
              `Booking ID: ${session.metadata?.booking_id ?? "Not provided"}`,
              `Service: ${session.metadata?.service_name ?? "Not provided"}`,
              `Customer: ${session.metadata?.customer_name ?? "Not provided"}`,
              `Email: ${session.metadata?.customer_email ?? session.customer_email ?? "Not provided"}`,
              `Stripe session: ${session.id}`,
              paymentIntentId ? `Payment intent: ${paymentIntentId}` : undefined,
            ].filter(Boolean).join("\n"),
          }).catch((error) => console.warn("[StripeWebhook] Owner payment notification failed", error));
        }
      }
      console.log("[StripeWebhook] Processed event", event.type, event.id);
      res.json({ received: true });
    } catch (error) {
      console.error("[StripeWebhook] Failed to process event", event.id, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}
