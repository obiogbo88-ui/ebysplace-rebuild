from pathlib import Path

root = Path('/home/ubuntu/ebysplace-rebuild')

# Update customer notification helpers with optional provider-ready email and shared confirmation dispatch.
path = root / 'server/customerNotifications.ts'
text = path.read_text()
if 'type EmailInput' not in text:
    text += r'''

type EmailInput = {
  to?: string | null;
  subject: string;
  body: string;
};

function isValidEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

/**
 * Customer email confirmation hook. Stripe Checkout is configured to send the
 * payment receipt email automatically after successful card payment. If a
 * SendGrid key is later added, this helper sends the branded appointment
 * confirmation as a separate customer email without blocking checkout.
 */
export async function sendCustomerEmailSafely(input: EmailInput) {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.SENDGRID_FROM_EMAIL || process.env.CUSTOMER_EMAIL_FROM;
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
        from: { email: from },
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
'''
path.write_text(text)

# Update router booking schema and createBooking serialization.
path = root / 'server/routers.ts'
text = path.read_text()
text = text.replace('import { sendCustomerSmsSafely } from "./customerNotifications";', 'import { sendCustomerSmsSafely } from "./customerNotifications";')
old = '''const bookingInput = z.object({
  serviceId: z.number().optional(),
  serviceName: z.string().min(2),
  clientName: z.string().min(2),
  clientEmail: z.string().email(),
  clientPhone: z.string().min(6),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  county: z.string().optional(),
  postcode: z.string().min(3),
  deliveryNote: z.string().optional(),
  appointmentDate: z.string().min(8),
  appointmentTime: z.string().min(4),
});'''
new = '''const bookingAddOnInput = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  price: z.string().regex(/^\\d+(\\.\\d{2})?$/),
}).strict();

const bookingProductInput = z.object({
  productId: z.number(),
  productName: z.string().min(2),
  quantity: z.number().int().positive(),
  unitPrice: z.string().regex(/^\\d+(\\.\\d{2})?$/),
}).strict();

const bookingInput = z.object({
  serviceId: z.number().optional(),
  serviceName: z.string().min(2),
  clientName: z.string().min(2),
  clientEmail: z.string().email(),
  clientPhone: z.string().min(6),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  county: z.string().optional(),
  postcode: z.string().min(3),
  deliveryNote: z.string().optional(),
  appointmentDate: z.string().min(8),
  appointmentTime: z.string().min(4),
  addOns: z.array(bookingAddOnInput).default([]),
  bookingProducts: z.array(bookingProductInput).default([]),
});'''
if old not in text:
    raise SystemExit('bookingInput block not found')
text = text.replace(old, new)
insert_after = '''async function notifyOwnerSafely(title: string, content: string) {
  try {
    await notifyOwner({ title, content });
  } catch (error) {
    console.warn("[Notification] Owner notification skipped", error);
  }
}
'''
helper = r'''

function formatBookingExtras(input: { addOns?: Array<{ name: string; price: string }>; bookingProducts?: Array<{ productName: string; quantity: number; unitPrice: string }> }) {
  const addOns = input.addOns?.length
    ? input.addOns.map((item) => `${item.name} (£${item.price})`).join(", ")
    : "None selected";
  const bookingProducts = input.bookingProducts?.length
    ? input.bookingProducts.map((item) => `${item.quantity} × ${item.productName} (£${item.unitPrice})`).join(", ")
    : "None selected";
  return { addOns, bookingProducts };
}

function buildBookingNote(input: { deliveryNote?: string; addOns?: Array<{ name: string; price: string }>; bookingProducts?: Array<{ productName: string; quantity: number; unitPrice: string }> }) {
  const extras = formatBookingExtras(input);
  return [
    input.deliveryNote?.trim() ? input.deliveryNote.trim() : undefined,
    `Optional add-ons: ${extras.addOns}`,
    `Optional shop products for appointment order: ${extras.bookingProducts}`,
  ].filter(Boolean).join("\n");
}
'''
if helper not in text:
    text = text.replace(insert_after, insert_after + helper)
old = '''    createBooking: publicProcedure.input(bookingInput).mutation(async ({ input }) => {
      const booking = await db.createBooking({ ...input, status: "pending", depositStatus: "unpaid" });
      await notifyOwnerSafely(
        "New Eby’s Place booking request",
        [
          `A customer has submitted a booking request and needs to complete the £20 Stripe deposit.`,
          `Booking ID: ${booking.id}`,
          `Service: ${input.serviceName}`,
          `Customer: ${input.clientName}`,
          `Email: ${input.clientEmail}`,
          `Phone: ${input.clientPhone}`,
          `Appointment: ${input.appointmentDate} at ${input.appointmentTime}`,
          `Address: ${input.addressLine1}, ${input.city}${input.county ? `, ${input.county}` : ""}, ${input.postcode}`,
          input.deliveryNote ? `Notes: ${input.deliveryNote}` : undefined,
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.clientPhone,
        body: `Eby’s Place received your ${input.serviceName} booking request for ${input.appointmentDate} at ${input.appointmentTime}. Please complete the £20 Stripe deposit on the website to secure it.`,
      });
      return { bookingId: booking.id, depositAmount: 20, depositCurrency: "GBP", message: "A £20 non-refundable deposit is required to secure your Eby’s Place appointment. You will receive on-screen confirmation after Stripe confirms payment.", customerNotification: "Your Eby’s Place booking request has been received. Please complete the secure Stripe deposit checkout to confirm the appointment." };
    }),'''
new = '''    createBooking: publicProcedure.input(bookingInput).mutation(async ({ input }) => {
      const { addOns, bookingProducts, ...bookingFields } = input;
      const bookingNote = buildBookingNote(input);
      const booking = await db.createBooking({ ...bookingFields, deliveryNote: bookingNote, status: "pending", depositStatus: "unpaid" });
      const extras = formatBookingExtras({ addOns, bookingProducts });
      await notifyOwnerSafely(
        "New Eby’s Place booking request",
        [
          `A customer has submitted a booking request and needs to complete the £20 Stripe deposit.`,
          `Booking ID: ${booking.id}`,
          `Service: ${input.serviceName}`,
          `Customer: ${input.clientName}`,
          `Email: ${input.clientEmail}`,
          `Phone: ${input.clientPhone}`,
          `Appointment: ${input.appointmentDate} at ${input.appointmentTime}`,
          `Address: ${input.addressLine1}, ${input.city}${input.county ? `, ${input.county}` : ""}, ${input.postcode}`,
          `Optional add-ons: ${extras.addOns}`,
          `Optional shop products: ${extras.bookingProducts}`,
          input.deliveryNote ? `Notes: ${input.deliveryNote}` : undefined,
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.clientPhone,
        body: `Eby’s Place received your ${input.serviceName} booking request for ${input.appointmentDate} at ${input.appointmentTime}. Please complete the £20 Stripe deposit on the website to secure it. Optional add-ons/products are recorded only when selected.`,
      });
      return { bookingId: booking.id, depositAmount: 20, depositCurrency: "GBP", message: "A £20 non-refundable deposit is required to secure your Eby’s Place appointment. You will receive on-screen confirmation after Stripe confirms payment.", customerNotification: "Your Eby’s Place booking request has been received. Add-ons and shop products are optional, and you can complete the secure Stripe deposit checkout now." };
    }),'''
if old not in text:
    raise SystemExit('createBooking block not found')
text = text.replace(old, new)
path.write_text(text)

# Update Stripe webhook to send email + WhatsApp/SMS after confirmed payment.
path = root / 'server/stripeWebhook.ts'
text = path.read_text()
text = text.replace('import { sendCustomerSmsSafely } from "./customerNotifications";', 'import { sendCustomerEmailSafely, sendCustomerSmsSafely, sendCustomerWhatsAppSafely } from "./customerNotifications";')
old = '''          await sendCustomerSmsSafely({
            to: booking?.clientPhone,
            body: `Your Eby’s Place £20 booking deposit has been confirmed. Your appointment for ${booking?.serviceName ?? "your selected service"}${booking?.appointmentDate ? ` on ${booking.appointmentDate}` : ""}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""} is now secured.`,
          });'''
new = '''          const customerConfirmation = `Your Eby’s Place £20 booking deposit has been confirmed. Your appointment for ${booking?.serviceName ?? "your selected service"}${booking?.appointmentDate ? ` on ${booking.appointmentDate}` : ""}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""} is now secured. Stripe will also email the payment receipt to the checkout email address.`;
          await Promise.allSettled([
            sendCustomerSmsSafely({
              to: booking?.clientPhone,
              body: customerConfirmation,
            }),
            sendCustomerWhatsAppSafely({
              to: booking?.clientPhone,
              body: customerConfirmation,
            }),
            sendCustomerEmailSafely({
              to: booking?.clientEmail ?? session.customer_email,
              subject: "Eby’s Place booking deposit confirmed",
              body: [
                "Thank you for booking with Eby’s Place.",
                customerConfirmation,
                booking?.deliveryNote ? `Booking notes and optional selections:\n${booking.deliveryNote}` : undefined,
                "If anything needs changing, please contact Eby’s Place before your appointment.",
              ].filter(Boolean).join("\n\n"),
            }),
          ]);'''
if old not in text:
    raise SystemExit('webhook sms block not found')
text = text.replace(old, new)
path.write_text(text)

print('server updates complete')
