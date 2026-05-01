import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  analyticsEvents,
  bookings,
  galleryImages,
  InsertUser,
  newsletterSubscribers,
  orderItems,
  orders,
  productVariants,
  products,
  reviews,
  services,
  tryOnGenerations,
  users,
  websiteSections,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _seeded = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "stripeCustomerId"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const seedServices = [
  { name: "Knotless Braids", slug: "knotless-braids", category: "Braids" as const, description: "Lightweight, tension-conscious braids with a seamless natural finish.", duration: "4–6 hours", priceFrom: "120.00", badge: "Signature", isFeatured: "true" as const, sortOrder: 1 },
  { name: "Boho Goddess Braids", slug: "boho-goddess-braids", category: "Braids" as const, description: "Premium boho braids with soft curls for a polished holiday-ready look.", duration: "5–7 hours", priceFrom: "150.00", badge: "Popular", isFeatured: "true" as const, sortOrder: 2 },
  { name: "Senegalese Twists", slug: "senegalese-twists", category: "Twists" as const, description: "Smooth rope twists designed for movement, protection, and comfort.", duration: "4–6 hours", priceFrom: "110.00", badge: "Protective", isFeatured: "true" as const, sortOrder: 3 },
  { name: "Invisible Locs", slug: "invisible-locs", category: "Locs" as const, description: "Modern loc-inspired styling with a soft, natural finish.", duration: "4–5 hours", priceFrom: "130.00", badge: "Trending", isFeatured: "true" as const, sortOrder: 4 },
  { name: "Kids Cornrows", slug: "kids-cornrows", category: "Kids Styles" as const, description: "Gentle, age-appropriate styling for children with comfort-first care.", duration: "1.5–3 hours", priceFrom: "45.00", badge: "Family Friendly", isFeatured: "false" as const, sortOrder: 5 },
  { name: "Wash & Blow Dry", slug: "wash-blow-dry", category: "Add-ons" as const, description: "Cleanse, condition, and prepare hair for a neat protective style appointment.", duration: "45 minutes", priceFrom: "25.00", badge: "Add-on", isFeatured: "false" as const, sortOrder: 6 },
];

const seedProducts = [
  { name: "Satin Edge Scarf", slug: "satin-edge-scarf", category: "Accessories" as const, description: "A silky black satin scarf for preserving edges and protecting fresh braids overnight.", price: "18.00", badge: "Best Seller", stockStatus: "in_stock" as const, stockQuantity: 34, isFeatured: "true" as const },
  { name: "Scalp Comfort Oil", slug: "scalp-comfort-oil", category: "Aftercare" as const, description: "A lightweight scalp oil for protective styles, designed to support comfort and shine.", price: "14.00", badge: "Aftercare", stockStatus: "low_stock" as const, stockQuantity: 8, isFeatured: "true" as const },
  { name: "Premium Braiding Hair", slug: "premium-braiding-hair", category: "Hair Attachments" as const, description: "Soft-touch braiding hair available in classic natural tones and statement shades.", price: "6.50", badge: "Salon Pick", stockStatus: "in_stock" as const, stockQuantity: 120, isFeatured: "true" as const },
];

const seedReviews = [
  { customerName: "Amara", rating: 5, reviewText: "The most comfortable braiding experience I have had. My scalp felt cared for and the finish was beautiful.", status: "approved" as const, source: "website" },
  { customerName: "Naomi", rating: 5, reviewText: "Eby’s Place feels premium from booking to the final look. The braids were neat, lightweight, and lasted so well.", status: "approved" as const, source: "website" },
  { customerName: "Tia", rating: 5, reviewText: "I booked for my daughter and the team was so patient and gentle. A truly family-friendly service.", status: "approved" as const, source: "website" },
];

async function seedIfNeeded() {
  const db = await getDb();
  if (!db || _seeded) return;
  _seeded = true;
  const existingServices = await db.select().from(services).limit(1);
  if (existingServices.length === 0) await db.insert(services).values(seedServices);
  const existingProducts = await db.select().from(products).limit(1);
  if (existingProducts.length === 0) {
    const inserted = await db.insert(products).values(seedProducts).$returningId();
    if (inserted[0]?.id) await db.insert(productVariants).values([{ productId: inserted[0].id, name: "Black", colourHex: "#111111", stockQuantity: 18 }, { productId: inserted[0].id, name: "Gold", colourHex: "#c8a95a", stockQuantity: 16 }]);
    if (inserted[2]?.id) await db.insert(productVariants).values([{ productId: inserted[2].id, name: "1B Natural Black", colourHex: "#1b1715", stockQuantity: 42 }, { productId: inserted[2].id, name: "30 Auburn", colourHex: "#8a4b2a", stockQuantity: 28 }, { productId: inserted[2].id, name: "613 Blonde", colourHex: "#d6b779", stockQuantity: 24 }]);
  }
  const existingReviews = await db.select().from(reviews).limit(1);
  if (existingReviews.length === 0) await db.insert(reviews).values(seedReviews);
  const existingGallery = await db.select().from(galleryImages).limit(1);
  if (existingGallery.length === 0) await db.insert(galleryImages).values([
    { title: "Knotless braid finish", category: "Braids", imageUrl: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?q=80&w=1200&auto=format&fit=crop", altText: "Elegant knotless braid hairstyle", sortOrder: 1 },
    { title: "Soft twist detail", category: "Twists", imageUrl: "https://images.unsplash.com/photo-1605980625600-88a6f024c6ac?q=80&w=1200&auto=format&fit=crop", altText: "Detailed twist protective hairstyle", sortOrder: 2 },
    { title: "Premium salon care", category: "Behind the Chair", imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1200&auto=format&fit=crop", altText: "Premium salon styling experience", sortOrder: 3 },
  ]);
}

export async function listServices(category?: string) {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return seedServices;
  return category ? db.select().from(services).where(eq(services.category, category as any)).orderBy(asc(services.sortOrder)) : db.select().from(services).orderBy(asc(services.sortOrder));
}

export async function listFeaturedServices() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return seedServices.filter((item) => item.isFeatured === "true");
  return db.select().from(services).where(eq(services.isFeatured, "true")).orderBy(asc(services.sortOrder));
}

export async function listProducts() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return seedProducts.map((product) => ({ ...product, variants: [] }));
  const productRows = await db.select().from(products).orderBy(desc(products.isFeatured), asc(products.name));
  const variantRows = await db.select().from(productVariants);
  return productRows.map((product) => ({ ...product, variants: variantRows.filter((variant) => variant.productId === product.id) }));
}

export async function listApprovedReviews() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return seedReviews;
  return db.select().from(reviews).where(eq(reviews.status, "approved")).orderBy(desc(reviews.createdAt));
}

export async function submitReview(input: { customerName: string; rating: number; reviewText: string }) {
  const db = await getDb();
  if (!db) return { id: Date.now(), status: "pending" as const };
  const inserted = await db.insert(reviews).values({ ...input, status: "pending", source: "website" }).$returningId();
  return { id: inserted[0]?.id ?? 0, status: "pending" as const };
}

export async function subscribeNewsletter(email: string, productAlerts = false) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(newsletterSubscribers).values({ email, productAlerts: productAlerts ? "true" : "false" }).onDuplicateKeyUpdate({ set: { productAlerts: productAlerts ? "true" : "false" } });
  return { success: true };
}

export async function listGallery(category?: string) {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return [];
  const filter = category && category !== "All" ? and(eq(galleryImages.isPublished, "true"), eq(galleryImages.category, category as any)) : eq(galleryImages.isPublished, "true");
  return db.select().from(galleryImages).where(filter).orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt));
}

export async function createBooking(input: typeof bookings.$inferInsert) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  const inserted = await db.insert(bookings).values(input).$returningId();
  return { id: inserted[0]?.id ?? 0 };
}

export async function updateBookingCheckout(id: number, stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ depositStatus: "checkout_started", stripeCheckoutSessionId, stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(bookings.id, id));
}

export async function markBookingDepositPaid(stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ depositStatus: "paid", status: "confirmed", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId));
}

export async function createOrderWithItems(input: { customerName: string; customerEmail: string; customerPhone?: string; addressLine1: string; city: string; county?: string; postcode: string; deliveryNote?: string; items: Array<{ productId: number; variantId?: number; productName: string; variantName?: string; quantity: number; unitPrice: string }> }) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  const inserted = await db.insert(orders).values({ customerName: input.customerName, customerEmail: input.customerEmail, customerPhone: input.customerPhone, addressLine1: input.addressLine1, city: input.city, county: input.county, postcode: input.postcode, deliveryNote: input.deliveryNote, status: "draft" }).$returningId();
  const orderId = inserted[0]?.id ?? 0;
  if (orderId && input.items.length) await db.insert(orderItems).values(input.items.map((item) => ({ ...item, orderId })));
  return { id: orderId };
}

export async function recordAnalytics(eventName: string, pagePath: string, metadata?: unknown) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(analyticsEvents).values({ eventName, pagePath, metadata, createdAtMs: Date.now() });
  return { success: true };
}

export async function createTryOnGeneration(input: { styleName: string; originalImageUrl: string; generatedImageUrl?: string; status?: "pending" | "completed" | "failed"; errorMessage?: string }) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  const inserted = await db.insert(tryOnGenerations).values({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, generatedImageUrl: input.generatedImageUrl, status: input.status ?? "pending", errorMessage: input.errorMessage }).$returningId();
  return { id: inserted[0]?.id ?? 0 };
}

export async function updateTryOnGeneration(id: number, input: { generatedImageUrl?: string; status: "completed" | "failed"; errorMessage?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(tryOnGenerations).set(input).where(eq(tryOnGenerations.id, id));
}

export async function adminSummary() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { bookings: 0, orders: 0, pendingReviews: 0, products: seedProducts.length, services: seedServices.length, tryOns: 0 };
  const [bookingRows, orderRows, reviewRows, productRows, serviceRows, tryOnRows] = await Promise.all([db.select().from(bookings), db.select().from(orders), db.select().from(reviews).where(eq(reviews.status, "pending")), db.select().from(products), db.select().from(services), db.select().from(tryOnGenerations)]);
  return { bookings: bookingRows.length, orders: orderRows.length, pendingReviews: reviewRows.length, products: productRows.length, services: serviceRows.length, tryOns: tryOnRows.length };
}

export async function adminLists() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { bookings: [], orders: [], reviews: seedReviews, products: seedProducts, services: seedServices, gallery: [], tryOns: [], sections: [] };
  const [bookingRows, orderRows, reviewRows, productRows, serviceRows, galleryRows, tryOnRows, sectionRows] = await Promise.all([db.select().from(bookings).orderBy(desc(bookings.createdAt)), db.select().from(orders).orderBy(desc(orders.createdAt)), db.select().from(reviews).orderBy(desc(reviews.createdAt)), db.select().from(products).orderBy(desc(products.createdAt)), db.select().from(services).orderBy(asc(services.sortOrder)), db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt)), db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)), db.select().from(websiteSections).orderBy(asc(websiteSections.sortOrder))]);
  return { bookings: bookingRows, orders: orderRows, reviews: reviewRows, products: productRows, services: serviceRows, gallery: galleryRows, tryOns: tryOnRows, sections: sectionRows };
}

export async function moderateReview(id: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) return { success: true };
  await db.update(reviews).set({ status }).where(eq(reviews.id, id));
  return { success: true };
}

export async function updateBookingStatus(id: number, status: "pending" | "confirmed" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) return { success: true };
  await db.update(bookings).set({ status }).where(eq(bookings.id, id));
  return { success: true };
}

export async function updateService(id: number, input: Partial<typeof services.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(services).set(input).where(eq(services.id, id));
  return { id, ...input };
}

export async function updateProduct(id: number, input: Partial<typeof products.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set(input).where(eq(products.id, id));
  return { id, ...input };
}

export async function updateOrderStatus(id: number, status: "draft" | "pending_payment" | "paid" | "fulfilling" | "shipped" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  return { id, status };
}

export async function updateProductStock(id: number, stockQuantity: number, stockStatus: "in_stock" | "low_stock" | "out_of_stock") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set({ stockQuantity, stockStatus }).where(eq(products.id, id));
  return { id, stockQuantity, stockStatus };
}

export async function addGalleryImage(input: typeof galleryImages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(galleryImages).values(input).$returningId();
  return { id: result[0]?.id, ...input };
}

export async function updateWebsiteSection(sectionKey: string, input: Partial<typeof websiteSections.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(websiteSections).values({ sectionKey, title: input.title ?? sectionKey, ...input }).onDuplicateKeyUpdate({ set: input });
  return { sectionKey, ...input };
}
