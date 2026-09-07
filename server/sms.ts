/**
 * SMS broadcasts to opted-in subscribers. Reuses the existing Twilio wiring
 * in customerNotifications.ts (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_SMS_FROM) rather than a second Twilio client — that module already
 * handles auth, sender formatting, and per-message delivery.
 *
 * Unlike web push and email, SMS costs money per message and requires a
 * funded Twilio account with a purchased sending number — this file assumes
 * that's already configured, it doesn't provision or pay for anything.
 */
import * as db from "./db";
import { getNotificationDiagnostics, sendCustomerSmsSafely } from "./customerNotifications";

export function isSmsConfigured() {
  return getNotificationDiagnostics().twilio.sms.configured;
}

export type SmsSendResult = {
  sent: boolean;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage?: string;
};

export async function sendSmsToAllSubscribers(text: string): Promise<SmsSendResult> {
  if (!isSmsConfigured()) {
    return { sent: false, recipientCount: 0, deliveredCount: 0, failedCount: 0, errorMessage: "Twilio SMS is not configured in this environment." };
  }

  const subscribers = await db.listSmsSubscriptions();
  if (!subscribers.length) {
    return { sent: true, recipientCount: 0, deliveredCount: 0, failedCount: 0 };
  }

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    subscribers.map(async (subscriber) => {
      const result = await sendCustomerSmsSafely({ to: subscriber.phone, body: text });
      if (result.sent) delivered += 1;
      else failed += 1;
    }),
  );

  return { sent: true, recipientCount: subscribers.length, deliveredCount: delivered, failedCount: failed };
}
