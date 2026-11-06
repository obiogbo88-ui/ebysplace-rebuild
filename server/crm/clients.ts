/**
 * The CRM's idea of a "client": one person, however many times they have
 * booked, bought, chatted or signed up. Nothing here is stored twice. The
 * rows come straight from the tables the website already writes to and are
 * joined in memory by email (lower-cased), falling back to phone digits.
 *
 * Everything in this file is pure so it can be tested without a database;
 * loading the rows lives in ./data.ts.
 */

export type BookingRow = {
  id: number;
  serviceName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  city: string | null;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  depositStatus: string;
  checkoutTotalCharged: string | null;
  reviewRequestSentAt: Date | string | null;
  /** The booking form's list choice; null on bookings made before it existed. */
  joinList?: boolean | null;
  createdAt: Date | string;
};

export type OrderRow = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  city: string | null;
  status: string;
  checkoutTotalCharged: string | null;
  createdAt: Date | string;
  items?: string[];
};

export type ChatRow = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  wantsHuman: string;
  messageCount: number;
  lastMessage?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type SubscriberRow = { id: number; email: string; productAlerts: string; source?: string | null; createdAt: Date | string };

/** A push subscription turned on from the booking confirmed screen. */
export type PushLinkRow = { bookingId: number | null };

/** Where this client stands with the Eby's Place list. */
export type ClientList = {
  status: "on" | "said_no" | "left" | "not_on";
  /** How they joined, when on the list. */
  via: "booking" | "website" | null;
  since: string | null; // YYYY-MM-DD
};

export type CrmExtras = {
  tags: Map<string, string[]>;
  notes: Map<string, { body: string; updatedAt: Date | string }>;
  optedOut: Set<string>;
};

export type ClientStage = "enquiry" | "booked" | "deposit_paid" | "done" | "review_asked" | "due_rebook";

export type Client = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  firstSeen: string;
  lastVisit: string | null; // last completed appointment date
  nextAppointment: { date: string; time: string; serviceName: string; bookingId: number } | null;
  visits: number;
  bookings: number;
  orders: number;
  paidOnline: number; // £ actually charged online: deposits + shop orders
  usualStyle: string | null;
  averageGapDays: number | null;
  subscriber: boolean;
  chats: number;
  stage: ClientStage;
  dueRebook: boolean;
  tags: string[]; // automatic + Eby's own
  ownTags: string[];
  note: string | null;
  marketingOptOut: boolean;
  list: ClientList;
  /** True only when turned on from the booking confirmed screen; other browsers can't be tied to a person. */
  notifications: boolean;
};

const PAID_ORDER = new Set(["paid", "fulfilling", "shipped", "completed"]);

export function normaliseEmail(value: string | null | undefined) {
  const v = (value ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : null;
}

/** UK numbers in either 07… or +447… form collapse to the same digits. */
export function normalisePhone(value: string | null | undefined) {
  let d = (value ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("44")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length >= 9 ? d : null;
}

export function clientKeyFor(email: string | null | undefined, phone: string | null | undefined) {
  const e = normaliseEmail(email);
  if (e) return `e:${e}`;
  const p = normalisePhone(phone);
  return p ? `p:${p}` : null;
}

const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());
const day = (v: Date | string) => iso(v).slice(0, 10);
const money = (v: string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** Braids last roughly 6 weeks: a client is due a rebook 5–8 weeks after their last completed visit, if nothing is booked. */
export const REBOOK_WINDOW_DAYS = { from: 35, to: 56 } as const;

type Acc = {
  names: Array<[string, string]>; // [when, name] newest wins
  email: string | null;
  phone: string | null;
  city: string | null;
  firstSeen: string;
  bookings: BookingRow[];
  orders: OrderRow[];
  chats: ChatRow[];
  subscriber: boolean;
  subs: SubscriberRow[];
};

/**
 * People are linked when they share an email OR a phone number, so someone
 * who booked with their email and chatted with only their phone is one client.
 */
export function buildClients(
  input: { bookings: BookingRow[]; orders: OrderRow[]; chats: ChatRow[]; subscribers: SubscriberRow[]; pushLinks?: PushLinkRow[] },
  extras: CrmExtras = { tags: new Map(), notes: new Map(), optedOut: new Set() },
  today: string = new Date().toISOString().slice(0, 10),
): Client[] {
  const byEmail = new Map<string, Acc>();
  const byPhone = new Map<string, Acc>();
  const all: Acc[] = [];

  const find = (email: string | null | undefined, phone: string | null | undefined): Acc | null => {
    const e = normaliseEmail(email);
    const p = normalisePhone(phone);
    const ea = e ? byEmail.get(e) : undefined;
    const pa = p ? byPhone.get(p) : undefined;
    if (ea && pa && ea !== pa) {
      // Same person seen twice (email-only and phone-only rows): fold the phone record in.
      ea.bookings.push(...pa.bookings);
      ea.orders.push(...pa.orders);
      ea.chats.push(...pa.chats);
      ea.names.push(...pa.names);
      ea.subscriber ||= pa.subscriber;
      ea.subs.push(...pa.subs);
      ea.city ||= pa.city;
      if (pa.firstSeen < ea.firstSeen) ea.firstSeen = pa.firstSeen;
      ea.phone ||= pa.phone;
      byPhone.forEach((v, k) => {
        if (v === pa) byPhone.set(k, ea);
      });
      all.splice(all.indexOf(pa), 1);
    }
    const a = ea || pa || null;
    if (a) {
      if (e && !a.email) a.email = e;
      if (p && !a.phone) a.phone = p;
      if (e) byEmail.set(e, a);
      if (p) byPhone.set(p, a);
      return a;
    }
    if (!e && !p) return null;
    const fresh: Acc = { names: [], email: e, phone: p, city: null, firstSeen: "9999-12-31", bookings: [], orders: [], chats: [], subscriber: false, subs: [] };
    if (e) byEmail.set(e, fresh);
    if (p) byPhone.set(p, fresh);
    all.push(fresh);
    return fresh;
  };
  const seen = (a: Acc, when: Date | string, name?: string | null, city?: string | null) => {
    const d = day(when);
    if (d < a.firstSeen) a.firstSeen = d;
    if (name && name.trim()) a.names.push([iso(when), name.trim()]);
    if (city && city.trim() && !a.city) a.city = city.trim();
  };

  for (const b of input.bookings) {
    const a = find(b.clientEmail, b.clientPhone);
    if (!a) continue;
    a.bookings.push(b);
    seen(a, b.createdAt, b.clientName, b.city);
  }
  for (const o of input.orders) {
    const a = find(o.customerEmail, o.customerPhone);
    if (!a) continue;
    a.orders.push(o);
    seen(a, o.createdAt, o.customerName, o.city);
  }
  for (const c of input.chats) {
    const a = find(c.email, c.phone);
    if (!a) continue;
    a.chats.push(c);
    seen(a, c.createdAt, c.name, c.city);
  }
  for (const s of input.subscribers) {
    const a = find(s.email, null);
    if (!a) continue;
    a.subscriber = true;
    a.subs.push(s);
    seen(a, s.createdAt);
  }

  const pushBookings = new Set((input.pushLinks ?? []).map((r) => r.bookingId).filter((id): id is number => typeof id === "number"));
  return all.map((a) => toClient(a, extras, today, pushBookings)).sort((x, y) => (y.lastActivity > x.lastActivity ? 1 : y.lastActivity < x.lastActivity ? -1 : x.name.localeCompare(y.name))).map(({ lastActivity, ...c }) => c);
}

export function listStanding(a: Pick<Acc, "subs" | "bookings">, optedOut: boolean): ClientList {
  if (optedOut) return { status: "left", via: null, since: null };
  const first = [...a.subs].sort((x, y) => iso(x.createdAt).localeCompare(iso(y.createdAt)))[0];
  if (first) return { status: "on", via: first.source === "booking" ? "booking" : "website", since: day(first.createdAt) };
  const choices = a.bookings.filter((b) => b.joinList != null).sort((x, y) => iso(x.createdAt).localeCompare(iso(y.createdAt)));
  if (choices.at(-1)?.joinList === false) return { status: "said_no", via: null, since: null };
  return { status: "not_on", via: null, since: null };
}

function toClient(a: Acc, extras: CrmExtras, today: string, pushBookings: Set<number> = new Set()): Client & { lastActivity: string } {
  const name = a.names.sort((x, y) => (x[0] < y[0] ? 1 : -1))[0]?.[1] ?? (a.email ? a.email.split("@")[0] : "Unknown");
  const live = a.bookings.filter((b) => b.status !== "cancelled");
  const completed = live.filter((b) => b.status === "completed").sort((x, y) => x.appointmentDate.localeCompare(y.appointmentDate));
  const upcoming = live
    .filter((b) => b.status !== "completed" && b.appointmentDate >= today)
    .sort((x, y) => (x.appointmentDate + x.appointmentTime).localeCompare(y.appointmentDate + y.appointmentTime));
  const lastVisit = completed.at(-1)?.appointmentDate ?? null;
  const gaps = completed.slice(1).map((b, i) => daysBetween(completed[i].appointmentDate, b.appointmentDate));
  const averageGapDays = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;

  const styleCount = new Map<string, number>();
  for (const b of completed.length ? completed : live) styleCount.set(b.serviceName, (styleCount.get(b.serviceName) ?? 0) + 1);
  const usualStyle = Array.from(styleCount.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;

  const deposits = a.bookings.filter((b) => b.depositStatus === "paid").reduce((s, b) => s + money(b.checkoutTotalCharged), 0);
  const paidOrders = a.orders.filter((o) => PAID_ORDER.has(o.status));
  const paidOnline = Math.round((deposits + paidOrders.reduce((s, o) => s + money(o.checkoutTotalCharged), 0)) * 100) / 100;

  const sinceLast = lastVisit ? daysBetween(lastVisit, today) : null;
  const dueRebook = !upcoming.length && sinceLast !== null && sinceLast >= REBOOK_WINDOW_DAYS.from && sinceLast <= REBOOK_WINDOW_DAYS.to;
  const lastReviewAsked = completed.filter((b) => b.reviewRequestSentAt).length > 0 && completed.at(-1)?.reviewRequestSentAt;

  let stage: ClientStage;
  if (upcoming.length) stage = upcoming.some((b) => b.depositStatus === "paid") ? "deposit_paid" : "booked";
  else if (dueRebook) stage = "due_rebook";
  else if (completed.length) stage = lastReviewAsked ? "review_asked" : "done";
  else stage = "enquiry";

  const auto: string[] = [];
  if (completed.length >= 3) auto.push("Regular");
  else if (completed.length === 1) auto.push("First visit");
  if (paidOrders.length) auto.push("Shop customer");
  if (a.subscriber) auto.push("Subscriber");
  if (!a.bookings.length && !a.orders.length && a.chats.length) auto.push("Chat enquiry");
  if (dueRebook) auto.push("Due a rebook");
  const key = a.email ? `e:${a.email}` : `p:${a.phone}`;
  const ownTags = extras.tags.get(key) ?? [];

  const activity = [
    ...a.bookings.map((b) => iso(b.createdAt)),
    ...a.orders.map((o) => iso(o.createdAt)),
    ...a.chats.map((c) => iso(c.updatedAt)),
    a.firstSeen,
  ].sort();

  return {
    // Email wins as the stable key once we know it; phone-only people keep a phone key.
    key: a.email ? `e:${a.email}` : `p:${a.phone}`,
    name,
    email: a.email,
    phone: a.phone ? displayPhone(a.bookings, a.orders, a.chats) : null,
    city: a.city,
    firstSeen: a.firstSeen,
    lastVisit,
    nextAppointment: upcoming[0] ? { date: upcoming[0].appointmentDate, time: upcoming[0].appointmentTime, serviceName: upcoming[0].serviceName, bookingId: upcoming[0].id } : null,
    visits: completed.length,
    bookings: live.length,
    orders: paidOrders.length,
    paidOnline,
    usualStyle,
    averageGapDays,
    subscriber: a.subscriber,
    chats: a.chats.length,
    stage,
    dueRebook,
    tags: [...auto, ...ownTags.filter((t) => !auto.includes(t))],
    ownTags,
    note: extras.notes.get(key)?.body ?? null,
    marketingOptOut: extras.optedOut.has(key),
    list: listStanding(a, extras.optedOut.has(key)),
    notifications: a.bookings.some((b) => pushBookings.has(b.id)),
    lastActivity: activity.at(-1) ?? a.firstSeen,
  };
}

/** Show the number the client actually typed most recently, not our normalised digits. */
function displayPhone(bookings: BookingRow[], orders: OrderRow[], chats: ChatRow[]) {
  const typed = [
    ...bookings.map((b) => [iso(b.createdAt), b.clientPhone] as const),
    ...orders.map((o) => [iso(o.createdAt), o.customerPhone ?? ""] as const),
    ...chats.map((c) => [iso(c.updatedAt), c.phone ?? ""] as const),
  ]
    .filter(([, p]) => normalisePhone(p))
    .sort((x, y) => (x[0] < y[0] ? 1 : -1));
  return typed[0]?.[1].trim() ?? null;
}

export type JourneyCounts = Record<ClientStage, number>;

export function journeyCounts(clients: Client[]): JourneyCounts {
  const out: JourneyCounts = { enquiry: 0, booked: 0, deposit_paid: 0, done: 0, review_asked: 0, due_rebook: 0 };
  for (const c of clients) out[c.stage] += 1;
  return out;
}

export type ClientFilter = "all" | "regulars" | "due_rebook" | "shop" | "subscribers" | "new_this_month" | "enquiries";

export function filterClients(clients: Client[], filter: ClientFilter, search = "", today = new Date().toISOString().slice(0, 10)) {
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  return clients.filter((c) => {
    if (filter === "regulars" && c.visits < 3) return false;
    if (filter === "due_rebook" && !c.dueRebook) return false;
    if (filter === "shop" && !(c.orders > 0 || c.ownTags.some((t) => /shop|bonnet|accessor|product/i.test(t)))) return false;
    if (filter === "subscribers" && !c.subscriber) return false;
    if (filter === "new_this_month" && c.firstSeen.slice(0, 7) !== today.slice(0, 7)) return false;
    if (filter === "enquiries" && c.stage !== "enquiry") return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").includes(q) ||
      (qDigits.length >= 4 && (normalisePhone(c.phone) ?? "").includes(qDigits.replace(/^0/, "").replace(/^44/, ""))) ||
      (c.usualStyle ?? "").toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export type TimelineItem = {
  at: string; // ISO
  kind: "booking" | "order" | "chat" | "review_ask" | "subscribed" | "note" | "automation" | "email";
  title: string;
  detail: string;
  status?: string;
};

/** Every booking this person made, soonest upcoming first, then the most recent past ones. */
export function clientBookings(client: Pick<Client, "email" | "phone">, bookings: BookingRow[], today: string) {
  const myEmail = normaliseEmail(client.email);
  const myPhone = normalisePhone(client.phone);
  const mine = bookings.filter((b) => {
    const ek = normaliseEmail(b.clientEmail);
    const pk = normalisePhone(b.clientPhone);
    return Boolean((myEmail && ek === myEmail) || (myPhone && pk === myPhone));
  });
  const rows = mine.map((b) => ({
    id: b.id,
    serviceName: b.serviceName,
    date: b.appointmentDate,
    time: String(b.appointmentTime).slice(0, 5),
    status: b.status,
    depositStatus: b.depositStatus,
    bookedOn: iso(b.createdAt).slice(0, 10),
    upcoming: b.appointmentDate >= today && b.status !== "cancelled" && b.status !== "completed",
  }));
  const upcoming = rows.filter((r) => r.upcoming).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = rows.filter((r) => !r.upcoming).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return [...upcoming, ...past];
}

export function clientTimeline(
  client: Pick<Client, "email" | "phone">,
  rows: { bookings: BookingRow[]; orders: OrderRow[]; chats: ChatRow[]; subscribers: SubscriberRow[] },
  extra: { sends?: Array<{ automation: string; sentAt: Date | string; channel: string }>; emails?: Array<{ subject: string; status: string; createdAt: Date | string }> } = {},
): TimelineItem[] {
  const myEmail = normaliseEmail(client.email);
  const myPhone = normalisePhone(client.phone);
  const mine = <T,>(list: T[], e: (r: T) => string | null | undefined, p: (r: T) => string | null | undefined) =>
    list.filter((r) => {
      const ek = normaliseEmail(e(r));
      const pk = normalisePhone(p(r));
      return Boolean((myEmail && ek === myEmail) || (myPhone && pk === myPhone));
    });
  const items: TimelineItem[] = [];
  for (const b of mine(rows.bookings, (r) => r.clientEmail, (r) => r.clientPhone)) {
    items.push({
      at: `${b.appointmentDate}T${/^\d{2}:\d{2}/.test(b.appointmentTime) ? b.appointmentTime.slice(0, 5) : "12:00"}:00.000Z`,
      kind: "booking",
      title: `${b.serviceName}`,
      detail: `${b.appointmentDate} at ${b.appointmentTime} · deposit ${b.depositStatus.replace("_", " ")}`,
      status: b.status,
    });
    if (b.reviewRequestSentAt) items.push({ at: iso(b.reviewRequestSentAt), kind: "review_ask", title: "Review request sent", detail: b.serviceName });
  }
  for (const o of mine(rows.orders, (r) => r.customerEmail, (r) => r.customerPhone)) {
    items.push({ at: iso(o.createdAt), kind: "order", title: `Shop order #${o.id}`, detail: `${(o.items ?? []).join(", ") || "Order"} · £${money(o.checkoutTotalCharged).toFixed(2)}`, status: o.status });
  }
  for (const c of mine(rows.chats, (r) => r.email, (r) => r.phone)) {
    items.push({ at: iso(c.updatedAt), kind: "chat", title: c.wantsHuman === "true" ? "Website chat (asked for Eby)" : "Website chat", detail: c.lastMessage ? `"${c.lastMessage.slice(0, 120)}"` : `${c.messageCount} messages`, status: c.status });
  }
  for (const s of mine(rows.subscribers, (r) => r.email, () => null)) {
    items.push({ at: iso(s.createdAt), kind: "subscribed", title: "Joined the mailing list", detail: s.productAlerts === "true" ? "With product alerts" : "Style openings and tips" });
  }
  for (const s of extra.sends ?? []) items.push({ at: iso(s.sentAt), kind: "automation", title: AUTOMATION_TITLES[s.automation] ?? s.automation, detail: `Sent automatically by ${s.channel}` });
  for (const e of extra.emails ?? []) items.push({ at: iso(e.createdAt), kind: "email", title: e.subject, detail: `Email ${e.status}` });
  return items.sort((x, y) => (x.at < y.at ? 1 : -1));
}

const AUTOMATION_TITLES: Record<string, string> = {
  review_ask: "Review request sent",
  rebook_nudge: "Rebook reminder sent",
  win_back: "We-miss-you email sent",
};
