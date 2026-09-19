// Collects paid AI Try-On credit purchases from a stream of Stripe Checkout Sessions.
// Kept separate from the Stripe client so the filtering can be tested without network access.
export type TryOnPurchase = {
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  amount: number;
  credits: number;
  customerEmail: string | null;
  paidAt: Date;
};

type SessionLike = {
  id: string;
  created: number;
  amount_total?: number | null;
  payment_status?: string | null;
  payment_intent?: unknown;
  customer_email?: string | null;
  metadata?: Record<string, string> | null;
};

const MAX_SESSIONS_SCANNED = 5000;

export async function collectTryOnPurchases(sessions: AsyncIterable<SessionLike> | Iterable<SessionLike>): Promise<TryOnPurchase[]> {
  const purchases: TryOnPurchase[] = [];
  let scanned = 0;
  for await (const session of sessions as AsyncIterable<SessionLike>) {
    if (++scanned > MAX_SESSIONS_SCANNED) break;
    if (session.metadata?.purchase_type !== "tryon_credits") continue;
    if (session.payment_status !== "paid") continue; // only money actually received
    purchases.push({
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      amount: session.amount_total != null ? Number(session.amount_total) / 100 : 0,
      credits: Number(session.metadata?.credits || 0),
      customerEmail: session.metadata?.customer_email || session.customer_email || null,
      paidAt: new Date(session.created * 1000),
    });
  }
  return purchases;
}
