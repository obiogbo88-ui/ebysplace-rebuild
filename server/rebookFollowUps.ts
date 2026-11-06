/**
 * Daily follow-up for "Choose a new date" emails (runs in the 9am cron).
 *
 * - 24 hours after the first email, if the booking hasn't moved: ONE reminder.
 * - If it still hasn't moved by the day before the old appointment (or the
 *   day has passed): ONE alert to the owner to call the customer.
 * Moving the booking clears these flags (db.moveBookingDate), so a booking
 * that's been rebooked is never chased.
 */
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import { sendRecordedRebookEmail } from "./rebookSend";
import { addDays, formatLongDate, londonToday } from "../shared/rebook";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runRebookFollowUps(now: Date = new Date()) {
  const pending = await db.listPendingRebooks();
  const today = londonToday(now);
  const tomorrow = addDays(today, 1);
  const result = { checked: pending.length, reminded: 0, ownerAlerts: 0, failed: [] as number[] };

  for (const booking of pending) {
    const requestedAt = booking.rebookRequestedAt ? new Date(booking.rebookRequestedAt) : null;
    if (!requestedAt) continue;

    const dueForReminder = !booking.rebookReminderSentAt && now.getTime() - requestedAt.getTime() >= DAY_MS && booking.appointmentDate > today;
    if (dueForReminder) {
      try {
        const sent = await sendRecordedRebookEmail(booking, { reminder: true });
        if (sent.sent) {
          await db.markRebookReminderSent(booking.id, now);
          result.reminded += 1;
        } else {
          result.failed.push(booking.id);
        }
      } catch (error) {
        console.error("[RebookFollowUps] Reminder failed", booking.id, error);
        result.failed.push(booking.id);
      }
    }

    const dueForOwnerAlert = !booking.rebookOwnerAlertedAt && booking.appointmentDate <= tomorrow;
    if (dueForOwnerAlert) {
      try {
        await notifyOwner({
          title: "Customer hasn't chosen a new date",
          content: `${booking.clientName} (${booking.clientPhone}) hasn't picked a new date for ${booking.serviceName}. It was booked for ${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime}. Please give them a call.`,
        });
        await db.markRebookOwnerAlerted(booking.id, now);
        result.ownerAlerts += 1;
      } catch (error) {
        console.error("[RebookFollowUps] Owner alert failed", booking.id, error);
        result.failed.push(booking.id);
      }
    }
  }
  return result;
}
