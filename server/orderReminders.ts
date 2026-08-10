import * as db from "./db";
import { sendOrderAbandonedReminderEmailSafely } from "./smtpEmailNotifications";
import { sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";

const REMINDER_THRESHOLD_HOURS = 24;

function summaryLine(order: any) {
  return `- ${order.customerName} · £${order.checkoutTotalCharged ?? "?"}`;
}

/**
 * Reminds the owner about shop orders stuck at "pending_payment" (Stripe
 * checkout opened but never completed) after REMINDER_THRESHOLD_HOURS. Each
 * order is reminded about once — dedup via db.getAbandonedOrdersNeedingReminder.
 * Called by the daily cron in server/dailyAutomations.ts.
 */
export async function runAbandonedOrderReminders() {
  const staleOrders = await db.getAbandonedOrdersNeedingReminder(REMINDER_THRESHOLD_HOURS);

  for (const order of staleOrders) {
    await sendOrderAbandonedReminderEmailSafely(order).catch((error) => {
      console.error("[OrderReminders] Failed to send reminder email", order.id, error);
    });
  }

  if (staleOrders.length) {
    const summary = [
      `${staleOrders.length} Eby's Place shop checkout${staleOrders.length === 1 ? "" : "s"} abandoned after ${REMINDER_THRESHOLD_HOURS}h:`,
      ...staleOrders.slice(0, 10).map(summaryLine),
      staleOrders.length > 10 ? `…and ${staleOrders.length - 10} more.` : undefined,
    ].filter(Boolean).join("\n");
    await sendOwnerSmsAndWhatsAppSafely(summary).catch((error) => {
      console.error("[OrderReminders] Failed to send owner SMS/WhatsApp summary", error);
    });
  }

  return { remindedCount: staleOrders.length };
}
