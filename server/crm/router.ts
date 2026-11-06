import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { SLOTS, SLOT_TIMES } from "../social/content";
import type { SlotName } from "../social/store";
import { AUTOMATIONS, automationStates, campaignEmail, campaignRecipients } from "./automations";
import { renderBrandedEmail, sendBrandedEmail } from "../resendEmail";
import { ADMIN_INVITE_CTA, ADMIN_INVITE_SUBJECT, adminInviteParagraphs } from "../../shared/adminInvite";
import { getPreferredProductionOrigin, isOwnerEmail, listConfiguredAdminEmails, sendAdminInvite } from "../supabaseAuth";
import { addAdmin, listAddedAdmins, removeAdmin, markInvited, setAdminRole } from "../adminAccess";
import { ASSIGNABLE_ROLES, ROLE_INFO, allows, canSeeMoney, type AdminRole } from "../../shared/adminRoles";
import { clientBookings, clientKeyFor, clientTimeline, filterClients, journeyCounts, type ClientFilter } from "./clients";
import { loadClients, londonToday } from "./data";
import { inviteCandidates, listInvitePreview, sendListInvites } from "./listInvite";
import { leaveListUrl } from "../list";
import { getAvailabilitySettings, logActivity as logDbActivity } from "../db";
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
      recentSends(20).catch(() => []),
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

    // This week (Monday to Sunday) against last week.
    const weekStart = mondayOf(today);
    const lastWeekStart = addDaysIso(weekStart, -7);
    const dayOf = (v: Date | string) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
    const inWeek = (d: string, from: string) => d >= from && d < addDaysIso(from, 7);
    const PAID_ORDER = new Set(["paid", "fulfilling", "shipped", "completed"]);
    const money = (v: string | null) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const paidIn = (from: string) =>
      Math.round(
        (rows.bookings.filter((b) => b.depositStatus === "paid" && inWeek(dayOf(b.createdAt), from)).reduce((s, b) => s + money(b.checkoutTotalCharged), 0) +
          rows.orders.filter((o) => PAID_ORDER.has(o.status) && inWeek(dayOf(o.createdAt), from)).reduce((s, o) => s + money(o.checkoutTotalCharged), 0)) * 100,
      ) / 100;
    const soldIn = (from: string) => Math.round(rows.orders.filter((o) => PAID_ORDER.has(o.status) && inWeek(dayOf(o.createdAt), from)).reduce((s, o) => s + money(o.checkoutTotalCharged), 0) * 100) / 100;
    const weekVisits = await db
      .execute(sql`SELECT count(*) FILTER (WHERE "createdAt" >= ${weekStart}::date)::int AS now,
          count(*) FILTER (WHERE "createdAt" >= ${lastWeekStart}::date AND "createdAt" < ${weekStart}::date)::int AS before
        FROM "analyticsEvents" WHERE "eventName" = 'page_visit' AND "createdAt" >= ${lastWeekStart}::date`)
      .then((r) => (r.rows[0] ?? { now: 0, before: 0 }) as { now: number; before: number })
      .catch(() => ({ now: 0, before: 0 }));

    // Today in the studio: times, how long each style takes, studio or home visit, deposit, new or returning.
    type TodayRow = { id: number; serviceName: string; clientName: string; clientEmail: string; clientPhone: string; appointmentTime: string; status: string; depositStatus: string; city: string | null; serviceLocation?: string | null; duration: string | null };
    const todayRows = await db
      .execute(sql`SELECT b."id", b."serviceName", b."clientName", b."clientEmail", b."clientPhone", b."appointmentTime", b."status", b."depositStatus", b."city", b."serviceLocation", s."duration"
        FROM "bookings" b LEFT JOIN "services" s ON s."name" = b."serviceName"
        WHERE b."appointmentDate" = ${today} AND b."status" <> 'cancelled' ORDER BY b."appointmentTime"`)
      .then((r) => r.rows as TodayRow[])
      .catch(() =>
        db
          .execute(sql`SELECT "id", "serviceName", "clientName", "clientEmail", "clientPhone", "appointmentTime", "status", "depositStatus", "city", NULL AS "duration"
            FROM "bookings" WHERE "appointmentDate" = ${today} AND "status" <> 'cancelled' ORDER BY "appointmentTime"`)
          .then((r) => r.rows as TodayRow[])
          .catch(() => [] as TodayRow[]),
      );
    const byKey = new Map(clients.map((c) => [c.key, c] as const));
    const tomorrow = addDaysIso(today, 1);
    const tomorrowRows = live.filter((b) => b.appointmentDate === tomorrow).sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
    return {
      week: {
        appointments: { now: live.filter((b) => inWeek(b.appointmentDate, weekStart)).length, before: live.filter((b) => inWeek(b.appointmentDate, lastWeekStart)).length },
        paidOnline: { now: paidIn(weekStart), before: paidIn(lastWeekStart) },
        newClients: { now: clients.filter((c) => inWeek(c.firstSeen.slice(0, 10), weekStart)).length, before: clients.filter((c) => inWeek(c.firstSeen.slice(0, 10), lastWeekStart)).length },
        visits: { now: Number(weekVisits.now) || 0, before: Number(weekVisits.before) || 0 },
      },
      todayList: todayRows.map((b) => {
        const key = keyOf(b.clientEmail, b.clientPhone);
        const client = byKey.get(key);
        return {
          id: Number(b.id),
          time: String(b.appointmentTime).slice(0, 5),
          name: b.clientName,
          serviceName: b.serviceName,
          duration: b.duration ?? null,
          homeVisit: b.serviceLocation === "home_service",
          city: b.city,
          status: b.status,
          depositStatus: b.depositStatus,
          returning: (client?.visits ?? 0) > (b.status === "completed" ? 1 : 0),
          phone: b.clientPhone,
          clientKey: key,
        };
      }),
      tomorrow: { count: tomorrowRows.length, first: tomorrowRows[0] ? { time: tomorrowRows[0].appointmentTime, serviceName: tomorrowRows[0].serviceName } : null },
      shop: { toSend: toSend.length, soldThisWeek: soldIn(weekStart) },
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
      nextAppointments: upcoming.slice(0, 20).map((b) => ({ id: b.id, name: b.clientName, serviceName: b.serviceName, date: b.appointmentDate, time: b.appointmentTime, status: b.status, depositStatus: b.depositStatus, clientKey: keyOf(b.clientEmail, b.clientPhone) })),
      needsYou: {
        pendingBookings: pending.slice(0, 20).map((b) => ({ id: b.id, name: b.clientName, serviceName: b.serviceName, date: b.appointmentDate, time: b.appointmentTime, depositStatus: b.depositStatus })),
        pendingBookingCount: pending.length,
        chats: chats.slice(0, 20).map((c) => ({ id: c.id, name: c.name, lastMessage: c.lastMessage ?? null, updatedAt: c.updatedAt })),
        chatCount: chats.length,
        reviewsPending: count(reviewsPending.rows) + count(productReviewsPending.rows),
        ordersToSend: toSend.length,
      },
      social: SLOTS.map((slot) => ({ slot, time: hhmm(slot), post: posts[slot] ? summarisePost(posts[slot]) : null })),
      // Show the client's name, not their email address or an internal key.
      recentSends: (sends as Array<{ automation: string; clientKey: string; channel: string; sentAt: string }>).map((s) => ({ ...s, clientName: clients.find((c) => c.key === s.clientKey)?.name ?? null })),
    };
  }),

  clients: adminProcedure
    .input(z.object({ filter: z.enum(FILTERS).default("all"), search: z.string().max(120).default("") }))
    .query(async ({ input }) => {
      const today = londonToday();
      const { clients } = await loadClients();
      const counts = Object.fromEntries(FILTERS.map((f) => [f, filterClients(clients, f as ClientFilter, "", today).length]));
      const list = {
        on: clients.filter((c) => c.list.status === "on").length,
        joinedAtBooking: clients.filter((c) => c.list.via === "booking").length,
        left: clients.filter((c) => c.list.status === "left").length,
        notifications: clients.filter((c) => c.notifications).length,
      };
      return { clients: filterClients(clients, input.filter, input.search, today), counts, list };
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
    return { client, timeline: clientTimeline(client, rows, { sends, emails }), switches, appointments: clientBookings(client, rows.bookings, londonToday()) };
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

  automations: adminProcedure.query(async () => {
    const [automations, sends, { clients }] = await Promise.all([automationStates(), recentSends(15).catch(() => []), loadClients()]);
    // The client's name, not their email address or an internal key.
    return { automations, recentSends: sends.map((s) => ({ ...s, clientName: clients.find((c) => c.key === s.clientKey)?.name ?? null })) };
  }),
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
      threadsConfigured: Boolean(String(process.env.THREADS_ACCESS_TOKEN || "").trim()),
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

  /** Past paying customers who can be invited to join the list (Campaigns page). */
  listInvite: adminProcedure.query(async () => {
    const { clients } = await loadClients();
    const candidates = inviteCandidates(clients);
    const notOnList = clients.filter((c) => c.email && c.paidOnline > 0 && c.list.status !== "on").length;
    return { candidates, notOnList, preview: listInvitePreview(candidates.find((c) => !c.waiting)?.name ?? "there") };
  }),
  sendListInvite: adminProcedure
    .input(z.object({ keys: z.array(clientKey).min(1).max(200) }))
    .mutation(async ({ input }) => {
      const { clients } = await loadClients();
      const allowed = new Set(inviteCandidates(clients).map((c) => c.key));
      const wanted = new Set(input.keys);
      // Only people still eligible right now: anyone who joined, left or was invited since the page loaded is skipped.
      const people = clients.filter((c) => wanted.has(c.key) && allowed.has(c.key));
      if (!people.length) throw new TRPCError({ code: "CONFLICT", message: "Nobody you ticked can be invited any more. Refresh the page." });
      const result = await sendListInvites(people, leaveListUrl);
      await logDbActivity({
        activityType: "list_invite_sent",
        activityCategory: "newsletter",
        description: `List invite sent to ${result.sent.length} of ${people.length}`,
        status: result.failed.length ? "failed" : "success",
        pageUrl: "/admin",
        metadata: { sent: result.sent, failed: result.failed.map((f) => f.name), skipped: result.skipped },
      }).catch(() => undefined);
      return { attempted: people.length, sent: result.sent.length, failed: result.failed, skipped: result.skipped.length + (input.keys.length - people.length) };
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
          WHERE "activityType" <> 'website_visit' AND "activityType" NOT LIKE 'admin\_%' ORDER BY "createdAt" DESC LIMIT 25`)
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
  websiteOverview: adminProcedure.query(async ({ ctx }) => {
    const db = await crmDb();
    const one = <T>(q: ReturnType<typeof sql>) => db.execute(q).then((r) => (r.rows[0] ?? null) as T | null).catch(() => null);
    const many = <T>(q: ReturnType<typeof sql>) => db.execute(q).then((r) => r.rows as T[]).catch(() => [] as T[]);
    const [emailStats, recentEmails, cookies, lastChange, adminUsers] = await Promise.all([
      one<{ sent: number; failed: number; lastSent: string | null }>(sql`SELECT
          count(*) FILTER (WHERE "status" = 'sent' AND "createdAt" >= now() - interval '7 days')::int AS sent,
          count(*) FILTER (WHERE "status" = 'failed' AND "createdAt" >= now() - interval '7 days')::int AS failed,
          max("createdAt") FILTER (WHERE "status" = 'sent') AS "lastSent"
        FROM "emailNotificationLogs"`),
      many<{ id: number; subject: string; audience: string; status: string; createdAt: string }>(sql`SELECT "id", "subject", "audience", "status", "createdAt" FROM "emailNotificationLogs" ORDER BY "createdAt" DESC LIMIT 15`),
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
      admins: [
        ...listConfiguredAdminEmails().map((email) => ({ email, name: signIns.get(email)?.name ?? null, lastSignedIn: signIns.get(email)?.lastSignedIn ?? null, owner: true, role: "owner" as AdminRole, addedBy: null as string | null, invitedAt: null as string | null })),
        ...(await listAddedAdmins().catch(() => []))
          .filter((a) => !isOwnerEmail(a.email))
          .map((a) => ({ email: a.email, name: a.name ?? signIns.get(a.email)?.name ?? null, lastSignedIn: signIns.get(a.email)?.lastSignedIn ?? null, owner: false, role: a.role as AdminRole, addedBy: a.addedBy, invitedAt: a.invitedAt })),
      ],
      canManageAdmins: isOwnerEmail(ctx.user?.email),
    };
  }),

  /** Give someone access to the Command Centre (owners only). Nothing is emailed here. */
  addAdmin: adminProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email().max(320), name: z.string().trim().max(120).optional(), role: z.enum(ASSIGNABLE_ROLES as [string, ...string[]]).default("manager") }))
    .mutation(async ({ input, ctx }) => {
      if (!isOwnerEmail(ctx.user?.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can give access." });
      if (isOwnerEmail(input.email)) throw new TRPCError({ code: "BAD_REQUEST", message: "That email already has owner access." });
      await addAdmin({ email: input.email, name: input.name || null, role: input.role as (typeof ASSIGNABLE_ROLES)[number], addedBy: ctx.user?.email ?? "owner" });
      await logDbActivity({ activityType: "admin_access_added", activityCategory: "admin", description: `Gave Command Centre access to ${input.email} as ${ROLE_INFO[input.role as AdminRole].label}`, userEmail: ctx.user?.email ?? null }).catch(() => {});
      return { ok: true as const };
    }),

  /** Change someone's role (owners only). Takes effect on their next request. */
  setAdminRole: adminProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(ASSIGNABLE_ROLES as [string, ...string[]]) }))
    .mutation(async ({ input, ctx }) => {
      if (!isOwnerEmail(ctx.user?.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can change roles." });
      if (isOwnerEmail(input.email)) throw new TRPCError({ code: "BAD_REQUEST", message: "The owner’s role can’t be changed here." });
      if (!(await listAddedAdmins()).some((a) => a.email === input.email)) throw new TRPCError({ code: "NOT_FOUND", message: "That person doesn’t have access." });
      await setAdminRole(input.email, input.role as (typeof ASSIGNABLE_ROLES)[number]);
      await logDbActivity({ activityType: "admin_role_changed", activityCategory: "admin", description: `Changed ${input.email} to ${ROLE_INFO[input.role as AdminRole].label}`, userEmail: ctx.user?.email ?? null }).catch(() => {});
      return { ok: true as const };
    }),

  /** Who is signed in and what their role lets them do, so the screen can hide what they can't use. */
  me: adminProcedure.query(({ ctx }) => {
    const role = ((ctx.user as { adminRole?: AdminRole }).adminRole ?? "manager") as AdminRole;
    return {
      email: ctx.user?.email ?? null,
      role,
      roleLabel: ROLE_INFO[role].label,
      canSeeMoney: canSeeMoney(role),
      canEditBookings: allows(role, "admin.updateBookingStatus", "mutation"),
      canEditWebsite: allows(role, "admin.updateWebsiteSection", "mutation"),
      canEditShop: allows(role, "admin.updateService", "mutation"),
      canEditMarketing: allows(role, "crm.sendCampaign", "mutation"),
      canEditSettings: allows(role, "crm.somethingElse", "mutation"),
      canManageAccess: role === "owner",
    };
  }),

  /** Take someone's access away (owners only). They're signed out on their next request. */
  removeAdmin: adminProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email() }))
    .mutation(async ({ input, ctx }) => {
      if (!isOwnerEmail(ctx.user?.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can remove access." });
      if (isOwnerEmail(input.email)) throw new TRPCError({ code: "BAD_REQUEST", message: "Owner access is set in the site settings and can’t be removed here." });
      await removeAdmin(input.email);
      await logDbActivity({ activityType: "admin_access_removed", activityCategory: "admin", description: `Removed Command Centre access for ${input.email}`, userEmail: ctx.user?.email ?? null }).catch(() => {});
      return { ok: true as const };
    }),

  /** The invite exactly as it will arrive (branded shell, real logo), for the owner to check before sending. */
  adminInvitePreview: adminProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email() }))
    .query(async ({ input, ctx }) => {
      if (!isOwnerEmail(ctx.user?.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can send invites." });
      const added = (await listAddedAdmins()).find((a) => a.email === input.email);
      const html = renderBrandedEmail({
        subject: ADMIN_INVITE_SUBJECT,
        paragraphs: adminInviteParagraphs({ name: added?.name, invitedBy: ctx.user?.name || "Eby’s Place" }),
        cta: { label: ADMIN_INVITE_CTA, url: getPreferredProductionOrigin() + "/admin/reset-password" },
      });
      return { to: input.email, subject: ADMIN_INVITE_SUBJECT, html };
    }),

  /** Emails the new admin a link to choose their password. Only when the owner presses Send. */
  sendAdminInvite: adminProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email() }))
    .mutation(async ({ input, ctx }) => {
      if (!isOwnerEmail(ctx.user?.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can send invites." });
      const added = (await listAddedAdmins()).find((a) => a.email === input.email);
      if (!added) throw new TRPCError({ code: "NOT_FOUND", message: "Add this person first." });
      await sendAdminInvite({ email: input.email, name: added.name, invitedBy: ctx.user?.name || "Eby’s Place", origin: getPreferredProductionOrigin() });
      await markInvited(input.email);
      await logDbActivity({ activityType: "admin_access_invited", activityCategory: "admin", description: `Sent Command Centre invite to ${input.email}`, userEmail: ctx.user?.email ?? null }).catch(() => {});
      return { ok: true as const };
    }),

  /**
   * What the ready-made announcements fill themselves in with: days with no
   * bookings, a cancelled slot that freed up, the next time blocked off, and
   * the kids' starting price. Nothing is sent from here.
   */
  announcementContext: adminProcedure.query(async () => {
    const today = londonToday();
    const db = await crmDb();
    const { rows } = await loadClients();
    const live = rows.bookings.filter((b) => b.status !== "cancelled");
    const { blockedSlots } = await getAvailabilitySettings().catch(() => ({ blockedSlots: [] as Array<{ date: string; time?: string }> }));
    const wholeDayBlocks = new Set(blockedSlots.filter((s) => !s.time).map((s) => s.date));
    const days = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i + 1)).map((date) => ({
      date,
      bookings: live.filter((b) => b.appointmentDate === date).length,
      blocked: wholeDayBlocks.has(date),
    }));
    const taken = new Set(live.map((b) => `${b.appointmentDate} ${b.appointmentTime}`));
    const opening = rows.bookings
      .filter((b) => b.status === "cancelled" && b.appointmentDate >= today && !taken.has(`${b.appointmentDate} ${b.appointmentTime}`))
      .sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime))[0];
    const futureBlocks = Array.from(wholeDayBlocks).filter((d) => d >= today).sort();
    let closed: { from: string; to: string; reopen: string } | null = null;
    if (futureBlocks.length) {
      let to = futureBlocks[0];
      for (const d of futureBlocks.slice(1)) if (d === addDaysIso(to, 1)) to = d; else break;
      closed = { from: futureBlocks[0], to, reopen: addDaysIso(to, 1) };
    }
    const kids = await db
      .execute(sql`SELECT min("priceFrom"::numeric)::float AS p FROM "services" WHERE ("category" ILIKE '%kid%' OR "name" ILIKE '%kid%') AND "isBookable" = 'true'`)
      .then((r) => (r.rows[0] as { p: number | null } | undefined)?.p ?? null)
      .catch(() => null);
    const recent = await db
      .execute(sql`SELECT "id", "status", "createdAt", "metadata" FROM "activityLogs"
        WHERE "activityType" IN ('admin_announcement_sent', 'admin_announcement_partial_failure') ORDER BY "createdAt" DESC LIMIT 20`)
      .then((r) =>
        (r.rows as Array<{ id: number; status: string; createdAt: string; metadata: any }>).map((row) => {
          const m = typeof row.metadata === "string" ? safeJson(row.metadata) : row.metadata ?? {};
          const ways = [m?.email ? "Email" : null, m?.webPush ? "Phone notification" : null, m?.sms ? "Text" : null, m?.whatsapp ? "WhatsApp" : null].filter(Boolean);
          return { id: Number(row.id), title: String(m?.title ?? "Announcement"), audience: String(m?.audience ?? ""), ways, failed: row.status === "failed", createdAt: row.createdAt };
        }),
      )
      .catch(() => []);
    return { today, days, opening: opening ? { date: opening.appointmentDate, time: String(opening.appointmentTime).slice(0, 5) } : null, closed, kidsFrom: kids, recent };
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

function safeJson(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

/** The Monday of the week a YYYY-MM-DD date falls in. */
function mondayOf(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysIso(date, day === 0 ? -6 : 1 - day);
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

