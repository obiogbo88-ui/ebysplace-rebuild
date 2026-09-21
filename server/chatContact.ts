/**
 * Pure helpers for pulling visitor contact details out of website chat.
 * Kept free of I/O so they can be unit-tested without a database.
 */

export type ChatTranscriptMessage = { role: "user" | "assistant"; content: string };

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+|00)?\d[\d\s().-]{7,18}\d/g;

export function cleanEmail(value?: string | null) {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!trimmed || trimmed.length > 320) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? trimmed : null;
}

/** Returns a tidy phone string, or null when it is not plausibly a phone number. */
export function cleanPhone(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed.length > 40) return null;
  if (/[A-Za-z]/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return trimmed.replace(/\s+/g, " ");
}

export function cleanName(value?: string | null) {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

/**
 * Finds an email address or phone number the visitor typed into the chat, so a
 * lead is not lost just because they never used the contact form.
 */
export function extractContactFromMessages(messages: ChatTranscriptMessage[]) {
  let email: string | null = null;
  let phone: string | null = null;
  for (const message of messages) {
    if (message.role !== "user") continue;
    if (!email) {
      const match = message.content.match(EMAIL_PATTERN);
      email = cleanEmail(match?.[0]);
    }
    if (!phone) {
      const withoutEmails = message.content.replace(new RegExp(EMAIL_PATTERN.source, "gi"), " ");
      for (const candidate of withoutEmails.match(PHONE_PATTERN) ?? []) {
        phone = cleanPhone(candidate);
        if (phone) break;
      }
    }
    if (email && phone) break;
  }
  return { email, phone };
}

export function summariseTranscript(messages: ChatTranscriptMessage[], maxMessages = 6, maxChars = 220) {
  return messages
    .slice(-maxMessages)
    .map((message) => `${message.role === "user" ? "Visitor" : "Eby"}: ${message.content.slice(0, maxChars)}`)
    .join("\n");
}
