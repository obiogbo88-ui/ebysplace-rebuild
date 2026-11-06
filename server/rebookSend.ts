/**
 * Sends a "Choose a new date" email and records it in the email log, so every
 * send (first link, reminder, sorry email, block-a-day email) shows in the
 * Command Centre. A failure to record never stops the email or its result.
 */
import { sendRebookRequestEmailSafely } from "./customerNotifications";
import * as db from "./db";
import { rebookUrl } from "./rebook";
import { REBOOK_EMAIL_PROVIDER } from "../shared/rebookStatus";

type RebookBooking = Parameters<typeof rebookUrl>[0] & Parameters<typeof sendRebookRequestEmailSafely>[0]["booking"] & { id: number };

export async function sendRecordedRebookEmail(booking: RebookBooking, options: { reminder?: boolean; onceMore?: boolean } = {}) {
  const url = rebookUrl(booking);
  const result = await sendRebookRequestEmailSafely({ booking, rebookUrl: url, ...options });
  try {
    await db.createEmailNotificationLog({
      entityType: "booking",
      entityId: booking.id,
      audience: "customer",
      recipientEmail: (booking.clientEmail || "").trim(),
      subject: ("subject" in result && result.subject) || "Choose a new date",
      bodyPreview: "text" in result ? result.text : null,
      status: result.sent ? "sent" : "failed",
      provider: REBOOK_EMAIL_PROVIDER,
      smtpHost: "api.resend.com",
      messageId: "messageId" in result ? result.messageId ?? null : null,
      errorMessage: !result.sent && "reason" in result ? result.reason : null,
      sentAtMs: result.sent ? Date.now() : null,
    });
  } catch (error) {
    console.error("[Rebook] Could not record email", booking.id, error);
  }
  return result;
}
