import { sendBrandedEmail, withLeaveLink, type BrandedEmail } from "../resendEmail";
import { unsubscribeSignature } from "./automations";
import type { Client } from "./clients";
import { claimSend, releaseSend } from "./store";

/**
 * The one-off "Would you like to join the Eby's Place list?" invite for past
 * paying customers who were never shown the booking-form notice (approved
 * 2026-11-06, mockup https://claude.ai/artifact/SqAC57ynXYF4AQ9fsxjEpW).
 * Nobody is added unless they tap "Join the list" themselves.
 */

export const LIST_INVITE = "list_invite";
const SITE = "https://www.ebysplace.com";
const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

export type InviteCandidate = { key: string; name: string; bookings: number; orders: number; waiting: boolean };

/** Paid a deposit or bought from the shop, has an email, isn't on the list, never said no or left, and wasn't invited before. */
export function inviteCandidates(clients: Client[]): InviteCandidate[] {
  return clients
    .filter((c) => c.email && c.paidOnline > 0 && c.list.status === "not_on" && !c.marketingOptOut && !c.list.invitedOn)
    .map((c) => ({ key: c.key, name: c.name, bookings: c.bookings, orders: c.orders, waiting: c.rebookPending }));
}

/** Their private one-tap "Join the list" link. */
export function joinListUrl(key: string, secret?: string) {
  return `${SITE}/api/crm/join?c=${b64url(key)}&s=${unsubscribeSignature(key, secret)}`;
}

/** "Miss Christina Wallbridge" → "Christina". */
export function inviteFirstName(name: string) {
  const words = name.trim().split(/\s+/).filter((w) => !/^(miss|mrs|mr|ms|mx|dr)\.?$/i.test(w));
  const first = words[0] || "there";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function listInviteEmail(client: Pick<Client, "key" | "name" | "email">, leaveUrl: string): BrandedEmail {
  return withLeaveLink(
    {
      to: client.email!,
      subject: "Would you like to join the Eby’s Place list?",
      paragraphs: [
        `Hi ${inviteFirstName(client.name)},`,
        "Thank you for choosing Eby’s Place. We’d love to keep you posted when free slots and offers come up. It’s one email now and then, and you can leave any time with one click.",
      ],
      cta: { label: "Join the list", url: joinListUrl(client.key) },
      closing: ["If you’d rather not, there’s nothing to do. We won’t add you unless you choose to join.", "Thank you, Eby"],
    },
    leaveUrl,
  );
}

/** A plain-text copy of the invite for the Command Centre preview. */
export function listInvitePreview(name: string) {
  const email = listInviteEmail({ key: "e:preview@example.com", name, email: "preview@example.com" }, "#");
  return { subject: email.subject, paragraphs: email.paragraphs, cta: email.cta!.label, closing: email.closing ?? [] };
}

/**
 * Sends one email per person, a few a second (Resend allows 10/s). Each person
 * is claimed first, so a double click or a retry can never invite anyone twice.
 */
export async function sendListInvites(people: Client[], leaveUrlFor: (email: string) => string | null) {
  const sent: string[] = [];
  const failed: Array<{ key: string; name: string }> = [];
  const skipped: string[] = [];
  for (let i = 0; i < people.length; i++) {
    const c = people[i];
    const refId = `${LIST_INVITE}:${c.key}`;
    if (!(await claimSend(LIST_INVITE, c.key, refId, "email"))) {
      skipped.push(c.name);
      continue;
    }
    if (sent.length + failed.length > 0) await new Promise((r) => setTimeout(r, 300));
    const leaveUrl = leaveUrlFor(c.email!) ?? `${SITE}/newsletter`;
    const result = await sendBrandedEmail(listInviteEmail(c, leaveUrl));
    if (result.sent) sent.push(c.name);
    else {
      await releaseSend(LIST_INVITE, refId);
      failed.push({ key: c.key, name: c.name });
    }
  }
  return { sent, failed, skipped };
}
