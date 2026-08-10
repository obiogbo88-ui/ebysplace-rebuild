import type { Application, Request, Response } from "express";
import { runUnconfirmedBookingReminders } from "./bookingReminders";
import { runAbandonedOrderReminders } from "./orderReminders";
import { runDayBeforeAppointmentReminders } from "./appointmentReminders";

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

    const results = await Promise.allSettled([
      runUnconfirmedBookingReminders(),
      runAbandonedOrderReminders(),
      runDayBeforeAppointmentReminders(),
    ]);

    const [bookingReminders, orderReminders, appointmentReminders] = results.map((result) =>
      result.status === "fulfilled" ? result.value : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error("[DailyAutomations] Check failed", ["bookingReminders", "orderReminders", "appointmentReminders"][index], result.reason);
      }
    });

    res.json({ success: true, bookingReminders, orderReminders, appointmentReminders });
  });
}
