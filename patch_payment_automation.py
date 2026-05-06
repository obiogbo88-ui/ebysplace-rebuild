from pathlib import Path

root = Path('/home/ubuntu/ebysplace-rebuild')

# Patch db.ts
path = root / 'server/db.ts'
s = path.read_text()
s = s.replace('''async function ensureBookingLocationColumns() {
  const db = await getDb();
  if (!db || !_pool) return;
  await _pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_location_type_enum') THEN
        CREATE TYPE booking_location_type_enum AS ENUM ('studio', 'home_service');
      END IF;
    END $$;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "serviceLocation" booking_location_type_enum NOT NULL DEFAULT 'studio';
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "addressLine2" varchar(255);
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "homeServiceSurcharge" numeric(10,2) NOT NULL DEFAULT '0.00';
  `);
}
''', '''async function ensureBookingLocationColumns() {
  const db = await getDb();
  if (!db || !_pool) return;
  await _pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_location_type_enum') THEN
        CREATE TYPE booking_location_type_enum AS ENUM ('studio', 'home_service');
      END IF;
    END $$;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "serviceLocation" booking_location_type_enum NOT NULL DEFAULT 'studio';
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "addressLine1" varchar(255);
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "addressLine2" varchar(255);
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "city" varchar(120);
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "county" varchar(120);
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "postcode" varchar(40);
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "deliveryNote" text;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "homeServiceSurcharge" numeric(10,2) NOT NULL DEFAULT '0.00';
    ALTER TABLE "bookings" ALTER COLUMN "addressLine1" DROP NOT NULL;
    ALTER TABLE "bookings" ALTER COLUMN "city" DROP NOT NULL;
    ALTER TABLE "bookings" ALTER COLUMN "postcode" DROP NOT NULL;
  `);
}

async function ensureOrderLocationColumns() {
  const db = await getDb();
  if (!db || !_pool) return;
  await _pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_location_type_enum') THEN
        CREATE TYPE booking_location_type_enum AS ENUM ('studio', 'home_service');
      END IF;
    END $$;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "serviceLocation" booking_location_type_enum NOT NULL DEFAULT 'studio';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "addressLine1" varchar(255);
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "addressLine2" varchar(255);
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "city" varchar(120);
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "county" varchar(120);
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "postcode" varchar(40);
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryNote" text;
    ALTER TABLE "orders" ALTER COLUMN "addressLine1" DROP NOT NULL;
    ALTER TABLE "orders" ALTER COLUMN "city" DROP NOT NULL;
    ALTER TABLE "orders" ALTER COLUMN "postcode" DROP NOT NULL;
  `);
}
''')
s = s.replace('''export async function createOrderWithItems(input: { customerName: string; customerEmail: string; customerPhone?: string; addressLine1: string; city: string; county?: string; postcode: string; deliveryNote?: string; items: Array<{ productId: number; variantId?: number; productName: string; variantName?: string; quantity: number; unitPrice: string }> }) {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { id: Date.now(), items: input.items };
''', '''export async function createOrderWithItems(input: { customerName: string; customerEmail: string; customerPhone?: string; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; county?: string | null; postcode?: string | null; deliveryNote?: string; items: Array<{ productId: number; variantId?: number; productName: string; variantName?: string; quantity: number; unitPrice: string }> }) {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { id: Date.now(), items: input.items };
  await ensureOrderLocationColumns();
''')
s = s.replace('''  const inserted = await db.insert(orders).values({ customerName: input.customerName, customerEmail: input.customerEmail, customerPhone: input.customerPhone, addressLine1: input.addressLine1, city: input.city, county: input.county, postcode: input.postcode, deliveryNote: input.deliveryNote, status: "draft" }).returning({ id: orders.id });
''', '''  const inserted = await db.insert(orders).values({
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone || null,
    serviceLocation: "home_service",
    addressLine1: input.addressLine1?.trim() || null,
    addressLine2: input.addressLine2?.trim() || null,
    city: input.city?.trim() || null,
    county: input.county?.trim() || null,
    postcode: input.postcode?.trim() || null,
    deliveryNote: input.deliveryNote?.trim() || null,
    status: "draft",
  }).returning({ id: orders.id });
''')
s = s.replace('''export async function markOrderPaid(stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId));
}
''', '''export async function markOrderPaid(stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
  const db = await getDb();
  if (!db) return;
  await ensureOrderLocationColumns();
  const matchingOrders = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  const order = matchingOrders[0];
  if (!order) return;
  const alreadyPaid = ["paid", "fulfilling", "shipped", "completed"].includes(order.status);
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.id, order.id));
  if (alreadyPaid) return;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const item of items) {
    if (item.variantId) {
      await db.update(productVariants)
        .set({ stockQuantity: sql`GREATEST(${productVariants.stockQuantity} - ${item.quantity}, 0)` })
        .where(eq(productVariants.id, item.variantId));
    }
    await db.update(products)
      .set({
        stockQuantity: sql`GREATEST(${products.stockQuantity} - ${item.quantity}, 0)`,
        stockStatus: sql`CASE WHEN GREATEST(${products.stockQuantity} - ${item.quantity}, 0) = 0 THEN 'out_of_stock'::stock_status_enum ELSE ${products.stockStatus} END`,
      })
      .where(eq(products.id, item.productId));
  }
}
''')
s = s.replace('''export async function getOrderByCheckoutSession(stripeCheckoutSessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}
''', '''export async function getOrderByCheckoutSession(stripeCheckoutSessionId: string) {
  const db = await getDb();
  if (!db) return null;
  await ensureOrderLocationColumns();
  const rows = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderItemsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}
''')
path.write_text(s)

# Patch customerNotifications.ts
path = root / 'server/customerNotifications.ts'
s = path.read_text()
s = s.replace("""export async function sendOwnerSmsAndWhatsAppSafely(body: string) {
  const ownerPhone = process.env.EBYSPLACE_OWNER_PHONE_E164 || '+447864585110';
  const results = await Promise.allSettled([
    sendCustomerSmsSafely({ to: ownerPhone, body }),
    sendCustomerWhatsAppSafely({ to: ownerPhone, body }),
  ]);
  return results.map((result) => result.status === 'fulfilled' ? result.value : { sent: false, reason: 'exception' });
}

export async function sendReviewRequestEmailSafely(input: { to?: string | null; customerName?: string | null; bookingId: number; serviceName?: string | null }) {
  const reviewUrl = `/reviews?booking=${input.bookingId}`;
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
""", """export async function sendOwnerSmsAndWhatsAppSafely(body: string) {
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

export async function sendShopOrderPaidEmailSafely(input: { to?: string | null; customerName?: string | null; orderId: number; itemsSummary?: string }) {
  return sendCustomerEmailSafely({
    to: input.to,
    subject: `Eby’s Place shop order #${input.orderId} confirmed`,
    body: [
      `Hi ${input.customerName || 'there'},`,
      `Your Eby’s Place shop payment has been confirmed for order #${input.orderId}.`,
      input.itemsSummary ? `Items:\n${input.itemsSummary}` : 'The Eby’s Place team is preparing your order.',
      'Stripe will send your payment receipt to the email used at checkout.'
    ].join('\n\n'),
  });
}
""")
path.write_text(s)

# Patch routers.ts imports and procedures
path = root / 'server/routers.ts'
s = path.read_text()
s = s.replace('sendReviewRequestEmailSafely,', 'sendReviewRequestEmailSafely, sendNewsletterWelcomeEmailSafely,')
s = s.replace('''    subscribeNewsletter: publicProcedure.input(z.object({ email: z.string().email(), productAlerts: z.boolean().optional() })).mutation(({ input }) => db.subscribeNewsletter(input.email, input.productAlerts)),''', '''    subscribeNewsletter: publicProcedure.input(z.object({ email: z.string().email(), productAlerts: z.boolean().optional() })).mutation(async ({ input }) => {
      const result = await db.subscribeNewsletter(input.email, input.productAlerts);
      await Promise.allSettled([
        sendNewsletterWelcomeEmailSafely({ to: input.email, productAlerts: input.productAlerts }),
        notifyOwner({ title: "New Eby’s Place newsletter signup", content: `${input.email} joined Eby’s Place updates${input.productAlerts ? " with product alerts" : ""}.` }),
      ]);
      return { ...result, customerNotification: "You’re subscribed to Eby’s Place updates." };
    }),''')
s = s.replace('''      await sendReviewRequestEmailSafely({ to: booking.clientEmail, customerName: booking.clientName, serviceName: booking.serviceName, reviewUrl: "/reviews" });''', '''      await sendReviewRequestEmailSafely({ to: booking.clientEmail, customerName: booking.clientName, bookingId: booking.id, serviceName: booking.serviceName, reviewUrl: `/reviews?booking=${booking.id}` });''')
path.write_text(s)

# Patch stripeWebhook.ts
path = root / 'server/stripeWebhook.ts'
s = path.read_text()
s = s.replace('sendCustomerEmailSafely,', 'sendCustomerEmailSafely, sendShopOrderPaidEmailSafely,')
s = s.replace('''      await db.markOrderPaid(session.id, paymentIntentId);
      const order = await db.getOrderByCheckoutSession(session.id);
      await notifyOwner({
        title: "Eby’s Place shop order paid",
        content: `Order ID: ${metadata.order_id || order?.id || "unknown"}\nCustomer: ${metadata.customer_name || session.customer_email || "unknown"}\nEmail: ${metadata.customer_email || session.customer_email || "unknown"}\nPayment intent: ${paymentIntentId || "not returned"}`,
      });
''', '''      await db.markOrderPaid(session.id, paymentIntentId);
      const order = await db.getOrderByCheckoutSession(session.id);
      const orderItems = order?.id ? await db.getOrderItemsByOrderId(order.id) : [];
      const itemsSummary = orderItems.length
        ? orderItems.map((item) => `- ${item.productName}${item.variantName ? ` — ${item.variantName}` : ""} x${item.quantity}`).join("\\n")
        : undefined;
      await Promise.allSettled([
        sendShopOrderPaidEmailSafely({ to: order?.customerEmail || metadata.customer_email || session.customer_email, customerName: order?.customerName || metadata.customer_name, orderId: Number(metadata.order_id || order?.id || 0), itemsSummary }),
        notifyOwner({
          title: "Eby’s Place shop order paid",
          content: `Order ID: ${metadata.order_id || order?.id || "unknown"}\nCustomer: ${metadata.customer_name || order?.customerName || session.customer_email || "unknown"}\nEmail: ${metadata.customer_email || order?.customerEmail || session.customer_email || "unknown"}\nPayment intent: ${paymentIntentId || "not returned"}${itemsSummary ? `\nItems:\n${itemsSummary}` : ""}`,
        }),
      ]);
''')
path.write_text(s)

# Patch Shop.tsx: Address line 2 must not be required; submit should guard shipping address but allow optional postcode with no min length.
path = root / 'client/src/pages/Shop.tsx'
s = path.read_text()
s = s.replace('''    const result = await order.mutateAsync({ ...delivery, items: cart });''', '''    if (!delivery.addressLine1.trim() || !delivery.city.trim()) {
      toast.error("Please add your delivery address and city before opening secure checkout.");
      return;
    }
    const result = await order.mutateAsync({ ...delivery, items: cart });''')
s = s.replace('''                <input required placeholder="Address line 2 (optional)" value={delivery.addressLine2} onChange={(event) => setDelivery({ ...delivery, addressLine2: event.target.value })} />''', '''                <input placeholder="Address line 2 (optional)" value={delivery.addressLine2} onChange={(event) => setDelivery({ ...delivery, addressLine2: event.target.value })} />''')
s = s.replace('''              <input required placeholder="Postcode" value={delivery.postcode} onChange={(event) => setDelivery({ ...delivery, postcode: event.target.value })} />''', '''              <input placeholder="Postcode (optional if unavailable)" value={delivery.postcode} onChange={(event) => setDelivery({ ...delivery, postcode: event.target.value })} />''')
path.write_text(s)

# Patch tests with focused assertions.
path = root / 'server/ebysplace.business.test.ts'
s = path.read_text()
s = s.replace('''      expect(markOrderPaidSpy).toHaveBeenCalledWith("cs_shop_live_mock", "pi_shop_live_mock");
      expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Eby’s Place shop order paid",
        content: expect.stringContaining("Order ID: 88"),
      }));''', '''      expect(markOrderPaidSpy).toHaveBeenCalledWith("cs_shop_live_mock", "pi_shop_live_mock");
      expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Eby’s Place shop order paid",
        content: expect.stringContaining("Order ID: 88"),
      }));''')
if 'decrements purchased product and variant stock only once when a shop order is marked paid' not in s:
    insert = '''\n\n  it("keeps shop delivery postcode optional in frontend checkout copy", () => {\n    const source = require("node:fs").readFileSync(require("node:path").join(process.cwd(), "client/src/pages/Shop.tsx"), "utf8");\n    expect(source).toContain('placeholder="Postcode (optional if unavailable)"');\n    expect(source).toContain('Please add your delivery address and city before opening secure checkout.');\n    expect(source).not.toContain('required placeholder="Address line 2 (optional)"');\n  });\n'''
    s = s.replace('\n  it("returns an admin summary fallback with seeded services and products", async () => {', insert + '\n  it("returns an admin summary fallback with seeded services and products", async () => {')
path.write_text(s)

# Patch todo tracker
path = root / 'todo.md'
s = path.read_text()
additions = '''\n- [ ] Ensure booking/order address and postcode database fields are nullable where optional while preserving required home-service validation\n- [ ] Reduce shop product and variant stock automatically after successful Stripe shop payment without double-decrementing duplicate webhooks\n- [ ] Send customer confirmation and owner summaries for paid shop orders, newsletter signups, and admin review requests\n- [ ] Fix shop checkout UI so Address Line 2 and postcode are genuinely optional where allowed\n- [ ] Add/update Vitest coverage for the payment, stock, notification, and optional-address automation fixes\n'''
if 'Reduce shop product and variant stock automatically after successful Stripe shop payment' not in s:
    s += additions
path.write_text(s)
