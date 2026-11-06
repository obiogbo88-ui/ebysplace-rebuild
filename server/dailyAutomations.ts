import type { Application, Request, Response } from "express";
import { runUnconfirmedBookingReminders } from "./bookingReminders";
import { runAbandonedOrderReminders } from "./orderReminders";
import { runDayBeforeAppointmentReminders } from "./appointmentReminders";
import { cleanupOldRateLimitBuckets } from "./db";
import { runStaleUnpaidCheckoutCleanup } from "./staleCheckoutCleanup";
import { ifOn, runAutoReviewAsks, runRebookNudges, runWinBack } from "./crm/automations";
import { runRebookFollowUps } from "./rebookFollowUps";

const CRON_PATH = "/api/cron/daily-reminders";

function isAuthorizedCronRequest(req: Request) {
  const expected = String(process.env.CRON_SECRET || "").trim();
  if (!expected) return false;
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return provided === expected;
}

/**
 * Single daily cron (see vercel.json "crons") that runs every scheduled
 * reminder check. Consolidated into one endpoint/one cron entry rather than
 * one per automation, since they all run on the same daily schedule anyway.
 * Each check is independent and wrapped so one failing doesn't stop the
 * others.
 */
export function registerDailyAutomationsCron(app: Application) {
  app.get(CRON_PATH, async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Each job checks its own switch on the CRM's Automations page first.
    const results = await Promise.allSettled([
      ifOn("unconfirmed_reminder", runUnconfirmedBookingReminders),
      ifOn("abandoned_order", runAbandonedOrderReminders),
      ifOn("day_before_reminder", runDayBeforeAppointmentReminders),
      cleanupOldRateLimitBuckets(),
      ifOn("stale_checkout_cleanup", runStaleUnpaidCheckoutCleanup),
      ifOn("review_ask", () => runAutoReviewAsks()),
      ifOn("rebook_nudge", () => runRebookNudges()),
      ifOn("win_back", () => runWinBack()),
      ifOn("rebook_follow_up", () => runRebookFollowUps()),
    ]);

    const [bookingReminders, orderReminders, appointmentReminders, , staleCheckoutCleanup, reviewAsks, rebookNudges, winBack, rebookFollowUps] = results.map((result) =>
      result.status === "fulfilled" ? result.value : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error("[DailyAutomations] Check failed", ["bookingReminders", "orderReminders", "appointmentReminders", "rateLimitCleanup", "staleCheckoutCleanup", "reviewAsks", "rebookNudges", "winBack", "rebookFollowUps"][index], result.reason);
      }
    });

    res.json({ success: true, bookingReminders, orderReminders, appointmentReminders, staleCheckoutCleanup, reviewAsks, rebookNudges, winBack, rebookFollowUps });
  });
}
