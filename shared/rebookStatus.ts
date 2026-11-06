// What the Command Centre shows on a booking after a "choose a new date" link:
// waiting for the customer, time to call them, or already moved.

/** Marks rebooking emails in the email log: they go through Resend, not Zoho. */
export const REBOOK_EMAIL_PROVIDER = "resend";

export type RebookStatusInput = {
  status: string;
  rebookRequestedAt?: Date | string | null;
  rebookReminderSentAt?: Date | string | null;
  rebookOwnerAlertedAt?: Date | string | null;
  rebookMovedAt?: Date | string | null;
  rebookMovedBy?: string | null;
  rebookPreviousDate?: string | null;
  rebookPreviousTime?: string | null;
};

export type RebookStatus =
  | { kind: "waiting"; sentAt: Date; reminderAt: Date | null; reminderDueAt: Date }
  | { kind: "call"; sentAt: Date; reminderAt: Date | null; alertedAt: Date }
  | { kind: "moved"; by: "customer" | "admin"; movedAt: Date; previousDate: string | null; previousTime: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const toDate = (value: Date | string | null | undefined) => (value ? new Date(value) : null);

export function rebookStatus(booking: RebookStatusInput): RebookStatus | null {
  if (booking.status === "cancelled" || booking.status === "completed") return null;
  const sentAt = toDate(booking.rebookRequestedAt);
  const reminderAt = toDate(booking.rebookReminderSentAt);
  if (sentAt) {
    const alertedAt = toDate(booking.rebookOwnerAlertedAt);
    if (alertedAt) return { kind: "call", sentAt, reminderAt, alertedAt };
    return { kind: "waiting", sentAt, reminderAt, reminderDueAt: new Date(sentAt.getTime() + DAY_MS) };
  }
  const movedAt = toDate(booking.rebookMovedAt);
  if (movedAt) {
    return {
      kind: "moved",
      by: booking.rebookMovedBy === "customer" ? "customer" : "admin",
      movedAt,
      previousDate: booking.rebookPreviousDate ?? null,
      previousTime: booking.rebookPreviousTime ?? null,
    };
  }
  return null;
}

const londonDay = (at: Date) => at.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const londonTime = (at: Date) => at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });

/** "today at 10:31", "tomorrow at 10:31" or "Fri 6 Nov, 10:31", in London time. */
export function formatRebookMoment(at: Date | string, now: Date = new Date()): string {
  const when = new Date(at);
  const day = londonDay(when);
  if (day === londonDay(now)) return `today at ${londonTime(when)}`;
  if (day === londonDay(new Date(now.getTime() + DAY_MS))) return `tomorrow at ${londonTime(when)}`;
  if (day === londonDay(new Date(now.getTime() - DAY_MS))) return `yesterday at ${londonTime(when)}`;
  const label = when.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
  return `${label}, ${londonTime(when)}`;
}

/** "Sat 7 Nov 10:00" from "2026-11-07" + "10:00". */
export function formatShortSlot(date: string, time?: string | null): string {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return time ? `${label} ${time}` : label;
}

/** Why a second rebooking link needs confirming, or null when it can go. */
export function rebookResendBlockReason(sentAt: Date | string | null | undefined, sendAgain: boolean, now: Date = new Date()): string | null {
  if (!sentAt || sendAgain) return null;
  return `A rebooking link was already sent ${formatRebookMoment(sentAt, now)}.`;
}

/**
 * True when the last rebooking email was the "sorry, once more" one: the
 * customer had already moved the booking themselves, and the link went out
 * after that move. "Send again" then resends the same sorry email.
 */
export function lastRebookEmailWasOnceMore(booking: Pick<RebookStatusInput, "rebookRequestedAt" | "rebookMovedAt" | "rebookMovedBy">): boolean {
  const sentAt = toDate(booking.rebookRequestedAt);
  const movedAt = toDate(booking.rebookMovedAt);
  return booking.rebookMovedBy === "customer" && !!sentAt && !!movedAt && sentAt.getTime() > movedAt.getTime();
}
