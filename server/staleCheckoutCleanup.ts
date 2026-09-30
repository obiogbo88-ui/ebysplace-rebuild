import * as db from "./db";
import { sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";

// Well past the 24h owner reminders (bookingReminders.ts / orderReminders.ts), so every
// abandoned booking or order has had several daily chances to be followed up first.
export const STALE_UNPAID_DAYS = 7;

/**
 * Cancels bookings and shop orders still unpaid after STALE_UNPAID_DAYS so they stop
 * showing as pending. Records are kept (status only), customers are not messaged, and the
 * owner gets a summary so a booking agreed offline can be switched back from the admin.
 * Called by the daily cron in server/dailyAutomations.ts.
 */
export async function runStaleUnpaidCheckoutCleanup() {
  const result = await db.cancelStaleUnpaidCheckouts(STALE_UNPAID_DAYS);
  const total = result.bookings.length + result.orders.length;
  if (!total) return { cancelledBookings: 0, cancelledOrders: 0, cancelledTransactions: result.transactions };

  await db.logActivity({
    activityType: "auto_cancelled_unpaid_checkouts",
    activityCategory: "admin_action",
    description: `Auto-cancelled ${result.bookings.length} unpaid booking${result.bookings.length === 1 ? "" : "s"} and ${result.orders.length} unpaid order${result.orders.length === 1 ? "" : "s"} older than ${STALE_UNPAID_DAYS} days`,
    status: "success",
    pageUrl: "/admin",
    metadata: { bookingIds: result.bookings.map((b) => b.id), orderIds: result.orders.map((o) => o.id), transactions: result.transactions },
  }).catch((error) => console.warn("[StaleCheckoutCleanup] Could not log activity", error));

  const lines = [
    `Eby's Place: cancelled ${total} unpaid checkout${total === 1 ? "" : "s"} older than ${STALE_UNPAID_DAYS} days.`,
    ...result.bookings.slice(0, 8).map((b) => `- Booking #${b.id} · ${b.clientName} · ${b.serviceName} · ${b.appointmentDate}`),
    ...result.orders.slice(0, 8).map((o) => `- Order #${o.id} · ${o.customerName}`),
    "If any of these were agreed offline, change the status back in the admin.",
  ];
  await sendOwnerSmsAndWhatsAppSafely(lines.join("\n")).catch((error) => console.error("[StaleCheckoutCleanup] Owner summary failed", error));

  return { cancelledBookings: result.bookings.length, cancelledOrders: result.orders.length, cancelledTransactions: result.transactions };
}
