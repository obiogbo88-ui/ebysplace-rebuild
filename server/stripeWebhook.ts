// @ts-nocheck
import express, { type Application, type Request, type Response } from "express";
import Stripe from "stripe";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { sendCustomerEmailSafely, sendShopOrderPaidEmailSafely, sendCustomerSmsSafely, sendCustomerWhatsAppSafely, sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";

const STUDIO_CONFIRMATION_ADDRESS = "1 Bawden Close, Woolavington, Bridgwater, Somerset, TA7 8HD, England, United Kingdom";

function normalizeStripeKey(value: string | undefined) {
  return value?.trim().replace(/^['\"]|['\"]$/g, "") || "";
}

function getStripeWebhookConfig() {
  const secretKey = [
    normalizeStripeKey(process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY),
    normalizeStripeKey(process.env.STRIPE_SECRET_KEY),
  ].find((key) => key.startsWith("sk_live_")) || [
    normalizeStripeKey(process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY),
    normalizeStripeKey(process.env.STRIPE_SECRET_KEY),
  ].find(Boolean);
  const webhookSecret = normalizeStripeKey(process.env.EBYSPLACE_LIVE_STRIPE_WEBHOOK_SECRET) || normalizeStripeKey(process.env.STRIPE_WEBHOOK_SECRET);
  if (!secretKey || !webhookSecret) return null;
  return { stripe: new Stripe(secretKey), webhookSecret };
}

export function registerStripeWebhook(app: Application) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
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
          const booking = await db.getBookingByCheckoutSession(session.id);
          const remainingBalance = booking?.estimatedPrice != null ? Math.max(Number(booking.estimatedPrice || 0) + Number(booking.homeServiceSurcharge || 0) - 20, 0).toFixed(2) : null;
          const customerConfirmation = `Your Eby’s Place £20 booking deposit has been confirmed. Your appointment for ${booking?.serviceName ?? "your selected service"}${booking?.appointmentDate ? ` on ${booking.appointmentDate}` : ""}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""} is now secured. Stripe will also email the payment receipt to the checkout email address.`;
          const bookingLocation = booking?.serviceLocation ?? session.metadata?.service_location ?? "studio";
          const homeServiceAddress = [booking?.addressLine1, booking?.addressLine2, booking?.city, booking?.county, booking?.postcode].filter(Boolean).join(", ");
          const locationConfirmation = bookingLocation === "home_service"
            ? `Home service address: ${homeServiceAddress || "the address provided during booking"}`
            : `Studio visit address: ${STUDIO_CONFIRMATION_ADDRESS}`;
          await Promise.allSettled([
            sendCustomerSmsSafely({
              to: booking?.clientPhone,
              body: customerConfirmation,
            }),
            sendCustomerWhatsAppSafely({
              to: booking?.clientPhone,
              body: customerConfirmation,
            }),
            sendCustomerEmailSafely({
              to: booking?.clientEmail ?? session.customer_email,
              subject: "Eby’s Place booking deposit confirmed",
              body: [
                `Hi ${booking?.clientName ?? session.metadata?.customer_name ?? "there"},`,
                "Thank you for booking with Eby’s Place.",
                customerConfirmation,
                `Service: ${booking?.serviceName ?? session.metadata?.service_name ?? "selected service"}`,
                `Date and time: ${booking?.appointmentDate ?? "date TBC"}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""}`,
                `Appointment location: ${bookingLocation === "home_service" ? "Home service" : "Eby’s Place studio"}`,
                locationConfirmation,
                "Deposit paid: £20.00 non-refundable booking deposit.",
                remainingBalance ? `Estimated remaining balance due at appointment: £${remainingBalance}.` : "Remaining balance: confirmed by Eby’s Place according to your final service and add-ons.",
                booking?.deliveryNote ? `Booking notes and optional selections:\n${booking.deliveryNote}` : undefined,
                "If anything needs changing, please contact Eby’s Place before your appointment.",
              ].filter(Boolean).join("\n\n"),
            }),
          ]);
          await sendOwnerSmsAndWhatsAppSafely(`Booking deposit paid: ${booking?.clientName ?? session.metadata?.customer_name ?? "Customer"} booked ${booking?.serviceName ?? session.metadata?.service_name ?? "a service"} on ${booking?.appointmentDate ?? "date TBC"} at ${booking?.appointmentTime ?? "time TBC"}. Email: ${booking?.clientEmail ?? session.customer_email ?? "not provided"}`);
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
        if (session.metadata?.order_type === "shop_products" && session.id) {
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
          await db.markOrderPaid(session.id, paymentIntentId);
          const order = await db.getOrderByCheckoutSession(session.id);
          const deliveryAddress = [order?.addressLine1, order?.addressLine2, order?.city, order?.county, order?.postcode].filter(Boolean).join(", ");
          const orderReference = order?.id ?? session.metadata?.order_id ?? "";
          const orderItems = order?.id ? await db.getOrderItemsByOrderId(order.id) : [];
          const itemsSummary = orderItems.length
            ? orderItems.map((item) => `${item.quantity} × ${item.variantName ? `${item.productName} — ${item.variantName}` : item.productName} (£${(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)})`).join("\n")
            : "Items recorded in your Stripe checkout.";
          const totalPaid = orderItems.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.quantity), 0).toFixed(2);
          const orderEmailBody = [
            `Hi ${order?.customerName ?? session.metadata?.customer_name ?? "there"},`,
            "Thank you for shopping with Eby’s Place.",
            `Order reference: #${orderReference}`,
            `Products and quantities:\n${itemsSummary}`,
            orderItems.length ? `Total paid: £${totalPaid}` : "Total paid: confirmed in your Stripe receipt.",
            `Delivery address: ${deliveryAddress || "provided during checkout"}`,
            "Estimated delivery: 3-5 working days after dispatch.",
          ].join("\n\n");
          await Promise.allSettled([
            sendCustomerSmsSafely({
              to: order?.customerPhone,
              body: `Eby's Place has received payment for order #${orderReference}. We will prepare your items and keep you updated.`,
            }),
            sendShopOrderPaidEmailSafely({
              to: order?.customerEmail ?? session.customer_email,
              customerName: order?.customerName ?? session.metadata?.customer_name,
              orderId: orderReference,
              deliveryAddress: deliveryAddress || "provided during checkout",
              itemsSummary: `${itemsSummary}\n\n${orderItems.length ? `Total paid: £${totalPaid}` : "Total paid: confirmed in your Stripe receipt."}\nEstimated delivery: 3-5 working days after dispatch.`,
            }),
            sendOwnerSmsAndWhatsAppSafely(`New Eby's Place shop order paid: ${order?.customerName ?? session.metadata?.customer_name ?? "Customer"}, order #${orderReference}, deliver to ${deliveryAddress || "address on order"}.`),
          ]);
          await notifyOwner({
            title: "Eby’s Place shop order paid",
            content: [
              `A shop product payment has been confirmed through Stripe.`,
              `Order ID: ${session.metadata?.order_id ?? "Not provided"}`,
              `Customer: ${session.metadata?.customer_name ?? "Not provided"}`,
              `Email: ${session.metadata?.customer_email ?? session.customer_email ?? "Not provided"}`,
              `Stripe session: ${session.id}`,
              paymentIntentId ? `Payment intent: ${paymentIntentId}` : undefined,
            ].filter(Boolean).join("\n"),
          }).catch((error) => console.warn("[StripeWebhook] Owner order notification failed", error));
        }
      }
      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("[StripeWebhook] Payment intent succeeded", paymentIntent.id);
      }
      if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const failureMessage = paymentIntent.last_payment_error?.message || "Stripe reported a failed payment attempt.";
        await notifyOwner({
          title: "Eby’s Place payment failed",
          content: [
            `Stripe payment failed for payment intent ${paymentIntent.id}.`,
            `Reason: ${failureMessage}`,
            paymentIntent.receipt_email ? `Customer email: ${paymentIntent.receipt_email}` : undefined,
          ].filter(Boolean).join("\n"),
        }).catch((error) => console.warn("[StripeWebhook] Owner failed-payment notification failed", error));
      }
      console.log("[StripeWebhook] Processed event", event.type, event.id);
      res.json({ received: true });
    } catch (error) {
      console.error("[StripeWebhook] Failed to process event", event.id, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}
