import * as db from "./db";
import { unsubscribeUrl } from "./crm/automations";
import { normaliseEmail } from "./crm/clients";
import { clientsSwitchedOff, setClientPref } from "./crm/store";

/**
 * The Eby's Place list (rebooking Part 4, approved 2026-11-06).
 *
 * - A paying customer joins when they left "Don't add me" unticked on the
 *   booking form. Older bookings (no choice recorded) are never added.
 * - Anyone who used "Leave the list" stays off it, even if they book again,
 *   until they choose "Join again" or sign up on the website themselves.
 * - Leaving is stored as the CRM's per-client "marketing" switch, so the
 *   CRM's own emails respect it too.
 */

export function listKey(email: string | null | undefined) {
  const e = normaliseEmail(email);
  return e ? `e:${e}` : null;
}

/** This person's private one-click leave link. */
export function leaveListUrl(email: string) {
  const key = listKey(email);
  return key ? unsubscribeUrl(key) : null;
}

/** Every email address that has left the list (lower case). */
export async function emailsThatLeft(): Promise<Set<string>> {
  const keys = await clientsSwitchedOff("marketing");
  return new Set(Array.from(keys).filter((k) => k.startsWith("e:")).map((k) => k.slice(2)));
}

export async function hasLeftList(email: string) {
  const e = normaliseEmail(email);
  return e ? (await emailsThatLeft()).has(e) : false;
}

/** Drops everyone who left. Throws if the opt-out list can't be read, so nobody who left is emailed by mistake. */
export async function withoutPeopleWhoLeft(recipients: string[]) {
  const left = await emailsThatLeft();
  return recipients.filter((to) => {
    const e = normaliseEmail(to);
    return e ? !left.has(e) : false;
  });
}

export type ListJoinOutcome = "joined" | "already_on" | "said_no" | "left_before" | "no_choice" | "no_email";

/** Run once the deposit is paid. Never throws: a list problem must not break the booking. */
export async function joinListAfterPayment(booking: { clientEmail?: string | null; joinList?: boolean | null }): Promise<ListJoinOutcome> {
  try {
    const email = normaliseEmail(booking.clientEmail);
    if (!email) return "no_email";
    if (booking.joinList == null) return "no_choice";
    if (booking.joinList === false) return "said_no";
    if (await hasLeftList(email)) return "left_before";
    const { joined } = await db.joinListFromBooking(email);
    return joined ? "joined" : "already_on";
  } catch (error) {
    console.warn("[List] Could not add a paying customer to the list", error);
    return "no_choice";
  }
}

/** Whether the confirmation email should say "you're on the list" with a leave link. */
export function confirmationSaysOnList(outcome: ListJoinOutcome) {
  return outcome === "joined" || outcome === "already_on";
}

export async function leaveList(key: string) {
  await setClientPref(key, "marketing", false);
  if (key.startsWith("e:")) await db.removeNewsletterSubscriber(key.slice(2));
}

/** "Join again" after leaving, or "Join the list" from the past-customer invite (source "invite"). */
export async function joinListAgain(key: string, source?: "invite") {
  await setClientPref(key, "marketing", true);
  if (key.startsWith("e:")) await db.subscribeNewsletter(key.slice(2), false, source);
}

/** Signing up on the website is a fresh yes, so it clears an earlier "leave". */
export async function clearLeftList(email: string) {
  const key = listKey(email);
  if (!key) return;
  try {
    if (await hasLeftList(email)) await setClientPref(key, "marketing", true);
  } catch (error) {
    console.warn("[List] Could not clear an earlier leave", error);
  }
}
