import nodemailer from "nodemailer";
import * as db from "./db";

const STUDIO_CONFIRMATION_ADDRESS = "1 Bawden Close, Woolavington, Bridgwater, Somerset, TA7 8HD, England, United Kingdom";
const CONTACT_PHONE = "+447864585110";
const CONTACT_EMAIL = "info@ebysplace.com";

type EntityType = "booking" | "order";
type Audience = "owner" | "customer";
type EmailStatus = "sent" | "failed" | "pending" | "retried";

type EmailPayload = {
  entityType: EntityType;
  entityId: number;
  audience: Audience;
  to: string | null | undefined;
  subject: string;
  body: string;
};

type SendResult = {
  status: EmailStatus;
  logId?: number;
  messageId?: string;
  errorMessage?: string;
};

function trimQuotes(value: string) {
  return value.trim().replace(/^['\"]|['\"]$/g, "").trim();
}

export function normalizeSmtpPassword(value: string | undefined) {
  return trimQuotes(value ?? "").replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
}

function normalizeEnv(value: string | undefined) {
  return trimQuotes(value ?? "");
}

export function getSmtpConfig() {
  const host = normalizeEnv(process.env.SMTP_HOST) || "smtp.zoho.eu";
  const port = Number(normalizeEnv(process.env.SMTP_PORT) || "465");
  const user = normalizeEnv(process.env.SMTP_USER) || CONTACT_EMAIL;
  const pass = normalizeSmtpPassword(process.env.SMTP_PASS);
  const from = normalizeEnv(process.env.SMTP_FROM) || user;
  const ownerEmail = normalizeEnv(process.env.EBYSPLACE_OWNER_EMAIL) || CONTACT_EMAIL;
  const secure = port === 465;
  return { host, port, secure, user, pass, from, ownerEmail };
}

export function assertSmtpConfigReady() {
  const config = getSmtpConfig();
  const missing = [
    !config.host && "SMTP_HOST",
    !config.port && "SMTP_PORT",
    !config.user && "SMTP_USER",
    !config.pass && "SMTP_PASS",
    !config.from && "SMTP_FROM",
    !config.ownerEmail && "EBYSPLACE_OWNER_EMAIL",
  ].filter(Boolean) as string[];
  if (missing.length) throw new Error(`Missing SMTP configuration: ${missing.join(", ")}`);
  return config;
}

function createTransport() {
  const config = assertSmtpConfigReady();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function verifySmtpConnection() {
  const transporter = createTransport();
  await transporter.verify();
  return getSmtpConfig();
}

function preview(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 900);
}

async function sendAndLogEmail(payload: EmailPayload, mode: "initial" | "resend" = "initial", existingLogId?: number): Promise<SendResult> {
  const config = getSmtpConfig();
  if (!payload.to?.trim()) {
    const errorMessage = `No ${payload.audience} recipient email is available for ${payload.entityType} #${payload.entityId}.`;
    const logId = existingLogId ?? (await db.createEmailNotificationLog({
      entityType: payload.entityType,
      entityId: payload.entityId,
      audience: payload.audience,
      recipientEmail: "missing-recipient@invalid.local",
      subject: payload.subject,
      bodyPreview: preview(payload.body),
      status: "failed",
      smtpHost: config.host,
      errorMessage,
    })).id;
    if (existingLogId) await db.updateEmailNotificationLog(existingLogId, { status: "failed", errorMessage, smtpHost: config.host });
    return { status: "failed", logId, errorMessage };
  }

  const pendingStatus = mode === "resend" ? "retried" : "pending";
  const logId = existingLogId ?? (await db.createEmailNotificationLog({
    entityType: payload.entityType,
    entityId: payload.entityId,
    audience: payload.audience,
    recipientEmail: payload.to.trim(),
    subject: payload.subject,
    bodyPreview: preview(payload.body),
    status: pendingStatus,
    smtpHost: config.host,
  })).id;

  try {
    const transporter = createTransport();
    const result = await transporter.sendMail({
      from: config.from,
      to: payload.to.trim(),
      subject: payload.subject,
      text: payload.body,
    });
    await db.updateEmailNotificationLog(logId, {
      status: mode === "resend" ? "retried" : "sent",
      messageId: result.messageId,
      errorMessage: null,
      smtpHost: config.host,
      sentAtMs: Date.now(),
    });
    return { status: mode === "resend" ? "retried" : "sent", logId, messageId: result.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[SMTP] Failed to send ${payload.entityType} ${payload.audience} email`, { entityId: payload.entityId, errorMessage });
    await db.updateEmailNotificationLog(logId, {
      status: "failed",
      errorMessage,
      smtpHost: config.host,
    });
    return { status: "failed", logId, errorMessage };
  }
}

function money(value: unknown, fallback = "confirmed in your payment receipt") {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return `£${numberValue.toFixed(2)}`;
}

function bookingReference(booking: any) {
  return booking?.id ? `BOOK-${String(booking.id).padStart(5, "0")}` : "Booking reference pending";
}

function orderReference(order: any) {
  return order?.id ? `ORDER-${String(order.id).padStart(5, "0")}` : "Order reference pending";
}

function bookingLocationText(booking: any) {
  if (booking?.serviceLocation === "home_service") {
    const address = [booking.addressLine1, booking.addressLine2, booking.city, booking.county, booking.postcode].filter(Boolean).join(", ");
    return `Home service address: ${address || "address supplied with the booking"}`;
  }
  return `Studio address: ${STUDIO_CONFIRMATION_ADDRESS}`;
}

function orderDeliveryText(order: any) {
  const address = [order?.addressLine1, order?.addressLine2, order?.city, order?.county, order?.postcode].filter(Boolean).join(", ");
  if (address) return `Delivery address: ${address}`;
  return order?.serviceLocation === "studio" ? "Collection/visit option: Eby’s Place studio" : "Delivery/collection information: provided during checkout";
}

export function buildBookingEmailPayloads(booking: any, session: any): EmailPayload[] {
  const config = getSmtpConfig();
  const reference = bookingReference(booking);
  const amountPaid = session?.amount_total != null ? money(Number(session.amount_total) / 100) : "£20.00 deposit";
  const priceLine = booking?.estimatedPrice != null ? money(Number(booking.estimatedPrice) + Number(booking.homeServiceSurcharge || 0)) : amountPaid;
  const customerName = booking?.clientName ?? session?.metadata?.customer_name ?? "Customer";
  const serviceName = booking?.serviceName ?? session?.metadata?.service_name ?? "Selected service";
  const dateTime = `${booking?.appointmentDate ?? "Date TBC"}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""}`;
  const paymentStatus = booking?.depositStatus === "paid" ? "Paid" : "Stripe payment confirmed";
  const notes = booking?.deliveryNote || "No customer notes provided.";
  const surchargePaid = Number(booking?.checkoutSurchargeCharged ?? booking?.homeServiceSurcharge ?? 0);
  const checkoutTotalPaid = session?.amount_total != null
    ? Number(session.amount_total) / 100
    : Number(booking?.checkoutTotalCharged ?? NaN);

  const ownerBody = [
    "A new paid Eby’s Place booking has been confirmed through Stripe.",
    `Booking reference: ${reference}`,
    `Customer name: ${customerName}`,
    `Customer phone: ${booking?.clientPhone ?? "Not provided"}`,
    `Customer email: ${booking?.clientEmail ?? session?.customer_email ?? "Not provided"}`,
    `Service/hairstyle booked: ${serviceName}`,
    `Booking date and time: ${dateTime}`,
    `Price/payment amount: ${priceLine}`,
    surchargePaid > 0 ? `Home service surcharge: ${money(surchargePaid)}` : undefined,
    Number.isFinite(checkoutTotalPaid) ? `Stripe total paid: ${money(checkoutTotalPaid)}` : undefined,
    `Payment status: ${paymentStatus}`,
    `Stripe session: ${session?.id ?? "Not available"}`,
    `Customer notes: ${notes}`,
    bookingLocationText(booking),
  ].join("\n");

  const customerBody = [
    `Hi ${customerName},`,
    "Thank you for booking with Eby’s Place. Your secure payment has been received and your appointment is secured.",
    `Booking reference: ${reference}`,
    `Service/hairstyle booked: ${serviceName}`,
    `Booking date and time: ${dateTime}`,
    `Amount paid or amount due: ${amountPaid}`,
    surchargePaid > 0 ? `Home service surcharge paid: ${money(surchargePaid)}` : undefined,
    Number.isFinite(checkoutTotalPaid) ? `Stripe total paid: ${money(checkoutTotalPaid)}` : undefined,
    bookingLocationText(booking),
    "If you need to update your appointment, please contact Eby’s Place as soon as possible.",
    `Contact: ${CONTACT_EMAIL} | WhatsApp/phone: ${CONTACT_PHONE}`,
  ].join("\n\n");

  return [
    { entityType: "booking", entityId: Number(booking?.id ?? session?.metadata?.booking_id ?? 0), audience: "owner", to: config.ownerEmail, subject: `New paid booking: ${reference}`, body: ownerBody },
    { entityType: "booking", entityId: Number(booking?.id ?? session?.metadata?.booking_id ?? 0), audience: "customer", to: booking?.clientEmail ?? session?.customer_email ?? session?.metadata?.customer_email, subject: `Eby’s Place booking confirmation: ${reference}`, body: customerBody },
  ];
}

export function buildOrderEmailPayloads(order: any, items: any[], session: any): EmailPayload[] {
  const config = getSmtpConfig();
  const reference = orderReference(order);
  const customerName = order?.customerName ?? session?.metadata?.customer_name ?? "Customer";
  const itemsSummary = items.length
    ? items.map((item) => `${item.quantity} × ${item.variantName ? `${item.productName} — ${item.variantName}` : item.productName} (${money(Number(item.unitPrice) * Number(item.quantity))})`).join("\n")
    : "Products recorded during checkout.";
  const totalPaid = items.length ? money(items.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.quantity), 0)) : (session?.amount_total != null ? money(Number(session.amount_total) / 100) : "confirmed in your payment receipt");
  const deliveryText = orderDeliveryText(order);
  const paymentStatus = order?.status === "paid" ? "Paid" : "Stripe payment confirmed";

  const ownerBody = [
    "A new paid Eby’s Place shop order has been confirmed through Stripe.",
    `Order reference: ${reference}`,
    `Customer name: ${customerName}`,
    `Customer phone: ${order?.customerPhone ?? "Not provided"}`,
    `Customer email: ${order?.customerEmail ?? session?.customer_email ?? "Not provided"}`,
    `Products ordered:\n${itemsSummary}`,
    `Total amount paid: ${totalPaid}`,
    deliveryText,
    `Payment status: ${paymentStatus}`,
    `Stripe session: ${session?.id ?? "Not available"}`,
  ].filter(Boolean).join("\n");

  const customerBody = [
    `Hi ${customerName},`,
    "Thank you for shopping with Eby’s Place. Your payment has been received and your order is being prepared.",
    `Order reference: ${reference}`,
    `Products ordered:\n${itemsSummary}`,
    `Total paid: ${totalPaid}`,
    deliveryText,
    "Eby’s Place will contact you if any delivery or collection details need confirming.",
    `Contact: ${CONTACT_EMAIL} | WhatsApp/phone: ${CONTACT_PHONE}`,
  ].filter(Boolean).join("\n\n");

  return [
    { entityType: "order", entityId: Number(order?.id ?? session?.metadata?.order_id ?? 0), audience: "owner", to: config.ownerEmail, subject: `New paid shop order: ${reference}`, body: ownerBody },
    { entityType: "order", entityId: Number(order?.id ?? session?.metadata?.order_id ?? 0), audience: "customer", to: order?.customerEmail ?? session?.customer_email ?? session?.metadata?.customer_email, subject: `Eby’s Place order confirmation: ${reference}`, body: customerBody },
  ];
}

export async function sendBookingPaymentEmailsSafely(booking: any, session: any) {
  const payloads = buildBookingEmailPayloads(booking, session);
  return Promise.all(payloads.map((payload) => sendAndLogEmail(payload).catch((error) => ({ status: "failed" as const, errorMessage: error instanceof Error ? error.message : String(error) }))));
}

export async function sendOrderPaymentEmailsSafely(order: any, items: any[], session: any) {
  const payloads = buildOrderEmailPayloads(order, items, session);
  return Promise.all(payloads.map((payload) => sendAndLogEmail(payload).catch((error) => ({ status: "failed" as const, errorMessage: error instanceof Error ? error.message : String(error) }))));
}

/**
 * Owner-only reminder for a booking that's sat pending (deposit unpaid) past
 * the reminder threshold. Subject is a fixed string so db.getUnconfirmedBookingsNeedingReminder
 * can use it to avoid reminding about the same booking twice.
 */
export async function sendBookingReminderEmailSafely(booking: any) {
  const config = getSmtpConfig();
  const reference = bookingReference(booking);
  const hoursSinceCreated = Math.max(0, Math.round((Date.now() - new Date(booking.createdAt).getTime()) / 3_600_000));
  const body = [
    "A booking is still unconfirmed — no deposit has been paid yet.",
    `Booking reference: ${reference}`,
    `Customer name: ${booking.clientName}`,
    `Customer phone: ${booking.clientPhone}`,
    `Customer email: ${booking.clientEmail}`,
    `Service requested: ${booking.serviceName}`,
    `Requested date/time: ${booking.appointmentDate} at ${booking.appointmentTime}`,
    `Submitted: ${hoursSinceCreated} hours ago`,
    "You may want to follow up with the customer or check whether their payment attempt failed.",
  ].join("\n");
  return sendAndLogEmail({
    entityType: "booking",
    entityId: booking.id,
    audience: "owner",
    to: config.ownerEmail,
    subject: db.BOOKING_REMINDER_SUBJECT,
    body,
  }).catch((error) => ({ status: "failed" as const, errorMessage: error instanceof Error ? error.message : String(error) }));
}

export async function resendEmailNotificationLog(logId: number) {
  const log = await db.getEmailNotificationLogById(logId);
  if (!log) throw new Error("Email notification log not found.");
  if (log.entityType === "booking") {
    const booking = await db.getBookingById(log.entityId);
    if (!booking) throw new Error("Booking for email resend was not found.");
    const payload = buildBookingEmailPayloads(booking, { metadata: { booking_id: booking.id }, customer_email: booking.clientEmail }).find((item) => item.audience === log.audience);
    if (!payload) throw new Error("Booking email payload could not be rebuilt.");
    return sendAndLogEmail(payload, "resend", log.id);
  }
  const order = await db.getOrderById(log.entityId);
  if (!order) throw new Error("Order for email resend was not found.");
  const items = await db.getOrderItemsByOrderId(order.id);
  const payload = buildOrderEmailPayloads(order, items, { metadata: { order_id: order.id }, customer_email: order.customerEmail }).find((item) => item.audience === log.audience);
  if (!payload) throw new Error("Order email payload could not be rebuilt.");
  return sendAndLogEmail(payload, "resend", log.id);
}
