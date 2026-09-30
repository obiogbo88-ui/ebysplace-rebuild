// Money maths for the admin Transactions panel: per-payment Stripe breakdowns and monthly totals by type.
// Kept free of the Stripe client and the database so the arithmetic can be tested directly.

export type PaymentLine = { description: string; quantity: number; amount: number };

export type PaymentBreakdown = {
  currency: string;
  lines: PaymentLine[];
  subtotal: number; // before discounts, what the line items add up to
  discount: number; // promotion codes applied at Stripe Checkout
  shipping: number;
  tax: number;
  total: number; // what the customer actually paid
  stripeFee: number | null; // null when Stripe has not settled the charge yet
  net: number | null; // total minus Stripe fee, i.e. what reaches the bank
};

type SessionLike = {
  currency?: string | null;
  amount_subtotal?: number | null;
  amount_total?: number | null;
  total_details?: { amount_discount?: number | null; amount_shipping?: number | null; amount_tax?: number | null } | null;
};
type LineItemLike = { description?: string | null; quantity?: number | null; amount_subtotal?: number | null; amount_total?: number | null };
type BalanceTransactionLike = { fee?: number | null; net?: number | null } | null | undefined;

const pounds = (pence: number | null | undefined) => Math.round(Number(pence ?? 0)) / 100;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildPaymentBreakdown(session: SessionLike, lineItems: LineItemLike[], balanceTransaction: BalanceTransactionLike): PaymentBreakdown {
  const total = pounds(session.amount_total);
  const hasFee = balanceTransaction?.fee != null;
  return {
    currency: (session.currency || "gbp").toLowerCase(),
    lines: lineItems.map((item) => ({
      description: item.description || "Item",
      quantity: Number(item.quantity ?? 1),
      amount: pounds(item.amount_subtotal ?? item.amount_total), // before discount, so lines add up to the subtotal
    })),
    subtotal: pounds(session.amount_subtotal ?? session.amount_total),
    discount: pounds(session.total_details?.amount_discount),
    shipping: pounds(session.total_details?.amount_shipping),
    tax: pounds(session.total_details?.amount_tax),
    total,
    stripeFee: hasFee ? pounds(balanceTransaction!.fee) : null,
    net: hasFee ? (balanceTransaction!.net != null ? pounds(balanceTransaction!.net) : round2(total - pounds(balanceTransaction!.fee))) : null,
  };
}

export const REPORT_TYPES = ["booking_deposit", "shop_order", "tryon_credits"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

export type MonthlyRow = { month: string; type: string; count: number; gross: number; fees: number; refunded: number; net: number; missingFees: number };
export type MonthTotals = { count: number; gross: number; fees: number; refunded: number; net: number; missingFees: number };
export type MonthReport = { month: string; byType: Record<ReportType, MonthTotals>; total: MonthTotals };

const emptyTotals = (): MonthTotals => ({ count: 0, gross: 0, fees: 0, refunded: 0, net: 0, missingFees: 0 });

function addInto(target: MonthTotals, row: MonthTotals) {
  target.count += row.count;
  target.gross = round2(target.gross + row.gross);
  target.fees = round2(target.fees + row.fees);
  target.refunded = round2(target.refunded + row.refunded);
  target.net = round2(target.net + row.net);
  target.missingFees += row.missingFees;
}

// "YYYY-MM" for the given month offset back from `now` (0 = this month).
function monthKey(now: Date, monthsBack: number) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Turns grouped SQL rows into one entry per month (newest first), with every type present and a grand total.
// Months with no payments still appear so the admin can see a quiet month as £0 rather than a gap.
export function shapeMonthlyTotals(rows: MonthlyRow[], months: number, now: Date = new Date()): MonthReport[] {
  const report: MonthReport[] = [];
  for (let i = 0; i < months; i++) {
    const month = monthKey(now, i);
    const byType = Object.fromEntries(REPORT_TYPES.map((type) => [type, emptyTotals()])) as Record<ReportType, MonthTotals>;
    const total = emptyTotals();
    for (const row of rows) {
      if (row.month !== month || !(REPORT_TYPES as readonly string[]).includes(row.type)) continue;
      addInto(byType[row.type as ReportType], row);
      addInto(total, row);
    }
    report.push({ month, byType, total });
  }
  return report;
}
