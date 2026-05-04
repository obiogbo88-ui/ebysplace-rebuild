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
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_SMS_FROM;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
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
