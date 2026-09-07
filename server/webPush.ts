/**
 * Browser push notifications. Two separate audiences, kept in separate
 * tables so an owner alert (new booking, new visitor) can never end up on a
 * customer's phone by mistake:
 *  - pushSubscriptions: public homepage opt-in, for customer announcements.
 *  - ownerPushSubscriptions: the owner's own device(s), for business alerts.
 *
 * Free (no per-message cost, unlike SMS) but only reaches whoever previously
 * granted notification permission and subscribed. Uses the standard Web
 * Push protocol via VAPID, so no third-party account is required beyond the
 * keypair generated for this project.
 */
import webpush from "web-push";
import * as db from "./db";
import { normalizeSecretKey } from "./_core/envSecrets";

function looksRedacted(value: string) {
  return value === "" || value === "[SENSITIVE]" || /^[*x.]+$/i.test(value);
}

function getVapidConfig() {
  const publicKey = normalizeSecretKey(process.env.VAPID_PUBLIC_KEY);
  const privateKey = normalizeSecretKey(process.env.VAPID_PRIVATE_KEY);
  const subject = normalizeSecretKey(process.env.VAPID_SUBJECT) || "mailto:info@ebysplace.com";
  const usable = !looksRedacted(publicKey) && !looksRedacted(privateKey);
  return { publicKey, privateKey, subject, usable };
}

export function isWebPushConfigured() {
  return getVapidConfig().usable;
}

export type PushPayload = { title: string; body: string; url?: string };

export type PushSendResult = {
  sent: boolean;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage?: string;
};

type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

/**
 * A 404/410 from the push service means the browser unsubscribed or the
 * subscription expired — those are deleted rather than retried, since they
 * will never succeed again.
 */
async function sendToSubscriptions(
  subscriptions: StoredSubscription[],
  payload: PushPayload,
  onExpired: (endpoint: string) => Promise<void>,
): Promise<PushSendResult> {
  const config = getVapidConfig();
  if (!config.usable) {
    return { sent: false, recipientCount: 0, deliveredCount: 0, failedCount: 0, errorMessage: "VAPID keys are not configured in this environment." };
  }
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  if (!subscriptions.length) {
    return { sent: true, recipientCount: 0, deliveredCount: 0, failedCount: 0 };
  }

  const body = JSON.stringify(payload);
  let delivered = 0;
  let failed = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
        );
        delivered += 1;
      } catch (error: any) {
        failed += 1;
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await onExpired(subscription.endpoint);
        } else {
          console.warn("[WebPush] Failed to deliver notification", { endpoint: subscription.endpoint, statusCode, message: error?.message });
        }
      }
    }),
  );

  return { sent: true, recipientCount: subscriptions.length, deliveredCount: delivered, failedCount: failed };
}

export async function sendPushToAllSubscribers(payload: PushPayload): Promise<PushSendResult> {
  const subscriptions = await db.listPushSubscriptions();
  return sendToSubscriptions(subscriptions, payload, db.deletePushSubscriptionByEndpoint);
}

export async function sendPushToOwner(payload: PushPayload): Promise<PushSendResult> {
  const subscriptions = await db.listOwnerPushSubscriptions();
  return sendToSubscriptions(subscriptions, payload, db.deleteOwnerPushSubscriptionByEndpoint);
}
