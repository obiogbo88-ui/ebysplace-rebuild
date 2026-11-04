import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { SLOTS, SLOT_TIMES } from "../social/content";
import type { SlotName } from "../social/store";
import { AUTOMATIONS, automationStates, campaignEmail, campaignRecipients } from "./automations";
import { sendBrandedEmail } from "../resendEmail";
import { listConfiguredAdminEmails } from "../supabaseAuth";
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

  reports: adminProcedure
    .input(z.object({ period: z.enum(["month", "3m", "12m"]).default("12m") }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "12m";
      const today = londonToday();
      const { rows, clients } = await loadClients();
      const db = await crmDb();
      const monthsBack = (n: number) => {
        const out: string[] = [];
        for (let i = n - 1; i >= 0; i--) {
          const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
          d.setUTCMonth(d.getUTCMonth() - i);
          out.push(d.toISOString().slice(0, 7));
        }
        return out;
      };
      const months = monthsBack(12);
      const span = period === "month" ? 1 : period === "3m" ? 3 : 12;
      const all = monthsBack(span * 2);
      const current = new Set(all.slice(span));
      const previous = new Set(all.slice(0, span));
      const monthOf = (v: Date | string) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 7);
      const live = rows.bookings.filter((b) => b.status !== "cancelled");
      const money = (v: string | null) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const PAID_ORDER = new Set(["paid", "fulfilling", "shipped", "completed"]);
      const payments = [
        ...rows.bookings.filter((b) => b.depositStatus === "paid").map((b) => ({ month: monthOf(b.createdAt), amount: money(b.checkoutTotalCharged) })),
        ...rows.orders.filter((o) => PAID_ORDER.has(o.status)).map((o) => ({ month: monthOf(o.createdAt), amount: money(o.checkoutTotalCharged) })),
      ].filter((p) => p.amount > 0);
      const sumIn = (set: Set<string>) => Math.round(payments.filter((p) => set.has(p.month)).reduce((s, p) => s + p.amount, 0) * 100) / 100;
      const countIn = (set: Set<string>) => payments.filter((p) => set.has(p.month)).length;

      const perMonth = months.map((m) => {
        const inMonth = live.filter((b) => b.appointmentDate.slice(0, 7) === m);
        const completed = inMonth.filter((b) => b.status === "completed").length;
        return { month: m, bookings: inMonth.length, completed, upcoming: inMonth.length - completed };
      });
      const styles = new Map<string, number>();
      for (const b of live) if (current.has(b.appointmentDate.slice(0, 7))) styles.set(b.serviceName, (styles.get(b.serviceName) ?? 0) + 1);
      const visited = clients.filter((c) => c.visits >= 1);
      const visits = await db
        .execute(sql`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS m, count(*)::int AS total,
            count(*) FILTER (WHERE coalesce("metadata"::jsonb->>'referrer', '') ILIKE '%instagram%')::int AS instagram
          FROM "analyticsEvents" WHERE "eventName" = 'page_visit' AND "createdAt" >= now() - interval '24 months' GROUP BY 1 ORDER BY 1`)
        .then((r) => r.rows as Array<{ m: string; total: number; instagram: number }>)
        .catch(() => []);
      const visitMap = new Map<string, { m: string; total: number; instagram: number }>(visits.map((v) => [v.m, v] as const));
      const visitsIn = (set: Set<string>, key: "total" | "instagram") => Array.from(set).reduce((s, m) => s + Number(visitMap.get(m)?.[key] ?? 0), 0);

      // From visit to booking, this calendar month: distinct browsing sessions at each step, then deposits actually paid.
      const funnelRow = await db
        .execute(sql`SELECT count(DISTINCT "sessionId")::int AS visited,
            count(DISTINCT "sessionId") FILTER (WHERE "pageUrl" LIKE '/services%')::int AS services,
            count(DISTINCT "sessionId") FILTER (WHERE "pageUrl" LIKE '/book%')::int AS booking
          FROM "activityLogs" WHERE "activityType" = 'website_visit' AND "sessionId" IS NOT NULL AND "createdAt" >= date_trunc('month', now())`)
        .then((r) => (r.rows[0] ?? null) as { visited: number; services: number; booking: number } | null)
        .catch(() => null);
      const thisMonth = today.slice(0, 7);
      const depositsThisMonth = rows.bookings.filter((b) => b.depositStatus === "paid" && monthOf(b.createdAt) === thisMonth).length;

      const recentActivity = await db
        .execute(sql`SELECT "id", "activityType", "activityCategory", "description", "status", "createdAt" FROM "activityLogs"
          WHERE "activityType" <> 'website_visit' AND "activityType" NOT LIKE 'admin\_%' ORDER BY "createdAt" DESC LIMIT 6`)
        .then((r) => r.rows as Array<{ id: number; activityType: string; activityCategory: string; description: string; status: string; createdAt: string }>)
        .catch(() => []);

      const gaps = clients.map((c) => c.averageGapDays).filter((g): g is number => g !== null);
      return {
        period,
        kpis: {
          appointments: { now: live.filter((b) => current.has(b.appointmentDate.slice(0, 7))).length, before: live.filter((b) => previous.has(b.appointmentDate.slice(0, 7))).length },
          paidOnline: { now: sumIn(current), before: sumIn(previous) },
          averagePayment: { now: countIn(current) ? Math.round((sumIn(current) / countIn(current)) * 100) / 100 : null, before: countIn(previous) ? Math.round((sumIn(previous) / countIn(previous)) * 100) / 100 : null },
          visits: { now: visitsIn(current, "total"), before: visitsIn(previous, "total") },
          instagramVisits: { now: visitsIn(current, "instagram"), before: visitsIn(previous, "instagram") },
        },
        months: perMonth.map((p) => ({ ...p, visits: visitMap.get(p.month)?.total ?? 0, instagramVisits: visitMap.get(p.month)?.instagram ?? 0 })),
        topStyles: Array.from(styles.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, bookings: n })),
        rebookRate: visited.length ? Math.round((visited.filter((c) => c.visits >= 2).length / visited.length) * 100) : null,
        averageGapDays: gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null,
        clients: {
          total: clients.length,
          newThisMonth: clients.filter((c) => c.firstSeen.slice(0, 7) === thisMonth).length,
          dueRebook: clients.filter((c) => c.dueRebook).length,
        },
        funnel: funnelRow
          ? [
              { step: "Visited the site", n: Number(funnelRow.visited) || 0 },
              { step: "Looked at Services", n: Number(funnelRow.services) || 0 },
              { step: "Opened the Booking page", n: Number(funnelRow.booking) || 0 },
              { step: "Paid the deposit", n: depositsThisMonth },
            ]
          : null,
        recentActivity,
        clientsSince: rows.bookings.length ? rows.bookings.map((b) => String(b.createdAt).slice(0, 10)).sort()[0] : null,
      };
    }),

  /** The Website & settings overview: health, emails, cookie choices and who can sign in. */
  websiteOverview: adminProcedure.query(async () => {
    const db = await crmDb();
    const one = <T>(q: ReturnType<typeof sql>) => db.execute(q).then((r) => (r.rows[0] ?? null) as T | null).catch(() => null);
    const many = <T>(q: ReturnType<typeof sql>) => db.execute(q).then((r) => r.rows as T[]).catch(() => [] as T[]);
    const [emailStats, recentEmails, cookies, lastChange, adminUsers] = await Promise.all([
      one<{ sent: number; failed: number; lastSent: string | null }>(sql`SELECT
          count(*) FILTER (WHERE "status" = 'sent' AND "createdAt" >= now() - interval '7 days')::int AS sent,
          count(*) FILTER (WHERE "status" = 'failed' AND "createdAt" >= now() - interval '7 days')::int AS failed,
          max("createdAt") FILTER (WHERE "status" = 'sent') AS "lastSent"
        FROM "emailNotificationLogs"`),
      many<{ id: number; subject: string; audience: string; status: string; createdAt: string }>(sql`SELECT "id", "subject", "audience", "status", "createdAt" FROM "emailNotificationLogs" ORDER BY "createdAt" DESC LIMIT 4`),
      one<{ total: number; analytics: number }>(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE "analytics" = 'true')::int AS analytics FROM "cookieConsents" WHERE "createdAt" >= now() - interval '30 days'`),
      one<{ at: string | null }>(sql`SELECT max("createdAt") AS at FROM "activityLogs" WHERE "activityType" LIKE 'admin\_%'`),
      many<{ email: string; name: string | null; lastSignedIn: string | null }>(sql`SELECT lower("email") AS email, "name", "lastSignedIn" FROM "users" WHERE "role" = 'admin' AND "email" IS NOT NULL`),
    ]);
    type AdminUser = { email: string; name: string | null; lastSignedIn: string | null };
    const signIns = new Map<string, AdminUser>((adminUsers as AdminUser[]).map((u) => [u.email, u]));
    return {
      emails: {
        sentThisWeek: Number(emailStats?.sent ?? 0),
        failedThisWeek: Number(emailStats?.failed ?? 0),
        lastSentAt: emailStats?.lastSent ?? null,
        recent: recentEmails,
      },
      cookies30d: { total: Number(cookies?.total ?? 0), analytics: Number(cookies?.analytics ?? 0) },
      lastChangeAt: lastChange?.at ?? null,
      admins: listConfiguredAdminEmails().map((email) => ({ email, name: signIns.get(email)?.name ?? null, lastSignedIn: signIns.get(email)?.lastSignedIn ?? null })),
    };
  }),

  /** Saves the Gallery order: the first photo shows first on the Gallery page and homepage. */
  reorderGallery: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ input }) => {
    const db = await crmDb();
    for (let i = 0; i < input.ids.length; i++) {
      await db.execute(sql`UPDATE "galleryImages" SET "sortOrder" = ${i} WHERE "id" = ${input.ids[i]}`);
    }
    return { saved: input.ids.length };
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

