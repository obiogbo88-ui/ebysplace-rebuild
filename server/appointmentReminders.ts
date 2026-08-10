import * as db from "./db";
import { sendCustomerSmsSafely, sendCustomerWhatsAppSafely, sendCustomerEmailSafely } from "./customerNotifications";

function reminderMessage(booking: any) {
  return `Hi ${booking.clientName}, this is a reminder from Eby's Place: your ${booking.serviceName} appointment is tomorrow (${booking.appointmentDate}) at ${booking.appointmentTime}. Reply or contact us if you need to reschedule.`;
}

/**
 * Sends a day-before reminder to customers with a confirmed appointment
 * tomorrow. Naturally runs once per booking (see
 * db.getConfirmedBookingsForTomorrow) since a booking's appointmentDate only
 * matches "tomorrow" on the single day before it. Called by the daily cron
 * in server/dailyAutomations.ts.
 */
export async function runDayBeforeAppointmentReminders() {
  const bookingsTomorrow = await db.getConfirmedBookingsForTomorrow();

  for (const booking of bookingsTomorrow) {
    const body = reminderMessage(booking);
    await Promise.allSettled([
      sendCustomerSmsSafely({ to: booking.clientPhone, body }),
      sendCustomerWhatsAppSafely({ to: booking.clientPhone, body }),
      sendCustomerEmailSafely({ to: booking.clientEmail, subject: "Your Eby's Place appointment is tomorrow", body }),
    ]).catch((error) => {
      console.error("[AppointmentReminders] Failed to send reminder", booking.id, error);
    });
  }

  return { remindedCount: bookingsTomorrow.length };
}
