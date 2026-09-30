import type Stripe from "stripe";
import * as db from "./db";
import { buildPaymentBreakdown } from "./transactionReport";

// Reads a paid Checkout Session back from Stripe (line items, discount, processing fee) and stores the breakdown.
export async function syncPaymentBreakdown(stripe: Stripe, stripeCheckoutSessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(stripeCheckoutSessionId, {
    expand: ["payment_intent.latest_charge.balance_transaction"],
  });
  const lineItems = await stripe.checkout.sessions.listLineItems(stripeCheckoutSessionId, { limit: 100 });
  const paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = paymentIntent && typeof paymentIntent.latest_charge === "object" ? paymentIntent.latest_charge : null;
  const balanceTransaction = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  const breakdown = buildPaymentBreakdown(session, lineItems.data, balanceTransaction);
  await db.saveTransactionBreakdown(stripeCheckoutSessionId, breakdown);
  if (charge?.amount_refunded && paymentIntent) {
    await db.recordTransactionRefund(paymentIntent.id, charge.amount_refunded / 100, Boolean(charge.refunded));
  }
  return breakdown;
}

// Fills in breakdowns for paid checkouts that do not have one yet. One failure never stops the rest.
export async function syncMissingPaymentBreakdowns(stripe: Stripe, limit = 50) {
  const sessionIds = await db.listTransactionsMissingBreakdown(limit);
  const result = { checked: sessionIds.length, updated: 0, stillPending: 0, failed: 0 };
  for (const sessionId of sessionIds) {
    try {
      const breakdown = await syncPaymentBreakdown(stripe, sessionId);
      if (breakdown.stripeFee == null) result.stillPending += 1;
      else result.updated += 1;
    } catch (error) {
      result.failed += 1;
      console.warn("[Transactions] Could not sync Stripe breakdown", sessionId, error instanceof Error ? error.message : error);
    }
  }
  return result;
}
