import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildClients, clientKeyFor, clientTimeline, filterClients, journeyCounts, normalisePhone, type BookingRow, type ChatRow, type OrderRow, type SubscriberRow } from "./clients";
import { AUTOMATIONS, rebookEmail, unsubscribeSignature, unsubscribeUrl, verifyUnsubscribe, winBackEmail } from "./automations";

const TODAY = "2026-11-03";

let id = 0;
function booking(over: Partial<BookingRow>): BookingRow {
  id += 1;
  return {
    id,
    serviceName: "Knotless braids (medium)",
    clientName: "Amaka Obi",
    clientEmail: "amaka@example.com",
    clientPhone: "07700 900123",
    city: "Bridgwater",
    appointmentDate: "2026-09-14",
    appointmentTime: "10:00",
    status: "completed",
    depositStatus: "paid",
    checkoutTotalCharged: "20.00",
    reviewRequestSentAt: null,
    createdAt: "2026-09-01T10:00:00Z",
    ...over,
  };
}
const order = (over: Partial<OrderRow>): OrderRow => ({ id: ++id, customerName: "Amaka Obi", customerEmail: "AMAKA@example.com", customerPhone: null, city: null, status: "paid", checkoutTotalCharged: "24.00", createdAt: "2026-10-02T09:00:00Z", items: ["Satin bonnet"], ...over });
const chat = (over: Partial<ChatRow>): ChatRow => ({ id: ++id, name: "Amaka", email: null, phone: "+44 7700 900123", city: "Taunton", status: "new", wantsHuman: "true", messageCount: 4, lastMessage: "Do you do kids' cornrows?", createdAt: "2026-10-20T18:00:00Z", updatedAt: "2026-10-20T18:05:00Z", ...over });
const sub = (over: Partial<SubscriberRow>): SubscriberRow => ({ id: ++id, email: "amaka@example.com", productAlerts: "true", createdAt: "2026-08-01T08:00:00Z", ...over });

describe("one client per person", () => {
  it("links bookings, orders, chats and sign-ups by email or phone", () => {
    const clients = buildClients(
      {
        bookings: [booking({ appointmentDate: "2026-07-20" }), booking({ appointmentDate: "2026-09-14" })],
        orders: [order({})],
        chats: [chat({})], // phone only, written differently
        subscribers: [sub({})],
      },
      undefined,
      TODAY,
    );
    expect(clients).toHaveLength(1);
    const [c] = clients;
    expect(c.key).toBe("e:amaka@example.com");
    expect(c.visits).toBe(2);
    expect(c.orders).toBe(1);
    expect(c.chats).toBe(1);
    expect(c.subscriber).toBe(true);
    expect(c.paidOnline).toBe(64); // two £20 deposits + £24 order
    expect(c.averageGapDays).toBe(56);
    expect(c.usualStyle).toBe("Knotless braids (medium)");
    expect(c.lastVisit).toBe("2026-09-14");
    expect(c.tags).toEqual(expect.arrayContaining(["Shop customer", "Subscriber", "Due a rebook"]));
  });

  it("folds a phone-only chat into a client who later books with email and phone", () => {
    const clients = buildClients({ bookings: [booking({ createdAt: "2026-10-25T10:00:00Z" })], orders: [], chats: [chat({ createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z" })], subscribers: [] }, undefined, TODAY);
    expect(clients).toHaveLength(1);
    expect(clients[0].firstSeen).toBe("2026-10-01");
  });

  it("merges two records once a later row shows they are the same person", () => {
    const clients = buildClients(
      {
        bookings: [booking({ clientEmail: "zee@example.com", clientPhone: "07123 456789" })],
        orders: [],
        chats: [chat({ phone: "07999 111222", email: null }), chat({ phone: "07999111222", email: "zee@example.com" })],
        subscribers: [],
      },
      undefined,
      TODAY,
    );
    // The first chat (phone 07999…) and the booking (email zee@) are joined by the second chat carrying both.
    expect(clients).toHaveLength(1);
    expect(clients[0].chats).toBe(2);
  });

  it("uses the newest name and keeps different people apart", () => {
    const clients = buildClients(
      {
        bookings: [booking({ clientName: "Amaka", createdAt: "2026-01-01T00:00:00Z" }), booking({ clientName: "Amaka Obi", createdAt: "2026-09-01T00:00:00Z" }), booking({ clientName: "Bisi", clientEmail: "bisi@example.com", clientPhone: "07111 222333" })],
        orders: [],
        chats: [],
        subscribers: [],
      },
      undefined,
      TODAY,
    );
    expect(clients.map((c) => c.name).sort()).toEqual(["Amaka Obi", "Bisi"]);
  });

  it("normalises UK phone numbers written different ways", () => {
    expect(normalisePhone("07700 900123")).toBe(normalisePhone("+44 7700 900123"));
    expect(normalisePhone("0044 7700-900-123")).toBe("7700900123");
    expect(normalisePhone("123")).toBeNull();
    expect(clientKeyFor("not-an-email", "07700900123")).toBe("p:7700900123");
  });
});

describe("journey and rebook", () => {
  it("is due a rebook 5–8 weeks after the last braid, only if nothing is booked", () => {
    const at = (date: string, more: BookingRow[] = []) => buildClients({ bookings: [booking({ appointmentDate: date }), ...more], orders: [], chats: [], subscribers: [] }, undefined, TODAY)[0];
    expect(at("2026-10-01").dueRebook).toBe(false); // 33 days
    expect(at("2026-09-29").dueRebook).toBe(true); // 35 days
    expect(at("2026-09-08").dueRebook).toBe(true); // 56 days
    expect(at("2026-09-07").dueRebook).toBe(false); // 57 days
    expect(at("2026-09-20", [booking({ appointmentDate: "2026-11-10", status: "confirmed" })]).dueRebook).toBe(false);
  });

  it("puts each client in one stage", () => {
    const clients = buildClients(
      {
        bookings: [
          booking({ clientEmail: "a@x.com", clientPhone: "", appointmentDate: "2026-11-10", status: "confirmed", depositStatus: "paid" }),
          booking({ clientEmail: "b@x.com", clientPhone: "", appointmentDate: "2026-11-12", status: "pending", depositStatus: "unpaid" }),
          booking({ clientEmail: "c@x.com", clientPhone: "", appointmentDate: "2026-10-30", reviewRequestSentAt: "2026-10-31T09:00:00Z" }),
          booking({ clientEmail: "d@x.com", clientPhone: "", appointmentDate: "2026-10-30" }),
          booking({ clientEmail: "e@x.com", clientPhone: "", appointmentDate: "2026-09-20" }),
        ],
        orders: [],
        chats: [chat({ email: "f@x.com", phone: null })],
        subscribers: [],
      },
      undefined,
      TODAY,
    );
    expect(journeyCounts(clients)).toEqual({ enquiry: 1, booked: 1, deposit_paid: 1, done: 1, review_asked: 1, due_rebook: 1 });
  });

  it("ignores cancelled bookings", () => {
    const [c] = buildClients({ bookings: [booking({ status: "cancelled", appointmentDate: "2026-11-20" })], orders: [], chats: [], subscribers: [] }, undefined, TODAY);
    expect(c.nextAppointment).toBeNull();
    expect(c.bookings).toBe(0);
    expect(c.stage).toBe("enquiry");
  });
});

describe("filters, search and timeline", () => {
  const rows = {
    bookings: [
      booking({ clientEmail: "reg@x.com", clientName: "Regular Rita", appointmentDate: "2026-05-01" }),
      booking({ clientEmail: "reg@x.com", clientName: "Regular Rita", appointmentDate: "2026-06-15" }),
      booking({ clientEmail: "reg@x.com", clientName: "Regular Rita", appointmentDate: "2026-09-20", serviceName: "Boho knotless" }),
    ],
    orders: [order({ customerEmail: "shop@x.com", customerName: "Shopper Sade" })],
    chats: [],
    subscribers: [sub({ email: "news@x.com", createdAt: "2026-11-01T08:00:00Z" })],
  };
  const clients = buildClients(rows, { tags: new Map([["e:news@x.com", ["Likes satin bonnets"]]]), notes: new Map(), optedOut: new Set() }, TODAY);

  it("filters by the chips on the Clients page", () => {
    expect(filterClients(clients, "regulars", "", TODAY).map((c) => c.name)).toEqual(["Regular Rita"]);
    expect(filterClients(clients, "shop", "", TODAY).map((c) => c.email).sort()).toEqual(["news@x.com", "shop@x.com"]);
    expect(filterClients(clients, "subscribers", "", TODAY).map((c) => c.email)).toEqual(["news@x.com"]);
    expect(filterClients(clients, "new_this_month", "", TODAY).map((c) => c.email)).toEqual(["news@x.com"]);
    expect(filterClients(clients, "due_rebook", "", TODAY).map((c) => c.name)).toEqual(["Regular Rita"]);
  });

  it("searches names, emails, phone digits, styles and tags", () => {
    expect(filterClients(clients, "all", "rita", TODAY)).toHaveLength(1);
    expect(filterClients(clients, "all", "knotless", TODAY)).toHaveLength(1); // usual style
    expect(filterClients(clients, "all", "bonnet", TODAY)).toHaveLength(1);
    expect(filterClients(clients, "all", "07700 900", TODAY).length).toBeGreaterThanOrEqual(1);
  });

  it("builds a newest-first timeline from every source", () => {
    const rita = clients.find((c) => c.name === "Regular Rita")!;
    const items = clientTimeline(rita, rows, { sends: [{ automation: "rebook_nudge", channel: "email", sentAt: "2026-11-02T09:00:00Z" }] });
    expect(items[0].title).toBe("Rebook reminder sent");
    expect(items.filter((i) => i.kind === "booking")).toHaveLength(3);
    expect(items.map((i) => i.at)).toEqual([...items.map((i) => i.at)].sort().reverse());
  });
});

describe("automations", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("signs unsubscribe links so nobody can switch off someone else", () => {
    const url = new URL(unsubscribeUrl("e:amaka@example.com", "secret-1"));
    const c = url.searchParams.get("c")!;
    const s = url.searchParams.get("s")!;
    expect(verifyUnsubscribe(c, s, "secret-1")).toBe("e:amaka@example.com");
    expect(verifyUnsubscribe(c, s, "other-secret")).toBeNull();
    const forged = Buffer.from("e:someone@else.com").toString("base64url");
    expect(verifyUnsubscribe(forged, s, "secret-1")).toBeNull();
    expect(verifyUnsubscribe(c, unsubscribeSignature("e:x@y.com", "secret-1"), "secret-1")).toBeNull();
    expect(verifyUnsubscribe(c, s, "")).toBeNull();
  });

  it("writes short, plain emails with the booking link and an unsubscribe link", () => {
    vi.stubEnv("CRM_UNSUBSCRIBE_SECRET", "s");
    const r = rebookEmail({ key: "e:a@b.com", name: "Amaka Obi", usualStyle: "Knotless braids (medium)", lastVisit: "2026-09-14" });
    expect(r.paragraphs[0]).toBe("Hi Amaka,");
    expect(r.paragraphs.join(" ")).toContain("your Knotless braids (medium)");
    expect(r.paragraphs.join(" ")).toContain("https://www.ebysplace.com/booking");
    expect(r.paragraphs.at(-1)).toContain("/api/crm/unsubscribe?c=");
    const w = winBackEmail({ key: "e:a@b.com", name: "  " });
    expect(w.paragraphs[0]).toBe("Hi there,");
  });

  it("keeps old jobs on and new client emails off until Eby switches them on", () => {
    const by = Object.fromEntries(AUTOMATIONS.map((a) => [a.key, a]));
    for (const k of ["unconfirmed_reminder", "day_before_reminder", "abandoned_order", "stale_checkout_cleanup", "social_autopilot"]) expect(by[k].defaultOn).toBe(true);
    for (const k of ["review_ask", "rebook_nudge", "win_back"]) expect(by[k].defaultOn).toBe(false);
    expect(by.owner_alerts.switchable).toBe(false);
    expect(by.shop_interest.status).toBe("needs_meta");
  });

  it("checks each switch in the daily cron and the social crons", () => {
    const daily = readFileSync("server/dailyAutomations.ts", "utf8");
    for (const k of ["unconfirmed_reminder", "abandoned_order", "day_before_reminder", "stale_checkout_cleanup", "review_ask", "rebook_nudge", "win_back"]) expect(daily).toContain(`ifOn("${k}"`);
    const social = readFileSync("server/social/cron.ts", "utf8");
    expect(social.match(/isAutomationOn\("social_autopilot"\)/g)?.length).toBe(2);
  });
});

describe("review request sent for Eby", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./data");
    vi.doUnmock("./store");
    vi.doUnmock("../customerNotifications");
    vi.doUnmock("../db");
  });

  it("asks once, the day after a completed booking, and frees the claim if the email fails", async () => {
    vi.resetModules();
    const claims = new Set<string>();
    const released: string[] = [];
    const sent: number[] = [];
    vi.doMock("./data", () => ({
      londonToday: () => TODAY,
      loadClients: async () => ({
        rows: {
          bookings: [
            booking({ id: 501, appointmentDate: "2026-11-02" }), // yesterday: ask
            booking({ id: 502, appointmentDate: "2026-11-03" }), // today: too soon
            booking({ id: 503, appointmentDate: "2026-10-20" }), // two weeks: too old
            booking({ id: 504, appointmentDate: "2026-11-01", reviewRequestSentAt: "2026-11-02T09:00:00Z" }), // already asked by hand
            booking({ id: 505, appointmentDate: "2026-11-01", status: "confirmed" }), // not completed
            booking({ id: 506, appointmentDate: "2026-10-31", clientEmail: "fail@example.com" }),
          ],
          orders: [],
          chats: [],
          subscribers: [],
        },
        clients: [],
      }),
    }));
    vi.doMock("./store", () => ({
      automationSettings: async () => ({}),
      clientsSwitchedOff: async () => new Set<string>(),
      claimSend: async (_a: string, _k: string, ref: string) => (claims.has(ref) ? false : (claims.add(ref), true)),
      releaseSend: async (_a: string, ref: string) => {
        released.push(ref);
        claims.delete(ref);
      },
      lastSendOf: async () => null,
    }));
    vi.doMock("../customerNotifications", () => ({
      sendReviewRequestEmailSafely: async (input: { to: string; bookingId: number }) => (input.to.startsWith("fail") ? { sent: false, reason: "bounced" } : (sent.push(input.bookingId), { sent: true })),
    }));
    const marked: number[] = [];
    vi.doMock("../db", () => ({ markReviewRequestSent: async (bid: number) => marked.push(bid) }));
    const { runAutoReviewAsks } = await import("./automations");

    const first = await runAutoReviewAsks(TODAY);
    expect(sent).toEqual([501]);
    expect(marked).toEqual([501]);
    expect(released).toEqual(["booking:506"]);
    expect(first.results).toEqual({ sent: 1, failed: 1 });

    const again = await runAutoReviewAsks(TODAY);
    expect(sent).toEqual([501]); // never twice
    expect(again.results).toEqual({ "already sent": 1, failed: 1 });
  });
});
