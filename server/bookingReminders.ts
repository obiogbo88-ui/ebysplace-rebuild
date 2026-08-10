import type { Application, Request, Response } from "express";
import * as db from "./db";
import { sendBookingReminderEmailSafely } from "./smtpEmailNotifications";
import { sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";

const REMINDER_THRESHOLD_HOURS = 24;
const CRON_PATH = "/api/cron/booking-reminders";

function isAuthorizedCronRequest(req: Request) {
  const expected = String(process.env.CRON_SECRET || "").trim();
  if (!expected) return false;
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return provided === expected;
}

function summaryLine(booking: any) {
  return `- ${booking.clientName} · ${booking.serviceName} · ${booking.appointmentDate} ${booking.appointmentTime}`;
}

/**
 * Daily cron (see vercel.json "crons") that reminds the owner about
 * bookings still unconfirmed (deposit unpaid) after REMINDER_THRESHOLD_HOURS.
 * Each booking is reminded about once — dedup is handled by
 * db.getUnconfirmedBookingsNeedingReminder checking existing email logs.
 */
export function registerBookingReminderCron(app: Application) {
  app.get(CRON_PATH, async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const staleBookings = await db.getUnconfirmedBookingsNeedingReminder(REMINDER_THRESHOLD_HOURS);

      for (const booking of staleBookings) {
        await sendBookingReminderEmailSafely(booking).catch((error) => {
          console.error("[BookingReminders] Failed to send reminder email", booking.id, error);
        });
      }

      if (staleBookings.length) {
        const summary = [
          `${staleBookings.length} Eby's Place booking${staleBookings.length === 1 ? "" : "s"} still unconfirmed after ${REMINDER_THRESHOLD_HOURS}h:`,
          ...staleBookings.slice(0, 10).map(summaryLine),
          staleBookings.length > 10 ? `…and ${staleBookings.length - 10} more.` : undefined,
        ].filter(Boolean).join("\n");
        await sendOwnerSmsAndWhatsAppSafely(summary).catch((error) => {
          console.error("[BookingReminders] Failed to send owner SMS/WhatsApp summary", error);
        });
      }

      res.json({ success: true, remindedCount: staleBookings.length });
    } catch (error) {
      console.error("[BookingReminders] Cron run failed", error);
      res.status(500).json({ error: "Failed to process booking reminders" });
    }
  });
}
