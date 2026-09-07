/**
 * SMS and WhatsApp broadcasts. Reuses the existing Twilio wiring in
 * customerNotifications.ts (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_SMS_FROM / TWILIO_WHATSAPP_FROM) rather than a second Twilio
 * client — that module already handles auth, sender formatting, and
 * per-message delivery.
 *
 * Both channels cost money per message and require a funded Twilio account
 * with a purchased sending number. WhatsApp additionally requires either an
 * approved WhatsApp Business sender, or (in Sandbox mode) that the recipient
 * has first texted the join code to Twilio's sandbox number — Twilio refuses
 * every other recipient outright. This file assumes whichever is configured;
 * it doesn't provision or pay for anything.
 */
import { getNotificationDiagnostics, sendCustomerSmsSafely, sendCustomerWhatsAppSafely } from "./customerNotifications";

export function isSmsConfigured() {
  return getNotificationDiagnostics().twilio.sms.configured;
}

export function isWhatsAppConfigured() {
  return getNotificationDiagnostics().twilio.whatsapp.configured;
}

export type BroadcastResult = {
  sent: boolean;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage?: string;
};

async function sendToPhones(
  phones: string[],
  text: string,
  sendOne: (phone: string, text: string) => Promise<{ sent: boolean }>,
): Promise<BroadcastResult> {
  if (!phones.length) {
    return { sent: true, recipientCount: 0, deliveredCount: 0, failedCount: 0 };
  }

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    phones.map(async (phone) => {
      const result = await sendOne(phone, text);
      if (result.sent) delivered += 1;
      else failed += 1;
    }),
  );

  return { sent: true, recipientCount: phones.length, deliveredCount: delivered, failedCount: failed };
}

export async function sendSmsToPhones(phones: string[], text: string): Promise<BroadcastResult> {
  if (!isSmsConfigured()) {
    return { sent: false, recipientCount: 0, deliveredCount: 0, failedCount: 0, errorMessage: "Twilio SMS is not configured in this environment." };
  }
  return sendToPhones(phones, text, (to, body) => sendCustomerSmsSafely({ to, body }));
}

export async function sendWhatsAppToPhones(phones: string[], text: string): Promise<BroadcastResult> {
  if (!isWhatsAppConfigured()) {
    return { sent: false, recipientCount: 0, deliveredCount: 0, failedCount: 0, errorMessage: "Twilio WhatsApp is not configured in this environment." };
  }
  return sendToPhones(phones, text, (to, body) => sendCustomerWhatsAppSafely({ to, body }));
}
