import { normalizeSecretKey, trimEnvValue } from "./_core/envSecrets";

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
  const trimmed = value.trim();
  if (channel === "whatsapp") return /^whatsapp:\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : null;
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9 ]{1,11}$/.test(trimmed)) return trimmed;
  return null;
}

async function sendTwilioMessage(input: MessageInput) {
  const accountSid = normalizeSecretKey(process.env.TWILIO_ACCOUNT_SID);
  const authToken = normalizeSecretKey(process.env.TWILIO_AUTH_TOKEN);
  const smsFrom = trimEnvValue(process.env.TWILIO_SMS_FROM);
  const whatsappFrom = trimEnvValue(process.env.TWILIO_WHATSAPP_FROM);
  const to = normalisePhone(input.to);
  const channel = input.channel || "sms";
  const from = normaliseSender(channel === "whatsapp" ? whatsappFrom : smsFrom, channel);
  if (!accountSid || !authToken || !from || !to) {
    return { sent: false, reason: `${channel}_not_configured_or_invalid_number` } as const;
  }

  const formattedTo = channel === "whatsapp" ? `whatsapp:${to}` : to;
  const params = new URLSearchParams({ To: formattedTo, From: from, Body: input.body.slice(0, 1500) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
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
    return { sent: false, reason: "twilio_error" } as const;
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

export async function sendReviewRequestEmailSafely(input: { to?: string | null; customerName?: string | null; bookingId?: number | null; serviceName?: string | null; reviewUrl?: string | null }) {
  const reviewUrl = input.reviewUrl || (input.bookingId ? `/reviews?booking=${input.bookingId}` : '/reviews');
  return sendCustomerEmailSafely({
    to: input.to,
    subject: 'How was your Eby’s Place appointment?',
    body: [
      `Hi ${input.customerName || 'there'},`,
      `Thank you for visiting Eby’s Place for ${input.serviceName || 'your appointment'}.`,
      `Please leave a review here: ${reviewUrl}`,
      'Reviews are checked by the Eby’s Place team before appearing publicly.'
    ].join('\n\n'),
  });
}

export async function sendNewsletterWelcomeEmailSafely(input: { to?: string | null; productAlerts?: boolean }) {
  return sendCustomerEmailSafely({
    to: input.to,
    subject: 'Welcome to Eby’s Place updates',
    body: [
      'Hi there,',
      'Thank you for joining Eby’s Place updates. You will receive styling news, braid-care guidance, booking reminders, and selected product updates from the Eby’s Place team.',
      input.productAlerts ? 'You are also subscribed to product and stock alerts for Eby’s Place braid-care essentials.' : 'You can opt into product alerts whenever you want updates on braid-care essentials.',
      'If this was not you, you can ignore this email.'
    ].join('\n\n'),
  });
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
