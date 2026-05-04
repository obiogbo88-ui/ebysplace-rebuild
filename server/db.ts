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
  "knotless-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
  "box-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_box_braids_c219e578-5ddc057b3d.png",
  "goddess-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_goddess_braids_da92cf33-2c24c12340.png",
  "fulani-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png",
  "cornrows": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_cornrows_2b5007dd-7637e158cc.png",
  "stitch-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_stitch_braids_562f3424-edda69b630.png",
  "lemonade-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_lemonade_braids_71001277-04350dddc8.png",
  "boho-goddess-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png",
  "tribal-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_tribal_braids_f0ce8622-90e4a26bf0.png",
  "senegalese-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_senegalese_twists_d58a9d66-1fa4e6b79d.png",
  "passion-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_passion_twists_fb79128f-5a04dc2709.png",
  "faux-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_faux_locs_b738d17e-eb99412a43.png",
  "butterfly-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_butterfly_locs_642d7503-3bb725b95f.png",
  "starter-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png",
  "kids-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_kids_braids_066faa86-8d44891ba5.png",
  "kids-cornrows": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png",
  "hair-wash-prep": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png",
  "beads-accessories": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_beads_accessories_05425a55-585b8bc439.png",
  "edge-control-styling": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_edge_control_styling_675ed964-0d252ca79f.png",
  "braid-takedown": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_braid_takedown_6240fcb4-8c93f3e6e6.png"
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_box_braids_c219e578-5ddc057b3d.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_goddess_braids_da92cf33-2c24c12340.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_cornrows_2b5007dd-7637e158cc.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_stitch_braids_562f3424-edda69b630.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_lemonade_braids_71001277-04350dddc8.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_tribal_braids_f0ce8622-90e4a26bf0.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_senegalese_twists_d58a9d66-1fa4e6b79d.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_passion_twists_fb79128f-5a04dc2709.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_faux_locs_b738d17e-eb99412a43.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_butterfly_locs_642d7503-3bb725b95f.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_kids_braids_066faa86-8d44891ba5.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_beads_accessories_05425a55-585b8bc439.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_edge_control_styling_675ed964-0d252ca79f.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/manus-storage/ebysplace_service_braid_takedown_6240fcb4-8c93f3e6e6.png",
  },
];

const seedProducts = [
  { name: "Satin Edge Scarf", slug: "satin-edge-scarf", seoTitle: "Satin Edge Scarf for Braids | Eby’s Place", seoDescription: "Protect fresh braids overnight with a silky satin edge scarf from Eby’s Place, designed to preserve edges and reduce friction.", category: "Accessories" as const, description: "A silky black satin scarf for preserving edges and protecting fresh braids overnight.", price: "18.00", imageUrl: imageBySlug["edge-control-styling"], badge: "Best Seller", stockStatus: "in_stock" as const, stockQuantity: 34, isFeatured: "true" as const },
  { name: "Scalp Comfort Oil", slug: "scalp-comfort-oil", seoTitle: "Scalp Comfort Oil for Protective Styles | Eby’s Place", seoDescription: "Shop lightweight scalp comfort oil for braids, twists, and locs, created to support shine and comfort between salon appointments.", category: "Aftercare" as const, description: "A lightweight scalp oil for protective styles, designed to support comfort and shine.", price: "14.00", imageUrl: imageBySlug["hair-wash-prep"], badge: "Aftercare", stockStatus: "low_stock" as const, stockQuantity: 8, isFeatured: "true" as const },
  { name: "Premium Braiding Hair", slug: "premium-braiding-hair", seoTitle: "Premium Braiding Hair in Natural and Statement Shades | Eby’s Place", seoDescription: "Buy soft-touch premium braiding hair from Eby’s Place in natural tones and statement shades for protective styles.", category: "Hair Attachments" as const, description: "Soft-touch braiding hair available in classic natural tones and statement shades.", price: "6.50", imageUrl: imageBySlug["beads-accessories"], badge: "Salon Pick", stockStatus: "in_stock" as const, stockQuantity: 120, isFeatured: "true" as const },
  { name: "Braid Care Starter Kit", slug: "braid-care-starter-kit", seoTitle: "Braid Care Starter Kit | Eby’s Place", seoDescription: "A practical starter kit for maintaining fresh protective styles between Eby’s Place appointments.", category: "Aftercare" as const, description: "A simple aftercare bundle with satin protection, scalp comfort guidance, and braid maintenance essentials.", price: "28.00", imageUrl: imageBySlug["boho-goddess-braids"], badge: "New", stockStatus: "in_stock" as const, stockQuantity: 20, isFeatured: "true" as const },
];

const seedReviews = [
  { customerName: "Amara", rating: 5, reviewText: "The most comfortable braiding experience I have had. My scalp felt cared for and the finish was beautiful.", status: "approved" as const, source: "website" },
  { customerName: "Naomi", rating: 5, reviewText: "Eby’s Place feels premium from booking to the final look. The braids were neat, lightweight, and lasted so well.", status: "approved" as const, source: "website" },
  { customerName: "Tia", rating: 5, reviewText: "I booked for my daughter and the team was so patient and gentle. A truly family-friendly service.", status: "approved" as const, source: "website" },
  { customerName: "Obi", rating: 5, reviewText: "I cant thank you enough.", status: "approved" as const, source: "google" },
  { customerName: "Claudia Grenlus", rating: 5, reviewText: "Love my hair,happy that I found you ,highly recommend", status: "approved" as const, source: "google" },
  { customerName: "Lauren Groves", rating: 5, reviewText: "Very pleased pleased with my daughters hair .. lovely lady & very professional & welcoming", status: "approved" as const, source: "google" },
  { customerName: "amy martlin", rating: 5, reviewText: "Really happy and would definitely use eby again. She very welcoming, high standards and goes the extra mile. Would highly recommend this lady", status: "approved" as const, source: "google" },
  { customerName: "Rafiatu Yussif", rating: 5, reviewText: "I was happy with my hair and the service given. Thanks Eby’s. Will be returning again.", status: "approved" as const, source: "google" },
  { customerName: "Nazanin Aflakian", rating: 5, reviewText: "I had an amazing experience getting my daughter's hair done! She got African braids, and the stylist was incredibly...", status: "approved" as const, source: "google" },
  { customerName: "Finlay Pettitt", rating: 5, reviewText: "5-star Google review.", status: "approved" as const, source: "google" },
  { customerName: "yaali", rating: 5, reviewText: "i'm a person with a lot of issues and insecurity, but it was such a lovely experience. over the moon with my braids and...", status: "approved" as const, source: "google" },
  { customerName: "Maliha Berridge", rating: 5, reviewText: "My son had his hair braided and extensions by Eby. She was extremely professional and gave great advice on what would be...", status: "approved" as const, source: "google" },
  { customerName: "Miracle Igboanugo", rating: 5, reviewText: "Ooh! I just got my locs with this brand and I loveeee!!! Thank you so much! Cus I am sure coming back for another 😍", status: "approved" as const, source: "google" },
  { customerName: "Ivy O", rating: 5, reviewText: "Excellent hair services. Highly professional and delivers all the time.", status: "approved" as const, source: "google" },
  { customerName: "Lynda Francis", rating: 5, reviewText: "I have had my hair styled on two occasions and they were both fantastic and well above expectations. I would highly recommend. Cheers.", status: "approved" as const, source: "google" },
  { customerName: "Chiamaka Udebbia", rating: 5, reviewText: "Service was great, friendly environment with lovely staff. Price is very reasonable and affordable. Will recommend for everyone.", status: "approved" as const, source: "google" },
  { customerName: "ebirim salvy", rating: 5, reviewText: "Tested and trusted. She gives that perfect African braids vibes Neatly done with care", status: "approved" as const, source: "google" },
  { customerName: "Logos HQ", rating: 5, reviewText: "Thank you for fitting us in last minute! Amazing customer service! Service was done professionally and nice touch with the curls.", status: "approved" as const, source: "google" },
  { customerName: "Onuoha Christiana", rating: 5, reviewText: "Amazing hair stylist.. Highly recommended.. Please do well to patronise her.. I absolutely loved her service", status: "approved" as const, source: "google" },
  { customerName: "Kelly", rating: 5, reviewText: "I recently got my hair done here and i was so pleased with how it came out. She was so quick and she replicated the...", status: "approved" as const, source: "google" },
  { customerName: "Isaac Fortune", rating: 5, reviewText: "Braids were so neat..Nice customer service", status: "approved" as const, source: "google" },
  { customerName: "elizabethz okeke", rating: 5, reviewText: "I received an exceptional service.", status: "approved" as const, source: "google" },
  { customerName: "Nombulelo Choto", rating: 5, reviewText: "Amazing service, always go home loving my hair. Highly recommend!!", status: "approved" as const, source: "google" },
  { customerName: "Chigozie Gloria", rating: 5, reviewText: "5-star Google review.", status: "approved" as const, source: "google" },
];

async function ensureSeedReviews(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  for (const review of seedReviews) {
    const existing = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.customerName, review.customerName), eq(reviews.reviewText, review.reviewText)))
      .limit(1);
    if (existing.length === 0) await db.insert(reviews).values(review);
  }
}

const seedGallery = [
  { title: "Knotless Braids", category: "Braids" as const, imageUrl: imageBySlug["knotless-braids"], altText: "HD model wearing Knotless Braids by Eby’s Place", sortOrder: 1 },
  { title: "Box Braids", category: "Braids" as const, imageUrl: imageBySlug["box-braids"], altText: "HD model wearing Box Braids by Eby’s Place", sortOrder: 2 },
  { title: "Goddess Braids", category: "Braids" as const, imageUrl: imageBySlug["goddess-braids"], altText: "HD model wearing Goddess Braids by Eby’s Place", sortOrder: 3 },
  { title: "Fulani Braids", category: "Braids" as const, imageUrl: imageBySlug["fulani-braids"], altText: "HD model wearing Fulani Braids by Eby’s Place", sortOrder: 4 },
  { title: "Lemonade Braids", category: "Braids" as const, imageUrl: imageBySlug["lemonade-braids"], altText: "HD model wearing Lemonade Braids by Eby’s Place", sortOrder: 5 },
  { title: "Boho Braids", category: "Braids" as const, imageUrl: imageBySlug["boho-goddess-braids"], altText: "HD model wearing Boho Braids by Eby’s Place", sortOrder: 6 },
  { title: "Senegalese Twists", category: "Twists" as const, imageUrl: imageBySlug["senegalese-twists"], altText: "HD model wearing Senegalese Twists by Eby’s Place", sortOrder: 7 },
  { title: "Passion Twists", category: "Twists" as const, imageUrl: imageBySlug["passion-twists"], altText: "HD model wearing Passion Twists by Eby’s Place", sortOrder: 8 },
  { title: "Faux Locs", category: "Locs" as const, imageUrl: imageBySlug["faux-locs"], altText: "HD model wearing Faux Locs by Eby’s Place", sortOrder: 9 },
  { title: "Butterfly Locs", category: "Locs" as const, imageUrl: imageBySlug["butterfly-locs"], altText: "HD model wearing Butterfly Locs by Eby’s Place", sortOrder: 10 },
  { title: "Kids Braids", category: "Kids Styles" as const, imageUrl: imageBySlug["kids-braids"], altText: "HD child model wearing Kids Braids by Eby’s Place", sortOrder: 11 },
  { title: "Starter Locs", category: "Locs" as const, imageUrl: imageBySlug["starter-locs"], altText: "HD model wearing Starter Locs by Eby’s Place", sortOrder: 12 },
];

function isPositivePrice(value: unknown) {
  return Number(value) > 0;
}

function isUsableImageUrl(value: unknown) {
  return typeof value === "string" && (/^\/manus-storage\//.test(value) || /^https?:\/\//.test(value));
}

async function ensureSeedProducts(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  for (const product of seedProducts) {
    await db.insert(products).values(product).onDuplicateKeyUpdate({
      set: {
        name: sql`VALUES(name)`,
        seoTitle: sql`VALUES(seoTitle)`,
        seoDescription: sql`VALUES(seoDescription)`,
        category: sql`VALUES(category)`,
        description: sql`VALUES(description)`,
        price: sql`VALUES(price)`,
        imageUrl: sql`VALUES(imageUrl)`,
        badge: sql`VALUES(badge)`,
        stockStatus: sql`VALUES(stockStatus)`,
        stockQuantity: sql`VALUES(stockQuantity)`,
        isFeatured: sql`VALUES(isFeatured)`,
      },
    });
  }
}

async function ensureSeedGallery(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  for (const item of seedGallery) {
    const existing = await db.select({ id: galleryImages.id }).from(galleryImages).where(eq(galleryImages.title, item.title)).limit(1);
    if (existing.length === 0) {
      await db.insert(galleryImages).values(item);
    } else {
      await db.update(galleryImages).set({ ...item, isPublished: "true" }).where(eq(galleryImages.id, existing[0].id));
    }
  }
}

const seedWebsiteSections = [
  {
    sectionKey: "about_us",
    eyebrow: "Our Story",
    title: "From Passion to Power",
    body: "Eby’s Place was born from a love for braiding and a belief that beautiful hair should never come with pain, pulling, or damage. What began as a passion for helping women and families feel confident has grown into a premium braid-care experience built on gentle hands, neat finishing, protective styling, and genuine customer care.",
    ctaLabel: "Read our services",
    ctaHref: "/services",
    imageUrl: "",
    portraitImageUrl: "",
    portraitDescription: "Eberechi Ogbo | Founder & Service Lead",
    sortOrder: 1,
    isPublished: "true" as const,
  },
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
        priceFrom: sql`VALUES(priceFrom)`,
        badge: sql`VALUES(badge)`,
        isFeatured: sql`VALUES(isFeatured)`,
        imageUrl: sql`VALUES(imageUrl)`,
        sortOrder: sql`VALUES(sortOrder)`,
      },
    });
  await ensureSeedProducts(db);
  const productRows = await db.select().from(products);
  const variantRows = await db.select().from(productVariants);
  const scarf = productRows.find((product) => product.slug === "satin-edge-scarf");
  const hair = productRows.find((product) => product.slug === "premium-braiding-hair");
  if (scarf && !variantRows.some((variant) => variant.productId === scarf.id)) await db.insert(productVariants).values([{ productId: scarf.id, name: "Black", colourHex: "#111111", stockQuantity: 18 }, { productId: scarf.id, name: "Gold", colourHex: "#c8a95a", stockQuantity: 16 }]);
  if (hair && !variantRows.some((variant) => variant.productId === hair.id)) await db.insert(productVariants).values([{ productId: hair.id, name: "1B Natural Black", colourHex: "#1b1715", stockQuantity: 42 }, { productId: hair.id, name: "30 Auburn", colourHex: "#8a4b2a", stockQuantity: 28 }, { productId: hair.id, name: "613 Blonde", colourHex: "#d6b779", stockQuantity: 24 }]);
  await ensureSeedReviews(db);
  const existingSections = await db.select().from(websiteSections).where(eq(websiteSections.sectionKey, "about_us")).limit(1);
  if (existingSections.length === 0) await db.insert(websiteSections).values(seedWebsiteSections);
  await ensureSeedGallery(db);
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

export async function listWebsiteSections() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return seedWebsiteSections.filter((section) => section.isPublished === "true");
  return db.select().from(websiteSections).where(eq(websiteSections.isPublished, "true")).orderBy(asc(websiteSections.sortOrder));
}

export async function listProducts() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return seedProducts.map((product) => ({ ...product, variants: [] }));
  const productRows = await db.select().from(products).orderBy(desc(products.isFeatured), asc(products.name));
  const variantRows = await db.select().from(productVariants);
  const publicRows = productRows.filter((product) => isPositivePrice(product.price));
  const safeRows = publicRows.length ? publicRows : seedProducts;
  return safeRows.map((product) => ({
    ...product,
    imageUrl: isUsableImageUrl(product.imageUrl) ? product.imageUrl : imageBySlug["beads-accessories"],
    seoTitle: product.seoTitle || `${product.name} | Eby’s Place`,
    seoDescription: product.seoDescription || product.description,
    variants: "id" in product ? variantRows.filter((variant) => variant.productId === product.id) : [],
  }));
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
  if (!db) return category && category !== "All" ? seedGallery.filter((item) => item.category === category) : seedGallery;
  const filter = category && category !== "All" ? and(eq(galleryImages.isPublished, "true"), eq(galleryImages.category, category as any)) : eq(galleryImages.isPublished, "true");
  const rows = await db.select().from(galleryImages).where(filter).orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt));
  const safeRows = rows.filter((row) => isUsableImageUrl(row.imageUrl));
  if (safeRows.length >= 8 || (category && category !== "All")) return safeRows;
  const existingTitles = new Set(safeRows.map((row) => row.title));
  return [...safeRows, ...seedGallery.filter((item) => !existingTitles.has(item.title))];
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

export async function updateOrderCheckout(id: number, stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "pending_payment", stripeCheckoutSessionId, stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.id, id));
}

export async function markOrderPaid(stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId));
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
  if (!db) return { bookings: [], orders: [], reviews: seedReviews, products: seedProducts.map((product) => ({ ...product, variants: [] })), services: seedServices, gallery: [], tryOns: [], sections: [] };
  const [bookingRows, orderRows, reviewRows, productRows, variantRows, serviceRows, galleryRows, tryOnRows, sectionRows] = await Promise.all([db.select().from(bookings).orderBy(desc(bookings.createdAt)), db.select().from(orders).orderBy(desc(orders.createdAt)), db.select().from(reviews).orderBy(desc(reviews.createdAt)), db.select().from(products).orderBy(desc(products.createdAt)), db.select().from(productVariants), db.select().from(services).orderBy(asc(services.sortOrder)), db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt)), db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)), db.select().from(websiteSections).orderBy(asc(websiteSections.sortOrder))]);
  const productsWithVariants = productRows.map((product) => ({
    ...product,
    seoTitle: product.seoTitle || `${product.name} | Eby’s Place`,
    seoDescription: product.seoDescription || product.description,
    variants: variantRows.filter((variant) => variant.productId === product.id),
  }));
  return { bookings: bookingRows, orders: orderRows, reviews: reviewRows, products: productsWithVariants, services: serviceRows, gallery: galleryRows, tryOns: tryOnRows, sections: sectionRows };
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

export async function createProduct(input: typeof products.$inferInsert, variants: Array<{ name: string; colourHex?: string; stockQuantity: number }> = []) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const inserted = await db.insert(products).values(input).$returningId();
  const productId = inserted[0]?.id;
  if (productId && variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId })));
  return { id: productId, ...input };
}

export async function replaceProductVariants(productId: number, variants: Array<{ name: string; colourHex?: string; stockQuantity: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId })));
  return { productId, variants };
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

export async function adminInsights() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return {
    bestSellingProducts: [],
    bestBookedServices: [],
    bestTriedStyles: [],
    recentActivity: [],
  };

  const [productSales, bookedServices, triedStyles, bookingRows, orderRows, reviewRows, analyticsRows, tryOnRows, subscriberRows] = await Promise.all([
    db.select({ label: orderItems.productName, units: sql<number>`sum(${orderItems.quantity})`, revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})` }).from(orderItems).groupBy(orderItems.productName).orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(8),
    db.select({ label: bookings.serviceName, total: sql<number>`count(*)` }).from(bookings).groupBy(bookings.serviceName).orderBy(desc(sql`count(*)`)).limit(8),
    db.select({ label: tryOnGenerations.styleName, total: sql<number>`count(*)` }).from(tryOnGenerations).groupBy(tryOnGenerations.styleName).orderBy(desc(sql`count(*)`)).limit(8),
    db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(6),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6),
    db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(6),
    db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt)).limit(6),
    db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)).limit(6),
    db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(6),
  ]);

  const recentActivity = [
    ...bookingRows.map((item) => ({ type: "Booking", label: item.clientName, detail: `${item.serviceName} · ${item.status}`, createdAt: item.createdAt })),
    ...orderRows.map((item) => ({ type: "Shop order", label: item.customerName, detail: `${item.city} · ${item.status}`, createdAt: item.createdAt })),
    ...reviewRows.map((item) => ({ type: "Review", label: item.customerName, detail: `${item.rating} stars · ${item.status}`, createdAt: item.createdAt })),
    ...analyticsRows.map((item) => ({ type: "Visit", label: item.eventName, detail: item.pagePath, createdAt: item.createdAt })),
    ...tryOnRows.map((item) => ({ type: "AI try-on", label: item.styleName, detail: item.status, createdAt: item.createdAt })),
    ...subscriberRows.map((item) => ({ type: "Newsletter", label: item.email, detail: item.productAlerts === "true" ? "Product alerts" : "General updates", createdAt: item.createdAt })),
  ].sort((a, b) => new Date(b.createdAt as Date).getTime() - new Date(a.createdAt as Date).getTime()).slice(0, 12);

  return {
    bestSellingProducts: productSales.map((item) => ({ label: item.label, units: Number(item.units ?? 0), revenue: Number(item.revenue ?? 0) })),
    bestBookedServices: bookedServices.map((item) => ({ label: item.label, total: Number(item.total ?? 0) })),
    bestTriedStyles: triedStyles.map((item) => ({ label: item.label, total: Number(item.total ?? 0) })),
    recentActivity,
  };
}
