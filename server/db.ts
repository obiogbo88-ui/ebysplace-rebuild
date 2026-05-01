import { and, asc, desc, eq, sql } from "drizzle-orm";
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

const imageBySlug: Record<string, string> = {
  "knotless-braids": "/manus-storage/ebysplace_service_knotless_braids_ee7bcfb0.png",
  "box-braids": "/manus-storage/ebysplace_service_box_braids_c219e578.png",
  "goddess-braids": "/manus-storage/ebysplace_service_goddess_braids_da92cf33.png",
  "fulani-braids": "/manus-storage/ebysplace_service_fulani_braids_0575047c.png",
  "cornrows": "/manus-storage/ebysplace_service_cornrows_2b5007dd.png",
  "stitch-braids": "/manus-storage/ebysplace_service_stitch_braids_562f3424.png",
  "lemonade-braids": "/manus-storage/ebysplace_service_lemonade_braids_71001277.png",
  "boho-goddess-braids": "/manus-storage/ebysplace_service_boho_braids_ee8557bc.png",
  "tribal-braids": "/manus-storage/ebysplace_service_tribal_braids_f0ce8622.png",
  "senegalese-twists": "/manus-storage/ebysplace_service_senegalese_twists_d58a9d66.png",
  "passion-twists": "/manus-storage/ebysplace_service_passion_twists_fb79128f.png",
  "faux-locs": "/manus-storage/ebysplace_service_faux_locs_b738d17e.png",
  "butterfly-locs": "/manus-storage/ebysplace_service_butterfly_locs_642d7503.png",
  "starter-locs": "/manus-storage/ebysplace_service_starter_locs_3cfa3435.png",
  "kids-braids": "/manus-storage/ebysplace_service_kids_braids_066faa86.png",
  "kids-cornrows": "/manus-storage/ebysplace_service_kids_cornrows_e12e1096.png",
  "hair-wash-prep": "/manus-storage/ebysplace_service_hair_wash_prep_ccec3da2.png",
  "beads-accessories": "/manus-storage/ebysplace_service_beads_accessories_05425a55.png",
  "edge-control-styling": "/manus-storage/ebysplace_service_edge_control_styling_675ed964.png",
  "braid-takedown": "/manus-storage/ebysplace_service_braid_takedown_6240fcb4.png"
};

const seedServices = [
  {
    name: "Knotless Braids",
    slug: "knotless-braids",
    category: "Braids" as const,
    description: "Lightweight, tension-conscious braids with a seamless natural finish and pain-free installation approach.",
    duration: "4–6 hours",
    priceFrom: "120.00",
    badge: "Signature",
    isFeatured: "true" as const,
    sortOrder: 1,
    imageUrl: "/manus-storage/ebysplace_service_knotless_braids_ee7bcfb0.png",
  },
  {
    name: "Box Braids",
    slug: "box-braids",
    category: "Braids" as const,
    description: "Classic individual braids with clean parting, balanced weight, and a polished protective finish.",
    duration: "4–6 hours",
    priceFrom: "100.00",
    badge: "Classic",
    isFeatured: "true" as const,
    sortOrder: 2,
    imageUrl: "/manus-storage/ebysplace_service_box_braids_c219e578.png",
  },
  {
    name: "Goddess Braids",
    slug: "goddess-braids",
    category: "Braids" as const,
    description: "Elegant goddess styling with soft curly details for a refined, feminine finish.",
    duration: "5–7 hours",
    priceFrom: "140.00",
    badge: "Luxury",
    isFeatured: "false" as const,
    sortOrder: 3,
    imageUrl: "/manus-storage/ebysplace_service_goddess_braids_da92cf33.png",
  },
  {
    name: "Fulani Braids",
    slug: "fulani-braids",
    category: "Braids" as const,
    description: "Statement Fulani-inspired braids with a neat front pattern, individual lengths, and optional accessories.",
    duration: "4–6 hours",
    priceFrom: "110.00",
    badge: "Statement",
    isFeatured: "false" as const,
    sortOrder: 4,
    imageUrl: "/manus-storage/ebysplace_service_fulani_braids_0575047c.png",
  },
  {
    name: "Cornrows",
    slug: "cornrows",
    category: "Braids" as const,
    description: "Clean cornrow styling for simple, elegant, and low-maintenance protective wear.",
    duration: "1.5–3 hours",
    priceFrom: "55.00",
    badge: "Neat Finish",
    isFeatured: "false" as const,
    sortOrder: 5,
    imageUrl: "/manus-storage/ebysplace_service_cornrows_2b5007dd.png",
  },
  {
    name: "Stitch Braids",
    slug: "stitch-braids",
    category: "Braids" as const,
    description: "Defined stitch-part braids with sharp detailing and tension-aware installation.",
    duration: "2.5–4 hours",
    priceFrom: "80.00",
    badge: "Defined",
    isFeatured: "false" as const,
    sortOrder: 6,
    imageUrl: "/manus-storage/ebysplace_service_stitch_braids_562f3424.png",
  },
  {
    name: "Lemonade Braids",
    slug: "lemonade-braids",
    category: "Braids" as const,
    description: "Side-swept braid styling with clean direction, polished edges, and a confident finish.",
    duration: "3–5 hours",
    priceFrom: "90.00",
    badge: "Popular",
    isFeatured: "true" as const,
    sortOrder: 7,
    imageUrl: "/manus-storage/ebysplace_service_lemonade_braids_71001277.png",
  },
  {
    name: "Boho Braids",
    slug: "boho-goddess-braids",
    category: "Braids" as const,
    description: "Premium boho braids with soft curls for a polished, holiday-ready look.",
    duration: "5–7 hours",
    priceFrom: "150.00",
    badge: "Popular",
    isFeatured: "true" as const,
    sortOrder: 8,
    imageUrl: "/manus-storage/ebysplace_service_boho_braids_ee8557bc.png",
  },
  {
    name: "Tribal Braids",
    slug: "tribal-braids",
    category: "Braids" as const,
    description: "Pattern-led braids with a tailored layout, premium parting, and optional bead finish.",
    duration: "4–6 hours",
    priceFrom: "120.00",
    badge: "Artistry",
    isFeatured: "false" as const,
    sortOrder: 9,
    imageUrl: "/manus-storage/ebysplace_service_tribal_braids_f0ce8622.png",
  },
  {
    name: "Senegalese Twists",
    slug: "senegalese-twists",
    category: "Twists" as const,
    description: "Smooth rope twists designed for movement, protection, and comfort.",
    duration: "4–6 hours",
    priceFrom: "110.00",
    badge: "Protective",
    isFeatured: "true" as const,
    sortOrder: 10,
    imageUrl: "/manus-storage/ebysplace_service_senegalese_twists_d58a9d66.png",
  },
  {
    name: "Passion Twists",
    slug: "passion-twists",
    category: "Twists" as const,
    description: "Soft, lightweight twists with a textured finish and gentle installation.",
    duration: "4–6 hours",
    priceFrom: "115.00",
    badge: "Soft Texture",
    isFeatured: "false" as const,
    sortOrder: 11,
    imageUrl: "/manus-storage/ebysplace_service_passion_twists_fb79128f.png",
  },
  {
    name: "Faux Locs",
    slug: "faux-locs",
    category: "Locs" as const,
    description: "Protective faux locs with a natural-looking finish and comfortable weight distribution.",
    duration: "5–8 hours",
    priceFrom: "140.00",
    badge: "Protective",
    isFeatured: "true" as const,
    sortOrder: 12,
    imageUrl: "/manus-storage/ebysplace_service_faux_locs_b738d17e.png",
  },
  {
    name: "Butterfly Locs",
    slug: "butterfly-locs",
    category: "Locs" as const,
    description: "Textured butterfly locs with soft volume, movement, and a modern distressed finish.",
    duration: "5–7 hours",
    priceFrom: "135.00",
    badge: "Trending",
    isFeatured: "false" as const,
    sortOrder: 13,
    imageUrl: "/manus-storage/ebysplace_service_butterfly_locs_642d7503.png",
  },
  {
    name: "Starter Locs",
    slug: "starter-locs",
    category: "Locs" as const,
    description: "Starter loc foundation service with neat sectioning and careful guidance for your loc journey.",
    duration: "2–4 hours",
    priceFrom: "85.00",
    badge: "Loc Journey",
    isFeatured: "false" as const,
    sortOrder: 14,
    imageUrl: "/manus-storage/ebysplace_service_starter_locs_3cfa3435.png",
  },
  {
    name: "Kids Braids",
    slug: "kids-braids",
    category: "Kids Styles" as const,
    description: "Gentle, age-appropriate braided styles created with patience, comfort, and neat finishing.",
    duration: "2–4 hours",
    priceFrom: "55.00",
    badge: "Family Friendly",
    isFeatured: "false" as const,
    sortOrder: 15,
    imageUrl: "/manus-storage/ebysplace_service_kids_braids_066faa86.png",
  },
  {
    name: "Kids Cornrows",
    slug: "kids-cornrows",
    category: "Kids Styles" as const,
    description: "Gentle cornrow styling for children with comfort-first care and tidy results.",
    duration: "1.5–3 hours",
    priceFrom: "45.00",
    badge: "Family Friendly",
    isFeatured: "false" as const,
    sortOrder: 16,
    imageUrl: "/manus-storage/ebysplace_service_kids_cornrows_e12e1096.png",
  },
  {
    name: "Hair Wash & Prep",
    slug: "hair-wash-prep",
    category: "Add-ons" as const,
    description: "Cleanse, condition, detangle, and prepare hair for a neat protective style appointment.",
    duration: "45 minutes",
    priceFrom: "25.00",
    badge: "Add-on",
    isFeatured: "false" as const,
    sortOrder: 17,
    imageUrl: "/manus-storage/ebysplace_service_hair_wash_prep_ccec3da2.png",
  },
  {
    name: "Beads & Accessories",
    slug: "beads-accessories",
    category: "Add-ons" as const,
    description: "Custom beads, cuffs, and accessory finishing for a personalised Eby’s Place look.",
    duration: "15–30 minutes",
    priceFrom: "10.00",
    badge: "Finishing",
    isFeatured: "false" as const,
    sortOrder: 18,
    imageUrl: "/manus-storage/ebysplace_service_beads_accessories_05425a55.png",
  },
  {
    name: "Edge Control & Styling",
    slug: "edge-control-styling",
    category: "Add-ons" as const,
    description: "Soft edge styling and polished finishing touches using a scalp-conscious approach.",
    duration: "15 minutes",
    priceFrom: "8.00",
    badge: "Finishing",
    isFeatured: "false" as const,
    sortOrder: 19,
    imageUrl: "/manus-storage/ebysplace_service_edge_control_styling_675ed964.png",
  },
  {
    name: "Braid Takedown",
    slug: "braid-takedown",
    category: "Add-ons" as const,
    description: "Careful braid removal service designed to reduce pulling, breakage, and avoidable stress.",
    duration: "1–2 hours",
    priceFrom: "35.00",
    badge: "Aftercare",
    isFeatured: "false" as const,
    sortOrder: 20,
    imageUrl: "/manus-storage/ebysplace_service_braid_takedown_6240fcb4.png",
  },
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
  await db
    .insert(services)
    .values(seedServices)
    .onDuplicateKeyUpdate({
      set: {
        name: sql`VALUES(name)`,
        category: sql`VALUES(category)`,
        description: sql`VALUES(description)`,
        duration: sql`VALUES(duration)`,
        priceFrom: sql`VALUES(price_from)`,
        badge: sql`VALUES(badge)`,
        isFeatured: sql`VALUES(is_featured)`,
        imageUrl: sql`VALUES(image_url)`,
        sortOrder: sql`VALUES(sort_order)`,
      },
    });
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
    { title: "Knotless Braids", category: "Braids", imageUrl: imageBySlug["knotless-braids"], altText: "HD model wearing Knotless Braids by Eby’s Place", sortOrder: 1 },
    { title: "Box Braids", category: "Braids", imageUrl: imageBySlug["box-braids"], altText: "HD model wearing Box Braids by Eby’s Place", sortOrder: 2 },
    { title: "Goddess Braids", category: "Braids", imageUrl: imageBySlug["goddess-braids"], altText: "HD model wearing Goddess Braids by Eby’s Place", sortOrder: 3 },
    { title: "Senegalese Twists", category: "Twists", imageUrl: imageBySlug["senegalese-twists"], altText: "HD model wearing Senegalese Twists by Eby’s Place", sortOrder: 4 },
    { title: "Faux Locs", category: "Locs", imageUrl: imageBySlug["faux-locs"], altText: "HD model wearing Faux Locs by Eby’s Place", sortOrder: 5 },
    { title: "Kids Braids", category: "Kids Styles", imageUrl: imageBySlug["kids-braids"], altText: "HD child model wearing Kids Braids by Eby’s Place", sortOrder: 6 },
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
