/**
 * SMS broadcasts via Twilio's REST API over plain `fetch`, mirroring the
 * approach in resendEmail.ts rather than pulling in the `twilio` SDK — the
 * surface needed is a single authenticated POST per message.
 *
 * Unlike web push and email, SMS costs money per message and requires a
 * funded Twilio account with a purchased sending number. This module stays
 * gracefully unconfigured (mirrors isResendConfigured/isWebPushConfigured)
 * until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are
 * set — nothing here provisions or pays for that account.
 */
import * as db from "./db";
import { normalizeSecretKey } from "./_core/envSecrets";

function looksRedacted(value: string) {
  return value === "" || value === "[SENSITIVE]" || /^[*x.]+$/i.test(value);
}

function getTwilioConfig() {
  const accountSid = normalizeSecretKey(process.env.TWILIO_ACCOUNT_SID);
  const authToken = normalizeSecretKey(process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = normalizeSecretKey(process.env.TWILIO_FROM_NUMBER);
  const usable = !looksRedacted(accountSid) && !looksRedacted(authToken) && !looksRedacted(fromNumber);
  return { accountSid, authToken, fromNumber, usable };
}

export function isSmsConfigured() {
  return getTwilioConfig().usable;
}

export type SmsSendResult = {
  sent: boolean;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage?: string;
};

/**
 * A 21610 error code from Twilio means the recipient has replied STOP or the
 * number is otherwise unreachable — those subscriptions are removed rather
 * than retried, since they will never succeed again.
 */
export async function sendSmsToAllSubscribers(text: string, fetchImpl: typeof fetch = fetch): Promise<SmsSendResult> {
  const config = getTwilioConfig();
  if (!config.usable) {
    return { sent: false, recipientCount: 0, deliveredCount: 0, failedCount: 0, errorMessage: "Twilio is not configured in this environment." };
  }

  const subscribers = await db.listSmsSubscriptions();
  if (!subscribers.length) {
    return { sent: true, recipientCount: 0, deliveredCount: 0, failedCount: 0 };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    subscribers.map(async (subscriber) => {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: subscriber.phone, From: config.fromNumber, Body: text }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          failed += 1;
          if (payload?.code === 21610 || response.status === 404) {
            await db.deleteSmsSubscriptionByPhone(subscriber.phone);
          } else {
            console.warn("[SMS] Failed to deliver message", { phone: subscriber.phone, status: response.status, code: payload?.code, message: payload?.message });
          }
          return;
        }
        delivered += 1;
      } catch (error: any) {
        failed += 1;
        console.warn("[SMS] Failed to deliver message", { phone: subscriber.phone, message: error?.message });
      }
    }),
  );

  return { sent: true, recipientCount: subscribers.length, deliveredCount: delivered, failedCount: failed };
}
