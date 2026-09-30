import * as db from "./db";
import { sendAppointmentReminderEmailSafely, sendCustomerSmsSafely, sendCustomerWhatsAppSafely } from "./customerNotifications";

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
      sendAppointmentReminderEmailSafely({ to: booking.clientEmail, customerName: booking.clientName, serviceName: booking.serviceName, appointmentDate: booking.appointmentDate, appointmentTime: booking.appointmentTime, serviceLocation: booking.serviceLocation }),
    ]).catch((error) => {
      console.error("[AppointmentReminders] Failed to send reminder", booking.id, error);
    });
  }

  return { remindedCount: bookingsTomorrow.length };
}
