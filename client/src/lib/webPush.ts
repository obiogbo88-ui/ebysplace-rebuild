/**
 * Browser push opt-in for Eby's Place. Only reaches whoever explicitly grants
 * notification permission in their own browser — never the full customer
 * list, and it's a no-op on browsers without push support (notably Safari on
 * iOS unless the site has been added to the home screen).
 */

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map((char) => char.charCodeAt(0)));
}

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * Requests notification permission (must be called from a user gesture) and
 * returns the resulting PushSubscription, or null if permission was denied
 * or the browser doesn't support push at all.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.warn("[WebPush] VITE_VAPID_PUBLIC_KEY is not set — cannot subscribe.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export function pushSubscriptionToInput(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint!,
    keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
    userAgent: navigator.userAgent.slice(0, 512),
  };
}
