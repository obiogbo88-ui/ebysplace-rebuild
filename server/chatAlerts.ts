import { getSmtpConfig } from "./smtpEmailNotifications";
import { sendBrandedEmail } from "./resendEmail";
import { sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";
import { sendPushToOwner } from "./webPush";
import { summariseTranscript, type ChatTranscriptMessage } from "./chatContact";

export type ChannelOutcome = { sent: boolean; detail?: string };
export type OwnerAlertOutcome = {
  sms: ChannelOutcome;
  whatsapp: ChannelOutcome;
  push: ChannelOutcome;
  email: ChannelOutcome;
};

type Lead = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  wantsHuman: boolean;
  messages: ChatTranscriptMessage[];
  adminUrl: string;
};

function describeTwilio(result: unknown): ChannelOutcome {
  const value = result as { sent?: boolean; reason?: string; detail?: string } | undefined;
  if (value?.sent) return { sent: true };
  return { sent: false, detail: value?.detail || value?.reason || "Not sent" };
}

/**
 * Sends one owner alert over every channel we have. SMS/WhatsApp go through
 * Twilio and have silently failed before, so email and browser push run
 * alongside them and the per-channel outcome is returned instead of swallowed.
 */
export async function dispatchOwnerAlert(input: {
  title: string;
  text: string;
  emailParagraphs: string[];
  replyTo?: string | null;
  cta?: { label: string; url: string };
}): Promise<OwnerAlertOutcome> {
  const [twilio, push, email] = await Promise.all([
    sendOwnerSmsAndWhatsAppSafely(`${input.title}\n${input.text}`.slice(0, 1500)).catch(() => [
      { sent: false, reason: "exception" },
      { sent: false, reason: "exception" },
    ]),
    sendPushToOwner({ title: input.title, body: input.text.slice(0, 200) }).catch(
      (error) => ({ sent: false, deliveredCount: 0, errorMessage: error instanceof Error ? error.message : String(error) }),
    ),
    sendBrandedEmail({
      to: getSmtpConfig().ownerEmail,
      subject: input.title,
      paragraphs: ["Hi Eby,", ...input.emailParagraphs],
      cta: input.cta,
      replyTo: input.replyTo || undefined,
    }).catch((error) => ({ sent: false, errorMessage: error instanceof Error ? error.message : String(error) })),
  ]);

  const pushResult = push as { deliveredCount?: number; recipientCount?: number; errorMessage?: string };
  const emailResult = email as { sent: boolean; errorMessage?: string };
  return {
    sms: describeTwilio(twilio[0]),
    whatsapp: describeTwilio(twilio[1]),
    push: (pushResult.deliveredCount ?? 0) > 0
      ? { sent: true }
      : { sent: false, detail: pushResult.errorMessage || (pushResult.recipientCount === 0 ? "No browser is subscribed to owner alerts yet" : "Delivery failed") },
    email: emailResult.sent ? { sent: true } : { sent: false, detail: emailResult.errorMessage || "Not sent" },
  };
}

export async function alertOwnerOfChatLead(lead: Lead) {
  const who = [lead.name, lead.phone, lead.email].filter(Boolean).join(" · ");
  const hasContact = Boolean(lead.phone || lead.email);
  const title = lead.wantsHuman
    ? `Chat: visitor wants to talk to you${lead.name ? ` (${lead.name})` : ""}`
    : hasContact
      ? `New chat lead${lead.name ? `: ${lead.name}` : ""}`
      : "Chat enquiry (no contact details)";
  const transcript = summariseTranscript(lead.messages);
  const contactLine = hasContact ? `Contact: ${who}` : "They did not leave contact details.";
  return dispatchOwnerAlert({
    title,
    text: `${contactLine}\n${transcript}`,
    emailParagraphs: [
      lead.wantsHuman ? "A website visitor asked to speak to a real person." : "A website visitor chatted with Eby and left without booking.",
      contactLine,
      `Conversation:\n${transcript}`,
      "Open the Chats panel in admin to see the full conversation and mark it as contacted.",
    ],
    replyTo: lead.email,
    cta: { label: "Open chats", url: lead.adminUrl },
  });
}
