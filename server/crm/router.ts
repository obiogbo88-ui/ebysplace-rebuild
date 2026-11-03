import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { SLOTS, SLOT_TIMES } from "../social/content";
import type { SlotName } from "../social/store";
import { AUTOMATIONS, automationStates, campaignEmail, campaignRecipients } from "./automations";
import { sendBrandedEmail } from "../resendEmail";
import { clientKeyFor, clientTimeline, filterClients, journeyCounts, type ClientFilter } from "./clients";
import { loadClients, londonToday } from "./data";
import { addTag, clientPrefs, crmDb, recentSends, removeTag, saveNote, sendsFor, setAutomationSetting, setClientPref } from "./store";

const clientKey = z.string().regex(/^[ep]:.{3,320}$/, "Not a client key");
const FILTERS = ["all", "regulars", "due_rebook", "shop", "subscribers", "new_this_month", "enquiries"] as const;
export const CLIENT_SWITCHES = ["reminders", "review_ask", "rebook_nudge", "win_back", "marketing"] as const;

const count = (rows: unknown[]) => Number((rows[0] as any)?.n ?? 0);

export const crmRouter = router({
  overview: adminProcedure.query(async () => {
    const today = londonToday();
    const { rows, clients } = await loadClients();
    const db = await crmDb();
    const [services, reviewsPending, productReviewsPending, social, sends] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS n FROM "services"`),
      db.execute(sql`SELECT count(*)::int AS n FROM "reviews" WHERE "status" = 'pending'`),
      db.execute(sql`SELECT count(*)::int AS n FROM "productReviews" WHERE "status" = 'pending'`),
      db.execute(sql`SELECT "slot", "kind", "status", "slides", "postedAt", "error" FROM "socialPosts" WHERE "slotDate" = ${today}`).catch(() => ({ rows: [] })),
      recentSends(8).catch(() => []),
    ]);
    const live = rows.bookings.filter((b) => b.status !== "cancelled");
    const since30 = Date.now() - 30 * 86_400_000;
    const pending = rows.bookings
      .filter((b) => b.status === "pending" && b.appointmentDate >= today)
      .sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime));
    const chats = rows.chats
      .filter((c) => c.wantsHuman === "true" && c.status === "new")
      .sort((a, b) => (String(b.updatedAt) > String(a.updatedAt) ? 1 : -1));
    const toSend = rows.orders.filter((o) => o.status === "paid" || o.status === "fulfilling");
    const upcoming = live
      .filter((b) => b.status !== "completed" && b.appointmentDate >= today)
      .sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime));
    const posts = (social.rows as any[]).reduce((acc, r) => ({ ...acc, [r.slot]: r }), {} as Record<string, any>);
    return {
      today,
      counts: {
        clients: clients.length,
        bookings: rows.bookings.length,
        bookingsLast30: rows.bookings.filter((b) => new Date(b.createdAt).getTime() >= since30).length,
        upcoming: upcoming.length,
        orders: rows.orders.filter((o) => o.status !== "pending_payment" && o.status !== "cancelled").length,
        subscribers: rows.subscribers.length,
        services: count(services.rows),
        dueRebook: clients.filter((c) => c.dueRebook).length,
      },
      journey: journeyCounts(clients),
      nextAppointments: upcoming.slice(0, 5).map((b) => ({ id: b.id, name: b.clientName, serviceName: b.serviceName, date: b.appointmentDate, time: b.appointmentTime, status: b.status, depositStatus: b.depositStatus, clientKey: keyOf(b.clientEmail, b.clientPhone) })),
      needsYou: {
        pendingBookings: pending.slice(0, 5).map((b) => ({ id: b.id, name: b.clientName, serviceName: b.serviceName, date: b.appointmentDate, time: b.appointmentTime, depositStatus: b.depositStatus })),
        pendingBookingCount: pending.length,
        chats: chats.slice(0, 5).map((c) => ({ id: c.id, name: c.name, lastMessage: c.lastMessage ?? null, updatedAt: c.updatedAt })),
        chatCount: chats.length,
        reviewsPending: count(reviewsPending.rows) + count(productReviewsPending.rows),
        ordersToSend: toSend.length,
      },
      social: SLOTS.map((slot) => ({ slot, time: hhmm(slot), post: posts[slot] ? summarisePost(posts[slot]) : null })),
      recentSends: sends,
    };
  }),

  clients: adminProcedure
    .input(z.object({ filter: z.enum(FILTERS).default("all"), search: z.string().max(120).default("") }))
    .query(async ({ input }) => {
      const today = londonToday();
      const { clients } = await loadClients();
      const counts = Object.fromEntries(FILTERS.map((f) => [f, filterClients(clients, f as ClientFilter, "", today).length]));
      return { clients: filterClients(clients, input.filter, input.search, today), counts };
    }),

  client: adminProcedure.input(z.object({ key: clientKey })).query(async ({ input }) => {
    const { rows, clients } = await loadClients();
    const client = clients.find((c) => c.key === input.key);
    if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "That client isn't on file any more." });
    const db = await crmDb();
    const [sends, prefs, emails] = await Promise.all([
      sendsFor(client.key).catch(() => []),
      clientPrefs(client.key).catch(() => ({})),
      client.email
        ? db.execute(sql`SELECT "subject", "status", "createdAt" FROM "emailNotificationLogs" WHERE lower("recipientEmail") = ${client.email} AND "audience" = 'customer' ORDER BY "createdAt" DESC LIMIT 30`).then((r) => r.rows as any[])
        : Promise.resolve([]),
    ]);
    const switches = Object.fromEntries(CLIENT_SWITCHES.map((k) => [k, (prefs as Record<string, boolean>)[k] ?? true]));
    return { client, timeline: clientTimeline(client, rows, { sends, emails }), switches };
  }),

  saveNote: adminProcedure.input(z.object({ key: clientKey, body: z.string().max(4000) })).mutation(async ({ input }) => {
    await saveNote(input.key, input.body);
    return { success: true };
  }),
  addTag: adminProcedure.input(z.object({ key: clientKey, tag: z.string().trim().min(1).max(40) })).mutation(async ({ input }) => {
    await addTag(input.key, input.tag);
    return { success: true };
  }),
  removeTag: adminProcedure.input(z.object({ key: clientKey, tag: z.string().min(1).max(60) })).mutation(async ({ input }) => {
    await removeTag(input.key, input.tag);
    return { success: true };
  }),
  setClientSwitch: adminProcedure
    .input(z.object({ key: clientKey, automation: z.enum(CLIENT_SWITCHES), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await setClientPref(input.key, input.automation, input.enabled);
      return { success: true };
    }),

  calendar: adminProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.number().int().min(1).max(42).default(7) })).query(async ({ input }) => {
    const { rows } = await loadClients();
    const to = new Date(Date.parse(`${input.from}T12:00:00Z`) + (input.days - 1) * 86_400_000).toISOString().slice(0, 10);
    return {
      from: input.from,
      to,
      today: londonToday(),
      bookings: rows.bookings
        .filter((b) => b.appointmentDate >= input.from && b.appointmentDate <= to && b.status !== "cancelled")
        .sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime))
        .map((b) => ({ id: b.id, date: b.appointmentDate, time: b.appointmentTime, name: b.clientName, serviceName: b.serviceName, status: b.status, depositStatus: b.depositStatus, clientKey: keyOf(b.clientEmail, b.clientPhone) })),
    };
  }),

  automations: adminProcedure.query(async () => ({ automations: await automationStates(), recentSends: await recentSends(15).catch(() => []) })),
  setAutomation: adminProcedure.input(z.object({ key: z.string(), enabled: z.boolean() })).mutation(async ({ input }) => {
    const info = AUTOMATIONS.find((a) => a.key === input.key);
    if (!info || !info.switchable) throw new TRPCError({ code: "BAD_REQUEST", message: "That automation can't be switched here." });
    await setAutomationSetting(input.key, input.enabled);
    return { success: true };
  }),

  social: adminProcedure.query(async () => {
    const db = await crmDb();
    const today = londonToday();
    const res = await db
      .execute(sql`SELECT "id", "slotDate", "slot", "kind", "status", "slides", "caption", "reelUrl", "imageUrls", "igMediaId", "isAiGenerated", "error", "postedAt", "createdAt"
        FROM "socialPosts" WHERE "slotDate" >= ${addDaysIso(today, -14)} ORDER BY "slotDate" DESC, "slot" DESC`)
      .catch(() => ({ rows: [] }));
    const states = await automationStates();
    return {
      today,
      autopilot: states.find((a) => a.key === "social_autopilot")?.enabled ?? true,
      envPaused: /^(1|true|yes)$/i.test(String(process.env.SOCIAL_AUTOPOST_PAUSED || "").trim()),
      instagramConfigured: Boolean(String(process.env.INSTAGRAM_ACCESS_TOKEN || "").trim()),
      facebookConfigured: Boolean(String(process.env.FACEBOOK_PAGE_ID || "").trim()),
      schedule: SLOTS.map((slot) => ({ slot, time: hhmm(slot) })),
      posts: (res.rows as any[]).map((r) => ({ ...summarisePost(r), id: r.id, slotDate: r.slotDate, slot: r.slot, caption: r.caption, reelUrl: r.reelUrl, imageUrl: (r.imageUrls ?? [])[0] ?? null, igMediaId: r.igMediaId, isAiGenerated: r.isAiGenerated, createdAt: r.createdAt })),
    };
  }),
  postNow: adminProcedure.mutation(async () => {
    const { runPublish } = await import("../social/cron");
    const db = await crmDb();
    const today = londonToday();
    const res = await db.execute(sql`SELECT "slot", "status" FROM "socialPosts" WHERE "slotDate" = ${today}`).catch(() => ({ rows: [] }));
    const done = new Set((res.rows as any[]).filter((r) => r.status === "posted").map((r) => r.slot));
    const slot = SLOTS.find((s) => !done.has(s));
    if (!slot) throw new TRPCError({ code: "CONFLICT", message: "All three of today's posts have already gone out. Tomorrow's start at 08:00." });
    const result = (await runPublish(slot as SlotName, true)) as any;
    if (result?.skipped) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Not posted: ${result.skipped}.` });
    const outcome = result?.outcomes?.[0];
    return { slot, outcome };
  }),

  campaignAudience: adminProcedure.input(z.object({ filter: z.enum(FILTERS) })).query(async ({ input }) => {
    const { clients } = await loadClients();
    const recipients = campaignRecipients(clients, input.filter, londonToday());
    return { count: recipients.length, sample: recipients.slice(0, 5).map((c) => c.name), skippedOptOut: clients.filter((c) => c.marketingOptOut).length };
  }),
  sendCampaign: adminProcedure
    .input(z.object({ filter: z.enum(FILTERS), subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(3000), expectedCount: z.number().int().min(1) }))
    .mutation(async ({ input }) => {
      const { clients } = await loadClients();
      const recipients = campaignRecipients(clients, input.filter, londonToday());
      // The preview count must still match, so a list that changed since the preview never surprises Eby.
      if (recipients.length !== input.expectedCount) throw new TRPCError({ code: "CONFLICT", message: `The group changed to ${recipients.length} people since you previewed it. Check the preview again.` });
      let delivered = 0;
      const failed: string[] = [];
      for (let i = 0; i < recipients.length; i++) {
        const c = recipients[i];
        if (i > 0) await new Promise((r) => setTimeout(r, 160)); // stay under Resend's 10/s
        const email = campaignEmail(c, input.subject, input.message);
        const result = await sendBrandedEmail({ to: c.email!, ...email });
        if (result.sent) delivered += 1;
        else failed.push(c.name);
      }
      return { recipientCount: recipients.length, delivered, failed };
    }),

  reports: adminProcedure.query(async () => {
    const today = londonToday();
    const { rows, clients } = await loadClients();
    const db = await crmDb();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    const perMonth = months.map((m) => ({
      month: m,
      bookings: rows.bookings.filter((b) => b.status !== "cancelled" && b.appointmentDate.slice(0, 7) === m).length,
      completed: rows.bookings.filter((b) => b.status === "completed" && b.appointmentDate.slice(0, 7) === m).length,
    }));
    const styles = new Map<string, number>();
    for (const b of rows.bookings) if (b.status !== "cancelled") styles.set(b.serviceName, (styles.get(b.serviceName) ?? 0) + 1);
    const visited = clients.filter((c) => c.visits >= 1);
    const visits = await db
      .execute(sql`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS m, count(*)::int AS total,
          count(*) FILTER (WHERE coalesce("metadata"::jsonb->>'referrer', '') ILIKE '%instagram%')::int AS instagram
        FROM "analyticsEvents" WHERE "eventName" = 'page_visit' AND "createdAt" >= now() - interval '12 months' GROUP BY 1 ORDER BY 1`)
      .then((r) => r.rows as Array<{ m: string; total: number; instagram: number }>)
      .catch(() => []);
    const visitMap = new Map<string, { m: string; total: number; instagram: number }>(visits.map((v) => [v.m, v] as const));
    return {
      months: perMonth.map((p) => ({ ...p, visits: visitMap.get(p.month)?.total ?? 0, instagramVisits: visitMap.get(p.month)?.instagram ?? 0 })),
      topStyles: Array.from(styles.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, bookings: n })),
      rebookRate: visited.length ? Math.round((visited.filter((c) => c.visits >= 2).length / visited.length) * 100) : null,
      averagePaidOnline: clients.length ? Math.round((clients.reduce((s, c) => s + c.paidOnline, 0) / Math.max(1, clients.filter((c) => c.paidOnline > 0).length)) * 100) / 100 : null,
      averageGapDays: (() => {
        const gaps = clients.map((c) => c.averageGapDays).filter((g): g is number => g !== null);
        return gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;
      })(),
      clientsSince: rows.bookings.length ? rows.bookings.map((b) => String(b.createdAt).slice(0, 10)).sort()[0] : null,
    };
  }),
});

const keyOf = (email: string, phone: string) => clientKeyFor(email, phone);

function hhmm(slot: SlotName) {
  const t = SLOT_TIMES[slot];
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

function addDaysIso(date: string, n: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

const KIND_LABEL: Record<string, string> = { motivation: "Motivation", style: "Style spotlight", inspiration: "AI this-or-that", article: "Tips carousel", kouvia: "Kouvia Booking for braiders" };

function summarisePost(r: any) {
  const first = (r.slides ?? [])[0] ?? {};
  const title = first.headline || first.title || first.quote || first.hook || (first.variant ? `Kouvia: ${first.variant}` : "") || KIND_LABEL[r.kind] || r.kind;
  return { kind: r.kind, kindLabel: KIND_LABEL[r.kind] ?? r.kind, title: String(title).slice(0, 90), status: r.status, postedAt: r.postedAt, error: r.error ? String(r.error).slice(0, 200) : null };
}

