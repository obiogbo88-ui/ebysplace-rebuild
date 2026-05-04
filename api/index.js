import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// server/vercel.ts
import "dotenv/config";
import express3 from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/stripeWebhook.ts
import express from "express";
import Stripe from "stripe";

// server/db.ts
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// drizzle/schema.ts
import {
  bigint,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";
var userRoleEnum = pgEnum("user_role_enum", ["user", "admin"]);
var trueFalseEnum = pgEnum("true_false_enum", ["true", "false"]);
var serviceCategoryEnum = pgEnum("service_category_enum", ["Braids", "Twists", "Locs", "Kids Styles", "Add-ons"]);
var bookingStatusEnum = pgEnum("booking_status_enum", ["pending", "confirmed", "completed", "cancelled"]);
var depositStatusEnum = pgEnum("deposit_status_enum", ["unpaid", "checkout_started", "paid", "failed", "refunded"]);
var productCategoryEnum = pgEnum("product_category_enum", ["Accessories", "Aftercare", "Hair Attachments"]);
var stockStatusEnum = pgEnum("stock_status_enum", ["in_stock", "low_stock", "out_of_stock"]);
var orderStatusEnum = pgEnum("order_status_enum", ["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
var galleryCategoryEnum = pgEnum("gallery_category_enum", ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
var reviewStatusEnum = pgEnum("review_status_enum", ["pending", "approved", "rejected"]);
var tryOnStatusEnum = pgEnum("try_on_status_enum", ["pending", "completed", "failed"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var websiteSections = pgTable("websiteSections", {
  id: serial("id").primaryKey(),
  sectionKey: varchar("sectionKey", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  eyebrow: varchar("eyebrow", { length: 160 }),
  body: text("body"),
  ctaLabel: varchar("ctaLabel", { length: 120 }),
  ctaHref: varchar("ctaHref", { length: 500 }),
  imageUrl: varchar("imageUrl", { length: 800 }),
  portraitImageUrl: varchar("portraitImageUrl", { length: 800 }),
  portraitDescription: text("portraitDescription"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isPublished: trueFalseEnum("isPublished").default("true").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  category: serviceCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  duration: varchar("duration", { length: 80 }).notNull(),
  priceFrom: numeric("priceFrom", { precision: 10, scale: 2 }).notNull(),
  badge: varchar("badge", { length: 80 }),
  imageUrl: varchar("imageUrl", { length: 800 }),
  isBookable: trueFalseEnum("isBookable").default("true").notNull(),
  isFeatured: trueFalseEnum("isFeatured").default("false").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId"),
  serviceName: varchar("serviceName", { length: 180 }).notNull(),
  clientName: varchar("clientName", { length: 180 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 80 }).notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }).notNull(),
  deliveryNote: text("deliveryNote"),
  appointmentDate: varchar("appointmentDate", { length: 20 }).notNull(),
  appointmentTime: varchar("appointmentTime", { length: 20 }).notNull(),
  status: bookingStatusEnum("status").default("pending").notNull(),
  depositStatus: depositStatusEnum("depositStatus").default("unpaid").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: text("seoDescription"),
  category: productCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 800 }),
  badge: varchar("badge", { length: 80 }),
  stockStatus: stockStatusEnum("stockStatus").default("in_stock").notNull(),
  stockQuantity: integer("stockQuantity").default(0).notNull(),
  isFeatured: trueFalseEnum("isFeatured").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var productVariants = pgTable("productVariants", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  colourHex: varchar("colourHex", { length: 20 }),
  stockQuantity: integer("stockQuantity").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 80 }),
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }).notNull(),
  deliveryNote: text("deliveryNote"),
  status: orderStatusEnum("status").default("draft").notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var orderItems = pgTable("orderItems", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  productId: integer("productId").notNull(),
  variantId: integer("variantId"),
  productName: varchar("productName", { length: 180 }).notNull(),
  variantName: varchar("variantName", { length: 120 }),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unitPrice", { precision: 10, scale: 2 }).notNull()
});
var galleryImages = pgTable("galleryImages", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  category: galleryCategoryEnum("category").notNull(),
  imageUrl: varchar("imageUrl", { length: 800 }).notNull(),
  altText: varchar("altText", { length: 255 }).notNull(),
  isPublished: trueFalseEnum("isPublished").default("true").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("reviewText").notNull(),
  status: reviewStatusEnum("status").default("pending").notNull(),
  source: varchar("source", { length: 80 }).default("website").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var newsletterSubscribers = pgTable("newsletterSubscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  productAlerts: trueFalseEnum("productAlerts").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var analyticsEvents = pgTable("analyticsEvents", {
  id: serial("id").primaryKey(),
  eventName: varchar("eventName", { length: 120 }).notNull(),
  pagePath: varchar("pagePath", { length: 500 }).notNull(),
  metadata: jsonb("metadata"),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var tryOnGenerations = pgTable("tryOnGenerations", {
  id: serial("id").primaryKey(),
  styleName: varchar("styleName", { length: 160 }).notNull(),
  originalImageUrl: varchar("originalImageUrl", { length: 800 }).notNull(),
  generatedImageUrl: varchar("generatedImageUrl", { length: 800 }),
  status: tryOnStatusEnum("status").default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});

// server/db.ts
var _pool = null;
var _db = null;
var _seeded = false;
var _unsupportedDatabaseUrlWarned = false;
var _missingDatabaseUrlWarned = false;
var _databaseConnectionFailed = false;
var _lastDatabaseUrlFingerprint = null;
function isPostgresConnectionString(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}
function requiresSsl(connectionString) {
  return /supabase\.co|sslmode=require/i.test(connectionString);
}
function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}
function databaseUrlFingerprint(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname ? "/\u2026" : ""}`;
  } catch {
    return "unparseable-url";
  }
}
async function getDb() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    if (!_missingDatabaseUrlWarned) {
      console.error("[Database] DATABASE_URL is missing. Public reads will use safe seed-data fallbacks and write operations will be skipped.", {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
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
      vercelEnv: process.env.VERCEL_ENV
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
        idleTimeoutMillis: 1e4,
        connectionTimeoutMillis: 1e4,
        ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : void 0
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
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod", "stripeCustomerId"];
  textFields.forEach((field) => {
    const value = user[field];
    if (value === void 0) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: { ...updateSet, updatedAt: /* @__PURE__ */ new Date() } });
}
var imageBySlug = {
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
var seedServices = [
  {
    name: "Knotless Braids",
    slug: "knotless-braids",
    category: "Braids",
    description: "Lightweight, tension-conscious braids with a seamless natural finish and pain-free installation approach.",
    duration: "4\u20136 hours",
    priceFrom: "120.00",
    badge: "Signature",
    isFeatured: "true",
    sortOrder: 1,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png"
  },
  {
    name: "Box Braids",
    slug: "box-braids",
    category: "Braids",
    description: "Classic individual braids with clean parting, balanced weight, and a polished protective finish.",
    duration: "4\u20136 hours",
    priceFrom: "100.00",
    badge: "Classic",
    isFeatured: "true",
    sortOrder: 2,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_box_braids_c219e578-5ddc057b3d.png"
  },
  {
    name: "Goddess Braids",
    slug: "goddess-braids",
    category: "Braids",
    description: "Elegant goddess styling with soft curly details for a refined, feminine finish.",
    duration: "5\u20137 hours",
    priceFrom: "140.00",
    badge: "Luxury",
    isFeatured: "false",
    sortOrder: 3,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_goddess_braids_da92cf33-2c24c12340.png"
  },
  {
    name: "Fulani Braids",
    slug: "fulani-braids",
    category: "Braids",
    description: "Statement Fulani-inspired braids with a neat front pattern, individual lengths, and optional accessories.",
    duration: "4\u20136 hours",
    priceFrom: "110.00",
    badge: "Statement",
    isFeatured: "false",
    sortOrder: 4,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png"
  },
  {
    name: "Cornrows",
    slug: "cornrows",
    category: "Braids",
    description: "Clean cornrow styling for simple, elegant, and low-maintenance protective wear.",
    duration: "1.5\u20133 hours",
    priceFrom: "55.00",
    badge: "Neat Finish",
    isFeatured: "false",
    sortOrder: 5,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_cornrows_2b5007dd-7637e158cc.png"
  },
  {
    name: "Stitch Braids",
    slug: "stitch-braids",
    category: "Braids",
    description: "Defined stitch-part braids with sharp detailing and tension-aware installation.",
    duration: "2.5\u20134 hours",
    priceFrom: "80.00",
    badge: "Defined",
    isFeatured: "false",
    sortOrder: 6,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_stitch_braids_562f3424-edda69b630.png"
  },
  {
    name: "Lemonade Braids",
    slug: "lemonade-braids",
    category: "Braids",
    description: "Side-swept braid styling with clean direction, polished edges, and a confident finish.",
    duration: "3\u20135 hours",
    priceFrom: "90.00",
    badge: "Popular",
    isFeatured: "true",
    sortOrder: 7,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_lemonade_braids_71001277-04350dddc8.png"
  },
  {
    name: "Boho Braids",
    slug: "boho-goddess-braids",
    category: "Braids",
    description: "Premium boho braids with soft curls for a polished, holiday-ready look.",
    duration: "5\u20137 hours",
    priceFrom: "150.00",
    badge: "Popular",
    isFeatured: "true",
    sortOrder: 8,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png"
  },
  {
    name: "Tribal Braids",
    slug: "tribal-braids",
    category: "Braids",
    description: "Pattern-led braids with a tailored layout, premium parting, and optional bead finish.",
    duration: "4\u20136 hours",
    priceFrom: "120.00",
    badge: "Artistry",
    isFeatured: "false",
    sortOrder: 9,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_tribal_braids_f0ce8622-90e4a26bf0.png"
  },
  {
    name: "Senegalese Twists",
    slug: "senegalese-twists",
    category: "Twists",
    description: "Smooth rope twists designed for movement, protection, and comfort.",
    duration: "4\u20136 hours",
    priceFrom: "110.00",
    badge: "Protective",
    isFeatured: "true",
    sortOrder: 10,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_senegalese_twists_d58a9d66-1fa4e6b79d.png"
  },
  {
    name: "Passion Twists",
    slug: "passion-twists",
    category: "Twists",
    description: "Soft, lightweight twists with a textured finish and gentle installation.",
    duration: "4\u20136 hours",
    priceFrom: "115.00",
    badge: "Soft Texture",
    isFeatured: "false",
    sortOrder: 11,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_passion_twists_fb79128f-5a04dc2709.png"
  },
  {
    name: "Faux Locs",
    slug: "faux-locs",
    category: "Locs",
    description: "Protective faux locs with a natural-looking finish and comfortable weight distribution.",
    duration: "5\u20138 hours",
    priceFrom: "140.00",
    badge: "Protective",
    isFeatured: "true",
    sortOrder: 12,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_faux_locs_b738d17e-eb99412a43.png"
  },
  {
    name: "Butterfly Locs",
    slug: "butterfly-locs",
    category: "Locs",
    description: "Textured butterfly locs with soft volume, movement, and a modern distressed finish.",
    duration: "5\u20137 hours",
    priceFrom: "135.00",
    badge: "Trending",
    isFeatured: "false",
    sortOrder: 13,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_butterfly_locs_642d7503-3bb725b95f.png"
  },
  {
    name: "Starter Locs",
    slug: "starter-locs",
    category: "Locs",
    description: "Starter loc foundation service with neat sectioning and careful guidance for your loc journey.",
    duration: "2\u20134 hours",
    priceFrom: "85.00",
    badge: "Loc Journey",
    isFeatured: "false",
    sortOrder: 14,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png"
  },
  {
    name: "Kids Braids",
    slug: "kids-braids",
    category: "Kids Styles",
    description: "Gentle, age-appropriate braided styles created with patience, comfort, and neat finishing.",
    duration: "2\u20134 hours",
    priceFrom: "55.00",
    badge: "Family Friendly",
    isFeatured: "false",
    sortOrder: 15,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_braids_066faa86-8d44891ba5.png"
  },
  {
    name: "Kids Cornrows",
    slug: "kids-cornrows",
    category: "Kids Styles",
    description: "Gentle cornrow styling for children with comfort-first care and tidy results.",
    duration: "1.5\u20133 hours",
    priceFrom: "45.00",
    badge: "Family Friendly",
    isFeatured: "false",
    sortOrder: 16,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png"
  },
  {
    name: "Hair Wash & Prep",
    slug: "hair-wash-prep",
    category: "Add-ons",
    description: "Cleanse, condition, detangle, and prepare hair for a neat protective style appointment.",
    duration: "45 minutes",
    priceFrom: "25.00",
    badge: "Add-on",
    isFeatured: "false",
    sortOrder: 17,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png"
  },
  {
    name: "Beads & Accessories",
    slug: "beads-accessories",
    category: "Add-ons",
    description: "Custom beads, cuffs, and accessory finishing for a personalised Eby\u2019s Place look.",
    duration: "15\u201330 minutes",
    priceFrom: "10.00",
    badge: "Finishing",
    isFeatured: "false",
    sortOrder: 18,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png"
  },
  {
    name: "Edge Control & Styling",
    slug: "edge-control-styling",
    category: "Add-ons",
    description: "Soft edge styling and polished finishing touches using a scalp-conscious approach.",
    duration: "15 minutes",
    priceFrom: "8.00",
    badge: "Finishing",
    isFeatured: "false",
    sortOrder: 19,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_edge_control_styling_675ed964-0d252ca79f.png"
  },
  {
    name: "Braid Takedown",
    slug: "braid-takedown",
    category: "Add-ons",
    description: "Careful braid removal service designed to reduce pulling, breakage, and avoidable stress.",
    duration: "1\u20132 hours",
    priceFrom: "35.00",
    badge: "Aftercare",
    isFeatured: "false",
    sortOrder: 20,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_braid_takedown_6240fcb4-8c93f3e6e6.png"
  }
];
var seedProducts = [
  { name: "Satin Edge Scarf", slug: "satin-edge-scarf", seoTitle: "Satin Edge Scarf for Braids | Eby\u2019s Place", seoDescription: "Protect fresh braids overnight with a silky satin edge scarf from Eby\u2019s Place, designed to preserve edges and reduce friction.", category: "Accessories", description: "A silky black satin scarf for preserving edges and protecting fresh braids overnight.", price: "18.00", imageUrl: imageBySlug["edge-control-styling"], badge: "Best Seller", stockStatus: "in_stock", stockQuantity: 34, isFeatured: "true" },
  { name: "Scalp Comfort Oil", slug: "scalp-comfort-oil", seoTitle: "Scalp Comfort Oil for Protective Styles | Eby\u2019s Place", seoDescription: "Shop lightweight scalp comfort oil for braids, twists, and locs, created to support shine and comfort between salon appointments.", category: "Aftercare", description: "A lightweight scalp oil for protective styles, designed to support comfort and shine.", price: "14.00", imageUrl: imageBySlug["hair-wash-prep"], badge: "Aftercare", stockStatus: "low_stock", stockQuantity: 8, isFeatured: "true" },
  { name: "Premium Braiding Hair", slug: "premium-braiding-hair", seoTitle: "Premium Braiding Hair in Natural and Statement Shades | Eby\u2019s Place", seoDescription: "Buy soft-touch premium braiding hair from Eby\u2019s Place in natural tones and statement shades for protective styles.", category: "Hair Attachments", description: "Soft-touch braiding hair available in classic natural tones and statement shades.", price: "6.50", imageUrl: imageBySlug["beads-accessories"], badge: "Salon Pick", stockStatus: "in_stock", stockQuantity: 120, isFeatured: "true" },
  { name: "Braid Care Starter Kit", slug: "braid-care-starter-kit", seoTitle: "Braid Care Starter Kit | Eby\u2019s Place", seoDescription: "A practical starter kit for maintaining fresh protective styles between Eby\u2019s Place appointments.", category: "Aftercare", description: "A simple aftercare bundle with satin protection, scalp comfort guidance, and braid maintenance essentials.", price: "28.00", imageUrl: imageBySlug["boho-goddess-braids"], badge: "New", stockStatus: "in_stock", stockQuantity: 20, isFeatured: "true" }
];
var seedReviews = [
  { customerName: "Amara", rating: 5, reviewText: "The most comfortable braiding experience I have had. My scalp felt cared for and the finish was beautiful.", status: "approved", source: "website" },
  { customerName: "Naomi", rating: 5, reviewText: "Eby\u2019s Place feels premium from booking to the final look. The braids were neat, lightweight, and lasted so well.", status: "approved", source: "website" },
  { customerName: "Tia", rating: 5, reviewText: "I booked for my daughter and the team was so patient and gentle. A truly family-friendly service.", status: "approved", source: "website" },
  { customerName: "Obi", rating: 5, reviewText: "I cant thank you enough.", status: "approved", source: "google" },
  { customerName: "Claudia Grenlus", rating: 5, reviewText: "Love my hair,happy that I found you ,highly recommend", status: "approved", source: "google" },
  { customerName: "Lauren Groves", rating: 5, reviewText: "Very pleased pleased with my daughters hair .. lovely lady & very professional & welcoming", status: "approved", source: "google" },
  { customerName: "amy martlin", rating: 5, reviewText: "Really happy and would definitely use eby again. She very welcoming, high standards and goes the extra mile. Would highly recommend this lady", status: "approved", source: "google" },
  { customerName: "Rafiatu Yussif", rating: 5, reviewText: "I was happy with my hair and the service given. Thanks Eby\u2019s. Will be returning again.", status: "approved", source: "google" },
  { customerName: "Nazanin Aflakian", rating: 5, reviewText: "I had an amazing experience getting my daughter's hair done! She got African braids, and the stylist was incredibly...", status: "approved", source: "google" },
  { customerName: "Finlay Pettitt", rating: 5, reviewText: "5-star Google review.", status: "approved", source: "google" },
  { customerName: "yaali", rating: 5, reviewText: "i'm a person with a lot of issues and insecurity, but it was such a lovely experience. over the moon with my braids and...", status: "approved", source: "google" },
  { customerName: "Maliha Berridge", rating: 5, reviewText: "My son had his hair braided and extensions by Eby. She was extremely professional and gave great advice on what would be...", status: "approved", source: "google" },
  { customerName: "Miracle Igboanugo", rating: 5, reviewText: "Ooh! I just got my locs with this brand and I loveeee!!! Thank you so much! Cus I am sure coming back for another \u{1F60D}", status: "approved", source: "google" },
  { customerName: "Ivy O", rating: 5, reviewText: "Excellent hair services. Highly professional and delivers all the time.", status: "approved", source: "google" },
  { customerName: "Lynda Francis", rating: 5, reviewText: "I have had my hair styled on two occasions and they were both fantastic and well above expectations. I would highly recommend. Cheers.", status: "approved", source: "google" },
  { customerName: "Chiamaka Udebbia", rating: 5, reviewText: "Service was great, friendly environment with lovely staff. Price is very reasonable and affordable. Will recommend for everyone.", status: "approved", source: "google" },
  { customerName: "ebirim salvy", rating: 5, reviewText: "Tested and trusted. She gives that perfect African braids vibes Neatly done with care", status: "approved", source: "google" },
  { customerName: "Logos HQ", rating: 5, reviewText: "Thank you for fitting us in last minute! Amazing customer service! Service was done professionally and nice touch with the curls.", status: "approved", source: "google" },
  { customerName: "Onuoha Christiana", rating: 5, reviewText: "Amazing hair stylist.. Highly recommended.. Please do well to patronise her.. I absolutely loved her service", status: "approved", source: "google" },
  { customerName: "Kelly", rating: 5, reviewText: "I recently got my hair done here and i was so pleased with how it came out. She was so quick and she replicated the...", status: "approved", source: "google" },
  { customerName: "Isaac Fortune", rating: 5, reviewText: "Braids were so neat..Nice customer service", status: "approved", source: "google" },
  { customerName: "elizabethz okeke", rating: 5, reviewText: "I received an exceptional service.", status: "approved", source: "google" },
  { customerName: "Nombulelo Choto", rating: 5, reviewText: "Amazing service, always go home loving my hair. Highly recommend!!", status: "approved", source: "google" },
  { customerName: "Chigozie Gloria", rating: 5, reviewText: "5-star Google review.", status: "approved", source: "google" }
];
async function ensureSeedReviews(db) {
  if (!db) return;
  for (const review of seedReviews) {
    const existing = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.customerName, review.customerName), eq(reviews.reviewText, review.reviewText))).limit(1);
    if (existing.length === 0) await db.insert(reviews).values(review);
  }
}
var seedGallery = [
  { title: "Knotless Braids", category: "Braids", imageUrl: imageBySlug["knotless-braids"], altText: "HD model wearing Knotless Braids by Eby\u2019s Place", sortOrder: 1 },
  { title: "Box Braids", category: "Braids", imageUrl: imageBySlug["box-braids"], altText: "HD model wearing Box Braids by Eby\u2019s Place", sortOrder: 2 },
  { title: "Goddess Braids", category: "Braids", imageUrl: imageBySlug["goddess-braids"], altText: "HD model wearing Goddess Braids by Eby\u2019s Place", sortOrder: 3 },
  { title: "Fulani Braids", category: "Braids", imageUrl: imageBySlug["fulani-braids"], altText: "HD model wearing Fulani Braids by Eby\u2019s Place", sortOrder: 4 },
  { title: "Lemonade Braids", category: "Braids", imageUrl: imageBySlug["lemonade-braids"], altText: "HD model wearing Lemonade Braids by Eby\u2019s Place", sortOrder: 5 },
  { title: "Boho Braids", category: "Braids", imageUrl: imageBySlug["boho-goddess-braids"], altText: "HD model wearing Boho Braids by Eby\u2019s Place", sortOrder: 6 },
  { title: "Senegalese Twists", category: "Twists", imageUrl: imageBySlug["senegalese-twists"], altText: "HD model wearing Senegalese Twists by Eby\u2019s Place", sortOrder: 7 },
  { title: "Passion Twists", category: "Twists", imageUrl: imageBySlug["passion-twists"], altText: "HD model wearing Passion Twists by Eby\u2019s Place", sortOrder: 8 },
  { title: "Faux Locs", category: "Locs", imageUrl: imageBySlug["faux-locs"], altText: "HD model wearing Faux Locs by Eby\u2019s Place", sortOrder: 9 },
  { title: "Butterfly Locs", category: "Locs", imageUrl: imageBySlug["butterfly-locs"], altText: "HD model wearing Butterfly Locs by Eby\u2019s Place", sortOrder: 10 },
  { title: "Kids Braids", category: "Kids Styles", imageUrl: imageBySlug["kids-braids"], altText: "HD child model wearing Kids Braids by Eby\u2019s Place", sortOrder: 11 },
  { title: "Starter Locs", category: "Locs", imageUrl: imageBySlug["starter-locs"], altText: "HD model wearing Starter Locs by Eby\u2019s Place", sortOrder: 12 }
];
function isPositivePrice(value) {
  return Number(value) > 0;
}
function isUsableImageUrl(value) {
  return typeof value === "string" && /^https?:\/\//.test(value);
}
async function ensureSeedProducts(db) {
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
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
  }
}
async function ensureSeedGallery(db) {
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
var seedWebsiteSections = [
  {
    sectionKey: "about_us",
    eyebrow: "Our Story",
    title: "From Passion to Power",
    body: "Eby\u2019s Place was born from a love for braiding and a belief that beautiful hair should never come with pain, pulling, or damage. What began as a passion for helping women and families feel confident has grown into a premium braid-care experience built on gentle hands, neat finishing, protective styling, and genuine customer care.",
    ctaLabel: "Read our services",
    ctaHref: "/services",
    imageUrl: "",
    portraitImageUrl: "",
    portraitDescription: "Eberechi Ogbo | Founder & Service Lead",
    sortOrder: 1,
    isPublished: "true"
  }
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
        updatedAt: /* @__PURE__ */ new Date()
      }
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
function mergeWithSeedServices(rows, category) {
  const scopedRows = category ? rows.filter((row) => row.category === category) : rows;
  const usableRows = scopedRows.map((row) => ({
    ...row,
    imageUrl: isUsableImageUrl(row.imageUrl) ? row.imageUrl : imageBySlug[row.slug] || row.imageUrl
  }));
  const existingSlugs = new Set(usableRows.map((row) => row.slug));
  const scopedSeeds = seedServices.filter((item) => (!category || item.category === category) && !existingSlugs.has(item.slug));
  return [...usableRows, ...scopedSeeds].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
async function listServices(category) {
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
async function listFeaturedServices() {
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
async function listWebsiteSections() {
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
async function listProducts() {
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
      imageUrl: isUsableImageUrl(product.imageUrl) ? product.imageUrl : imageBySlug["beads-accessories"],
      seoTitle: product.seoTitle || `${product.name} | Eby\u2019s Place`,
      seoDescription: product.seoDescription || product.description,
      variants: "id" in product ? variantRows.filter((variant) => variant.productId === product.id) : []
    }));
  } catch (error) {
    console.warn("[Database] Falling back to seeded products", error);
    return fallback;
  }
}
async function listApprovedReviews() {
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
async function submitReview(input) {
  const db = await getDb();
  if (!db) return { id: Date.now(), status: "pending" };
  const inserted = await db.insert(reviews).values({ ...input, status: "pending", source: "website" }).returning({ id: reviews.id });
  return { id: inserted[0]?.id ?? 0, status: "pending" };
}
async function subscribeNewsletter(email, productAlerts = false) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(newsletterSubscribers).values({ email, productAlerts: productAlerts ? "true" : "false" }).onConflictDoUpdate({ target: newsletterSubscribers.email, set: { productAlerts: productAlerts ? "true" : "false" } });
  return { success: true };
}
async function listGallery(category) {
  const fallback = category && category !== "All" ? seedGallery.filter((item) => item.category === category) : seedGallery;
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const filter = category && category !== "All" ? and(eq(galleryImages.isPublished, "true"), eq(galleryImages.category, category)) : eq(galleryImages.isPublished, "true");
    const rows = await db.select().from(galleryImages).where(filter).orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt));
    const safeRows = rows.filter((row) => isUsableImageUrl(row.imageUrl));
    if (safeRows.length >= 8 || category && category !== "All") return safeRows.length ? safeRows : fallback;
    const existingTitles = new Set(safeRows.map((row) => row.title));
    return [...safeRows, ...seedGallery.filter((item) => !existingTitles.has(item.title))];
  } catch (error) {
    console.warn("[Database] Falling back to seeded gallery", error);
    return fallback;
  }
}
async function createBooking(input) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  const inserted = await db.insert(bookings).values(input).returning({ id: bookings.id });
  return { id: inserted[0]?.id ?? 0 };
}
async function updateBookingCheckout(id, stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ depositStatus: "checkout_started", stripeCheckoutSessionId, stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(bookings.id, id));
}
async function markBookingDepositPaid(stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ depositStatus: "paid", status: "confirmed", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId));
}
async function getBookingByCheckoutSession(stripeCheckoutSessionId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(bookings).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}
async function createOrderWithItems(input) {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { id: Date.now(), items: input.items };
  const [productRows, variantRows] = await Promise.all([
    db.select().from(products),
    db.select().from(productVariants)
  ]);
  const validatedItems = input.items.map((item) => {
    const product = productRows.find((row) => row.id === item.productId);
    if (!product) throw new Error(`Product ${item.productId} is no longer available.`);
    if (product.stockStatus === "out_of_stock") throw new Error(`${product.name} is currently out of stock.`);
    const quantity = Math.max(1, Math.min(25, Math.floor(Number(item.quantity) || 1)));
    const variant = item.variantId ? variantRows.find((row) => row.id === item.variantId && row.productId === product.id) : void 0;
    if (item.variantId && !variant) throw new Error(`Selected variant for ${product.name} is no longer available.`);
    const stockQuantity = variant ? Number(variant.stockQuantity ?? 0) : Number(product.stockQuantity ?? 0);
    if (stockQuantity > 0 && quantity > stockQuantity) throw new Error(`Only ${stockQuantity} ${variant ? `${product.name} \u2014 ${variant.name}` : product.name} item(s) are available.`);
    return {
      productId: product.id,
      variantId: variant?.id,
      productName: product.name,
      variantName: variant?.name,
      quantity,
      unitPrice: Number(product.price).toFixed(2)
    };
  });
  const inserted = await db.insert(orders).values({ customerName: input.customerName, customerEmail: input.customerEmail, customerPhone: input.customerPhone, addressLine1: input.addressLine1, city: input.city, county: input.county, postcode: input.postcode, deliveryNote: input.deliveryNote, status: "draft" }).returning({ id: orders.id });
  const orderId = inserted[0]?.id ?? 0;
  if (orderId && validatedItems.length) await db.insert(orderItems).values(validatedItems.map((item) => ({ ...item, orderId })));
  return { id: orderId, items: validatedItems };
}
async function updateOrderCheckout(id, stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "pending_payment", stripeCheckoutSessionId, stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.id, id));
}
async function markOrderPaid(stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId));
}
async function getOrderByCheckoutSession(stripeCheckoutSessionId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}
async function recordAnalytics(eventName, pagePath, metadata) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(analyticsEvents).values({ eventName, pagePath, metadata, createdAtMs: Date.now() });
  return { success: true };
}
async function createTryOnGeneration(input) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  const inserted = await db.insert(tryOnGenerations).values({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, generatedImageUrl: input.generatedImageUrl, status: input.status ?? "pending", errorMessage: input.errorMessage }).returning({ id: tryOnGenerations.id });
  return { id: inserted[0]?.id ?? 0 };
}
async function updateTryOnGeneration(id, input) {
  const db = await getDb();
  if (!db) return;
  await db.update(tryOnGenerations).set(input).where(eq(tryOnGenerations.id, id));
}
async function adminSummary() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { bookings: 0, orders: 0, pendingReviews: 0, products: seedProducts.length, services: seedServices.length, tryOns: 0 };
  const [bookingRows, orderRows, reviewRows, productRows, serviceRows, tryOnRows] = await Promise.all([db.select().from(bookings), db.select().from(orders), db.select().from(reviews).where(eq(reviews.status, "pending")), db.select().from(products), db.select().from(services), db.select().from(tryOnGenerations)]);
  return { bookings: bookingRows.length, orders: orderRows.length, pendingReviews: reviewRows.length, products: productRows.length, services: serviceRows.length, tryOns: tryOnRows.length };
}
async function adminLists() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return { bookings: [], orders: [], reviews: seedReviews, products: seedProducts.map((product) => ({ ...product, variants: [] })), services: seedServices, gallery: [], tryOns: [], sections: [] };
  const [bookingRows, orderRows, reviewRows, productRows, variantRows, serviceRows, galleryRows, tryOnRows, sectionRows] = await Promise.all([db.select().from(bookings).orderBy(desc(bookings.createdAt)), db.select().from(orders).orderBy(desc(orders.createdAt)), db.select().from(reviews).orderBy(desc(reviews.createdAt)), db.select().from(products).orderBy(desc(products.createdAt)), db.select().from(productVariants), db.select().from(services).orderBy(asc(services.sortOrder)), db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt)), db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)), db.select().from(websiteSections).orderBy(asc(websiteSections.sortOrder))]);
  const productsWithVariants = productRows.map((product) => ({
    ...product,
    seoTitle: product.seoTitle || `${product.name} | Eby\u2019s Place`,
    seoDescription: product.seoDescription || product.description,
    variants: variantRows.filter((variant) => variant.productId === product.id)
  }));
  return { bookings: bookingRows, orders: orderRows, reviews: reviewRows, products: productsWithVariants, services: serviceRows, gallery: galleryRows, tryOns: tryOnRows, sections: sectionRows };
}
async function moderateReview(id, status) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.update(reviews).set({ status }).where(eq(reviews.id, id));
  return { success: true };
}
async function updateBookingStatus(id, status) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.update(bookings).set({ status }).where(eq(bookings.id, id));
  return { success: true };
}
async function updateService(id, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(services).set(input).where(eq(services.id, id));
  return { id, ...input };
}
async function updateProduct(id, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set(input).where(eq(products.id, id));
  return { id, ...input };
}
async function createProduct(input, variants = []) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const inserted = await db.insert(products).values(input).returning({ id: products.id });
  const productId = inserted[0]?.id;
  if (productId && variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId })));
  return { id: productId, ...input };
}
async function replaceProductVariants(productId, variants) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId })));
  return { productId, variants };
}
async function updateOrderStatus(id, status) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  return { id, status };
}
async function updateProductStock(id, stockQuantity, stockStatus) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set({ stockQuantity, stockStatus }).where(eq(products.id, id));
  return { id, stockQuantity, stockStatus };
}
async function addGalleryImage(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(galleryImages).values(input).returning({ id: galleryImages.id });
  return { id: result[0]?.id, ...input };
}
async function updateWebsiteSection(sectionKey, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(websiteSections).values({ sectionKey, title: input.title ?? sectionKey, ...input }).onConflictDoUpdate({ target: websiteSections.sectionKey, set: { ...input, updatedAt: /* @__PURE__ */ new Date() } });
  return { sectionKey, ...input };
}
async function adminInsights() {
  await seedIfNeeded();
  const db = await getDb();
  if (!db) return {
    bestSellingProducts: [],
    bestBookedServices: [],
    bestTriedStyles: [],
    recentActivity: []
  };
  const [productSales, bookedServices, triedStyles, bookingRows, orderRows, reviewRows, analyticsRows, tryOnRows, subscriberRows] = await Promise.all([
    db.select({ label: orderItems.productName, units: sql`sum(${orderItems.quantity})`, revenue: sql`sum(${orderItems.quantity} * ${orderItems.unitPrice})` }).from(orderItems).groupBy(orderItems.productName).orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(8),
    db.select({ label: bookings.serviceName, total: sql`count(*)` }).from(bookings).groupBy(bookings.serviceName).orderBy(desc(sql`count(*)`)).limit(8),
    db.select({ label: tryOnGenerations.styleName, total: sql`count(*)` }).from(tryOnGenerations).groupBy(tryOnGenerations.styleName).orderBy(desc(sql`count(*)`)).limit(8),
    db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(6),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6),
    db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(6),
    db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt)).limit(6),
    db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)).limit(6),
    db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(6)
  ]);
  const recentActivity = [
    ...bookingRows.map((item) => ({ type: "Booking", label: item.clientName, detail: `${item.serviceName} \xB7 ${item.status}`, createdAt: item.createdAt })),
    ...orderRows.map((item) => ({ type: "Shop order", label: item.customerName, detail: `${item.city} \xB7 ${item.status}`, createdAt: item.createdAt })),
    ...reviewRows.map((item) => ({ type: "Review", label: item.customerName, detail: `${item.rating} stars \xB7 ${item.status}`, createdAt: item.createdAt })),
    ...analyticsRows.map((item) => ({ type: "Visit", label: item.eventName, detail: item.pagePath, createdAt: item.createdAt })),
    ...tryOnRows.map((item) => ({ type: "AI try-on", label: item.styleName, detail: item.status, createdAt: item.createdAt })),
    ...subscriberRows.map((item) => ({ type: "Newsletter", label: item.email, detail: item.productAlerts === "true" ? "Product alerts" : "General updates", createdAt: item.createdAt }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12);
  return {
    bestSellingProducts: productSales.map((item) => ({ label: item.label, units: Number(item.units ?? 0), revenue: Number(item.revenue ?? 0) })),
    bestBookedServices: bookedServices.map((item) => ({ label: item.label, total: Number(item.total ?? 0) })),
    bestTriedStyles: triedStyles.map((item) => ({ label: item.label, total: Number(item.total ?? 0) })),
    recentActivity
  };
}

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/customerNotifications.ts
function normalisePhone(value) {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, "");
  if (/^whatsapp:\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed.replace(/^whatsapp:/, "");
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^0\d{9,10}$/.test(trimmed)) return `+44${trimmed.slice(1)}`;
  return null;
}
function normaliseSender(value, channel = "sms") {
  if (!value) return null;
  const trimmed = value.trim();
  if (channel === "whatsapp") return /^whatsapp:\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : null;
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9 ]{1,11}$/.test(trimmed)) return trimmed;
  return null;
}
async function sendTwilioMessage(input) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_SMS_FROM;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
  const to = normalisePhone(input.to);
  const channel = input.channel || "sms";
  const from = normaliseSender(channel === "whatsapp" ? whatsappFrom : smsFrom, channel);
  if (!accountSid || !authToken || !from || !to) {
    return { sent: false, reason: `${channel}_not_configured_or_invalid_number` };
  }
  const formattedTo = channel === "whatsapp" ? `whatsapp:${to}` : to;
  const params = new URLSearchParams({ To: formattedTo, From: from, Body: input.body.slice(0, 1500) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  let response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.warn(`[TwilioNotification] ${channel} send failed`, response.status, details.slice(0, 300));
    return { sent: false, reason: "twilio_error" };
  }
  return { sent: true };
}
async function sendCustomerSms(input) {
  return sendTwilioMessage({ ...input, channel: "sms" });
}
async function sendCustomerSmsSafely(input) {
  try {
    return await sendCustomerSms(input);
  } catch (error) {
    console.warn("[CustomerSMS] Notification skipped", error);
    return { sent: false, reason: "exception" };
  }
}
async function notifyOwnerByTwilioSafely(input) {
  const body = `${input.title}
${input.content}`.slice(0, 1500);
  const ownerPhone = process.env.EBYSPLACE_OWNER_PHONE_E164 || process.env.OWNER_PHONE_E164 || process.env.TWILIO_OWNER_PHONE;
  const [sms, whatsapp] = await Promise.allSettled([
    sendTwilioMessage({ to: ownerPhone, body, channel: "sms" }),
    sendTwilioMessage({ to: ownerPhone, body, channel: "whatsapp" })
  ]);
  return {
    sms: sms.status === "fulfilled" ? sms.value : { sent: false, reason: "exception" },
    whatsapp: whatsapp.status === "fulfilled" ? whatsapp.value : { sent: false, reason: "exception" }
  };
}

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  const result = await notifyOwnerByTwilioSafely({ title, content });
  return Boolean(result.sms.sent || result.whatsapp.sent);
}

// server/stripeWebhook.ts
function getStripeWebhookConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return null;
  return { stripe: new Stripe(secretKey), webhookSecret };
}
function registerStripeWebhook(app2) {
  app2.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const config = getStripeWebhookConfig();
    if (!config) {
      res.status(503).json({ error: "Stripe webhook is not configured" });
      return;
    }
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).json({ error: "Missing Stripe signature" });
      return;
    }
    let event;
    try {
      event = config.stripe.webhooks.constructEvent(req.body, signature, config.webhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid webhook signature";
      console.error("[StripeWebhook] Signature verification failed:", message);
      res.status(400).json({ error: message });
      return;
    }
    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      res.json({ verified: true });
      return;
    }
    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        if (session.metadata?.deposit_type === "non_refundable_20_gbp" && session.id) {
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
          await markBookingDepositPaid(session.id, paymentIntentId);
          const booking = await getBookingByCheckoutSession(session.id);
          await sendCustomerSmsSafely({
            to: booking?.clientPhone,
            body: `Your Eby\u2019s Place \xA320 booking deposit has been confirmed. Your appointment for ${booking?.serviceName ?? "your selected service"}${booking?.appointmentDate ? ` on ${booking.appointmentDate}` : ""}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""} is now secured.`
          });
          await notifyOwner({
            title: "Eby\u2019s Place deposit paid",
            content: [
              `A \xA320 booking deposit has been confirmed through Stripe.`,
              `Booking ID: ${session.metadata?.booking_id ?? "Not provided"}`,
              `Service: ${session.metadata?.service_name ?? "Not provided"}`,
              `Customer: ${session.metadata?.customer_name ?? "Not provided"}`,
              `Email: ${session.metadata?.customer_email ?? session.customer_email ?? "Not provided"}`,
              `Stripe session: ${session.id}`,
              paymentIntentId ? `Payment intent: ${paymentIntentId}` : void 0
            ].filter(Boolean).join("\n")
          }).catch((error) => console.warn("[StripeWebhook] Owner payment notification failed", error));
        }
        if (session.metadata?.order_type === "shop_products" && session.id) {
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
          await markOrderPaid(session.id, paymentIntentId);
          const order = await getOrderByCheckoutSession(session.id);
          await sendCustomerSmsSafely({
            to: order?.customerPhone,
            body: `Eby\u2019s Place has received payment for order #${order?.id ?? session.metadata?.order_id ?? ""}. We will prepare your items and keep you updated.`
          });
          await notifyOwner({
            title: "Eby\u2019s Place shop order paid",
            content: [
              `A shop product payment has been confirmed through Stripe.`,
              `Order ID: ${session.metadata?.order_id ?? "Not provided"}`,
              `Customer: ${session.metadata?.customer_name ?? "Not provided"}`,
              `Email: ${session.metadata?.customer_email ?? session.customer_email ?? "Not provided"}`,
              `Stripe session: ${session.id}`,
              paymentIntentId ? `Payment intent: ${paymentIntentId}` : void 0
            ].filter(Boolean).join("\n")
          }).catch((error) => console.warn("[StripeWebhook] Owner order notification failed", error));
        }
      }
      console.log("[StripeWebhook] Processed event", event.type, event.id);
      res.json({ received: true });
    } catch (error) {
      console.error("[StripeWebhook] Failed to process event", event.id, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import Stripe2 from "stripe";
import { z as z2 } from "zod";

// server/storage.ts
var SUPABASE_URL = (process.env.SUPABASE_URL || "https://jcyoipbiplzrocrrhwkp.supabase.co").replace(/\/+$/, "");
var SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "ebysplace-media";
function getSupabaseConfig() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Storage is unavailable: configure SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.");
  }
  return { supabaseUrl: SUPABASE_URL, serviceRoleKey, bucket: SUPABASE_BUCKET };
}
function normalizeKey(relKey) {
  return relKey.replace(/^supabase:/, "").replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const cleanKey = normalizeKey(relKey);
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = cleanKey.lastIndexOf(".");
  if (lastDot === -1) return `${cleanKey}_${hash}`;
  return `${cleanKey.slice(0, lastDot)}_${hash}${cleanKey.slice(lastDot)}`;
}
function encodeObjectKey(key) {
  return normalizeKey(key).split("/").map((part) => encodeURIComponent(part)).join("/");
}
function publicUrlForKey(key) {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${encodeObjectKey(key)}`;
}
function toUploadBody(data, contentType) {
  if (typeof data === "string") return new Blob([data], { type: contentType });
  return new Blob([data], { type: contentType });
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseConfig();
  const key = appendHashSuffix(relKey);
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectKey(key)}`;
  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: toUploadBody(data, contentType)
  });
  if (!uploadResp.ok) {
    const msg = await uploadResp.text().catch(() => uploadResp.statusText);
    throw new Error(`Supabase storage upload failed (${uploadResp.status}): ${msg}`);
  }
  return { key: `supabase:${key}`, url: publicUrlForKey(key) };
}
async function storageGet(relKey) {
  const key = normalizeKey(relKey);
  return { key: `supabase:${key}`, url: publicUrlForKey(key) };
}
async function storageGetSignedUrl(relKey) {
  return (await storageGet(relKey)).url;
}

// server/_core/imageGeneration.ts
async function fetchImageAsFile(image, index) {
  const mimeType = image.mimeType?.startsWith("image/") ? image.mimeType : "image/png";
  if (image.b64Json) {
    const buffer = Buffer.from(image.b64Json, "base64");
    const ext2 = mimeType.split("/")[1] || "png";
    return new File([buffer], `source-${index}.${ext2}`, { type: mimeType });
  }
  if (!image.url) throw new Error("AI Try-On needs a readable source image URL.");
  const response = await fetch(image.url);
  if (!response.ok) {
    throw new Error(`AI Try-On could not retrieve the uploaded photo (${response.status}). Please upload the photo again.`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0] || mimeType;
  const ext = contentType.split("/")[1] || "png";
  const bytes = await response.arrayBuffer();
  return new File([bytes], `source-${index}.${ext}`, { type: contentType });
}
async function generateImage(options) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI Try-On is not configured for this deployment. Add OPENAI_API_KEY in Vercel, then redeploy.");
  }
  const originals = options.originalImages || [];
  const endpoint = originals.length > 0 ? "https://api.openai.com/v1/images/edits" : "https://api.openai.com/v1/images/generations";
  const form = new FormData();
  form.set("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  form.set("prompt", options.prompt);
  form.set("size", process.env.OPENAI_IMAGE_SIZE || "1024x1024");
  if (originals.length > 0) {
    const files = await Promise.all(originals.map((image2, index) => fetchImageAsFile(image2, index)));
    for (const file of files) form.append("image", file);
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
  }
  const result = await response.json();
  const image = result.data?.[0];
  if (!image) throw new Error("OpenAI image generation returned no image data.");
  if (image.url) return { url: image.url };
  if (!image.b64_json) throw new Error("OpenAI image generation returned an unsupported response.");
  const buffer = Buffer.from(image.b64_json, "base64");
  const { url } = await storagePut(`try-on/generated/${Date.now()}.png`, buffer, "image/png");
  return { url };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// shared/const.ts
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/supabaseAuth.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var ADMIN_EMAIL = (process.env.EBYSPLACE_ADMIN_EMAIL ?? "info@ebysplace.com").trim().toLowerCase();
function toTrpcError(error, fallbackMessage) {
  if (error instanceof TRPCError3) return error;
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message });
}
function getSupabaseAuthConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("[Auth] Supabase Auth configuration missing", {
      hasSupabaseUrl: Boolean(url),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });
    throw new TRPCError3({
      code: "PRECONDITION_FAILED",
      message: "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the deployment environment."
    });
  }
  return { url, serviceRoleKey };
}
function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
function getDisplayName(user, fallbackEmail) {
  const metadataName = user.user_metadata?.name;
  return typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : fallbackEmail.split("@")[0];
}
function getSafeResetRedirect(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported protocol");
    return parsed.origin + "/admin/reset-password";
  } catch {
    return "http://localhost:3000/admin/reset-password";
  }
}
async function supabaseAuthFetch(path2, init = {}) {
  const { url, serviceRoleKey } = getSupabaseAuthConfig();
  let response;
  try {
    response = await fetch(`${url}/auth/v1${path2}`, {
      ...init,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...init.headers ?? {}
      }
    });
  } catch (error) {
    console.error("[Auth] Supabase Auth network request failed", { path: path2, method: init.method ?? "GET", error });
    throw new TRPCError3({ code: "BAD_GATEWAY", message: "Unable to reach Supabase Auth. Check SUPABASE_URL and network access." });
  }
  const body = await response.text().catch((error) => {
    console.error("[Auth] Failed reading Supabase Auth response body", { path: path2, status: response.status, error });
    return "";
  });
  let json = null;
  if (body) {
    try {
      json = JSON.parse(body);
    } catch (error) {
      console.error("[Auth] Supabase Auth returned non-JSON response", {
        path: path2,
        status: response.status,
        bodyPreview: body.slice(0, 500),
        error
      });
      throw new TRPCError3({ code: "BAD_GATEWAY", message: "Supabase Auth returned an invalid response." });
    }
  }
  if (!response.ok) {
    const message = typeof json?.msg === "string" ? json.msg : typeof json?.message === "string" ? json.message : "Supabase Auth request failed.";
    console.error("[Auth] Supabase Auth request failed", { path: path2, method: init.method ?? "GET", status: response.status, message });
    throw new TRPCError3({ code: response.status === 401 || response.status === 400 ? "UNAUTHORIZED" : "BAD_REQUEST", message });
  }
  return json;
}
async function signInAdminWithPassword(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    if (normalizedEmail !== ADMIN_EMAIL) {
      console.error("[Auth] Rejected admin sign-in for non-admin email", { email: normalizedEmail });
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Only the configured Eby\u2019s Place administrator can sign in." });
    }
    const session = await supabaseAuthFetch("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, password })
    });
    if (!session.access_token || !session.user?.id) {
      console.error("[Auth] Supabase returned an incomplete admin session", { email: normalizedEmail, hasAccessToken: Boolean(session.access_token), hasUserId: Boolean(session.user?.id) });
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Supabase did not return a valid session." });
    }
    await upsertUser({
      openId: session.user.id,
      email: normalizedEmail,
      name: getDisplayName(session.user, normalizedEmail),
      loginMethod: "supabase_password",
      role: "admin",
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    return {
      accessToken: session.access_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1e3) + session.expires_in,
      user: {
        openId: session.user.id,
        email: normalizedEmail,
        name: getDisplayName(session.user, normalizedEmail),
        role: "admin"
      }
    };
  } catch (error) {
    const safeError = toTrpcError(error, "Admin sign-in failed.");
    console.error("[Auth] Admin sign-in failed", { email: normalizedEmail, code: safeError.code, message: safeError.message, stack: safeError.stack });
    throw safeError;
  }
}
async function requestAdminPasswordReset(email, origin) {
  const normalizedEmail = email.trim().toLowerCase();
  const genericResponse = {
    success: true,
    message: "If this email is the configured Eby\u2019s Place administrator, a Supabase password reset link has been sent."
  };
  if (normalizedEmail !== ADMIN_EMAIL) {
    console.warn("[Auth] Ignored password reset request for non-admin email", { email: normalizedEmail });
    return genericResponse;
  }
  try {
    const redirectTo = getSafeResetRedirect(origin);
    await supabaseAuthFetch("/recover?redirect_to=" + encodeURIComponent(redirectTo), {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail })
    });
    return genericResponse;
  } catch (error) {
    const safeError = toTrpcError(error, "Unable to send the Supabase password reset email.");
    console.error("[Auth] Password reset request failed", { email: normalizedEmail, code: safeError.code, message: safeError.message });
    throw safeError;
  }
}
async function updateAdminPasswordWithRecoveryToken(accessToken, password) {
  const token = accessToken.trim();
  if (!token) throw new TRPCError3({ code: "BAD_REQUEST", message: "The password reset link is missing its recovery token." });
  try {
    const user = await supabaseAuthFetch("/user", {
      method: "GET",
      headers: { Authorization: "Bearer " + token }
    });
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (normalizedEmail !== ADMIN_EMAIL) {
      console.error("[Auth] Rejected password update for non-admin recovery token", { email: normalizedEmail });
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "This reset link is not for the configured Eby\u2019s Place administrator." });
    }
    const updated = await supabaseAuthFetch("/user", {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({ password })
    });
    await upsertUser({
      openId: updated.id || user.id,
      email: ADMIN_EMAIL,
      name: getDisplayName(updated.id ? updated : user, ADMIN_EMAIL),
      loginMethod: "supabase_password",
      role: "admin",
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    return { success: true, message: "Your admin password has been updated. Please sign in with the new password." };
  } catch (error) {
    const safeError = toTrpcError(error, "Unable to update the admin password from this reset link.");
    console.error("[Auth] Password update failed", { code: safeError.code, message: safeError.message });
    throw safeError;
  }
}
async function authenticateSupabaseRequest(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const user = await supabaseAuthFetch("/user", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!user.id || !user.email) {
      console.error("[Auth] Supabase bearer token returned an incomplete user", { hasUserId: Boolean(user.id), hasEmail: Boolean(user.email) });
      return null;
    }
    const normalizedEmail = user.email.trim().toLowerCase();
    const role = normalizedEmail === ADMIN_EMAIL ? "admin" : "user";
    const localUser = {
      openId: user.id,
      email: normalizedEmail,
      name: getDisplayName(user, normalizedEmail),
      loginMethod: "supabase_password",
      role,
      lastSignedIn: /* @__PURE__ */ new Date()
    };
    await upsertUser(localUser);
    return localUser;
  } catch (error) {
    console.error("[Auth] Supabase bearer token verification failed", error);
    return null;
  }
}

// server/routers.ts
var serviceCategory = z2.enum(["Braids", "Twists", "Locs", "Kids Styles", "Add-ons"]);
var bookingStatus = z2.enum(["pending", "confirmed", "completed", "cancelled"]);
var reviewStatus = z2.enum(["approved", "rejected"]);
var orderStatus = z2.enum(["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
var productStockStatus = z2.enum(["in_stock", "low_stock", "out_of_stock"]);
var productCategory = z2.enum(["Accessories", "Aftercare", "Hair Attachments"]);
var galleryCategory = z2.enum(["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
var bookingInput = z2.object({
  serviceId: z2.number().optional(),
  serviceName: z2.string().min(2),
  clientName: z2.string().min(2),
  clientEmail: z2.string().email(),
  clientPhone: z2.string().min(6),
  addressLine1: z2.string().min(3),
  city: z2.string().min(2),
  county: z2.string().optional(),
  postcode: z2.string().min(3),
  deliveryNote: z2.string().optional(),
  appointmentDate: z2.string().min(8),
  appointmentTime: z2.string().min(4)
});
var orderInput = z2.object({
  customerName: z2.string().min(2),
  customerEmail: z2.string().email(),
  customerPhone: z2.string().optional(),
  addressLine1: z2.string().min(3),
  city: z2.string().min(2),
  county: z2.string().optional(),
  postcode: z2.string().min(3),
  deliveryNote: z2.string().optional(),
  items: z2.array(z2.object({
    productId: z2.number(),
    variantId: z2.number().optional(),
    productName: z2.string().min(2),
    variantName: z2.string().optional(),
    quantity: z2.number().int().positive(),
    unitPrice: z2.string().regex(/^\d+(\.\d{2})?$/)
  })).min(1)
});
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Stripe is not configured yet." });
  return new Stripe2(key);
}
function getOrigin(req) {
  const origin = req.headers.origin;
  return typeof origin === "string" ? origin : "http://localhost:3000";
}
async function notifyOwnerSafely(title, content) {
  try {
    await notifyOwner({ title, content });
  } catch (error) {
    console.warn("[Notification] Owner notification skipped", error);
  }
}
function decodeDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new TRPCError4({ code: "BAD_REQUEST", message: "Upload must be a base64 data URL." });
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}
async function uploadDataUrlAsset(input) {
  const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
  if (!mimeType.startsWith("image/")) {
    throw new TRPCError4({ code: "BAD_REQUEST", message: "Only image uploads are supported for admin media." });
  }
  if (buffer.byteLength > 7 * 1024 * 1024) {
    throw new TRPCError4({ code: "PAYLOAD_TOO_LARGE", message: "Please upload an image smaller than 7MB." });
  }
  const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
  const baseName = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || "upload";
  const uploaded = await storagePut(`${input.folder}/${Date.now()}-${baseName}.${extension}`, buffer, mimeType);
  return { url: uploaded.url, key: uploaded.key, mimeType };
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string().min(8) })).mutation(({ input }) => signInAdminWithPassword(input.email, input.password)),
    requestPasswordReset: publicProcedure.input(z2.object({ email: z2.string().email(), origin: z2.string().url() })).mutation(({ input }) => requestAdminPasswordReset(input.email, input.origin)),
    updatePassword: publicProcedure.input(z2.object({ accessToken: z2.string().min(20), password: z2.string().min(8) })).mutation(({ input }) => updateAdminPasswordWithRecoveryToken(input.accessToken, input.password)),
    logout: publicProcedure.mutation(() => ({ success: true }))
  }),
  public: router({
    services: publicProcedure.input(z2.object({ category: serviceCategory.optional() }).optional()).query(({ input }) => listServices(input?.category)),
    featuredServices: publicProcedure.query(() => listFeaturedServices()),
    products: publicProcedure.query(() => listProducts()),
    websiteSections: publicProcedure.query(() => listWebsiteSections()),
    reviews: publicProcedure.query(() => listApprovedReviews()),
    gallery: publicProcedure.input(z2.object({ category: z2.string().optional() }).optional()).query(({ input }) => listGallery(input?.category)),
    newsletter: publicProcedure.input(z2.object({ email: z2.string().email(), productAlerts: z2.boolean().default(false) })).mutation(({ input }) => subscribeNewsletter(input.email, input.productAlerts)),
    submitReview: publicProcedure.input(z2.object({ customerName: z2.string().min(2), rating: z2.number().min(1).max(5), reviewText: z2.string().min(10) })).mutation(async ({ input }) => {
      const review = await submitReview(input);
      await notifyOwnerSafely(
        "New Eby\u2019s Place review submitted",
        [
          `A customer submitted a website review for moderation.`,
          `Review ID: ${review.id}`,
          `Customer: ${input.customerName}`,
          `Rating: ${input.rating}/5`,
          `Status: ${review.status}`
        ].join("\n")
      );
      return { ...review, customerNotification: "Thank you for reviewing Eby\u2019s Place. Your review has been received and is pending approval." };
    }),
    createBooking: publicProcedure.input(bookingInput).mutation(async ({ input }) => {
      const booking = await createBooking({ ...input, status: "pending", depositStatus: "unpaid" });
      await notifyOwnerSafely(
        "New Eby\u2019s Place booking request",
        [
          `A customer has submitted a booking request and needs to complete the \xA320 Stripe deposit.`,
          `Booking ID: ${booking.id}`,
          `Service: ${input.serviceName}`,
          `Customer: ${input.clientName}`,
          `Email: ${input.clientEmail}`,
          `Phone: ${input.clientPhone}`,
          `Appointment: ${input.appointmentDate} at ${input.appointmentTime}`,
          `Address: ${input.addressLine1}, ${input.city}${input.county ? `, ${input.county}` : ""}, ${input.postcode}`,
          input.deliveryNote ? `Notes: ${input.deliveryNote}` : void 0
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.clientPhone,
        body: `Eby\u2019s Place received your ${input.serviceName} booking request for ${input.appointmentDate} at ${input.appointmentTime}. Please complete the \xA320 Stripe deposit on the website to secure it.`
      });
      return { bookingId: booking.id, depositAmount: 20, depositCurrency: "GBP", message: "A \xA320 non-refundable deposit is required to secure your Eby\u2019s Place appointment. You will receive on-screen confirmation after Stripe confirms payment.", customerNotification: "Your Eby\u2019s Place booking request has been received. Please complete the secure Stripe deposit checkout to confirm the appointment." };
    }),
    createDepositCheckout: publicProcedure.input(z2.object({ bookingId: z2.number(), clientEmail: z2.string().email(), clientName: z2.string().min(2), serviceName: z2.string().min(2) })).mutation(async ({ input, ctx }) => {
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.clientEmail,
        client_reference_id: input.bookingId.toString(),
        payment_intent_data: { receipt_email: input.clientEmail, description: `Eby\u2019s Place booking deposit for ${input.serviceName}`, statement_descriptor_suffix: "EBYSPLACE" },
        custom_text: { submit: { message: "You are paying Eby\u2019s Place securely. Your booking deposit confirmation and receipt will use the email entered for checkout." } },
        line_items: [{ price_data: { currency: "gbp", unit_amount: 2e3, product_data: { name: "Eby\u2019s Place \xA320 non-refundable booking deposit", description: `Deposit for ${input.serviceName}` } }, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${origin}/booking/success?booking=${input.bookingId}`,
        cancel_url: `${origin}/booking?booking=${input.bookingId}`,
        metadata: { booking_id: input.bookingId.toString(), customer_email: input.clientEmail, customer_name: input.clientName, service_name: input.serviceName, deposit_type: "non_refundable_20_gbp" }
      });
      if (!session.url) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a booking deposit checkout link. Please try again." });
      await updateBookingCheckout(input.bookingId, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
      return { checkoutUrl: session.url, bookingId: input.bookingId };
    }),
    createOrder: publicProcedure.input(orderInput).mutation(async ({ input, ctx }) => {
      const order = await createOrderWithItems(input);
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const orderId = order.id.toString();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: orderId,
        payment_intent_data: { receipt_email: input.customerEmail, description: "Eby\u2019s Place shop order", statement_descriptor_suffix: "EBYSPLACE" },
        custom_text: { submit: { message: "You are paying Eby\u2019s Place securely. Your shop order confirmation and receipt will use the email entered for checkout." } },
        line_items: order.items.map((item) => ({
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(Number(item.unitPrice) * 100),
            product_data: {
              name: item.variantName ? `${item.productName} \u2014 ${item.variantName}` : item.productName,
              description: "Eby\u2019s Place shop product"
            }
          },
          quantity: item.quantity
        })),
        allow_promotion_codes: true,
        success_url: `${origin}/shop?payment=success&order=${orderId}`,
        cancel_url: `${origin}/shop?payment=cancelled&order=${orderId}`,
        metadata: {
          order_id: orderId,
          order_type: "shop_products",
          customer_email: input.customerEmail,
          customer_name: input.customerName
        }
      });
      if (!session.url) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a checkout link. Please try again." });
      await updateOrderCheckout(order.id, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
      await notifyOwnerSafely(
        "New Eby\u2019s Place shop order checkout started",
        [
          `A customer started Stripe checkout for a shop order.`,
          `Order ID: ${order.id}`,
          `Customer: ${input.customerName}`,
          `Email: ${input.customerEmail}`,
          input.customerPhone ? `Phone: ${input.customerPhone}` : void 0,
          `Items: ${order.items.map((item) => `${item.quantity} \xD7 ${item.variantName ? `${item.productName} \u2014 ${item.variantName}` : item.productName}`).join(", ")}`
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.customerPhone,
        body: `Eby\u2019s Place has prepared your secure checkout for order #${order.id}. Please complete Stripe payment in the browser tab to confirm your order.`
      });
      return { orderId: order.id, checkoutUrl: session.url, status: "pending_payment", message: "Your secure Eby\u2019s Place checkout is ready.", customerNotification: "Your Eby\u2019s Place order checkout is ready. Please complete Stripe payment to confirm the order." };
    }),
    uploadTryOnPhoto: publicProcedure.input(z2.object({ dataUrl: z2.string().min(50), fileName: z2.string().default("try-on-photo.jpg") })).mutation(async ({ input }) => {
      const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
      const supportedTypes = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!supportedTypes.has(mimeType)) {
        throw new TRPCError4({ code: "BAD_REQUEST", message: "AI Try-On accepts JPEG, PNG, or WebP photos after preparation." });
      }
      if (buffer.byteLength > 7 * 1024 * 1024) {
        throw new TRPCError4({ code: "PAYLOAD_TOO_LARGE", message: "Please upload a smaller photo. The AI Try-On accepts images up to 7MB after preparation." });
      }
      const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const safeName = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || "customer-photo";
      const uploaded = await storagePut(`try-on/uploads/${Date.now()}-${safeName}.${extension}`, buffer, mimeType);
      return { url: uploaded.url, key: uploaded.key, mimeType };
    }),
    generateTryOn: publicProcedure.input(z2.object({
      styleName: z2.string().min(2),
      originalImageUrl: z2.string().min(5),
      originalImageKey: z2.string().min(3).optional(),
      mimeType: z2.string().optional()
    })).mutation(async ({ input }) => {
      const record = await createTryOnGeneration({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, status: "pending" });
      try {
        const prompt = `Change ONLY the hairstyle of the person in this photo to ${input.styleName}. Keep the person's face, skin tone, eye color, facial features, expression, body, background, and clothing EXACTLY the same \u2014 do not alter them in any way. Only modify the hair into neat, professional, realistic ${input.styleName} with the refined Eby\u2019s Place salon finish.`;
        const storageKey = input.originalImageUrl.startsWith("/") ? input.originalImageKey ?? decodeURIComponent(input.originalImageUrl.replace("/", "")) : null;
        const editableImageUrl = storageKey ? await storageGetSignedUrl(storageKey) : input.originalImageUrl;
        const mimeType = input.mimeType?.startsWith("image/") ? input.mimeType : "image/jpeg";
        const result = await generateImage({ prompt, originalImages: [{ url: editableImageUrl, mimeType }] });
        await updateTryOnGeneration(record.id, { status: "completed", generatedImageUrl: result.url });
        await notifyOwnerSafely(
          "New Eby\u2019s Place AI Try-On generated",
          [
            `A visitor generated an AI Try-On preview on the website.`,
            `Try-On ID: ${record.id}`,
            `Style: ${input.styleName}`
          ].join("\n")
        );
        return { id: record.id, generatedImageUrl: result.url, status: "completed", customerNotification: "Your Eby\u2019s Place AI Try-On preview is ready." };
      } catch (error) {
        const message = error instanceof Error ? error.message : "The AI could not read that photo clearly. Please upload a bright front-facing JPEG, PNG, WebP, or iPhone HEIC portrait where the face and hair are visible.";
        await updateTryOnGeneration(record.id, { status: "failed", errorMessage: message });
        throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
    track: publicProcedure.input(z2.object({ eventName: z2.string().min(2), pagePath: z2.string().min(1), metadata: z2.unknown().optional() })).mutation(({ input }) => recordAnalytics(input.eventName, input.pagePath, input.metadata))
  }),
  admin: router({
    summary: adminProcedure.query(() => adminSummary()),
    lists: adminProcedure.query(() => adminLists()),
    moderateReview: adminProcedure.input(z2.object({ id: z2.number(), status: reviewStatus })).mutation(({ input }) => moderateReview(input.id, input.status)),
    updateBookingStatus: adminProcedure.input(z2.object({ id: z2.number(), status: bookingStatus })).mutation(({ input }) => updateBookingStatus(input.id, input.status)),
    updateOrderStatus: adminProcedure.input(z2.object({ id: z2.number(), status: orderStatus })).mutation(({ input }) => updateOrderStatus(input.id, input.status)),
    updateService: adminProcedure.input(z2.object({ id: z2.number(), name: z2.string().min(2).optional(), description: z2.string().min(10).optional(), duration: z2.string().min(2).optional(), priceFrom: z2.string().regex(/^\d+(\.\d{2})?$/).optional(), badge: z2.string().optional(), imageUrl: z2.string().min(5).optional(), isBookable: z2.enum(["true", "false"]).optional(), isFeatured: z2.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { id, ...changes } = input;
      return updateService(id, changes);
    }),
    createProduct: adminProcedure.input(z2.object({ name: z2.string().min(2), slug: z2.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), seoTitle: z2.string().min(8).max(255).optional(), seoDescription: z2.string().min(30).max(320).optional(), category: productCategory, description: z2.string().min(10), price: z2.string().regex(/^\d+(\.\d{2})?$/), imageUrl: z2.string().min(5).optional(), badge: z2.string().optional(), stockStatus: productStockStatus.default("in_stock"), stockQuantity: z2.number().int().min(0).default(0), isFeatured: z2.enum(["true", "false"]).default("false"), variants: z2.array(z2.object({ name: z2.string().min(1), colourHex: z2.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), stockQuantity: z2.number().int().min(0).default(0) })).default([]) })).mutation(({ input }) => {
      const { variants, ...product } = input;
      return createProduct(product, variants);
    }),
    updateProduct: adminProcedure.input(z2.object({ id: z2.number(), name: z2.string().min(2).optional(), slug: z2.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), seoTitle: z2.string().min(8).max(255).optional(), seoDescription: z2.string().min(30).max(320).optional(), category: productCategory.optional(), description: z2.string().min(10).optional(), price: z2.string().regex(/^\d+(\.\d{2})?$/).optional(), imageUrl: z2.string().min(5).optional(), badge: z2.string().optional(), stockStatus: productStockStatus.optional(), stockQuantity: z2.number().int().min(0).optional(), isFeatured: z2.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { id, ...changes } = input;
      return updateProduct(id, changes);
    }),
    updateProductStock: adminProcedure.input(z2.object({ id: z2.number(), stockQuantity: z2.number().int().min(0), stockStatus: productStockStatus })).mutation(({ input }) => updateProductStock(input.id, input.stockQuantity, input.stockStatus)),
    updateProductVariants: adminProcedure.input(z2.object({ productId: z2.number(), variants: z2.array(z2.object({ name: z2.string().min(1), colourHex: z2.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), stockQuantity: z2.number().int().min(0).default(0) })) })).mutation(({ input }) => replaceProductVariants(input.productId, input.variants)),
    uploadProductImage: adminProcedure.input(z2.object({ productId: z2.number().optional(), productName: z2.string().min(2), dataUrl: z2.string().min(50), fileName: z2.string().default("product-image.png") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.productName}-${input.fileName}`, folder: "products" });
      if (input.productId) await updateProduct(input.productId, { imageUrl: uploaded.url });
      return uploaded;
    }),
    insights: adminProcedure.query(() => adminInsights()),
    uploadServiceImage: adminProcedure.input(z2.object({ serviceId: z2.number(), serviceName: z2.string().min(2), dataUrl: z2.string().min(50), fileName: z2.string().default("service-image.png") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.serviceName}-${input.fileName}`, folder: "services" });
      await updateService(input.serviceId, { imageUrl: uploaded.url });
      return uploaded;
    }),
    uploadGalleryImage: adminProcedure.input(z2.object({ dataUrl: z2.string().min(50), fileName: z2.string().default("gallery-image.png") })).mutation(async ({ input }) => uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: input.fileName, folder: "gallery" })),
    uploadWebsiteSectionImage: adminProcedure.input(z2.object({ sectionKey: z2.string().min(2), dataUrl: z2.string().min(50), fileName: z2.string().default("section-image.png"), imageRole: z2.enum(["main", "portrait"]).default("main") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.sectionKey}-${input.imageRole}-${input.fileName}`, folder: "website-sections" });
      await updateWebsiteSection(input.sectionKey, input.imageRole === "portrait" ? { portraitImageUrl: uploaded.url } : { imageUrl: uploaded.url });
      return uploaded;
    }),
    addGalleryImage: adminProcedure.input(z2.object({ title: z2.string().min(2), category: galleryCategory, imageUrl: z2.string().min(5), altText: z2.string().min(5), isPublished: z2.enum(["true", "false"]).default("true"), sortOrder: z2.number().int().default(0) })).mutation(({ input }) => addGalleryImage(input)),
    updateWebsiteSection: adminProcedure.input(z2.object({ sectionKey: z2.string().min(2), title: z2.string().min(2).optional(), eyebrow: z2.string().optional(), body: z2.string().optional(), ctaLabel: z2.string().optional(), ctaHref: z2.string().optional(), imageUrl: z2.string().optional(), portraitImageUrl: z2.string().optional(), portraitDescription: z2.string().optional(), isPublished: z2.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { sectionKey, ...changes } = input;
      return updateWebsiteSection(sectionKey, changes);
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  const req = opts.req;
  const res = opts.res;
  let user = null;
  try {
    user = await authenticateSupabaseRequest(req);
  } catch {
    user = null;
  }
  return { req, res, user };
}

// server/static.ts
import express2 from "express";
import fs from "fs";
import path from "path";
function resolveProductionStaticPath() {
  const candidates = [
    path.resolve(process.cwd(), "public"),
    path.resolve(import.meta.dirname, "..", "public"),
    path.resolve(import.meta.dirname, "../..", "public"),
    path.resolve(import.meta.dirname, "public"),
    path.resolve(import.meta.dirname, "../..", "dist", "public")
  ];
  return candidates.find((candidate) => fs.existsSync(path.resolve(candidate, "index.html"))) ?? candidates[0];
}
function isBackendApiRequest(url) {
  const pathname = url.split("?")[0] ?? "/";
  if (pathname === "/api/index" || pathname === "/api/index/") {
    return false;
  }
  return pathname === "/api" || pathname.startsWith("/api/");
}
function serveStatic(app2) {
  const distPath = process.env.NODE_ENV === "development" ? path.resolve(import.meta.dirname, "..", "dist", "public") : resolveProductionStaticPath();
  const indexPath = path.resolve(distPath, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath, { fallthrough: true, index: false }));
  app2.use("*", (req, res, next) => {
    if (isBackendApiRequest(req.originalUrl || req.url)) {
      return next();
    }
    res.status(200).sendFile(indexPath, (error) => {
      if (error) next(error);
    });
  });
}

// server/apiErrorHandling.ts
function isApiRequest(req) {
  return req.path === "/api" || req.path.startsWith("/api/");
}
function getStatusCode(error) {
  if (typeof error === "object" && error !== null) {
    const maybeStatus = error.status ?? error.statusCode;
    if (typeof maybeStatus === "number" && maybeStatus >= 400 && maybeStatus < 600) return maybeStatus;
  }
  return 500;
}
function getErrorMessage(error) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Internal server error";
}
function registerApiJsonNotFound(app2) {
  app2.use("/api", (req, res) => {
    console.error("[API] Unmatched API route", { method: req.method, path: req.originalUrl });
    res.status(404).json({
      ok: false,
      error: "API route not found",
      path: req.originalUrl
    });
  });
}
var apiJsonErrorHandler = (error, req, res, next) => {
  if (!isApiRequest(req)) return next(error);
  const status = getStatusCode(error);
  const message = getErrorMessage(error);
  console.error("[API] Request failed", {
    method: req.method,
    path: req.originalUrl,
    status,
    message,
    stack: error instanceof Error ? error.stack : void 0
  });
  if (res.headersSent) return next(error);
  res.status(status).json({
    ok: false,
    error: message
  });
};

// server/vercel.ts
var app = express3();
registerStripeWebhook(app);
app.use(express3.json({ limit: "50mb" }));
app.use(express3.urlencoded({ limit: "50mb", extended: true }));
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path: path2, type }) {
      console.error("[tRPC] Vercel API request failed", { path: path2, type, message: error.message, stack: error.stack });
    }
  })
);
registerApiJsonNotFound(app);
serveStatic(app);
app.use(apiJsonErrorHandler);
var vercel_default = app;
export {
  vercel_default as default
};
