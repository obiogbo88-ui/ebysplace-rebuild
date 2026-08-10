import * as db from "./db";
import { sendBookingReminderEmailSafely } from "./smtpEmailNotifications";
import { sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";

const REMINDER_THRESHOLD_HOURS = 24;

function summaryLine(booking: any) {
  return `- ${booking.clientName} · ${booking.serviceName} · ${booking.appointmentDate} ${booking.appointmentTime}`;
}

/**
 * Reminds the owner about bookings still unconfirmed (deposit unpaid) after
 * REMINDER_THRESHOLD_HOURS. Each booking is reminded about once — dedup is
 * handled by db.getUnconfirmedBookingsNeedingReminder checking existing
 * email logs. Called by the daily cron in server/dailyAutomations.ts.
 */
export async function runUnconfirmedBookingReminders() {
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

  return { remindedCount: staleBookings.length };
}
