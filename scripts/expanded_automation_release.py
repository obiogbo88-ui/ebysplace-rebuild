from pathlib import Path
import re

root = Path('/home/ubuntu/ebysplace-rebuild')

def read(rel):
    return (root / rel).read_text()

def write(rel, text):
    (root / rel).write_text(text)

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Missing block for {label}')
    return text.replace(old, new, 1)

# --- db helpers ---
db_path = 'server/db.ts'
db = read(db_path)
helper_block = r'''
export type BlockedBookingSlot = { date: string; time?: string; reason?: string };

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function getWebsiteJsonSection<T>(sectionKey: string, fallback: T): Promise<T> {
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const rows = await db.select().from(websiteSections).where(eq(websiteSections.sectionKey, sectionKey)).limit(1);
    return safeParseJson(rows[0]?.body, fallback);
  } catch (error) {
    console.warn(`[Database] Falling back for website JSON section ${sectionKey}`, error);
    return fallback;
  }
}

async function setWebsiteJsonSection(sectionKey: string, value: unknown) {
  const db = await getDb();
  const body = JSON.stringify(value);
  if (!db) return { success: true };
  await db.insert(websiteSections).values({
    sectionKey,
    title: sectionKey,
    body,
  }).onConflictDoUpdate({ target: websiteSections.sectionKey, set: { body, updatedAt: sql`CURRENT_TIMESTAMP` } });
  return { success: true };
}

export async function getAvailabilitySettings() {
  return getWebsiteJsonSection<{ blockedSlots: BlockedBookingSlot[] }>('availability_settings', { blockedSlots: [] });
}

export async function blockBookingSlot(input: BlockedBookingSlot) {
  const settings = await getAvailabilitySettings();
  const nextSlot = { date: input.date, time: input.time || '', reason: input.reason || 'Unavailable' };
  const blockedSlots = settings.blockedSlots.filter((slot) => !(slot.date === nextSlot.date && (slot.time || '') === nextSlot.time));
  blockedSlots.push(nextSlot);
  return setWebsiteJsonSection('availability_settings', { blockedSlots });
}

export async function unblockBookingSlot(input: { date: string; time?: string }) {
  const settings = await getAvailabilitySettings();
  const blockedSlots = settings.blockedSlots.filter((slot) => !(slot.date === input.date && (slot.time || '') === (input.time || '')));
  return setWebsiteJsonSection('availability_settings', { blockedSlots });
}

export async function isBookingSlotBlocked(date: string, time: string) {
  const settings = await getAvailabilitySettings();
  return settings.blockedSlots.some((slot) => slot.date === date && (!(slot.time || '').trim() || slot.time === time));
}

export async function getInstagramSettings() {
  return getWebsiteJsonSection('instagram_settings', {
    handle: '@ebysplace',
    feedUrl: 'https://www.instagram.com/ebysplace/',
    enabled: true,
    note: 'Connect the official Instagram feed provider when production social credentials are available.',
  });
}

export async function updateInstagramSettings(input: { handle: string; feedUrl: string; enabled: boolean; note?: string }) {
  return setWebsiteJsonSection('instagram_settings', input);
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return rows[0] ?? null;
}
'''
if 'export type BlockedBookingSlot' not in db:
    marker = 'export async function subscribeNewsletter(email: string, productAlerts = false) {'
    db = db.replace(marker, helper_block + '\n' + marker, 1)

db = replace_once(db,
'''export async function subscribeNewsletter(email: string, productAlerts = false) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(newsletterSubscribers).values({ email, productAlerts: productAlerts ? "true" : "false" }).onConflictDoUpdate({ target: newsletterSubscribers.email, set: { productAlerts: productAlerts ? "true" : "false" } });
  return { success: true };
}
''',
'''export async function subscribeNewsletter(email: string, productAlerts = false) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(newsletterSubscribers).values({ email, productAlerts: productAlerts ? "true" : "false" }).onConflictDoUpdate({ target: newsletterSubscribers.email, set: { productAlerts: productAlerts ? "true" : "false", subscribedAt: sql`CURRENT_TIMESTAMP` } });
  return { success: true };
}
''', 'newsletter upsert')

# decrement inventory in markOrderPaid if not already present
m = re.search(r'export async function markOrderPaid\(checkoutSessionId: string, paymentIntentId: string \| null\) \{.*?\n\}', db, re.S)
if m and 'stockQuantity - ${item.quantity}' not in m.group(0):
    new = r'''export async function markOrderPaid(checkoutSessionId: string, paymentIntentId: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: paymentIntentId ?? undefined }).where(eq(orders.stripeCheckoutSessionId, checkoutSessionId));
  const orderRows = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, checkoutSessionId)).limit(1);
  const order = orderRows[0];
  if (!order) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const item of items) {
    await db.update(products).set({ stockQuantity: sql`GREATEST(${products.stockQuantity} - ${item.quantity}, 0)`, stockStatus: sql`CASE WHEN GREATEST(${products.stockQuantity} - ${item.quantity}, 0) <= 0 THEN 'out_of_stock' ELSE ${products.stockStatus} END` }).where(eq(products.id, item.productId));
    if (item.variantId) {
      await db.update(productVariants).set({ stockQuantity: sql`GREATEST(${productVariants.stockQuantity} - ${item.quantity}, 0)` }).where(eq(productVariants.id, item.variantId));
    }
  }
}
'''
    db = db[:m.start()] + new + db[m.end():]
write(db_path, db)

# --- customer notification helper exports ---
notif_path = 'server/customerNotifications.ts'
notif = read(notif_path)
if 'sendOwnerSmsAndWhatsAppSafely' not in notif:
    notif += r'''

export async function sendOwnerSmsAndWhatsAppSafely(body: string) {
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
'''
write(notif_path, notif)

# --- routers ---
routers_path = 'server/routers.ts'
rt = read(routers_path)
rt = rt.replace('import { sendCustomerSmsSafely } from "./customerNotifications";', 'import { sendCustomerEmailSafely, sendCustomerSmsSafely, sendOwnerSmsAndWhatsAppSafely, sendReviewRequestEmailSafely } from "./customerNotifications";')
# create booking block check
rt = rt.replace('''      const booking = await db.createBooking({''', '''      if (await db.isBookingSlotBlocked(input.appointmentDate, input.appointmentTime)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That date or time has been blocked by Eby’s Place. Please choose another slot." });
      }
      const booking = await db.createBooking({''', 1)
# public availability/instagram queries after products if absent
if 'availability: publicProcedure.query' not in rt:
    rt = rt.replace('''    products: publicProcedure.query(() => db.listProducts()),''', '''    products: publicProcedure.query(() => db.listProducts()),
    availability: publicProcedure.query(() => db.getAvailabilitySettings()),
    instagramSettings: publicProcedure.query(() => db.getInstagramSettings()),''', 1)
# newsletter mutation notifications
rt = re.sub(r'''newsletterSubscribe: publicProcedure\.input\(z\.object\(\{ email: z\.string\(\)\.email\(\), productAlerts: z\.boolean\(\)\.optional\(\) \}\)\)\.mutation\(async \(\{ input \}\) => \{\n\s*return db\.subscribeNewsletter\(input\.email, input\.productAlerts\);\n\s*\}\),''', '''newsletterSubscribe: publicProcedure.input(z.object({ email: z.string().email(), productAlerts: z.boolean().optional() })).mutation(async ({ input }) => {
      const result = await db.subscribeNewsletter(input.email, input.productAlerts);
      await Promise.allSettled([
        sendCustomerEmailSafely({ to: input.email, subject: "Welcome to Eby’s Place", body: "Thank you for joining the Eby’s Place list. You’ll receive braid-care tips, product updates, appointment news, and salon offers." }),
        notifyOwner({ title: "New Eby’s Place newsletter subscriber", content: `${input.email} joined the newsletter${input.productAlerts ? " and requested product alerts" : ""}.` }),
        sendOwnerSmsAndWhatsAppSafely(`New Eby’s Place newsletter subscriber: ${input.email}`),
      ]);
      return result;
    }),''', rt)
# admin mutations: replace updateBookingStatus block
rt = re.sub(r'''updateBookingStatus: adminProcedure\.input\(z\.object\(\{ id: z\.number\(\), status: z\.enum\(\["pending", "confirmed", "completed", "cancelled"\]\) \}\)\)\.mutation\(\(\{ input \}\) => db\.updateBookingStatus\(input\.id, input\.status\)\),''', '''updateBookingStatus: adminProcedure.input(z.object({ id: z.number(), status: z.enum(["pending", "confirmed", "completed", "cancelled"]) })).mutation(async ({ input }) => {
      const result = await db.updateBookingStatus(input.id, input.status);
      if (input.status === "completed") {
        const booking = await db.getBookingById(input.id);
        await sendReviewRequestEmailSafely({ to: booking?.clientEmail, customerName: booking?.clientName, bookingId: input.id, serviceName: booking?.serviceName });
      }
      return result;
    }),
    sendReviewRequest: adminProcedure.input(z.object({ bookingId: z.number() })).mutation(async ({ input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      return sendReviewRequestEmailSafely({ to: booking.clientEmail, customerName: booking.clientName, bookingId: input.bookingId, serviceName: booking.serviceName });
    }),
    blockAvailabilitySlot: adminProcedure.input(z.object({ date: z.string(), time: z.string().optional(), reason: z.string().optional() })).mutation(({ input }) => db.blockBookingSlot(input)),
    unblockAvailabilitySlot: adminProcedure.input(z.object({ date: z.string(), time: z.string().optional() })).mutation(({ input }) => db.unblockBookingSlot(input)),
    updateInstagramSettings: adminProcedure.input(z.object({ handle: z.string(), feedUrl: z.string().url(), enabled: z.boolean(), note: z.string().optional() })).mutation(({ input }) => db.updateInstagramSettings(input)),''', rt)
write(routers_path, rt)

# --- webhook confirmations ---
webhook_path = 'server/stripeWebhook.ts'
wh = read(webhook_path)
wh = wh.replace('import { sendCustomerEmailSafely, sendCustomerSmsSafely, sendCustomerWhatsAppSafely } from "./customerNotifications";', 'import { sendCustomerEmailSafely, sendCustomerSmsSafely, sendCustomerWhatsAppSafely, sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";')
wh = wh.replace('''          await notifyOwner({
            title: "Eby’s Place deposit paid",''', '''          await sendOwnerSmsAndWhatsAppSafely(`Booking deposit paid: ${booking?.clientName ?? session.metadata?.customer_name ?? "Customer"} booked ${booking?.serviceName ?? session.metadata?.service_name ?? "a service"} on ${booking?.appointmentDate ?? "date TBC"} at ${booking?.appointmentTime ?? "time TBC"}. Email: ${booking?.clientEmail ?? session.customer_email ?? "not provided"}`);
          await notifyOwner({
            title: "Eby’s Place deposit paid",''', 1)
wh = wh.replace('''          await sendCustomerSmsSafely({
            to: order?.customerPhone,
            body: `Eby’s Place has received payment for order #${order?.id ?? session.metadata?.order_id ?? ""}. We will prepare your items and keep you updated.`,
          });
          await notifyOwner({''', '''          const deliveryAddress = [order?.addressLine1, order?.addressLine2, order?.city, order?.county, order?.postcode].filter(Boolean).join(", ");
          await Promise.allSettled([
            sendCustomerSmsSafely({
              to: order?.customerPhone,
              body: `Eby’s Place has received payment for order #${order?.id ?? session.metadata?.order_id ?? ""}. We will prepare your items and keep you updated.`,
            }),
            sendCustomerEmailSafely({
              to: order?.customerEmail ?? session.customer_email,
              subject: "Eby’s Place order confirmed",
              body: [`Thank you for shopping with Eby’s Place.`, `Order reference: #${order?.id ?? session.metadata?.order_id ?? ""}`, `Delivery address: ${deliveryAddress || "provided during checkout"}`, "Estimated delivery: 3–5 working days after dispatch."].join("\n\n"),
            }),
            sendOwnerSmsAndWhatsAppSafely(`New Eby’s Place shop order paid: ${order?.customerName ?? session.metadata?.customer_name ?? "Customer"}, order #${order?.id ?? session.metadata?.order_id ?? ""}, deliver to ${deliveryAddress || "address on order"}.`),
          ]);
          await notifyOwner({''', 1)
write(webhook_path, wh)

# --- Booking page: add policy and blocked slot awareness minimal patch ---
booking_path = 'client/src/pages/Booking.tsx'
bk = read(booking_path)
if 'bookingBlockedSlots' not in bk:
    bk = bk.replace('const depositCheckout = trpc.public.createDepositCheckout.useMutation();', 'const depositCheckout = trpc.public.createDepositCheckout.useMutation();\n  const availability = trpc.public.availability.useQuery();\n  const bookingBlockedSlots = availability.data?.blockedSlots || [];', 1)
if '48-hour cancellation policy' not in bk:
    bk = bk.replace('<form', '<div className="mt-6 rounded-3xl border border-primary/30 bg-primary/10 p-5 text-white/85"><b className="text-primary">48-hour cancellation policy</b><p className="mt-2 text-sm leading-6">Customers can cancel up to 48 hours before the appointment for a deposit refund. Cancellations under 48 hours before the appointment are non-refundable, so please choose your date and time carefully.</p></div>\n        <form', 1)
# inject blocked warning near time selection if common selectedDate variables exist
if 'This slot is unavailable' not in bk:
    bk = bk.replace('{step === 1 &&', '{step === 1 &&', 1)
    bk = bk.replace('</select>', '</select>{bookingBlockedSlots.some((slot: any) => slot.date === booking.appointmentDate && (!slot.time || slot.time === booking.appointmentTime)) ? <p className="mt-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">This slot is unavailable because it has been blocked by Eby’s Place. Please choose another date or time.</p> : null}', 1)
write(booking_path, bk)

# --- Shop full address and disabled out of stock additions ---
shop_path = 'client/src/pages/Shop.tsx'
shop = read(shop_path)
shop = shop.replace('addressLine1: "", city: "", county: "", postcode: "", deliveryNote: ""', 'addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", deliveryNote: ""')
shop = shop.replace('{order.addressLine1}, {order.city}', '{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}')
if 'placeholder="Address line 2' not in shop:
    shop = shop.replace('placeholder="City"', 'placeholder="Address line 2 (optional)" value={delivery.addressLine2} onChange={(event) => setDelivery({ ...delivery, addressLine2: event.target.value })} />\n              <input required placeholder="City"', 1)
write(shop_path, shop)

# --- TryOn limit and prompt copy ---
try_path = 'client/src/pages/TryOn.tsx'
tryon = read(try_path)
if 'TRY_ON_ATTEMPT_LIMIT' not in tryon:
    tryon = tryon.replace('export default function TryOn()', 'const TRY_ON_ATTEMPT_LIMIT = 3;\nconst TRY_ON_ATTEMPT_KEY = "ebysplace_tryon_attempts";\n\nexport default function TryOn()')
    tryon = tryon.replace('const generate = trpc.public.generateTryOn.useMutation();', 'const generate = trpc.public.generateTryOn.useMutation();\n  const [attemptsUsed, setAttemptsUsed] = useState(() => Number(localStorage.getItem(TRY_ON_ATTEMPT_KEY) || "0"));')
    tryon = tryon.replace('const result = await generate.mutateAsync', 'if (attemptsUsed >= TRY_ON_ATTEMPT_LIMIT) { toast.error("You have used your 3 free AI try-on attempts on this device."); return; }\n      const result = await generate.mutateAsync')
    tryon = tryon.replace('setGeneratedUrl(result.imageUrl);', 'setGeneratedUrl(result.imageUrl);\n      const nextAttempts = attemptsUsed + 1;\n      setAttemptsUsed(nextAttempts);\n      localStorage.setItem(TRY_ON_ATTEMPT_KEY, String(nextAttempts));')
if 'Preserve my face exactly' not in tryon:
    tryon = tryon.replace('face preservation', 'face preservation. Preserve my face exactly: only change the hairstyle, and keep skin tone, expression, facial features, face shape, and identity unchanged')
write(try_path, tryon)

# --- Dashboard menu ---
dl_path = 'client/src/components/DashboardLayout.tsx'
dl = read(dl_path)
dl = dl.replace('CalendarDays, Home, Images, LayoutDashboard, LogOut, MessageSquare, Package, PanelLeft, Scissors, ShoppingBag, Users', 'CalendarDays, Home, Images, Instagram, LayoutDashboard, LogOut, MessageSquare, Package, PanelLeft, Scissors, ShoppingBag, Users')
dl = dl.replace('  { icon: CalendarDays, label: "Bookings", path: "/admin#bookings" },', '  { icon: CalendarDays, label: "Bookings", path: "/admin#bookings" },\n  { icon: CalendarDays, label: "Availability", path: "/admin#availability" },')
dl = dl.replace('  { icon: Images, label: "Gallery", path: "/admin#gallery" },', '  { icon: Images, label: "Gallery", path: "/admin#gallery" },\n  { icon: Instagram, label: "Instagram", path: "/admin#instagram" },')
write(dl_path, dl)

# --- Admin UI scripted patches ---
admin_path = 'client/src/pages/Admin.tsx'
adm = read(admin_path)
if 'availabilitySlot' not in adm:
    adm = adm.replace('const [gallery, setGallery]', 'const [availabilitySlot, setAvailabilitySlot] = useState({ date: "", time: "", reason: "Unavailable" });\n  const [instagramSettings, setInstagramSettings] = useState({ handle: "@ebysplace", feedUrl: "https://www.instagram.com/ebysplace/", enabled: true, note: "Latest Eby’s Place Instagram posts appear here once the production feed is connected." });\n  const [gallery, setGallery]')
if 'blockAvailabilitySlot' not in adm:
    adm = adm.replace('const updateBooking = trpc.admin.updateBookingStatus.useMutation', 'const blockAvailabilitySlot = trpc.admin.blockAvailabilitySlot.useMutation({ onSuccess: () => { toast.success("Availability slot blocked"); refresh(); } });\n  const unblockAvailabilitySlot = trpc.admin.unblockAvailabilitySlot.useMutation({ onSuccess: () => { toast.success("Availability slot unblocked"); refresh(); } });\n  const sendReviewRequest = trpc.admin.sendReviewRequest.useMutation({ onSuccess: () => toast.success("Review request sent") });\n  const updateInstagram = trpc.admin.updateInstagramSettings.useMutation({ onSuccess: () => toast.success("Instagram feed settings saved") });\n  const updateBooking = trpc.admin.updateBookingStatus.useMutation')
# add manual review button in bookings row
if 'Send review request' not in adm:
    adm = adm.replace('</select>\n                    </td>', '</select>\n                      {booking.status === "completed" ? <button className="btn-dark mt-2 py-2 text-xs" type="button" onClick={() => sendReviewRequest.mutate({ bookingId: booking.id })}>Send review request</button> : null}\n                    </td>', 1)
# insert availability panel before orders
if 'id="availability"' not in adm:
    availability_panel = '''\n\n          <AdminPanel id="availability" eyebrow="Calendar controls" title="Availability calendar" description="Block and unblock specific appointment dates or individual time slots. Customers cannot book blocked slots." icon={CalendarDays} open={isPanelOpen("availability")} onToggle={() => togglePanel("availability")}>
            <form className="mt-5 grid gap-3 rounded-2xl border border-primary/20 bg-black/20 p-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); blockAvailabilitySlot.mutate(availabilitySlot); }}>
              <input required type="date" value={availabilitySlot.date} onChange={(event) => setAvailabilitySlot({ ...availabilitySlot, date: event.target.value })} />
              <input type="time" value={availabilitySlot.time} onChange={(event) => setAvailabilitySlot({ ...availabilitySlot, time: event.target.value })} />
              <input placeholder="Reason" value={availabilitySlot.reason} onChange={(event) => setAvailabilitySlot({ ...availabilitySlot, reason: event.target.value })} />
              <button className="btn-gold py-2" type="submit">Block slot</button>
            </form>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(data.availability?.blockedSlots || []).length ? (data.availability?.blockedSlots || []).map((slot: any) => <div className="rounded-2xl border border-white/10 p-4" key={`${slot.date}-${slot.time || 'day'}`}><b className="text-primary">{slot.date} {slot.time || 'All day'}</b><p className="text-sm text-white/55">{slot.reason || 'Unavailable'}</p><button className="btn-dark mt-3 py-2 text-sm" type="button" onClick={() => unblockAvailabilitySlot.mutate({ date: slot.date, time: slot.time || undefined })}>Unblock</button></div>) : <p className="text-sm text-white/55">No blocked slots yet.</p>}
            </div>
          </AdminPanel>
'''
    adm = adm.replace('\n          <AdminPanel id="orders"', availability_panel + '\n          <AdminPanel id="orders"', 1)
# insert instagram panel after gallery
if 'id="instagram"' not in adm:
    instagram_panel = '''\n\n          <AdminPanel id="instagram" eyebrow="Social feed" title="Instagram feed settings" description="Store the official Eby’s Place Instagram handle and feed URL used by the public gallery section." icon={Images} open={isPanelOpen("instagram")} onToggle={() => togglePanel("instagram")}>
            <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); updateInstagram.mutate(instagramSettings); }}>
              <input required placeholder="Instagram handle" value={instagramSettings.handle} onChange={(event) => setInstagramSettings({ ...instagramSettings, handle: event.target.value })} />
              <input required placeholder="Instagram feed URL" value={instagramSettings.feedUrl} onChange={(event) => setInstagramSettings({ ...instagramSettings, feedUrl: event.target.value })} />
              <textarea placeholder="Integration note" value={instagramSettings.note} onChange={(event) => setInstagramSettings({ ...instagramSettings, note: event.target.value })} />
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={instagramSettings.enabled} onChange={(event) => setInstagramSettings({ ...instagramSettings, enabled: event.target.checked })} /> Show Instagram feed section</label>
              <button className="btn-gold w-fit py-2" type="submit">Save Instagram settings</button>
            </form>
          </AdminPanel>
'''
    adm = adm.replace('\n\n          <AdminPanel id="users"', instagram_panel + '\n\n          <AdminPanel id="users"', 1)
write(admin_path, adm)
print('expanded automation release patch applied')
