import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _seeded = false;
let _unsupportedDatabaseUrlWarned = false;
let _missingDatabaseUrlWarned = false;
let _databaseConnectionFailed = false;
let _lastDatabaseUrlFingerprint: string | null = null;

function isPostgresConnectionString(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function requiresSsl(connectionString: string) {
  return /supabase\.co|sslmode=require/i.test(connectionString);
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function databaseUrlFingerprint(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname ? "/…" : ""}`;
  } catch {
    return "unparseable-url";
  }
}

export async function getDb() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    if (!_missingDatabaseUrlWarned) {
      console.error("[Database] DATABASE_URL is missing. Public reads will use safe seed-data fallbacks and write operations will be skipped.", {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
      });
      _missingDatabaseUrlWarned = true;
    }
    return null;
  }

  const fingerprint = databaseUrlFingerprint(connectionString);
  if (_lastDatabaseUrlFingerprint !== fingerprint) {
    _lastDatabaseUrlFingerprint = fingerprint;
    _databaseConnectionFailed = false;
    console.error("[Database] DATABASE_URL detected for PostgreSQL initialisation", {
      fingerprint,
      isPostgres: isPostgresConnectionString(connectionString),
      requiresSsl: requiresSsl(connectionString),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });
  }

  if (!isPostgresConnectionString(connectionString)) {
    if (!_unsupportedDatabaseUrlWarned) {
      console.error("[Database] Ignoring non-PostgreSQL DATABASE_URL. The production app expects a Supabase PostgreSQL connection string and will use safe seed-data fallbacks until one is configured.", { fingerprint });
      _unsupportedDatabaseUrlWarned = true;
    }
    return null;
  }
  if (_databaseConnectionFailed) return null;
  if (!_db) {
    try {
      _pool = new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
        ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      });
      await _pool.query("select 1");
      _db = drizzle(_pool);
      console.error("[Database] PostgreSQL connection initialised", { fingerprint });
    } catch (error) {
      console.error("[Database] Failed to initialise PostgreSQL connection; falling back to seed data for public reads.", { fingerprint, error });
      await _pool?.end().catch((closeError) => console.error("[Database] Failed to close broken PostgreSQL pool", closeError));
      _pool = null;
      _db = null;
      _databaseConnectionFailed = true;
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
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: { ...updateSet, updatedAt: new Date() } });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export const imageBySlug: Record<string, string> = {
  "knotless-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
  "box-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_box_braids_c219e578-5ddc057b3d.png",
  "goddess-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_goddess_braids_da92cf33-2c24c12340.png",
  "fulani-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png",
  "cornrows": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_cornrows_2b5007dd-7637e158cc.png",
  "stitch-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_stitch_braids_562f3424-edda69b630.png",
  "lemonade-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_lemonade_braids_71001277-04350dddc8.png",
  "boho-goddess-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png",
  "tribal-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_tribal_braids_f0ce8622-90e4a26bf0.png",
  "senegalese-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_senegalese_twists_d58a9d66-1fa4e6b79d.png",
  "passion-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_passion_twists_fb79128f-5a04dc2709.png",
  "faux-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_faux_locs_b738d17e-eb99412a43.png",
  "butterfly-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_butterfly_locs_642d7503-3bb725b95f.png",
  "starter-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png",
  "kids-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_braids_066faa86-8d44891ba5.png",
  "kids-cornrows": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png",
  "hair-wash-prep": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png",
  "beads-accessories": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png",
  "edge-control-styling": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_edge_control_styling_675ed964-0d252ca79f.png",
  "braid-takedown": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_braid_takedown_6240fcb4-8c93f3e6e6.png"
};

export const seedServices = [
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_box_braids_c219e578-5ddc057b3d.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_goddess_braids_da92cf33-2c24c12340.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_cornrows_2b5007dd-7637e158cc.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_stitch_braids_562f3424-edda69b630.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_lemonade_braids_71001277-04350dddc8.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_tribal_braids_f0ce8622-90e4a26bf0.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_senegalese_twists_d58a9d66-1fa4e6b79d.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_passion_twists_fb79128f-5a04dc2709.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_faux_locs_b738d17e-eb99412a43.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_butterfly_locs_642d7503-3bb725b95f.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png",
  },
  {
    name: "Kids Braids",
    slug: "kids-braids",
    category: "Kids Styles" as const,
    description: "Gentle, age-appropriate braided styles created with patience, comfort, and neat finishing. We take our time so every child leaves happy.",
    duration: "2–4 hours",
    priceFrom: "55.00",
    badge: "Child Friendly",
    isFeatured: "false" as const,
    sortOrder: 15,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_braids_066faa86-8d44891ba5.png",
  },
  {
    name: "Kids Cornrows",
    slug: "kids-cornrows",
    category: "Kids Styles" as const,
    description: "Gentle cornrow styling for children of all ages, with comfort-first care, zero tension, and tidy results that last.",
    duration: "1.5–3 hours",
    priceFrom: "45.00",
    badge: "Child Friendly",
    isFeatured: "false" as const,
    sortOrder: 16,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png",
  },
  {
    name: "Kids Box Braids",
    slug: "kids-box-braids",
    category: "Kids Styles" as const,
    description: "Neat individual box braids for children, installed gently with lightweight hair and careful sectioning to protect young scalps.",
    duration: "2–4 hours",
    priceFrom: "60.00",
    badge: "Child Friendly",
    isFeatured: "false" as const,
    sortOrder: 17,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_braids_066faa86-8d44891ba5.png",
  },
  {
    name: "Kids Knotless Braids",
    slug: "kids-knotless-braids",
    category: "Kids Styles" as const,
    description: "Feather-light knotless braids for children — no tension at the root, no discomfort. The kindest protective style for young hair.",
    duration: "2.5–4 hours",
    priceFrom: "65.00",
    badge: "Child Friendly",
    isFeatured: "false" as const,
    sortOrder: 18,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
  },
  {
    name: "Kids Twists",
    slug: "kids-twists",
    category: "Kids Styles" as const,
    description: "Soft, comfortable twists for children that are quick to install and gentle on sensitive scalps.",
    duration: "1.5–3 hours",
    priceFrom: "50.00",
    badge: "Child Friendly",
    isFeatured: "false" as const,
    sortOrder: 19,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_passion_twists_fb79128f-5a04dc2709.png",
  },
  {
    name: "Back to School Styles",
    slug: "back-to-school-styles",
    category: "Kids Styles" as const,
    description: "Smart, neat, long-lasting protective styles for school — including cornrows, braids, and twists that stay tidy for weeks.",
    duration: "2–4 hours",
    priceFrom: "50.00",
    badge: "Family Friendly",
    isFeatured: "false" as const,
    sortOrder: 20,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png",
  },
  {
    name: "Men Cornrows",
    slug: "men-cornrows",
    category: "Men Styles" as const,
    description: "Clean, precise cornrow styling for men — laid flat and tailored to your preferred pattern for a sharp, low-maintenance look.",
    duration: "1.5–3 hours",
    priceFrom: "55.00",
    badge: "Men's Style",
    isFeatured: "false" as const,
    sortOrder: 21,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_cornrows_2b5007dd-7637e158cc.png",
  },
  {
    name: "Men Box Braids",
    slug: "men-box-braids",
    category: "Men Styles" as const,
    description: "Individual box braids for men, available in a range of lengths and sizes with a clean, polished finish.",
    duration: "3–5 hours",
    priceFrom: "80.00",
    badge: "Men's Style",
    isFeatured: "false" as const,
    sortOrder: 22,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_box_braids_c219e578-5ddc057b3d.png",
  },
  {
    name: "Men Twists",
    slug: "men-twists",
    category: "Men Styles" as const,
    description: "Smooth two-strand twists for men, offering a textured, protective style with a natural finish.",
    duration: "2–4 hours",
    priceFrom: "70.00",
    badge: "Men's Style",
    isFeatured: "false" as const,
    sortOrder: 23,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_senegalese_twists_d58a9d66-1fa4e6b79d.png",
  },
  {
    name: "Fulani Braids for Men",
    slug: "fulani-braids-men",
    category: "Men Styles" as const,
    description: "Bold Fulani-inspired braids for men with a statement front pattern and optional bead accessories.",
    duration: "3–5 hours",
    priceFrom: "90.00",
    badge: "Men's Style",
    isFeatured: "false" as const,
    sortOrder: 24,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png",
  },
  {
    name: "Locs for Men",
    slug: "locs-men",
    category: "Men Styles" as const,
    description: "Starter locs and faux loc installation for men — a protective journey or instant statement look with a clean finish.",
    duration: "2–5 hours",
    priceFrom: "85.00",
    badge: "Men's Style",
    isFeatured: "false" as const,
    sortOrder: 25,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_edge_control_styling_675ed964-0d252ca79f.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_braid_takedown_6240fcb4-8c93f3e6e6.png",
  },
];

const PRODUCT_IMAGE_FALLBACK_URL = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png";
const ABOUT_PORTRAIT_FALLBACK_URL = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-about-story-portrait.png";

export const seedProducts = [
  { name: "Satin Edge Scarf", slug: "satin-edge-scarf", seoTitle: "Satin Edge Scarf for Braids | Eby’s Place", seoDescription: "Protect fresh braids overnight with a silky satin edge scarf from Eby’s Place, designed to preserve edges and reduce friction.", category: "Accessories" as const, description: "A silky black satin scarf for preserving edges and protecting fresh braids overnight.", price: "18.00", imageUrl: imageBySlug["edge-control-styling"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "Best Seller", stockStatus: "in_stock" as const, stockQuantity: 34, isFeatured: "true" as const },
  { name: "Scalp Comfort Oil", slug: "scalp-comfort-oil", seoTitle: "Scalp Comfort Oil for Protective Styles | Eby’s Place", seoDescription: "Shop lightweight scalp comfort oil for braids, twists, and locs, created to support shine and comfort between salon appointments.", category: "Aftercare" as const, description: "A lightweight scalp oil for protective styles, designed to support comfort and shine.", price: "14.00", imageUrl: imageBySlug["hair-wash-prep"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "Aftercare", stockStatus: "low_stock" as const, stockQuantity: 8, isFeatured: "true" as const },
  { name: "Premium Braiding Hair", slug: "premium-braiding-hair", seoTitle: "Premium Braiding Hair in Natural and Statement Shades | Eby’s Place", seoDescription: "Buy soft-touch premium braiding hair from Eby’s Place in natural tones and statement shades for protective styles.", category: "Hair Attachments" as const, description: "Soft-touch braiding hair available in classic natural tones and statement shades.", price: "6.50", imageUrl: imageBySlug["beads-accessories"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "Salon Pick", stockStatus: "in_stock" as const, stockQuantity: 120, isFeatured: "true" as const },
  { name: "Braid Care Starter Kit", slug: "braid-care-starter-kit", seoTitle: "Braid Care Starter Kit | Eby’s Place", seoDescription: "A practical starter kit for maintaining fresh protective styles between Eby’s Place appointments.", category: "Aftercare" as const, description: "A simple aftercare bundle with satin protection, scalp comfort guidance, and braid maintenance essentials.", price: "28.00", imageUrl: imageBySlug["boho-goddess-braids"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "New", stockStatus: "in_stock" as const, stockQuantity: 20, isFeatured: "true" as const },
];

export const seedReviews = [
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

export const seedGallery = [
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
  return typeof value === "string" && /^https?:\/\//.test(value);
}

async function ensureSeedProducts(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  for (const product of seedProducts) {
    await db.insert(products).values(product).onConflictDoUpdate({
      target: products.slug,
      set: {
        name: product.name,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        category: product.category,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        badge: product.badge,
        stockStatus: product.stockStatus,
        stockQuantity: product.stockQuantity,
        isFeatured: product.isFeatured,
        updatedAt: new Date(),
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

export const seedWebsiteSections = [
  {
    sectionKey: "about_us",
    eyebrow: "Our Story",
    title: "From Passion to Power",
    body: "Eby’s Place was born from a love for braiding and a belief that beautiful hair should never come with pain, pulling, or damage. What began as a passion for helping women and families feel confident has grown into a premium braid-care experience built on gentle hands, neat finishing, protective styling, and genuine customer care.",
    ctaLabel: "Read our services",
    ctaHref: "/services",
    imageUrl: ABOUT_PORTRAIT_FALLBACK_URL,
    portraitImageUrl: ABOUT_PORTRAIT_FALLBACK_URL,
    portraitDescription: "Eberechi Ogbo | Founder & Service Lead",
    sortOrder: 1,
    isPublished: "true" as const,
  },
];

async function seedIfNeeded() {
  const db = await getDb();
  if (!db || _seeded) return;
  _seeded = true;
  for (const service of seedServices) {
    await db.insert(services).values(service).onConflictDoUpdate({
      target: services.slug,
      set: {
        name: service.name,
        category: service.category,
        description: service.description,
        duration: service.duration,
        priceFrom: service.priceFrom,
        badge: service.badge,
        isFeatured: service.isFeatured,
        imageUrl: service.imageUrl,
        sortOrder: service.sortOrder,
        updatedAt: new Date(),
      },
    });
  }
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

function mergeWithSeedServices(rows: Array<typeof services.$inferSelect>, category?: string) {
  const scopedRows = category ? rows.filter((row) => row.category === category) : rows;
  const usableRows = scopedRows.map((row) => ({
    ...row,
    imageUrl: isUsableImageUrl(row.imageUrl) ? row.imageUrl : imageBySlug[row.slug] || row.imageUrl,
  }));
  const existingSlugs = new Set(usableRows.map((row) => row.slug));
  const scopedSeeds = seedServices.filter((item) => (!category || item.category === category) && !existingSlugs.has(item.slug));
  return [...usableRows, ...scopedSeeds].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function listServices(category?: string) {
  const fallback = category ? seedServices.filter((item) => item.category === category) : seedServices;
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const rows = await db.select().from(services).orderBy(asc(services.sortOrder));
    return mergeWithSeedServices(rows, category);
  } catch (error) {
    console.warn("[Database] Falling back to seeded services", error);
    return fallback;
  }
}

export async function listFeaturedServices() {
  const fallback = seedServices.filter((item) => item.isFeatured === "true");
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const rows = await db.select().from(services).where(eq(services.isFeatured, "true")).orderBy(asc(services.sortOrder));
    const safeRows = mergeWithSeedServices(rows).filter((item) => item.isFeatured === "true");
    return safeRows.length ? safeRows : fallback;
  } catch (error) {
    console.warn("[Database] Falling back to seeded featured services", error);
    return fallback;
  }
}

export async function listWebsiteSections() {
  const fallback = seedWebsiteSections.filter((section) => section.isPublished === "true");
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const rows = await db.select().from(websiteSections).where(eq(websiteSections.isPublished, "true")).orderBy(asc(websiteSections.sortOrder));
    return rows.length ? rows : fallback;
  } catch (error) {
    console.warn("[Database] Falling back to seeded website sections", error);
    return fallback;
  }
}

export async function listProducts() {
  const fallback = seedProducts.map((product) => ({ ...product, variants: [] }));
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const productRows = await db.select().from(products).orderBy(desc(products.isFeatured), asc(products.name));
    const variantRows = await db.select().from(productVariants);
    const publicRows = productRows.filter((product) => isPositivePrice(product.price));
    const safeRows = publicRows.length ? publicRows : seedProducts;
    return safeRows.map((product) => ({
      ...product,
      imageUrl: isUsableImageUrl(product.imageUrl) ? product.imageUrl : PRODUCT_IMAGE_FALLBACK_URL,
      seoTitle: product.seoTitle || `${product.name} | Eby’s Place`,
      seoDescription: product.seoDescription || product.description,
      variants: "id" in product ? variantRows.filter((variant) => variant.productId === product.id) : [],
    }));
  } catch (error) {
    console.warn("[Database] Falling back to seeded products", error);
    return fallback;
  }
}

export async function listApprovedReviews() {
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return seedReviews;
    const rows = await db.select().from(reviews).where(eq(reviews.status, "approved")).orderBy(desc(reviews.createdAt));
    return rows.length ? rows : seedReviews;
  } catch (error) {
    console.warn("[Database] Falling back to seeded reviews", error);
    return seedReviews;
  }
}

export async function submitReview(input: { customerName: string; rating: number; reviewText: string }) {
  const db = await getDb();
  if (!db) return { id: Date.now(), status: "pending" as const };
  const inserted = await db.insert(reviews).values({ ...input, status: "pending", source: "website" }).returning({ id: reviews.id });
  return { id: inserted[0]?.id ?? 0, status: "pending" as const };
}


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
  const settings = await getWebsiteJsonSection<{ blockedSlots: BlockedBookingSlot[]; homeServiceSurcharge?: string }>('availability_settings', { blockedSlots: [], homeServiceSurcharge: "0.00" });
  return { blockedSlots: settings.blockedSlots || [], homeServiceSurcharge: settings.homeServiceSurcharge || "0.00" };
}

export async function updateHomeServiceSurcharge(homeServiceSurcharge: string) {
  const settings = await getAvailabilitySettings();
  return setWebsiteJsonSection('availability_settings', { ...settings, homeServiceSurcharge });
}

export async function blockBookingSlot(input: BlockedBookingSlot) {
  const settings = await getAvailabilitySettings();
  const nextSlot = { date: input.date, time: input.time || '', reason: input.reason || 'Unavailable' };
  const blockedSlots = settings.blockedSlots.filter((slot) => !(slot.date === nextSlot.date && (slot.time || '') === nextSlot.time));
  blockedSlots.push(nextSlot);
  return setWebsiteJsonSection('availability_settings', { ...settings, blockedSlots });
}

export async function unblockBookingSlot(input: { date: string; time?: string }) {
  const settings = await getAvailabilitySettings();
  const blockedSlots = settings.blockedSlots.filter((slot) => !(slot.date === input.date && (slot.time || '') === (input.time || '')));
  return setWebsiteJsonSection('availability_settings', { ...settings, blockedSlots });
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
  await ensureBookingLocationColumns();
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function subscribeNewsletter(email: string, productAlerts = false) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(newsletterSubscribers).values({ email, productAlerts: productAlerts ? "true" : "false" }).onConflictDoUpdate({ target: newsletterSubscribers.email, set: { productAlerts: productAlerts ? "true" : "false", createdAt: sql`CURRENT_TIMESTAMP` } });
  return { success: true };
}

export async function listGallery(category?: string) {
  const fallback = category && category !== "All" ? seedGallery.filter((item) => item.category === category) : seedGallery;
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const filter = category && category !== "All" ? and(eq(galleryImages.isPublished, "true"), eq(galleryImages.category, category as any)) : eq(galleryImages.isPublished, "true");
    const rows = await db.select().from(galleryImages).where(filter).orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt));
    const safeRows = rows.filter((row) => isUsableImageUrl(row.imageUrl));
    if (safeRows.length >= 8 || (category && category !== "All")) return safeRows.length ? safeRows : fallback;
    const existingTitles = new Set(safeRows.map((row) => row.title));
    return [...safeRows, ...seedGallery.filter((item) => !existingTitles.has(item.title))];
  } catch (error) {
    console.warn("[Database] Falling back to seeded gallery", error);
    return fallback;
  }
}

async function ensureBookingLocationColumns() {
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

export async function createBooking(input: typeof bookings.$inferInsert) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  await ensureBookingLocationColumns();
  const inserted = await db.insert(bookings).values(input).returning({ id: bookings.id });
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

export async function getBookingByCheckoutSession(stripeCheckoutSessionId: string) {
  const db = await getDb();
  if (!db) return null;
  await ensureBookingLocationColumns();
  const rows = await db.select().from(bookings).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}

export async function createOrderWithItems(input: { customerName: string; customerEmail: string; customerPhone?: string; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; county?: string | null; postcode?: string | null; deliveryNote?: string; items: Array<{ productId: number; variantId?: number; productName: string; variantName?: string; quantity: number; unitPrice: string }> }) {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { id: Date.now(), items: input.items };
  await ensureOrderLocationColumns();

  const [productRows, variantRows] = await Promise.all([
    db.select().from(products),
    db.select().from(productVariants),
  ]);
  const validatedItems = input.items.map((item) => {
    const product = productRows.find((row) => row.id === item.productId);
    if (!product) throw new Error(`Product ${item.productId} is no longer available.`);
    if (product.stockStatus === "out_of_stock") throw new Error(`${product.name} is currently out of stock.`);
    const quantity = Math.max(1, Math.min(25, Math.floor(Number(item.quantity) || 1)));
    const variant = item.variantId ? variantRows.find((row) => row.id === item.variantId && row.productId === product.id) : undefined;
    if (item.variantId && !variant) throw new Error(`Selected variant for ${product.name} is no longer available.`);
    const stockQuantity = variant ? Number(variant.stockQuantity ?? 0) : Number(product.stockQuantity ?? 0);
    if (stockQuantity > 0 && quantity > stockQuantity) throw new Error(`Only ${stockQuantity} ${variant ? `${product.name} — ${variant.name}` : product.name} item(s) are available.`);
    return {
      productId: product.id,
      variantId: variant?.id,
      productName: product.name,
      variantName: variant?.name,
      quantity,
      unitPrice: Number(product.price).toFixed(2),
    };
  });

  const inserted = await db.insert(orders).values({
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
  const orderId = inserted[0]?.id ?? 0;
  if (orderId && validatedItems.length) await db.insert(orderItems).values(validatedItems.map((item) => ({ ...item, orderId })));
  return { id: orderId, items: validatedItems };
}

export async function updateOrderCheckout(id: number, stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "pending_payment", stripeCheckoutSessionId, stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.id, id));
}

export async function markOrderPaid(stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
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

export async function getOrderByCheckoutSession(stripeCheckoutSessionId: string) {
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

export async function recordAnalytics(eventName: string, pagePath: string, metadata?: unknown) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(analyticsEvents).values({ eventName, pagePath, metadata, createdAtMs: Date.now() });
  return { success: true };
}

export async function createTryOnGeneration(input: { styleName: string; originalImageUrl: string; generatedImageUrl?: string; status?: "pending" | "completed" | "failed"; errorMessage?: string }) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  const inserted = await db.insert(tryOnGenerations).values({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, generatedImageUrl: input.generatedImageUrl, status: input.status ?? "pending", errorMessage: input.errorMessage }).returning({ id: tryOnGenerations.id });
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
  if (db) await ensureBookingLocationColumns();
  if (!db) return { bookings: [], orders: [], reviews: seedReviews, products: seedProducts.map((product) => ({ ...product, variants: [] })), services: seedServices, gallery: [], tryOns: [], sections: [], availability: await getAvailabilitySettings(), instagram: await getInstagramSettings() };
  const [bookingRows, orderRows, reviewRows, productRows, variantRows, serviceRows, galleryRows, tryOnRows, sectionRows] = await Promise.all([db.select().from(bookings).orderBy(desc(bookings.createdAt)), db.select().from(orders).orderBy(desc(orders.createdAt)), db.select().from(reviews).orderBy(desc(reviews.createdAt)), db.select().from(products).orderBy(desc(products.createdAt)), db.select().from(productVariants), db.select().from(services).orderBy(asc(services.sortOrder)), db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt)), db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)), db.select().from(websiteSections).orderBy(asc(websiteSections.sortOrder))]);
  const productsWithVariants = productRows.map((product) => ({
    ...product,
    seoTitle: product.seoTitle || `${product.name} | Eby’s Place`,
    seoDescription: product.seoDescription || product.description,
    variants: variantRows.filter((variant) => variant.productId === product.id),
  }));
  return { bookings: bookingRows, orders: orderRows, reviews: reviewRows, products: productsWithVariants, services: serviceRows, gallery: galleryRows, tryOns: tryOnRows, sections: sectionRows, availability: await getAvailabilitySettings(), instagram: await getInstagramSettings() };
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
  const inserted = await db.insert(products).values(input).returning({ id: products.id });
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
  const result = await db.insert(galleryImages).values(input).returning({ id: galleryImages.id });
  return { id: result[0]?.id, ...input };
}

export async function updateWebsiteSection(sectionKey: string, input: Partial<typeof websiteSections.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(websiteSections).values({ sectionKey, title: input.title ?? sectionKey, ...input }).onConflictDoUpdate({ target: websiteSections.sectionKey, set: { ...input, updatedAt: new Date() } });
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
