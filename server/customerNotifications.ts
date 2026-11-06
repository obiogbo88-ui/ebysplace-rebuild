import { normalizeSecretKey, trimEnvValue } from "./_core/envSecrets";
import { sendBrandedEmail } from "./resendEmail";
import { formatLongDate } from "../shared/rebook";

const SITE_URL = "https://www.ebysplace.com";

/**
 * Opens the "write a review" dialog on the Eby's Place Google Business Profile
 * (listed on Google as "Ebysplace.com"). The lrd hash carries the listing's
 * feature id; the query just needs to surface the listing's knowledge panel.
 */
export const GOOGLE_REVIEW_URL =
  "https://www.google.com/search?q=Ebysplace.com+hairdresser+07864+585110#lrd=0x4872056909763369:0x24f90dbf5e290238,3,,,";

type MessageInput = {
  to?: string | null;
  body: string;
  channel?: "sms" | "whatsapp";
};

function normalisePhone(value?: string | null) {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, "");
  if (/^whatsapp:\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed.replace(/^whatsapp:/, "");
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^0\d{9,10}$/.test(trimmed)) return `+44${trimmed.slice(1)}`;
  return null;
}

function normaliseSender(value?: string | null, channel: "sms" | "whatsapp" = "sms") {
  if (!value) return null;
  const trimmed = trimEnvValue(value);
  if (channel === "whatsapp") {
    if (/^whatsapp:\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
    if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return `whatsapp:${trimmed}`;
    return null;
  }
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9 ]{1,11}$/.test(trimmed)) return trimmed;
  return null;
}

function getTwilioConfig(channel: "sms" | "whatsapp" = "sms") {
  const accountSid = normalizeSecretKey(process.env.TWILIO_ACCOUNT_SID);
  const authToken = normalizeSecretKey(process.env.TWILIO_AUTH_TOKEN);
  const rawFrom = channel === "whatsapp" ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
  const from = normaliseSender(rawFrom, channel);
  return {
    accountSid,
    authToken,
    from,
    hasAccountSid: Boolean(accountSid),
    hasAuthToken: Boolean(authToken),
    hasRawSender: Boolean(trimEnvValue(rawFrom)),
    hasValidSender: Boolean(from),
  };
}

function getTwilioRequestTimeoutMs() {
  const parsed = Number(process.env.TWILIO_REQUEST_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 1500 ? Math.min(parsed, 15000) : 8000;
}

export function getNotificationDiagnostics() {
  const sms = getTwilioConfig("sms");
  const whatsapp = getTwilioConfig("whatsapp");
  const ownerPhone = normalisePhone(process.env.EBYSPLACE_OWNER_PHONE_E164 || process.env.OWNER_PHONE_E164 || process.env.TWILIO_OWNER_PHONE);
  return {
    twilio: {
      sms: {
        configured: sms.hasAccountSid && sms.hasAuthToken && sms.hasValidSender,
        hasAccountSid: sms.hasAccountSid,
        hasAuthToken: sms.hasAuthToken,
        hasSender: sms.hasRawSender,
        hasValidSender: sms.hasValidSender,
      },
      whatsapp: {
        configured: whatsapp.hasAccountSid && whatsapp.hasAuthToken && whatsapp.hasValidSender,
        hasAccountSid: whatsapp.hasAccountSid,
        hasAuthToken: whatsapp.hasAuthToken,
        hasSender: whatsapp.hasRawSender,
        hasValidSender: whatsapp.hasValidSender,
        expectedSenderFormat: "whatsapp:+14155238886 or an approved whatsapp:+E164 Twilio sender",
      },
      ownerPhoneConfigured: Boolean(ownerPhone),
      requestTimeoutMs: getTwilioRequestTimeoutMs(),
    },
  };
}

async function sendTwilioMessage(input: MessageInput) {
  const channel = input.channel || "sms";
  const config = getTwilioConfig(channel);
  const { accountSid, authToken, from } = config;
  const to = normalisePhone(input.to);
  if (!accountSid || !authToken || !from || !to) {
    console.warn(`[TwilioNotification] ${channel} skipped`, {
      hasAccountSid: config.hasAccountSid,
      hasAuthToken: config.hasAuthToken,
      hasSender: config.hasRawSender,
      hasValidSender: config.hasValidSender,
      hasValidRecipient: Boolean(to),
    });
    const missing = [
      !config.hasAccountSid && "TWILIO_ACCOUNT_SID",
      !config.hasAuthToken && "TWILIO_AUTH_TOKEN",
      !config.hasValidSender && (channel === "whatsapp" ? "a valid TWILIO_WHATSAPP_FROM (whatsapp:+E164)" : "a valid TWILIO_SMS_FROM"),
      !to && "a valid owner phone number in E.164 format (e.g. +447864585110)",
    ].filter(Boolean);
    return { sent: false, reason: `${channel}_not_configured_or_invalid_number`, detail: `Missing: ${missing.join(", ")}` } as const;
  }

  const formattedTo = channel === "whatsapp" ? `whatsapp:${to}` : to;
  const params = new URLSearchParams({ To: formattedTo, From: from, Body: input.body.slice(0, 1500) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTwilioRequestTimeoutMs());
  let response: Response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.warn(`[TwilioNotification] ${channel} send failed`, response.status, details.slice(0, 300));
    let detail = `Twilio responded ${response.status}`;
    try {
      const parsed = JSON.parse(details) as { code?: number; message?: string };
      if (parsed?.message) detail = `${parsed.code ? `Twilio error ${parsed.code}: ` : ""}${parsed.message}`.slice(0, 300);
    } catch {
      // keep the status-only detail
    }
    return { sent: false, reason: "twilio_error", detail } as const;
  }
  return { sent: true } as const;
}

export async function sendCustomerSms(input: MessageInput) {
  return sendTwilioMessage({ ...input, channel: "sms" });
}

export async function sendCustomerWhatsApp(input: MessageInput) {
  return sendTwilioMessage({ ...input, channel: "whatsapp" });
}

export async function sendCustomerSmsSafely(input: MessageInput) {
  try {
    return await sendCustomerSms(input);
  } catch (error) {
    console.warn("[CustomerSMS] Notification skipped", error);
    return { sent: false, reason: "exception" } as const;
  }
}

export async function sendCustomerWhatsAppSafely(input: MessageInput) {
  try {
    return await sendCustomerWhatsApp(input);
  } catch (error) {
    console.warn("[CustomerWhatsApp] Notification skipped", error);
    return { sent: false, reason: "exception" } as const;
  }
}

export async function notifyOwnerByTwilioSafely(input: { title: string; content: string }) {
  const body = `${input.title}\n${input.content}`.slice(0, 1500);
  const ownerPhone = process.env.EBYSPLACE_OWNER_PHONE_E164 || process.env.OWNER_PHONE_E164 || process.env.TWILIO_OWNER_PHONE;
  const [sms, whatsapp] = await Promise.allSettled([
    sendTwilioMessage({ to: ownerPhone, body, channel: "sms" }),
    sendTwilioMessage({ to: ownerPhone, body, channel: "whatsapp" }),
  ]);
  return {
    sms: sms.status === "fulfilled" ? sms.value : { sent: false, reason: "exception" as const },
    whatsapp: whatsapp.status === "fulfilled" ? whatsapp.value : { sent: false, reason: "exception" as const },
  };
}


type EmailInput = {
  to?: string | null;
  subject: string;
  body: string;
};

function isValidEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

/**
 * Customer email confirmation hook. The payment provider sends the payment
 * receipt email automatically after successful card payment. If a SendGrid key
 * is later added, this helper sends the branded appointment confirmation as a
 * separate customer email without blocking checkout.
 */
export async function sendCustomerEmailSafely(input: EmailInput) {
  try {
    const apiKey = normalizeSecretKey(process.env.SENDGRID_API_KEY);
    const from = trimEnvValue(process.env.SENDGRID_FROM_EMAIL) || trimEnvValue(process.env.CUSTOMER_EMAIL_FROM);
    if (!apiKey || !from || !isValidEmail(input.to)) {
      return { sent: false, reason: "email_provider_not_configured_or_invalid_address" } as const;
    }
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to!.trim() }] }],
        from: { email: from.trim() },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.body.slice(0, 12000) }],
      }),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.warn("[CustomerEmail] Send failed", response.status, details.slice(0, 300));
      return { sent: false, reason: "email_provider_error" } as const;
    }
    return { sent: true } as const;
  } catch (error) {
    console.warn("[CustomerEmail] Notification skipped", error);
    return { sent: false, reason: "exception" } as const;
  }
}


export async function sendOwnerSmsAndWhatsAppSafely(body: string) {
  const ownerPhone = process.env.EBYSPLACE_OWNER_PHONE_E164 || process.env.OWNER_PHONE_E164 || process.env.TWILIO_OWNER_PHONE;
  const results = await Promise.allSettled([
    sendCustomerSmsSafely({ to: ownerPhone, body }),
    sendCustomerWhatsAppSafely({ to: ownerPhone, body }),
  ]);
  return results.map((result) => result.status === 'fulfilled' ? result.value : { sent: false, reason: 'exception' });
}

// Review requests and newsletter welcomes go through Resend (branded, from
// info@ebysplace.com). They used to go through sendCustomerEmailSafely, whose
// SendGrid credentials were never set in production, so they silently never sent.
// Kept plain (no CTA button): 1:1 mail with boxed CTAs has landed in Junk before.
export async function sendReviewRequestEmailSafely(input: { to?: string | null; customerName?: string | null; bookingId?: number | null; serviceName?: string | null }) {
  if (!isValidEmail(input.to)) return { sent: false, reason: "invalid_address" } as const;
  const websiteReviewUrl = `${SITE_URL}/reviews${input.bookingId ? `?booking=${input.bookingId}` : ""}`;
  const result = await sendBrandedEmail({
    to: input.to!.trim(),
    subject: "How was your Eby’s Place appointment?",
    paragraphs: [
      `Hi ${input.customerName || "there"},`,
      `Thank you for visiting Eby’s Place for ${input.serviceName || "your appointment"}. We hope you love your braids.`,
      `If you have a minute, a Google review helps other people in Bridgwater and across Somerset find us: ${GOOGLE_REVIEW_URL}`,
      `You can also leave a review on our website: ${websiteReviewUrl}`,
      "Thank you for your support.",
    ],
  });
  return result.sent ? ({ sent: true } as const) : ({ sent: false, reason: result.errorMessage || "email_provider_error" } as const);
}

export async function sendNewsletterWelcomeEmailSafely(input: { to?: string | null; productAlerts?: boolean }) {
  if (!isValidEmail(input.to)) return { sent: false, reason: "invalid_address" } as const;
  const result = await sendBrandedEmail({
    to: input.to!.trim(),
    subject: "Welcome to Eby’s Place updates",
    paragraphs: [
      "Hi there,",
      "Thank you for joining the Eby’s Place list. You will receive style openings, braid-care guidance, and selected product updates from the Eby’s Place team.",
      input.productAlerts ? "You are also subscribed to product and stock alerts for Eby’s Place braid-care essentials." : "You can opt into product alerts whenever you want updates on braid-care essentials.",
      `Ready for your next style? Book online with a £20 deposit: ${SITE_URL}/booking`,
      "To unsubscribe, reply to this email with “Unsubscribe”. If you did not sign up, you can ignore this email.",
    ],
    headers: { "List-Unsubscribe": "<mailto:info@ebysplace.com?subject=Unsubscribe>" },
  });
  return result.sent ? ({ sent: true } as const) : ({ sent: false, reason: result.errorMessage || "email_provider_error" } as const);
}

function formatAppointmentDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "tomorrow";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

// Day-before reminder. Same Resend path and plain style as the review request.
export async function sendAppointmentReminderEmailSafely(input: { to?: string | null; customerName?: string | null; serviceName?: string | null; appointmentDate?: string | null; appointmentTime?: string | null; serviceLocation?: string | null }) {
  if (!isValidEmail(input.to)) return { sent: false, reason: "invalid_address" } as const;
  const when = `${formatAppointmentDate(input.appointmentDate)}${input.appointmentTime ? ` at ${input.appointmentTime}` : ""}`;
  const result = await sendBrandedEmail({
    to: input.to!.trim(),
    subject: "Your Eby’s Place appointment is tomorrow",
    paragraphs: [
      `Hi ${input.customerName || "there"},`,
      `This is a friendly reminder that your ${input.serviceName || "braiding"} appointment with Eby’s Place is tomorrow, ${when}.`,
      input.serviceLocation === "home_service"
        ? "We will come to the address you gave when booking."
        : "The studio address is in your booking confirmation.",
      "Need to change anything? Reply to this email or message us on WhatsApp at 07864 585110.",
      "We look forward to seeing you.",
    ],
  });
  return result.sent ? ({ sent: true } as const) : ({ sent: false, reason: result.errorMessage || "email_provider_error" } as const);
}

export async function sendShopOrderPaidEmailSafely(input: { to?: string | null; customerName?: string | null; orderId: number | string; deliveryAddress?: string; itemsSummary?: string }) {
  return sendCustomerEmailSafely({
    to: input.to,
    subject: `Eby’s Place shop order #${input.orderId} confirmed`,
    body: [
      `Hi ${input.customerName || 'there'},`,
      `Your Eby’s Place shop payment has been confirmed for order #${input.orderId}.`,
      input.deliveryAddress ? `Delivery address: ${input.deliveryAddress}` : 'Delivery address: provided during checkout.',
      input.itemsSummary ? `Items:\n${input.itemsSummary}` : 'The Eby’s Place team is preparing your order.',
      'Your payment receipt will be sent to the email used at checkout.'
    ].join('\n\n'),
  });
}

type RebookEmailBooking = {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  depositStatus?: string | null;
  serviceLocation?: string | null;
};

const JOIN_LIST_LINE = `So you never miss a free slot or offer, we’d love you to join the Eby’s Place list. It’s one email now and then, and you can leave any time: ${SITE_URL}/newsletter`;
const NOTIFICATIONS_LINE = "You can also turn on notifications to hear first when dates open up. On an iPhone, open ebysplace.com in Safari, tap Share, then Add to Home Screen, open Eby’s Place from your home screen and tap Allow. On Android, open ebysplace.com and tap Allow when it asks.";

function firstName(name: string) {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

/**
 * The apology + "Choose a new date" email, sent when a booked day is full or
 * blocked. The link is the customer's own (see server/rebook.ts).
 */
export async function sendRebookRequestEmailSafely(input: { booking: RebookEmailBooking; rebookUrl: string; reminder?: boolean; onceMore?: boolean }) {
  const { booking } = input;
  if (input.reminder) return sendRebookReminderEmail(booking, input.rebookUrl);
  if (input.onceMore) return sendRebookOnceMoreEmail(booking, input.rebookUrl);
  if (!isValidEmail(booking.clientEmail)) return { sent: false, reason: "invalid_address" } as const;
  const day = formatLongDate(booking.appointmentDate);
  const paid = booking.depositStatus === "paid";
  const result = await sendBrandedEmail({
    to: booking.clientEmail.trim(),
    subject: `Your ${day.split(" ")[0]} booking at Eby’s Place`,
    paragraphs: [
      `Hi ${firstName(booking.clientName)},`,
      `Thank you for booking your ${booking.serviceName.toLowerCase()} with us${paid ? ", and for paying your deposit" : ""}. I’m really sorry, but ${day} is now fully booked, so we can’t fit you in at ${booking.appointmentTime} as planned. Please accept our apologies.`,
      paid
        ? "Your £20 deposit is safe and moves with you to your new date. Please choose the day and time that suits you best. It only takes a moment and there’s nothing more to pay."
        : "Please choose the day and time that suits you best. It only takes a moment.",
    ],
    cta: { label: "Choose a new date", url: input.rebookUrl },
    closing: [
      `Rather talk to us? Just reply to this email and we’ll move it for you.${paid ? " If none of our dates work for you, tell us and we’ll refund your deposit." : ""}`,
      JOIN_LIST_LINE,
      NOTIFICATIONS_LINE,
      "Thank you for understanding, and we can’t wait to see you.",
    ],
  });
  return result.sent ? ({ sent: true } as const) : ({ sent: false, reason: result.errorMessage || "email_provider_error" } as const);
}

/**
 * A one-off apology when a customer's chosen new date can't be kept either
 * (approved for Fenton, 2026-11-06). The owner's number is in this email only.
 */
async function sendRebookOnceMoreEmail(booking: RebookEmailBooking, rebookUrl: string) {
  if (!isValidEmail(booking.clientEmail)) return { sent: false, reason: "invalid_address" } as const;
  const day = formatLongDate(booking.appointmentDate);
  const paid = booking.depositStatus === "paid";
  const name = firstName(booking.clientName);
  const result = await sendBrandedEmail({
    to: booking.clientEmail.trim(),
    subject: `Sorry, ${name}: we need to move your booking once more`,
    paragraphs: [
      `Hi ${name},`,
      `Thank you for choosing a new date so quickly. I\u2019m really sorry to come back to you, but we can\u2019t keep your ${booking.serviceName.toLowerCase()} appointment on ${day} at ${booking.appointmentTime} either.`,
      "This one is our fault, not yours. A fault on our booking system let that time show as free when it wasn\u2019t. Our technical team has now fixed it, and every unavailable day and time is clearly marked on the website, so whatever you choose now is really yours.",
      paid
        ? "Your \u00a320 deposit is safe and moves with you, and there\u2019s nothing more to pay. Please pick a new day and time below."
        : "Please pick a new day and time below.",
    ],
    cta: { label: "Choose a new date", url: rebookUrl },
    closing: [
      "Would you rather speak to Eby herself? Call or WhatsApp her on 07864 585110. Or just reply to this email and we\u2019ll sort it for you.",
      "Thank you for your patience, and sorry again for the trouble. We can\u2019t wait to see you.",
    ],
  });
  return result.sent ? ({ sent: true } as const) : ({ sent: false, reason: result.errorMessage || "email_provider_error" } as const);
}

/** The one follow-up, 24 hours after the first "Choose a new date" email. */
async function sendRebookReminderEmail(booking: RebookEmailBooking, rebookUrl: string) {
  if (!isValidEmail(booking.clientEmail)) return { sent: false, reason: "invalid_address" } as const;
  const day = formatLongDate(booking.appointmentDate);
  const paid = booking.depositStatus === "paid";
  const result = await sendBrandedEmail({
    to: booking.clientEmail.trim(),
    subject: "A quick reminder to choose your new date",
    paragraphs: [
      `Hi ${firstName(booking.clientName)},`,
      `Just a quick reminder: we couldn\u2019t keep your ${booking.serviceName.toLowerCase()} appointment on ${day}, so please choose a new day and time that suits you.${paid ? " Your \u00a320 deposit moves with you." : ""}`,
    ],
    cta: { label: "Choose a new date", url: rebookUrl },
    closing: [
      `Rather talk to us? Just reply to this email and we\u2019ll sort it for you.${paid ? " If none of our dates work, we\u2019ll refund your deposit." : ""}`,
      "Thank you, and sorry again for the change.",
    ],
  });
  return result.sent ? ({ sent: true } as const) : ({ sent: false, reason: result.errorMessage || "email_provider_error" } as const);
}

/** Confirmation after a booking has moved to a new date (by the customer or by us). */
export async function sendBookingMovedEmailSafely(input: { booking: RebookEmailBooking }) {
  const { booking } = input;
  if (!isValidEmail(booking.clientEmail)) return { sent: false, reason: "invalid_address" } as const;
  const day = formatLongDate(booking.appointmentDate);
  const result = await sendBrandedEmail({
    to: booking.clientEmail.trim(),
    subject: `You’re booked in: ${day} at ${booking.appointmentTime}`,
    paragraphs: [
      `Hi ${firstName(booking.clientName)},`,
      `Your ${booking.serviceName.toLowerCase()} appointment is now on ${day} at ${booking.appointmentTime}${booking.serviceLocation === "home_service" ? ", at your home" : ", at the studio"}.${booking.depositStatus === "paid" ? " Your £20 deposit has moved with it, so there’s nothing more to pay before your visit." : ""}`,
      "If you need to change anything, just reply to this email.",
      NOTIFICATIONS_LINE,
      "See you soon!",
    ],
  });
  return result.sent ? ({ sent: true } as const) : ({ sent: false, reason: result.errorMessage || "email_provider_error" } as const);
}
