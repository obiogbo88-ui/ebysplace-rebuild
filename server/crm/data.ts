import { sql } from "drizzle-orm";
import { crmDb, loadExtras } from "./store";
import { buildClients, type BookingRow, type ChatRow, type Client, type OrderRow, type SubscriberRow } from "./clients";

export type CrmRows = { bookings: BookingRow[]; orders: OrderRow[]; chats: ChatRow[]; subscribers: SubscriberRow[] };

/** Every row the CRM reads, straight from the website's own tables. Eby's Place is small enough to load whole. */
export async function loadRows(): Promise<CrmRows> {
  const db = await crmDb();
  const [bookings, orders, items, chats, subscribers] = await Promise.all([
    db.execute(sql`SELECT "id", "serviceName", "clientName", "clientEmail", "clientPhone", "city", "appointmentDate", "appointmentTime",
      "status", "depositStatus", "checkoutTotalCharged", "reviewRequestSentAt", "createdAt" FROM "bookings"`),
    db.execute(sql`SELECT "id", "customerName", "customerEmail", "customerPhone", "city", "status", "checkoutTotalCharged", "createdAt" FROM "orders"
      WHERE "status" <> 'draft'`),
    db.execute(sql`SELECT "orderId", "productName", "variantName", "quantity" FROM "orderItems"`),
    db.execute(sql`SELECT "id", "name", "email", "phone", "city", "status", "wantsHuman", "messageCount", "createdAt", "updatedAt",
      (SELECT e.val->>'content'
         FROM jsonb_array_elements(CASE WHEN jsonb_typeof("transcript"::jsonb) = 'array' THEN "transcript"::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY AS e(val, ord)
         WHERE e.val->>'role' = 'user' ORDER BY e.ord DESC LIMIT 1) AS "lastMessage"
      FROM "chatConversations"`),
    db.execute(sql`SELECT "id", "email", "productAlerts", "createdAt" FROM "newsletterSubscribers"`),
  ]);
  const itemsByOrder = new Map<number, string[]>();
  for (const r of items.rows as Array<{ orderId: number; productName: string; variantName: string | null; quantity: number }>) {
    const label = `${r.quantity > 1 ? `${r.quantity} × ` : ""}${r.productName}${r.variantName ? ` (${r.variantName})` : ""}`;
    itemsByOrder.set(r.orderId, [...(itemsByOrder.get(r.orderId) ?? []), label]);
  }
  return {
    bookings: bookings.rows as BookingRow[],
    orders: (orders.rows as OrderRow[]).map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] })),
    chats: chats.rows as ChatRow[],
    subscribers: subscribers.rows as SubscriberRow[],
  };
}

export function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function loadClients(): Promise<{ rows: CrmRows; clients: Client[] }> {
  const [rows, extras] = await Promise.all([loadRows(), loadExtras()]);
  return { rows, clients: buildClients(rows, extras, londonToday()) };
}
