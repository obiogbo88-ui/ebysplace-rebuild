/**
 * "Choose a new date" links.
 *
 * The token is an HMAC of the booking id and its CURRENT date and time, so a
 * link only opens its own booking, and it stops working as soon as the
 * booking is moved (by the customer or by the owner). No extra column needed.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeSecretKey } from "./_core/envSecrets";

const SITE_URL = "https://www.ebysplace.com";

type Slot = { id: number; appointmentDate: string; appointmentTime: string };

/**
 * Signing key: JWT_SECRET when set, otherwise the Supabase service-role key,
 * which every deployment has (it's server-only, and an HMAC never reveals it).
 * Read at call time so a key added later takes effect without a code change.
 */
function secret() {
  const key = normalizeSecretKey(process.env.JWT_SECRET) || normalizeSecretKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key || key.length < 16) throw new Error("No server secret is configured, so rebooking links can't be signed.");
  return key;
}

export function rebookToken(booking: Slot) {
  return createHmac("sha256", secret())
    .update(`rebook:${booking.id}:${booking.appointmentDate}:${booking.appointmentTime}`)
    .digest("base64url")
    .slice(0, 32);
}

export function isValidRebookToken(booking: Slot, token: string) {
  const expected = Buffer.from(rebookToken(booking));
  const given = Buffer.from(String(token || ""));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function rebookUrl(booking: Slot) {
  return `${SITE_URL}/rebook/${booking.id}/${rebookToken(booking)}`;
}

/** A booking can be moved by its link only while it's still upcoming business. */
export function rebookBlockReason(booking: { status: string } | null) {
  if (!booking) return "This link isn't valid.";
  if (booking.status === "cancelled") return "This booking has been cancelled. Please contact us to book again.";
  if (booking.status === "completed") return "This appointment has already taken place.";
  return null;
}
