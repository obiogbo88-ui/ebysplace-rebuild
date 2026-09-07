/**
 * Resend delivery for one-off branded customer replies.
 *
 * Deliberately talks to the Resend REST API over `fetch` rather than pulling in
 * the `resend` SDK. The surface we need is a single POST, and this repo has been
 * actively shrinking its dependency tree (see the recent vulnerability sweep), so
 * a new runtime dependency would cost more than it saves.
 *
 * Booking and order lifecycle mail still goes out over Zoho SMTP via
 * smtpEmailNotifications.ts. This module is additive and does not touch it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const CONTACT_EMAIL = "info@ebysplace.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend authenticates the sending *domain*, not the mailbox, so `from` must sit
 * on a domain verified in the Resend dashboard. ebysplace.com is verified via
 * DKIM (resend._domainkey) with SPF and bounce MX on the send. subdomain.
 */
const DEFAULT_FROM = `Eby's Place <${CONTACT_EMAIL}>`;

export type BrandedEmail = {
  to: string;
  cc?: string;
  subject: string;
  /** Plain-text paragraphs. Rendered into the branded shell in order. */
  paragraphs: string[];
  /** Optional gold call-to-action button below the paragraphs. */
  cta?: { label: string; url: string };
  replyTo?: string;
};

export type ResendResult = {
  sent: boolean;
  messageId?: string;
  errorMessage?: string;
};

function trimQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "").trim();
}

/**
 * The checked-in env file ships with redacted placeholders, and Vercel marks the
 * real key "Sensitive" so it only exists inside a deployed function. Treat an
 * obviously-redacted value as absent rather than firing a doomed request.
 */
function looksRedacted(value: string) {
  return value === "" || value === "[SENSITIVE]" || /^[*x.]+$/i.test(value);
}

export function getResendConfig() {
  const apiKey = trimQuotes(process.env.RESEND_API_KEY ?? "");
  const from = trimQuotes(process.env.RESEND_FROM ?? "") || DEFAULT_FROM;
  return { apiKey, from, usable: !looksRedacted(apiKey) };
}

export function isResendConfigured() {
  return getResendConfig().usable;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let cachedShell: string | null = null;

function loadShell() {
  if (cachedShell) return cachedShell;
  // Resolved from cwd so it works under both tsx (server/) and the bundled
  // Vercel function, where the template is copied alongside the handler.
  const candidates = [
    path.join(process.cwd(), "server", "emailTemplates", "ebysplace-base.html"),
    path.join(process.cwd(), "emailTemplates", "ebysplace-base.html"),
  ];
  for (const candidate of candidates) {
    try {
      cachedShell = readFileSync(candidate, "utf8");
      return cachedShell;
    } catch {
      // try the next candidate
    }
  }
  throw new Error("Branded email template (ebysplace-base.html) could not be located.");
}

const PARAGRAPH_STYLE = 'class="ink" style="margin:0 0 20px;color:#1A1A1A;"';

export function renderBrandedEmail(email: Pick<BrandedEmail, "subject" | "paragraphs" | "cta">) {
  const [salutation, ...rest] = email.paragraphs;
  const blocks: string[] = [];
  if (salutation) {
    blocks.push(`<p class="ink" style="margin:0 0 20px;font-size:16.5px;color:#1A1A1A;">${escapeHtml(salutation)}</p>`);
  }
  for (const paragraph of rest) {
    blocks.push(`        <p ${PARAGRAPH_STYLE}>${escapeHtml(paragraph)}</p>`);
  }
  if (email.cta) {
    blocks.push(
      `        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 32px;">\n` +
        `          <tr>\n            <td class="gold-btn" bgcolor="#C9A84C" style="background-color:#C9A84C;border-radius:3px;">\n` +
        `              <a href="${escapeHtml(email.cta.url)}" class="cta" style="display:inline-block;padding:13px 26px;font-family:Arial,sans-serif;font-size:12.5px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#FFFBF2;text-decoration:none;">${escapeHtml(email.cta.label)}</a>\n` +
        `            </td>\n          </tr>\n        </table>`,
    );
  }
  return loadShell()
    .replace("{{SUBJECT}}", escapeHtml(email.subject))
    .replace("{{BODY_HTML}}", blocks.join("\n"));
}

export function renderPlainText(email: Pick<BrandedEmail, "paragraphs" | "cta">) {
  const lines = [...email.paragraphs];
  if (email.cta) lines.push(`${email.cta.label}: ${email.cta.url}`);
  lines.push("", "Eby's Place", "Founder & Service Lead", CONTACT_EMAIL);
  return lines.join("\n\n");
}

/**
 * `fetchImpl` exists so tests can supply a stub instead of patching the global
 * `fetch`. Patching it globally leaked into sibling suites that make real
 * network calls, so the seam stays explicit here.
 */
export async function sendBrandedEmail(email: BrandedEmail, fetchImpl: typeof fetch = fetch): Promise<ResendResult> {
  const config = getResendConfig();
  if (!config.usable) {
    return { sent: false, errorMessage: "RESEND_API_KEY is not configured in this environment." };
  }

  let response: Response;
  try {
    response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [email.to],
        ...(email.cc ? { cc: [email.cc] } : {}),
        reply_to: email.replyTo || CONTACT_EMAIL,
        subject: email.subject,
        html: renderBrandedEmail(email),
        text: renderPlainText(email),
      }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("[Resend] Request failed", { errorMessage });
    return { sent: false, errorMessage };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok) {
    // Never surface the response verbatim to the client: Resend echoes request
    // context on some errors, and the key sits in the request headers.
    const errorMessage = payload?.message || `Resend responded ${response.status}`;
    console.warn("[Resend] Send rejected", { status: response.status, errorMessage });
    return { sent: false, errorMessage };
  }

  return { sent: true, messageId: payload?.id };
}

export type BroadcastResult = {
  sent: boolean;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage?: string;
};

/**
 * Sends one individual email per recipient rather than a single email with
 * everyone in bcc/cc — per the standing rule against grouping external
 * recipients together in one message.
 */
export async function sendBroadcastEmail(
  recipients: string[],
  content: Pick<BrandedEmail, "subject" | "paragraphs" | "cta">,
  fetchImpl: typeof fetch = fetch,
): Promise<BroadcastResult> {
  const config = getResendConfig();
  if (!config.usable) {
    return { sent: false, recipientCount: 0, deliveredCount: 0, failedCount: 0, errorMessage: "RESEND_API_KEY is not configured in this environment." };
  }
  if (!recipients.length) {
    return { sent: true, recipientCount: 0, deliveredCount: 0, failedCount: 0 };
  }

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    recipients.map(async (to) => {
      const result = await sendBrandedEmail({ to, ...content }, fetchImpl);
      if (result.sent) delivered += 1;
      else failed += 1;
    }),
  );

  return { sent: true, recipientCount: recipients.length, deliveredCount: delivered, failedCount: failed };
}
