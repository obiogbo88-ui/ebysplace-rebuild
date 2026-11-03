import { createHmac, timingSafeEqual } from "node:crypto";
import { sendBrandedEmail } from "../resendEmail";
import { sendReviewRequestEmailSafely } from "../customerNotifications";
import * as db from "../db";
import { daysBetween, filterClients, normaliseEmail, type Client, type ClientFilter } from "./clients";
import { loadClients, londonToday } from "./data";
import { automationSettings, claimSend, clientsSwitchedOff, lastSendOf, releaseSend } from "./store";

/**
 * Everything that runs by itself, in one list. The Automations page shows
 * this list; each runner checks its switch before doing anything.
 *
 * `defaultOn` is what happens before Eby has touched the switch: the jobs
 * that already ran before the CRM stay on; the new client-facing emails start
 * off so nothing new reaches clients until she turns it on.
 */
export type AutomationKey =
  | "unconfirmed_reminder"
  | "day_before_reminder"
  | "abandoned_order"
  | "stale_checkout_cleanup"
  | "social_autopilot"
  | "review_ask"
  | "rebook_nudge"
  | "win_back";

export type AutomationInfo = {
  key: AutomationKey | "owner_alerts" | "shop_interest";
  title: string;
  detail: string;
  audience: "Eby" | "Clients" | "Followers" | "Housekeeping";
  when: string;
  defaultOn: boolean;
  switchable: boolean;
  status: "live" | "new" | "needs_meta";
};

export const AUTOMATIONS: AutomationInfo[] = [
  { key: "unconfirmed_reminder", title: "Remind me about unconfirmed bookings", detail: "A nudge to you when a booking is still waiting for your confirmation.", audience: "Eby", when: "Daily, 9am", defaultOn: true, switchable: true, status: "live" },
  { key: "day_before_reminder", title: "Day-before appointment reminder", detail: "Email, SMS and WhatsApp to the client the day before a confirmed appointment.", audience: "Clients", when: "Daily, 9am", defaultOn: true, switchable: true, status: "live" },
  { key: "abandoned_order", title: "Unfinished shop checkout reminder", detail: "One email to a shopper who started checkout and didn't pay.", audience: "Clients", when: "Daily, 9am", defaultOn: true, switchable: true, status: "live" },
  { key: "stale_checkout_cleanup", title: "Clear old unpaid checkouts", detail: "Tidies away checkouts that were never paid, so your lists stay clean.", audience: "Housekeeping", when: "Daily, 9am", defaultOn: true, switchable: true, status: "live" },
  { key: "owner_alerts", title: "Instant alerts to your phone", detail: "New booking, new chat asking for you, low stock. Always on so you never miss one.", audience: "Eby", when: "As it happens", defaultOn: true, switchable: false, status: "live" },
  { key: "social_autopilot", title: "Social autopilot", detail: "Three Instagram Reels a day, each with its own tune, from your gallery and services.", audience: "Followers", when: "08:00 · 12:30 · 20:00", defaultOn: true, switchable: true, status: "live" },
  { key: "review_ask", title: "Ask for a review the day after", detail: "Sends the review request for you once a booking is marked Completed. Never twice for one booking.", audience: "Clients", when: "Daily, 9am", defaultOn: false, switchable: true, status: "new" },
  { key: "rebook_nudge", title: "Rebook reminder", detail: "Five to eight weeks after a braid, if nothing is booked: one friendly email with your booking link.", audience: "Clients", when: "Daily, 9am", defaultOn: false, switchable: true, status: "new" },
  { key: "win_back", title: "We miss you", detail: "One email to clients who haven't been back for three months.", audience: "Clients", when: "Daily, 9am", defaultOn: false, switchable: true, status: "new" },
  { key: "shop_interest", title: "Tag shop interest from Instagram answers", detail: "Reads answers to the accessory question posts and tags who wants what. Needs the Instagram comments permission in Meta.", audience: "Followers", when: "When someone answers", defaultOn: false, switchable: false, status: "needs_meta" },
];

const DEFAULTS = Object.fromEntries(AUTOMATIONS.map((a) => [a.key, a.defaultOn])) as Record<string, boolean>;

/** Fails open for jobs that ran before the CRM existed (so a database blip never stops reminders) and closed for the new ones. */
export async function isAutomationOn(key: AutomationKey): Promise<boolean> {
  try {
    const settings = await automationSettings();
    return settings[key] ?? DEFAULTS[key] ?? false;
  } catch (err) {
    console.warn(`[CRM] Could not read the ${key} switch; using its default`, err);
    return DEFAULTS[key] ?? false;
  }
}

export async function automationStates() {
  let settings: Record<string, boolean> = {};
  try {
    settings = await automationSettings();
  } catch {
    // shown with defaults
  }
  return AUTOMATIONS.map((a) => ({ ...a, enabled: a.switchable ? (settings[a.key] ?? a.defaultOn) : a.defaultOn }));
}

/** Runs a daily job only when its switch is on. */
export async function ifOn<T>(key: AutomationKey, run: () => Promise<T>): Promise<T | { skipped: string }> {
  return (await isAutomationOn(key)) ? run() : { skipped: `${key} is switched off in the CRM` };
}

// ---- unsubscribe links -------------------------------------------------

const SITE = "https://www.ebysplace.com";

function unsubscribeSecret() {
  return String(process.env.CRM_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "").trim();
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

export function unsubscribeSignature(clientKey: string, secret = unsubscribeSecret()) {
  return createHmac("sha256", secret).update(`unsubscribe:${clientKey}`).digest("base64url").slice(0, 32);
}

export function unsubscribeUrl(clientKey: string, secret = unsubscribeSecret()) {
  return `${SITE}/api/crm/unsubscribe?c=${b64url(clientKey)}&s=${unsubscribeSignature(clientKey, secret)}`;
}

export function verifyUnsubscribe(c: string, s: string, secret = unsubscribeSecret()): string | null {
  if (!secret || !c || !s) return null;
  let key: string;
  try {
    key = Buffer.from(c, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!/^[ep]:/.test(key)) return null;
  const want = Buffer.from(unsubscribeSignature(key, secret));
  const got = Buffer.from(s);
  return want.length === got.length && timingSafeEqual(want, got) ? key : null;
}

// ---- the new client emails ---------------------------------------------

const MAX_PER_RUN = 25;

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function rebookEmail(client: Pick<Client, "key" | "name" | "usualStyle" | "lastVisit">) {
  const style = client.usualStyle ? `your ${client.usualStyle}` : "your braids";
  return {
    subject: "Time for a fresh set?",
    paragraphs: [
      `Hi ${firstName(client.name)},`,
      `It's been a few weeks since ${style} at Eby's Place. Most styles are ready for a refresh around now, before the roots start to feel tight or fuzzy.`,
      `If you'd like the same again or fancy something new, you can pick a time here: ${SITE}/booking`,
      "Thank you for choosing Eby's Place.",
      `Don't want these reminders? Unsubscribe here: ${unsubscribeUrl(client.key)}`,
    ],
  };
}

export function winBackEmail(client: Pick<Client, "key" | "name">) {
  return {
    subject: "We miss you at Eby's Place",
    paragraphs: [
      `Hi ${firstName(client.name)},`,
      "It's been a while since your last visit and we'd love to see you again.",
      `Have a look at what's new and book a time that suits you: ${SITE}/booking`,
      "Thank you, and hope to see you soon.",
      `Don't want emails like this? Unsubscribe here: ${unsubscribeUrl(client.key)}`,
    ],
  };
}

/**
 * Who a group email goes to: clients with an email who have booked, bought
 * or joined the list (an existing relationship), minus anyone who
 * unsubscribed. Chat-only visitors are left out.
 */
export function campaignRecipients(clients: Client[], filter: ClientFilter, today: string) {
  return filterClients(clients, filter, "", today).filter((c) => c.email && !c.marketingOptOut && (c.bookings > 0 || c.orders > 0 || c.subscriber));
}

/** Eby's own words, split into paragraphs, with a greeting and a one-click unsubscribe line. */
export function campaignEmail(client: Pick<Client, "key" | "name">, subject: string, message: string) {
  const paragraphs = message
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
  const url = unsubscribeUrl(client.key);
  return {
    subject,
    paragraphs: [`Hi ${firstName(client.name)},`, ...paragraphs, `Don't want emails like this? Unsubscribe here: ${url}`],
    headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export const WIN_BACK_DAYS = { from: 90, to: 150 } as const;

async function sendOnce(automation: AutomationKey, client: Client, refId: string, email: { subject: string; paragraphs: string[] }) {
  if (!(await claimSend(automation, client.key, refId, "email"))) return "already sent";
  const result = await sendBrandedEmail({
    to: client.email!,
    subject: email.subject,
    paragraphs: email.paragraphs,
    headers: { "List-Unsubscribe": `<${unsubscribeUrl(client.key)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  if (!result.sent) {
    await releaseSend(automation, refId); // try again tomorrow
    return `failed: ${result.errorMessage}`;
  }
  return "sent";
}

export async function runRebookNudges(today = londonToday()) {
  const { clients } = await loadClients();
  const off = await clientsSwitchedOff("rebook_nudge");
  const due = clients.filter((c) => c.dueRebook && c.email && !c.marketingOptOut && !off.has(c.key)).slice(0, MAX_PER_RUN);
  const results: Record<string, string> = {};
  for (const c of due) results[c.key] = await sendOnce("rebook_nudge", c, `rebook:${c.key}:${c.lastVisit}`, rebookEmail(c));
  return { checked: clients.length, due: due.length, results: tally(results), today };
}

export async function runWinBack(today = londonToday()) {
  const { clients } = await loadClients();
  const off = await clientsSwitchedOff("win_back");
  const out: Record<string, string> = {};
  let n = 0;
  for (const c of clients) {
    if (n >= MAX_PER_RUN) break;
    if (!c.email || c.marketingOptOut || off.has(c.key) || c.nextAppointment || !c.lastVisit) continue;
    const gap = daysBetween(c.lastVisit, today);
    if (gap < WIN_BACK_DAYS.from || gap > WIN_BACK_DAYS.to) continue;
    // Give a recent rebook reminder room to work before writing again.
    const lastNudge = await lastSendOf("rebook_nudge", c.key);
    if (lastNudge && daysBetween(String(lastNudge).slice(0, 10), today) < 30) continue;
    n += 1;
    out[c.key] = await sendOnce("win_back", c, `winback:${c.key}:${c.lastVisit}`, winBackEmail(c));
  }
  return { sent: tally(out), today };
}

/** The review request Eby used to send by hand, sent for her the day after a booking is marked Completed (looks back a week, never older). */
export async function runAutoReviewAsks(today = londonToday()) {
  const { rows } = await loadClients();
  const off = await clientsSwitchedOff("review_ask");
  const out: Record<string, string> = {};
  const due = rows.bookings
    .filter((b) => b.status === "completed" && !b.reviewRequestSentAt && normaliseEmail(b.clientEmail))
    .filter((b) => {
      const age = daysBetween(b.appointmentDate, today);
      return age >= 1 && age <= 7;
    })
    .slice(0, MAX_PER_RUN);
  for (const b of due) {
    const key = `e:${normaliseEmail(b.clientEmail)}`;
    if (off.has(key)) continue;
    if (!(await claimSend("review_ask", key, `booking:${b.id}`, "email"))) {
      out[b.id] = "already sent";
      continue;
    }
    const result = await sendReviewRequestEmailSafely({ to: b.clientEmail, customerName: b.clientName, bookingId: b.id, serviceName: b.serviceName });
    if (result.sent) {
      await db.markReviewRequestSent(b.id);
      out[b.id] = "sent";
    } else {
      await releaseSend("review_ask", `booking:${b.id}`);
      out[b.id] = `failed: ${result.reason}`;
    }
  }
  return { due: due.length, results: tally(out), today };
}

function tally(results: Record<string, string>) {
  const counts: Record<string, number> = {};
  for (const v of Object.values(results)) {
    const k = v.startsWith("failed") ? "failed" : v;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}
