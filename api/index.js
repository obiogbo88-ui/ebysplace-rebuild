import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// server/vercel.ts
import "dotenv/config";
import express3 from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/stripeWebhook.ts
import express from "express";
import Stripe from "stripe";

// server/db.ts
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// server/_core/envSecrets.ts
var INVISIBLE_OR_COPY_WHITESPACE = /[\s\u200B-\u200D\uFEFF]+/g;
function trimEnvValue(value) {
  return (value ?? "").trim().replace(/^[\'\"]|[\'\"]$/g, "").trim();
}
function normalizeSecretKey(value) {
  return trimEnvValue(value).replace(INVISIBLE_OR_COPY_WHITESPACE, "");
}
function normalizeEnvUrl(value) {
  return normalizeSecretKey(value).replace(/\/+$/, "");
}

// drizzle/schema.ts
import {
  bigint,
  integer,
  json,
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
var bookingStatusEnum = pgEnum("booking_status_enum", ["pending", "confirmed", "completed", "cancelled"]);
var bookingLocationTypeEnum = pgEnum("booking_location_type_enum", ["studio", "home_service"]);
var depositStatusEnum = pgEnum("deposit_status_enum", ["unpaid", "checkout_started", "paid", "failed", "refunded"]);
var productCategoryEnum = pgEnum("product_category_enum", ["Accessories", "Aftercare", "Hair Attachments"]);
var stockStatusEnum = pgEnum("stock_status_enum", ["in_stock", "low_stock", "out_of_stock"]);
var orderStatusEnum = pgEnum("order_status_enum", ["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
var galleryCategoryEnum = pgEnum("gallery_category_enum", ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
var reviewStatusEnum = pgEnum("review_status_enum", ["pending", "approved", "rejected"]);
var tryOnStatusEnum = pgEnum("try_on_status_enum", ["pending", "completed", "failed"]);
var emailNotificationStatusEnum = pgEnum("email_notification_status_enum", ["pending", "sent", "failed", "retried"]);
var emailNotificationAudienceEnum = pgEnum("email_notification_audience_enum", ["owner", "customer"]);
var emailNotificationEntityEnum = pgEnum("email_notification_entity_enum", ["booking", "order"]);
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
  category: varchar("category", { length: 120 }).notNull(),
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
  serviceLocation: bookingLocationTypeEnum("serviceLocation").default("studio").notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }),
  deliveryNote: text("deliveryNote"),
  homeServiceSurcharge: numeric("homeServiceSurcharge", { precision: 10, scale: 2 }).default("0.00").notNull(),
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
  imageUrl: varchar("imageUrl", { length: 800 }),
  stockQuantity: integer("stockQuantity").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 80 }),
  serviceLocation: bookingLocationTypeEnum("serviceLocation").default("studio").notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }),
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
  imageUrl: varchar("imageUrl", { length: 800 }),
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
var productReviews = pgTable("productReviews", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
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
  metadata: json("metadata"),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var activityLogs = pgTable("activityLogs", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  userName: varchar("userName", { length: 180 }),
  userEmail: varchar("userEmail", { length: 320 }),
  sessionId: varchar("sessionId", { length: 128 }),
  activityType: varchar("activityType", { length: 120 }).notNull(),
  activityCategory: varchar("activityCategory", { length: 120 }).notNull(),
  description: text("description").notNull(),
  pageUrl: varchar("pageUrl", { length: 800 }),
  metadata: json("metadata"),
  status: varchar("status", { length: 30 }).default("info").notNull(),
  ipAddress: varchar("ipAddress", { length: 80 }),
  country: varchar("country", { length: 120 }),
  city: varchar("city", { length: 120 }),
  region: varchar("region", { length: 120 }),
  deviceType: varchar("deviceType", { length: 40 }),
  browser: varchar("browser", { length: 80 }),
  userAgent: varchar("userAgent", { length: 500 }),
  relatedEntityType: varchar("relatedEntityType", { length: 80 }),
  relatedEntityId: varchar("relatedEntityId", { length: 120 }),
  sourceApp: varchar("sourceApp", { length: 80 }).default("ebysplace").notNull(),
  isRead: trueFalseEnum("isRead").default("false").notNull(),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var emailNotificationLogs = pgTable("emailNotificationLogs", {
  id: serial("id").primaryKey(),
  entityType: emailNotificationEntityEnum("entityType").notNull(),
  entityId: integer("entityId").notNull(),
  audience: emailNotificationAudienceEnum("audience").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  bodyPreview: text("bodyPreview"),
  status: emailNotificationStatusEnum("status").default("pending").notNull(),
  provider: varchar("provider", { length: 80 }).default("zoho_smtp").notNull(),
  smtpHost: varchar("smtpHost", { length: 255 }),
  messageId: varchar("messageId", { length: 255 }),
  errorMessage: text("errorMessage"),
  attempts: integer("attempts").default(0).notNull(),
  lastAttemptAtMs: bigint("lastAttemptAtMs", { mode: "number" }),
  sentAtMs: bigint("sentAtMs", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
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
var _seedingPromise = null;
var _unsupportedDatabaseUrlWarned = false;
var _missingDatabaseUrlWarned = false;
var _databaseConnectionFailed = false;
var _lastDatabaseUrlFingerprint = null;
function isPostgresConnectionString(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return ["postgresql:", "postgres:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
function requiresSsl(connectionString) {
  return /sslmode=require|ssl=true|supabase\.co/i.test(connectionString);
}
function getDatabaseUrl() {
  return trimEnvValue(process.env.DATABASE_URL);
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
    console.log("[Database] DATABASE_URL detected for PostgreSQL initialisation", {
      fingerprint,
      isPostgres: isPostgresConnectionString(connectionString),
      requiresSsl: requiresSsl(connectionString),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });
  }
  if (!isPostgresConnectionString(connectionString)) {
    if (!_unsupportedDatabaseUrlWarned) {
      console.error("[Database] Ignoring non-PostgreSQL DATABASE_URL. The app expects a postgresql:// connection string (e.g. from Supabase) and will use safe seed-data fallbacks until one is configured.", { fingerprint });
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
      await _pool.query("SELECT 1");
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
function getSupabaseRestConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = normalizeEnvUrl(rawUrl);
  const serviceRoleKey = normalizeSecretKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}
function isSupabaseConfigured() {
  return !!getSupabaseRestConfig();
}
function cleanUndefinedValues(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== void 0));
}
async function supabaseRest(path2, init = {}) {
  const config = getSupabaseRestConfig();
  if (!config) return { ok: false, status: 0, body: null, unavailable: true };
  const response = await fetch(`${config.url}${path2}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers || {}
    }
  });
  const text2 = await response.text();
  let body = null;
  if (text2) {
    try {
      body = JSON.parse(text2);
    } catch {
      body = text2;
    }
  }
  if (!response.ok) console.warn("[Supabase Products] REST request failed", { path: path2, status: response.status, body });
  return { ok: response.ok, status: response.status, body, unavailable: false };
}
function formatProductPrice(value) {
  const price = Number(value ?? 0);
  return Number.isFinite(price) ? price.toFixed(2) : "0.00";
}
function normalizeStockStatus(value, stockQuantity) {
  if (value === "in_stock" || value === "low_stock" || value === "out_of_stock") return value;
  if (value === "active" || value === "published" || value === "available") return stockQuantity > 0 ? "in_stock" : "out_of_stock";
  if (value === "inactive" || value === "draft" || value === "archived" || value === "disabled") return "out_of_stock";
  if (stockQuantity <= 0) return "out_of_stock";
  if (stockQuantity <= 10) return "low_stock";
  return "in_stock";
}
function normalizeFeaturedFlag(value) {
  return value === true || value === "true" || value === 1 ? "true" : "false";
}
function stockStatusAfterDecrement(stockQuantity, currentStatus) {
  if (stockQuantity <= 0) return "out_of_stock";
  if (stockQuantity <= 10) return "low_stock";
  return currentStatus === "out_of_stock" ? "in_stock" : normalizeStockStatus(currentStatus, stockQuantity);
}
function normalizeSupabaseProduct(row, variants = []) {
  const id = Number(row.id);
  const stockQuantity = Number(row.stockQuantity ?? row.stock ?? 0);
  const stockStatus = normalizeStockStatus(row.stockStatus ?? row.status, Number.isFinite(stockQuantity) ? stockQuantity : 0);
  const imageUrl = row.imageUrl ?? row.image_url ?? null;
  const normalizedVariants = variants.map((variant) => {
    const variantId = Number(variant.id);
    const variantStock = Number(variant.stockQuantity ?? variant.stock ?? 0);
    return {
      ...variant,
      id: Number.isFinite(variantId) && variantId > 0 ? variantId : void 0,
      productId: Number(variant.productId ?? variant.product_id ?? id),
      name: String(variant.name ?? variant.colour ?? "Default"),
      colourHex: variant.colourHex ?? variant.colour_hex ?? variant.colour ?? "#c8a95a",
      imageUrl: variant.imageUrl ?? variant.image_url ?? null,
      stockQuantity: Number.isFinite(variantStock) ? variantStock : 0,
      stock: Number.isFinite(variantStock) ? variantStock : 0
    };
  });
  const normalized = {
    ...row,
    id: Number.isFinite(id) && id > 0 ? id : void 0,
    name: String(row.name ?? "Untitled product"),
    slug: String(row.slug ?? row.name ?? "product").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    seoTitle: row.seoTitle ?? row.seo_title ?? `${row.name ?? "Product"} | Eby\u2019s Place`,
    seoDescription: row.seoDescription ?? row.seo_description ?? row.description ?? "Eby\u2019s Place shop product.",
    category: row.category ?? "Accessories",
    description: row.description ?? "Eby\u2019s Place shop product.",
    price: formatProductPrice(row.price),
    imageUrl,
    image_url: imageUrl,
    badge: row.badge ?? null,
    stockStatus,
    status: stockStatus,
    stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
    stock: Number.isFinite(stockQuantity) ? stockQuantity : 0,
    colour: row.colour ?? normalizedVariants[0]?.name ?? null,
    isFeatured: normalizeFeaturedFlag(row.isFeatured ?? row.is_featured),
    variants: normalizedVariants
  };
  return normalized;
}
async function getSupabaseProductColumnStyle() {
  const result = await supabaseRest("/rest/v1/products?select=*&limit=1");
  if (!result.ok || !Array.isArray(result.body)) return null;
  const first = result.body[0];
  if (first && ("image_url" in first || "stock" in first || "status" in first || "seo_title" in first)) return "snake";
  return "camel";
}
async function getSupabaseVariantTableName() {
  const camel = await supabaseRest("/rest/v1/productVariants?select=*&limit=1");
  if (camel.ok) return "productVariants";
  const snake = await supabaseRest("/rest/v1/product_variants?select=*&limit=1");
  if (snake.ok) return "product_variants";
  return null;
}
function supabaseProductPayload(input, style) {
  const stockQuantity = Number(input.stockQuantity ?? 0);
  const base = {
    name: input.name,
    slug: input.slug,
    category: input.category,
    description: input.description,
    price: input.price,
    badge: input.badge
  };
  if (style === "snake") {
    return cleanUndefinedValues({
      ...base,
      image_url: input.imageUrl,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
      stock: Number.isFinite(stockQuantity) ? stockQuantity : void 0,
      status: input.stockStatus,
      is_featured: input.isFeatured
    });
  }
  return cleanUndefinedValues({
    ...base,
    imageUrl: input.imageUrl,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    stockQuantity: input.stockQuantity,
    stockStatus: input.stockStatus,
    isFeatured: input.isFeatured
  });
}
function supabaseVariantPayload(variant, tableName) {
  if (tableName === "product_variants") {
    return cleanUndefinedValues({ product_id: variant.productId, name: variant.name, colour_hex: variant.colourHex, image_url: variant.imageUrl, stock: variant.stockQuantity });
  }
  return cleanUndefinedValues({ productId: variant.productId, name: variant.name, colourHex: variant.colourHex, imageUrl: variant.imageUrl, stockQuantity: variant.stockQuantity });
}
async function listSupabaseProducts() {
  const style = await getSupabaseProductColumnStyle();
  if (!style) return null;
  const productResult = await supabaseRest("/rest/v1/products?select=*");
  if (!productResult.ok || !Array.isArray(productResult.body)) return null;
  const variantTable = await getSupabaseVariantTableName();
  const variantResult = variantTable ? await supabaseRest(`/rest/v1/${variantTable}?select=*`) : { ok: false, body: [] };
  const variants = variantResult.ok && Array.isArray(variantResult.body) ? variantResult.body : [];
  return productResult.body.map((product) => normalizeSupabaseProduct(product, variants.filter((variant) => Number(variant.productId ?? variant.product_id) === Number(product.id)))).filter((product) => product.id && isPositivePrice(product.price)).sort((a, b) => (b.isFeatured === "true" ? 1 : 0) - (a.isFeatured === "true" ? 1 : 0) || a.name.localeCompare(b.name));
}
async function createSupabaseProduct(input, variants = []) {
  const style = await getSupabaseProductColumnStyle();
  if (!style) return null;
  const result = await supabaseRest("/rest/v1/products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(supabaseProductPayload(input, style))
  });
  if (!result.ok || !Array.isArray(result.body) || !result.body[0]?.id) throw new Error("Supabase product could not be saved with a database id.");
  const product = normalizeSupabaseProduct(result.body[0]);
  if (product.id && variants.length) await replaceSupabaseProductVariants(product.id, variants);
  const refreshed = product.id ? await getSupabaseProductById(product.id) : null;
  return refreshed ?? product;
}
async function getSupabaseProductById(id) {
  const result = await supabaseRest(`/rest/v1/products?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`);
  if (!result.ok || !Array.isArray(result.body) || !result.body[0]) return null;
  const variantTable = await getSupabaseVariantTableName();
  const variantResult = variantTable ? await supabaseRest(`/rest/v1/${variantTable}?select=*&${variantTable === "product_variants" ? "product_id" : "productId"}=eq.${encodeURIComponent(String(id))}`) : { ok: false, body: [] };
  const variants = variantResult.ok && Array.isArray(variantResult.body) ? variantResult.body : [];
  return normalizeSupabaseProduct(result.body[0], variants);
}
async function updateSupabaseProduct(id, input) {
  const style = await getSupabaseProductColumnStyle();
  if (!style) return null;
  const result = await supabaseRest(`/rest/v1/products?id=eq.${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(supabaseProductPayload(input, style))
  });
  if (!result.ok) throw new Error(`Supabase product ${id} could not be updated.`);
  return result.body && Array.isArray(result.body) && result.body[0] ? normalizeSupabaseProduct(result.body[0]) : await getSupabaseProductById(id);
}
async function replaceSupabaseProductVariants(productId, variants) {
  const tableName = await getSupabaseVariantTableName();
  if (!tableName) return null;
  const productColumn = tableName === "product_variants" ? "product_id" : "productId";
  const deleteResult = await supabaseRest(`/rest/v1/${tableName}?${productColumn}=eq.${encodeURIComponent(String(productId))}`, { method: "DELETE" });
  if (!deleteResult.ok) throw new Error(`Existing Supabase variants for product ${productId} could not be replaced.`);
  if (!variants.length) return { productId, variants: [] };
  const payload = variants.map((variant) => supabaseVariantPayload({ ...variant, productId }, tableName));
  const insertResult = await supabaseRest(`/rest/v1/${tableName}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  if (!insertResult.ok) throw new Error(`Supabase variants for product ${productId} could not be saved.`);
  return { productId, variants: insertResult.body ?? [] };
}
async function deleteSupabaseProduct(id) {
  const style = await getSupabaseProductColumnStyle();
  if (!style) return null;
  const tableName = await getSupabaseVariantTableName();
  if (tableName) {
    const productColumn = tableName === "product_variants" ? "product_id" : "productId";
    await supabaseRest(`/rest/v1/${tableName}?${productColumn}=eq.${encodeURIComponent(String(id))}`, { method: "DELETE" });
  }
  const result = await supabaseRest(`/rest/v1/products?id=eq.${encodeURIComponent(String(id))}`, { method: "DELETE" });
  if (!result.ok) throw new Error(`Supabase product ${id} could not be deleted.`);
  return { id, deleted: true };
}
async function decrementSupabaseProductStock(productId, quantity, variantId) {
  const product = await getSupabaseProductById(productId);
  if (!product?.id) return null;
  if (variantId) {
    const variantTable = await getSupabaseVariantTableName();
    const variant = product.variants?.find((row) => Number(row.id) === Number(variantId));
    if (variantTable && variant?.id) {
      const style = variantTable === "product_variants" ? "snake" : "camel";
      const nextVariantStock = Math.max(Number(variant.stockQuantity ?? variant.stock ?? 0) - quantity, 0);
      await supabaseRest(`/rest/v1/${variantTable}?id=eq.${encodeURIComponent(String(variant.id))}`, {
        method: "PATCH",
        body: JSON.stringify(style === "snake" ? { stock: nextVariantStock } : { stockQuantity: nextVariantStock })
      });
    }
  }
  const nextProductStock = Math.max(Number(product.stockQuantity ?? product.stock ?? 0) - quantity, 0);
  const nextStatus = stockStatusAfterDecrement(nextProductStock, product.stockStatus ?? product.status);
  return updateSupabaseProduct(product.id, { stockQuantity: nextProductStock, stockStatus: nextStatus });
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
    description: "Gentle, age-appropriate braided styles created with patience, comfort, and neat finishing. We take our time so every child leaves happy.",
    duration: "2\u20134 hours",
    priceFrom: "55.00",
    badge: "Child Friendly",
    isFeatured: "false",
    sortOrder: 15,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_braids_066faa86-8d44891ba5.png"
  },
  {
    name: "Kids Cornrows",
    slug: "kids-cornrows",
    category: "Kids Styles",
    description: "Gentle cornrow styling for children of all ages, with comfort-first care, zero tension, and tidy results that last.",
    duration: "1.5\u20133 hours",
    priceFrom: "45.00",
    badge: "Child Friendly",
    isFeatured: "false",
    sortOrder: 16,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png"
  },
  {
    name: "Kids Box Braids",
    slug: "kids-box-braids",
    category: "Kids Styles",
    description: "Neat individual box braids for children, installed gently with lightweight hair and careful sectioning to protect young scalps.",
    duration: "2\u20134 hours",
    priceFrom: "60.00",
    badge: "Child Friendly",
    isFeatured: "false",
    sortOrder: 17,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_braids_066faa86-8d44891ba5.png"
  },
  {
    name: "Kids Knotless Braids",
    slug: "kids-knotless-braids",
    category: "Kids Styles",
    description: "Feather-light knotless braids for children \u2014 no tension at the root, no discomfort. The kindest protective style for young hair.",
    duration: "2.5\u20134 hours",
    priceFrom: "65.00",
    badge: "Child Friendly",
    isFeatured: "false",
    sortOrder: 18,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png"
  },
  {
    name: "Kids Twists",
    slug: "kids-twists",
    category: "Kids Styles",
    description: "Soft, comfortable twists for children that are quick to install and gentle on sensitive scalps.",
    duration: "1.5\u20133 hours",
    priceFrom: "50.00",
    badge: "Child Friendly",
    isFeatured: "false",
    sortOrder: 19,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_passion_twists_fb79128f-5a04dc2709.png"
  },
  {
    name: "Back to School Styles",
    slug: "back-to-school-styles",
    category: "Kids Styles",
    description: "Smart, neat, long-lasting protective styles for school \u2014 including cornrows, braids, and twists that stay tidy for weeks.",
    duration: "2\u20134 hours",
    priceFrom: "50.00",
    badge: "Family Friendly",
    isFeatured: "false",
    sortOrder: 20,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png"
  },
  {
    name: "Men Cornrows",
    slug: "men-cornrows",
    category: "Men Styles",
    description: "Clean, precise cornrow styling for men \u2014 laid flat and tailored to your preferred pattern for a sharp, low-maintenance look.",
    duration: "1.5\u20133 hours",
    priceFrom: "55.00",
    badge: "Men's Style",
    isFeatured: "false",
    sortOrder: 21,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_cornrows_2b5007dd-7637e158cc.png"
  },
  {
    name: "Men Box Braids",
    slug: "men-box-braids",
    category: "Men Styles",
    description: "Individual box braids for men, available in a range of lengths and sizes with a clean, polished finish.",
    duration: "3\u20135 hours",
    priceFrom: "80.00",
    badge: "Men's Style",
    isFeatured: "false",
    sortOrder: 22,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_box_braids_c219e578-5ddc057b3d.png"
  },
  {
    name: "Men Twists",
    slug: "men-twists",
    category: "Men Styles",
    description: "Smooth two-strand twists for men, offering a textured, protective style with a natural finish.",
    duration: "2\u20134 hours",
    priceFrom: "70.00",
    badge: "Men's Style",
    isFeatured: "false",
    sortOrder: 23,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_senegalese_twists_d58a9d66-1fa4e6b79d.png"
  },
  {
    name: "Fulani Braids for Men",
    slug: "fulani-braids-men",
    category: "Men Styles",
    description: "Bold Fulani-inspired braids for men with a statement front pattern and optional bead accessories.",
    duration: "3\u20135 hours",
    priceFrom: "90.00",
    badge: "Men's Style",
    isFeatured: "false",
    sortOrder: 24,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png"
  },
  {
    name: "Locs for Men",
    slug: "locs-men",
    category: "Men Styles",
    description: "Starter locs and faux loc installation for men \u2014 a protective journey or instant statement look with a clean finish.",
    duration: "2\u20135 hours",
    priceFrom: "85.00",
    badge: "Men's Style",
    isFeatured: "false",
    sortOrder: 25,
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png"
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
var PRODUCT_IMAGE_FALLBACK_URL = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png";
var ABOUT_PORTRAIT_FALLBACK_URL = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-about-story-portrait.png";
var seedProducts = [
  { name: "Satin Edge Scarf", slug: "satin-edge-scarf", seoTitle: "Satin Edge Scarf for Braids | Eby\u2019s Place", seoDescription: "Protect fresh braids overnight with a silky satin edge scarf from Eby\u2019s Place, designed to preserve edges and reduce friction.", category: "Accessories", description: "A silky black satin scarf for preserving edges and protecting fresh braids overnight.", price: "18.00", imageUrl: imageBySlug["edge-control-styling"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "Best Seller", stockStatus: "in_stock", stockQuantity: 34, isFeatured: "true" },
  { name: "Scalp Comfort Oil", slug: "scalp-comfort-oil", seoTitle: "Scalp Comfort Oil for Protective Styles | Eby\u2019s Place", seoDescription: "Shop lightweight scalp comfort oil for braids, twists, and locs, created to support shine and comfort between salon appointments.", category: "Aftercare", description: "A lightweight scalp oil for protective styles, designed to support comfort and shine.", price: "14.00", imageUrl: imageBySlug["hair-wash-prep"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "Aftercare", stockStatus: "low_stock", stockQuantity: 8, isFeatured: "true" },
  { name: "Premium Braiding Hair", slug: "premium-braiding-hair", seoTitle: "Premium Braiding Hair in Natural and Statement Shades | Eby\u2019s Place", seoDescription: "Buy soft-touch premium braiding hair from Eby\u2019s Place in natural tones and statement shades for protective styles.", category: "Hair Attachments", description: "Soft-touch braiding hair available in classic natural tones and statement shades.", price: "6.50", imageUrl: imageBySlug["beads-accessories"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "Salon Pick", stockStatus: "in_stock", stockQuantity: 120, isFeatured: "true" },
  { name: "Braid Care Starter Kit", slug: "braid-care-starter-kit", seoTitle: "Braid Care Starter Kit | Eby\u2019s Place", seoDescription: "A practical starter kit for maintaining fresh protective styles between Eby\u2019s Place appointments.", category: "Aftercare", description: "A simple aftercare bundle with satin protection, scalp comfort guidance, and braid maintenance essentials.", price: "28.00", imageUrl: imageBySlug["boho-goddess-braids"] || PRODUCT_IMAGE_FALLBACK_URL, badge: "New", stockStatus: "in_stock", stockQuantity: 20, isFeatured: "true" }
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
  await db.insert(reviews).values(seedReviews).onConflictDoUpdate({
    target: [reviews.customerName, reviews.reviewText, reviews.source],
    set: {
      rating: sql`excluded."rating"`,
      status: sql`excluded."status"`,
      updatedAt: sql`CURRENT_TIMESTAMP`
    }
  });
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
async function runSeedStep(label, action) {
  try {
    await action();
  } catch (error) {
    console.warn(`[Database] Seed step skipped for ${label}`, error);
  }
}
async function ensureSeedProducts(db) {
  if (!db) return;
  await db.insert(products).values(seedProducts).onConflictDoUpdate({
    target: products.slug,
    set: {
      name: sql`excluded."name"`,
      category: sql`excluded."category"`,
      description: sql`excluded."description"`,
      price: sql`excluded."price"`,
      imageUrl: sql`excluded."imageUrl"`,
      badge: sql`excluded."badge"`,
      seoTitle: sql`excluded."seoTitle"`,
      seoDescription: sql`excluded."seoDescription"`,
      stockStatus: sql`excluded."stockStatus"`,
      stockQuantity: sql`excluded."stockQuantity"`,
      isFeatured: sql`excluded."isFeatured"`,
      updatedAt: sql`CURRENT_TIMESTAMP`
    }
  });
}
async function ensureSeedGallery(db) {
  if (!db) return;
  await db.insert(galleryImages).values(seedGallery.map((item) => ({ ...item, isPublished: "true" }))).onConflictDoUpdate({
    target: [galleryImages.title, galleryImages.category],
    set: {
      imageUrl: sql`excluded."imageUrl"`,
      altText: sql`excluded."altText"`,
      sortOrder: sql`excluded."sortOrder"`,
      isPublished: sql`excluded."isPublished"`
    }
  });
}
var seedWebsiteSections = [
  {
    sectionKey: "about_us",
    eyebrow: "Our Story",
    title: "From Passion to Power",
    body: "Eby\u2019s Place was born from a love for braiding and a belief that beautiful hair should never come with pain, pulling, or damage. What began as a passion for helping women and families feel confident has grown into a premium braid-care experience built on gentle hands, neat finishing, protective styling, and genuine customer care.",
    ctaLabel: "Read our services",
    ctaHref: "/services",
    imageUrl: ABOUT_PORTRAIT_FALLBACK_URL,
    portraitImageUrl: ABOUT_PORTRAIT_FALLBACK_URL,
    portraitDescription: "Eberechi Ogbo | Founder & Service Lead",
    sortOrder: 1,
    isPublished: "true"
  }
];
async function seedIfNeeded() {
  const db = await getDb();
  if (!db || _seeded) return;
  if (_seedingPromise) return _seedingPromise;
  _seedingPromise = (async () => {
    await runSeedStep("services", async () => {
      await db.insert(services).values(seedServices).onConflictDoNothing({
        target: services.slug
      });
    });
    if (!isSupabaseConfigured()) {
      await runSeedStep("products", () => ensureSeedProducts(db));
      const productRows = await db.select().from(products);
      const scarf = productRows.find((product) => product.slug === "satin-edge-scarf");
      const hair = productRows.find((product) => product.slug === "premium-braiding-hair");
      if (scarf) {
        await runSeedStep("scarf variants", async () => {
          await db.insert(productVariants).values([
            { productId: scarf.id, name: "Black", colourHex: "#111111", stockQuantity: 18 },
            { productId: scarf.id, name: "Gold", colourHex: "#c8a95a", stockQuantity: 16 }
          ]).onConflictDoUpdate({
            target: [productVariants.productId, productVariants.name],
            set: {
              colourHex: sql`excluded."colourHex"`,
              stockQuantity: sql`excluded."stockQuantity"`
            }
          });
        });
      }
      if (hair) {
        await runSeedStep("hair variants", async () => {
          await db.insert(productVariants).values([
            { productId: hair.id, name: "1B Natural Black", colourHex: "#1b1715", stockQuantity: 42 },
            { productId: hair.id, name: "30 Auburn", colourHex: "#8a4b2a", stockQuantity: 28 },
            { productId: hair.id, name: "613 Blonde", colourHex: "#d6b779", stockQuantity: 24 }
          ]).onConflictDoUpdate({
            target: [productVariants.productId, productVariants.name],
            set: {
              colourHex: sql`excluded."colourHex"`,
              stockQuantity: sql`excluded."stockQuantity"`
            }
          });
        });
      }
    }
    await runSeedStep("reviews", () => ensureSeedReviews(db));
    await runSeedStep("website sections", async () => {
      await db.insert(websiteSections).values(seedWebsiteSections).onConflictDoNothing({
        target: websiteSections.sectionKey
      });
    });
    await runSeedStep("gallery", () => ensureSeedGallery(db));
    _seeded = true;
  })().finally(() => {
    _seedingPromise = null;
  });
  await _seedingPromise;
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
  const supabaseConfigured = isSupabaseConfigured();
  const fallback = supabaseConfigured ? [] : seedProducts.map((product, index) => ({ ...product, id: index + 1, image_url: product.imageUrl, stock: product.stockQuantity, status: product.stockStatus, colour: null, variants: [] }));
  try {
    const supabaseProducts = await listSupabaseProducts();
    if (supabaseProducts) return supabaseProducts;
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    const productRows = await db.select().from(products).orderBy(desc(products.isFeatured), asc(products.name));
    const variantRows = await db.select().from(productVariants);
    const publicRows = productRows.filter((product) => isPositivePrice(product.price));
    const safeRows = publicRows.length ? publicRows : fallback;
    return safeRows.map((product) => ({
      ...product,
      id: Number(product.id),
      imageUrl: isUsableImageUrl(product.imageUrl) ? product.imageUrl : PRODUCT_IMAGE_FALLBACK_URL,
      image_url: isUsableImageUrl(product.imageUrl) ? product.imageUrl : PRODUCT_IMAGE_FALLBACK_URL,
      seoTitle: product.seoTitle || `${product.name} | Eby\u2019s Place`,
      seoDescription: product.seoDescription || product.description,
      stock: product.stockQuantity,
      status: product.stockStatus,
      colour: null,
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
async function listApprovedProductReviews(productId) {
  try {
    const db = await getDb();
    if (!db) return [];
    await ensureProductReviewsTable();
    return await db.select().from(productReviews).where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved"))).orderBy(desc(productReviews.createdAt));
  } catch (error) {
    console.warn("[Database] Could not load product reviews", error);
    return [];
  }
}
async function listProductReviewSummaries() {
  try {
    const db = await getDb();
    if (!db) return [];
    await ensureProductReviewsTable();
    const rows = await db.select({
      productId: productReviews.productId,
      avgRating: sql`ROUND(AVG(${productReviews.rating})::numeric, 1)`,
      reviewCount: sql`COUNT(*)`
    }).from(productReviews).where(eq(productReviews.status, "approved")).groupBy(productReviews.productId);
    return rows.map((row) => ({ productId: row.productId, avgRating: Number(row.avgRating), reviewCount: Number(row.reviewCount) }));
  } catch (error) {
    console.warn("[Database] Could not load product review summaries", error);
    return [];
  }
}
async function submitProductReview(input) {
  const db = await getDb();
  if (!db) return { id: Date.now(), status: "pending" };
  await ensureProductReviewsTable();
  const inserted = await db.insert(productReviews).values({ ...input, status: "pending", source: "website" }).returning({ id: productReviews.id });
  return { id: inserted[0]?.id ?? 0, status: "pending" };
}
async function moderateProductReview(id, status) {
  const db = await getDb();
  if (!db) return { success: true };
  await ensureProductReviewsTable();
  await db.update(productReviews).set({ status }).where(eq(productReviews.id, id));
  return { success: true };
}
function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
async function getWebsiteJsonSection(sectionKey, fallback) {
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
async function setWebsiteJsonSection(sectionKey, value) {
  const db = await getDb();
  const body = JSON.stringify(value);
  if (!db) return { success: true };
  await db.insert(websiteSections).values({
    sectionKey,
    title: sectionKey,
    body
  }).onConflictDoUpdate({ target: websiteSections.sectionKey, set: { body, updatedAt: sql`CURRENT_TIMESTAMP` } });
  return { success: true };
}
async function getAvailabilitySettings() {
  const settings = await getWebsiteJsonSection("availability_settings", { blockedSlots: [], homeServiceSurcharge: "0.00" });
  return { blockedSlots: settings.blockedSlots || [], homeServiceSurcharge: settings.homeServiceSurcharge || "0.00" };
}
async function updateHomeServiceSurcharge(homeServiceSurcharge) {
  const settings = await getAvailabilitySettings();
  return setWebsiteJsonSection("availability_settings", { ...settings, homeServiceSurcharge });
}
async function blockBookingSlot(input) {
  const settings = await getAvailabilitySettings();
  const nextSlot = { date: input.date, time: input.time || "", reason: input.reason || "Unavailable" };
  const blockedSlots = settings.blockedSlots.filter((slot) => !(slot.date === nextSlot.date && (slot.time || "") === nextSlot.time));
  blockedSlots.push(nextSlot);
  return setWebsiteJsonSection("availability_settings", { ...settings, blockedSlots });
}
async function unblockBookingSlot(input) {
  const settings = await getAvailabilitySettings();
  const blockedSlots = settings.blockedSlots.filter((slot) => !(slot.date === input.date && (slot.time || "") === (input.time || "")));
  return setWebsiteJsonSection("availability_settings", { ...settings, blockedSlots });
}
async function isBookingSlotBlocked(date, time) {
  const settings = await getAvailabilitySettings();
  return settings.blockedSlots.some((slot) => slot.date === date && (!(slot.time || "").trim() || slot.time === time));
}
async function getInstagramSettings() {
  return getWebsiteJsonSection("instagram_settings", {
    handle: "@ebysplace",
    feedUrl: "https://www.instagram.com/ebysplace/",
    enabled: true,
    note: "Connect the official Instagram feed provider when production social credentials are available."
  });
}
async function updateInstagramSettings(input) {
  return setWebsiteJsonSection("instagram_settings", input);
}
async function getBookingById(id) {
  const db = await getDb();
  if (!db) return null;
  await ensureBookingLocationColumns();
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return rows[0] ?? null;
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
async function addPgColumnIfMissing(tableName, columnName, definition) {
  if (!_pool) return;
  try {
    await _pool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${columnName}" ${definition}`);
  } catch (err) {
    console.warn(`[Database] Could not add column ${tableName}.${columnName}`, err);
  }
}
async function makePgColumnNullable(tableName, columnName) {
  if (!_pool) return;
  try {
    await _pool.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" DROP NOT NULL`);
  } catch (err) {
    console.warn(`[Database] Could not make column ${tableName}.${columnName} nullable`, err);
  }
}
async function ensureBookingLocationColumns() {
  if (!_pool) return;
  await addPgColumnIfMissing("bookings", "serviceLocation", "TEXT NOT NULL DEFAULT 'studio'");
  await addPgColumnIfMissing("bookings", "addressLine2", "VARCHAR(255)");
  await addPgColumnIfMissing("bookings", "county", "VARCHAR(120)");
  await addPgColumnIfMissing("bookings", "deliveryNote", "TEXT");
  await addPgColumnIfMissing("bookings", "homeServiceSurcharge", "NUMERIC(10,2) NOT NULL DEFAULT 0.00");
  await makePgColumnNullable("bookings", "addressLine1");
  await makePgColumnNullable("bookings", "city");
  await makePgColumnNullable("bookings", "postcode");
}
async function ensureOrderLocationColumns() {
  if (!_pool) return;
  await addPgColumnIfMissing("orders", "serviceLocation", "TEXT NOT NULL DEFAULT 'studio'");
  await addPgColumnIfMissing("orders", "addressLine2", "VARCHAR(255)");
  await addPgColumnIfMissing("orders", "county", "VARCHAR(120)");
  await addPgColumnIfMissing("orders", "deliveryNote", "TEXT");
  await makePgColumnNullable("orders", "addressLine1");
  await makePgColumnNullable("orders", "city");
  await makePgColumnNullable("orders", "postcode");
}
async function ensureOrderItemSnapshotColumns() {
  if (!_pool) return;
  await addPgColumnIfMissing("orderItems", "imageUrl", "VARCHAR(800)");
}
var SENSITIVE_METADATA_KEY_PATTERN = /(password|passwd|secret|token|key|auth|credential|card|cvv|cvc|iban|stripe|supabase|database|cookie|sessioncookie)/i;
var MAX_METADATA_KEYS = 50;
var MAX_METADATA_TEXT = 500;
var MAX_DESCRIPTION_LENGTH = 500;
var MAX_PAGE_URL_LENGTH = 800;
function truncateText(value, max = MAX_METADATA_TEXT) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 1)}\u2026` : normalized;
}
function shouldStoreActivityLogIpAddress() {
  return String(process.env.ACTIVITY_LOG_STORE_IP ?? "false").trim().toLowerCase() === "true";
}
function anonymizeIpAddress(rawIp) {
  if (!rawIp) return null;
  if (rawIp.includes(".")) {
    const parts = rawIp.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.0.0`;
  }
  if (rawIp.includes(":")) {
    const parts = rawIp.split(":").filter(Boolean);
    return parts.length ? `${parts.slice(0, 2).join(":")}::` : null;
  }
  return null;
}
function detectDeviceType(userAgent) {
  if (!userAgent) return null;
  const normalized = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook/.test(normalized)) return "tablet";
  if (/mobi|android|iphone|ipod|blackberry|windows phone/.test(normalized)) return "mobile";
  return "desktop";
}
function detectBrowser(userAgent) {
  if (!userAgent) return null;
  const normalized = userAgent.toLowerCase();
  if (normalized.includes("edg/")) return "Edge";
  if (normalized.includes("opr/") || normalized.includes("opera")) return "Opera";
  if (normalized.includes("chrome/") && !normalized.includes("edg/")) return "Chrome";
  if (normalized.includes("firefox/")) return "Firefox";
  if (normalized.includes("safari/") && !normalized.includes("chrome/")) return "Safari";
  return "Unknown";
}
function sanitizeMetadataValue(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (value === null || value === void 0) return null;
  if (typeof value === "string") return truncateText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 25).map((entry) => sanitizeMetadataValue(entry, depth + 1));
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([key]) => !SENSITIVE_METADATA_KEY_PATTERN.test(key)).slice(0, MAX_METADATA_KEYS).map(([key, entry]) => [key, sanitizeMetadataValue(entry, depth + 1)]).filter(([, entry]) => entry !== null && entry !== void 0 && entry !== "");
    return Object.fromEntries(entries);
  }
  return truncateText(String(value));
}
function sanitizeMetadata(input) {
  const sanitized = sanitizeMetadataValue(input);
  if (!sanitized || typeof sanitized === "object" && !Array.isArray(sanitized) && Object.keys(sanitized).length === 0) return null;
  return sanitized;
}
function getRequestContext(request) {
  const req = request ?? null;
  const userAgent = truncateText(req?.headers["user-agent"] || null, 500);
  const forwarded = typeof req?.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0]?.trim() : null;
  const rawIp = forwarded || req?.ip || null;
  const shouldStoreIp = shouldStoreActivityLogIpAddress();
  const country = truncateText(req?.headers["x-vercel-ip-country"] || null, 120);
  const city = truncateText(req?.headers["x-vercel-ip-city"] || null, 120);
  const region = truncateText(req?.headers["x-vercel-ip-country-region"] || null, 120);
  return {
    userAgent,
    ipAddress: shouldStoreIp ? anonymizeIpAddress(rawIp) : null,
    country,
    city,
    region,
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent)
  };
}
async function ensureActivityLogsTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "activityLogs" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER,
      "userName" VARCHAR(180),
      "userEmail" VARCHAR(320),
      "sessionId" VARCHAR(128),
      "activityType" VARCHAR(120) NOT NULL,
      "activityCategory" VARCHAR(120) NOT NULL,
      "description" TEXT NOT NULL,
      "pageUrl" VARCHAR(800),
      "metadata" JSON,
      "status" VARCHAR(30) NOT NULL DEFAULT 'info',
      "ipAddress" VARCHAR(80),
      "country" VARCHAR(120),
      "city" VARCHAR(120),
      "region" VARCHAR(120),
      "deviceType" VARCHAR(40),
      "browser" VARCHAR(80),
      "userAgent" VARCHAR(500),
      "relatedEntityType" VARCHAR(80),
      "relatedEntityId" VARCHAR(120),
      "sourceApp" VARCHAR(80) NOT NULL DEFAULT 'ebysplace',
      "isRead" TEXT NOT NULL DEFAULT 'false',
      "createdAtMs" BIGINT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await _pool.query(`CREATE INDEX IF NOT EXISTS "activityLogs_createdAt_idx" ON "activityLogs" ("createdAt")`);
    await _pool.query(`CREATE INDEX IF NOT EXISTS "activityLogs_category_idx" ON "activityLogs" ("activityCategory")`);
    await _pool.query(`CREATE INDEX IF NOT EXISTS "activityLogs_status_idx" ON "activityLogs" ("status")`);
    await _pool.query(`CREATE INDEX IF NOT EXISTS "activityLogs_isRead_idx" ON "activityLogs" ("isRead")`);
  } catch (error) {
    console.warn("[Database] Could not ensure activityLogs table", error);
  }
}
function normalizePathForTracking(value) {
  const raw = (value || "/").trim();
  if (!raw) return "/";
  try {
    const parsed = new URL(raw, "https://www.ebysplace.com");
    return parsed.pathname || "/";
  } catch {
    return raw.split(/[?#]/)[0] || "/";
  }
}
function isAdminPathForTracking(value) {
  const pathname = normalizePathForTracking(value).toLowerCase();
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
async function shouldThrottlePublicActivity(input) {
  const db = await getDb();
  if (!db) return false;
  const sessionId = truncateText(input.sessionId, 128);
  const activityType = truncateText(input.activityType, 120);
  const pageUrl = truncateText(normalizePathForTracking(input.pageUrl), MAX_PAGE_URL_LENGTH);
  const sourceApp = truncateText(input.sourceApp || "ebysplace", 80) || "ebysplace";
  if (!sessionId || !activityType) return false;
  await ensureActivityLogsTable();
  const windowStart = Date.now() - Math.max(input.windowMs ?? 8e3, 500);
  const rows = await db.select({ id: activityLogs.id }).from(activityLogs).where(and(
    eq(activityLogs.sessionId, sessionId),
    eq(activityLogs.activityType, activityType),
    eq(activityLogs.sourceApp, sourceApp),
    eq(activityLogs.pageUrl, pageUrl),
    sql`${activityLogs.createdAtMs} >= ${windowStart}`
  )).limit(1);
  return rows.length > 0;
}
async function logActivity(input) {
  const db = await getDb();
  if (!db) return { success: true };
  await ensureActivityLogsTable();
  const requestContext = getRequestContext(input.request);
  const shouldStoreIp = shouldStoreActivityLogIpAddress();
  const inputIpAddress = anonymizeIpAddress(truncateText(input.ipAddress, 80));
  const payload = {
    userId: input.userId ?? null,
    userName: truncateText(input.userName, 180),
    userEmail: truncateText(input.userEmail, 320),
    sessionId: truncateText(input.sessionId, 128),
    activityType: truncateText(input.activityType, 120) || "unknown_activity",
    activityCategory: truncateText(input.activityCategory, 120) || "general",
    description: truncateText(input.description, MAX_DESCRIPTION_LENGTH) || "Activity recorded",
    pageUrl: truncateText(input.pageUrl, MAX_PAGE_URL_LENGTH),
    metadata: sanitizeMetadata(input.metadata),
    status: truncateText(input.status || "info", 30) || "info",
    ipAddress: shouldStoreIp ? inputIpAddress ?? requestContext.ipAddress : null,
    country: input.country ?? requestContext.country,
    city: input.city ?? requestContext.city,
    region: input.region ?? requestContext.region,
    deviceType: input.deviceType ?? requestContext.deviceType,
    browser: input.browser ?? requestContext.browser,
    userAgent: input.userAgent ?? requestContext.userAgent,
    relatedEntityType: truncateText(input.relatedEntityType, 80),
    relatedEntityId: truncateText(input.relatedEntityId, 120),
    sourceApp: truncateText(input.sourceApp || "ebysplace", 80) || "ebysplace",
    isRead: "false",
    createdAtMs: Date.now(),
    updatedAt: /* @__PURE__ */ new Date()
  };
  await db.insert(activityLogs).values(payload);
  return { success: true };
}
async function listActivityLogs(filters = {}) {
  const db = await getDb();
  if (!db) return [];
  await ensureActivityLogsTable();
  const conditions = [];
  if (filters.activityType) conditions.push(eq(activityLogs.activityType, filters.activityType));
  if (filters.activityCategory) conditions.push(eq(activityLogs.activityCategory, filters.activityCategory));
  if (filters.status) conditions.push(eq(activityLogs.status, filters.status));
  if (filters.sourceApp) conditions.push(eq(activityLogs.sourceApp, filters.sourceApp));
  if (filters.failedOnly) conditions.push(eq(activityLogs.status, "failed"));
  if (filters.unreadOnly) conditions.push(eq(activityLogs.isRead, "false"));
  if (filters.user) {
    const userQuery = `%${filters.user.trim()}%`;
    conditions.push(or(ilike(activityLogs.userName, userQuery), ilike(activityLogs.userEmail, userQuery), ilike(activityLogs.sessionId, userQuery)));
  }
  if (filters.query) {
    const query = `%${filters.query.trim()}%`;
    conditions.push(or(
      ilike(activityLogs.activityType, query),
      ilike(activityLogs.activityCategory, query),
      ilike(activityLogs.description, query),
      ilike(activityLogs.userName, query),
      ilike(activityLogs.userEmail, query),
      ilike(activityLogs.sessionId, query),
      ilike(activityLogs.pageUrl, query),
      ilike(activityLogs.relatedEntityId, query)
    ));
  }
  if (filters.datePreset) {
    if (filters.datePreset === "today") conditions.push(sql`${activityLogs.createdAt} >= CURRENT_DATE`);
    if (filters.datePreset === "yesterday") conditions.push(sql`${activityLogs.createdAt} >= CURRENT_DATE - INTERVAL '1 day' AND ${activityLogs.createdAt} < CURRENT_DATE`);
    if (filters.datePreset === "last_7_days") conditions.push(sql`${activityLogs.createdAt} >= NOW() - INTERVAL '7 days'`);
    if (filters.datePreset === "last_30_days") conditions.push(sql`${activityLogs.createdAt} >= NOW() - INTERVAL '30 days'`);
  }
  const whereClause = conditions.length ? and(...conditions) : void 0;
  return db.select().from(activityLogs).where(whereClause).orderBy(desc(activityLogs.createdAt)).limit(Math.min(Math.max(filters.limit ?? 150, 1), 500));
}
async function unreadActivityCount() {
  const db = await getDb();
  if (!db) return 0;
  await ensureActivityLogsTable();
  const rows = await db.select({ value: sql`count(*)` }).from(activityLogs).where(eq(activityLogs.isRead, "false"));
  return Number(rows[0]?.value ?? 0);
}
async function markActivityLogsRead(ids) {
  const db = await getDb();
  if (!db) return { success: true };
  await ensureActivityLogsTable();
  if (ids?.length) {
    const normalizedIds = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!normalizedIds.length) return { success: true };
    await db.update(activityLogs).set({ isRead: "true", updatedAt: /* @__PURE__ */ new Date() }).where(inArray(activityLogs.id, normalizedIds));
    return { success: true };
  }
  await db.update(activityLogs).set({ isRead: "true", updatedAt: /* @__PURE__ */ new Date() }).where(eq(activityLogs.isRead, "false"));
  return { success: true };
}
async function createBooking(input) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  await ensureBookingLocationColumns();
  const inserted = await db.insert(bookings).values(input).returning({ id: bookings.id });
  const bookingId = inserted[0]?.id ?? 0;
  await logActivity({
    activityType: "booking_started",
    activityCategory: "booking",
    description: `Booking started for ${input.serviceName}`,
    status: "pending",
    pageUrl: "/booking",
    relatedEntityType: "booking",
    relatedEntityId: bookingId || null,
    metadata: {
      serviceName: input.serviceName,
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      serviceLocation: input.serviceLocation,
      clientName: input.clientName,
      clientEmail: input.clientEmail
    }
  });
  return { id: bookingId };
}
async function updateBookingCheckout(id, stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ depositStatus: "checkout_started", stripeCheckoutSessionId, stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(bookings.id, id));
  await logActivity({
    activityType: "checkout_started",
    activityCategory: "payment",
    description: `Checkout started for booking #${id}`,
    status: "pending",
    pageUrl: "/booking",
    relatedEntityType: "booking",
    relatedEntityId: id,
    metadata: { stripeCheckoutSessionId }
  });
}
async function markBookingDepositPaid(stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ depositStatus: "paid", status: "confirmed", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId));
  const booking = await getBookingByCheckoutSession(stripeCheckoutSessionId);
  await logActivity({
    activityType: "payment_successful",
    activityCategory: "payment",
    description: `Booking deposit payment successful${booking?.id ? ` for booking #${booking.id}` : ""}`,
    status: "success",
    pageUrl: "/booking/success",
    relatedEntityType: "booking",
    relatedEntityId: booking?.id ?? null,
    metadata: { stripeCheckoutSessionId, stripePaymentIntentId }
  });
}
async function getBookingByCheckoutSession(stripeCheckoutSessionId) {
  const db = await getDb();
  if (!db) return null;
  await ensureBookingLocationColumns();
  const rows = await db.select().from(bookings).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}
async function createOrderWithItems(input) {
  const db = await getDb();
  if (!db) return { id: Date.now(), items: input.items };
  await ensureOrderLocationColumns();
  await ensureOrderItemSnapshotColumns();
  const supabaseProductRows = await listSupabaseProducts();
  const [dbProductRows, dbVariantRows] = supabaseProductRows ? [[], []] : await Promise.all([
    db.select().from(products),
    db.select().from(productVariants)
  ]);
  const productRows = supabaseProductRows ?? dbProductRows;
  const variantRows = supabaseProductRows ? supabaseProductRows.flatMap((product) => product.variants ?? []) : dbVariantRows;
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
      imageUrl: product.imageUrl || null,
      variantName: variant?.name,
      quantity,
      unitPrice: Number(product.price).toFixed(2)
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
    status: "draft"
  }).returning({ id: orders.id });
  const orderId = inserted[0]?.id ?? 0;
  if (orderId && validatedItems.length) await db.insert(orderItems).values(validatedItems.map((item) => ({ ...item, orderId })));
  await logActivity({
    activityType: "checkout_started",
    activityCategory: "payment",
    description: `Shop checkout started for order #${orderId}`,
    status: "pending",
    pageUrl: "/shop",
    relatedEntityType: "order",
    relatedEntityId: orderId || null,
    metadata: {
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      itemCount: validatedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    }
  });
  return { id: orderId, items: validatedItems };
}
async function updateOrderCheckout(id, stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status: "pending_payment", stripeCheckoutSessionId, stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.id, id));
  await logActivity({
    activityType: "checkout_started",
    activityCategory: "payment",
    description: `Order checkout session created for order #${id}`,
    status: "pending",
    pageUrl: "/shop",
    relatedEntityType: "order",
    relatedEntityId: id,
    metadata: { stripeCheckoutSessionId }
  });
}
async function markOrderPaid(stripeCheckoutSessionId, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return;
  await ensureOrderLocationColumns();
  const matchingOrders = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  const order = matchingOrders[0];
  if (!order) return;
  const alreadyPaid = ["paid", "fulfilling", "shipped", "completed"].includes(order.status);
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: stripePaymentIntentId ?? null }).where(eq(orders.id, order.id));
  await logActivity({
    activityType: "payment_successful",
    activityCategory: "payment",
    description: `Payment successful for order #${order.id}`,
    status: "success",
    pageUrl: "/shop",
    relatedEntityType: "order",
    relatedEntityId: order.id,
    metadata: { stripeCheckoutSessionId, stripePaymentIntentId }
  });
  if (alreadyPaid) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const supabaseProductRows = await listSupabaseProducts();
  for (const item of items) {
    const supabaseProduct = supabaseProductRows?.find((product) => product.id === item.productId);
    if (supabaseProduct) {
      await decrementSupabaseProductStock(item.productId, item.quantity, item.variantId);
      continue;
    }
    if (item.variantId) {
      await db.update(productVariants).set({ stockQuantity: sql`GREATEST(${productVariants.stockQuantity} - ${item.quantity}, 0)` }).where(eq(productVariants.id, item.variantId));
    }
    await db.update(products).set({
      stockQuantity: sql`GREATEST(${products.stockQuantity} - ${item.quantity}, 0)`,
      stockStatus: sql`CASE WHEN GREATEST(${products.stockQuantity} - ${item.quantity}, 0) = 0 THEN 'out_of_stock' ELSE ${products.stockStatus} END`
    }).where(eq(products.id, item.productId));
  }
}
async function getOrderByCheckoutSession(stripeCheckoutSessionId) {
  const db = await getDb();
  if (!db) return null;
  await ensureOrderLocationColumns();
  const rows = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}
async function getOrderById(id) {
  const db = await getDb();
  if (!db) return null;
  await ensureOrderLocationColumns();
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}
async function getOrderItemsByOrderId(orderId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}
async function ensureEmailNotificationLogTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "emailNotificationLogs" (
      "id" SERIAL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" INTEGER NOT NULL,
      "audience" TEXT NOT NULL,
      "recipientEmail" VARCHAR(320) NOT NULL,
      "subject" VARCHAR(255) NOT NULL,
      "bodyPreview" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "provider" VARCHAR(80) NOT NULL DEFAULT 'zoho_smtp',
      "smtpHost" VARCHAR(255),
      "messageId" VARCHAR(255),
      "errorMessage" TEXT,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastAttemptAtMs" BIGINT,
      "sentAtMs" BIGINT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await _pool.query(`CREATE INDEX IF NOT EXISTS "emailNotificationLogs_entity_idx" ON "emailNotificationLogs" ("entityType", "entityId")`);
    await _pool.query(`CREATE INDEX IF NOT EXISTS "emailNotificationLogs_status_idx" ON "emailNotificationLogs" ("status")`);
  } catch (err) {
    console.warn("[Database] Could not ensure emailNotificationLogs table", err);
  }
}
async function ensureProductReviewsTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "productReviews" (
      "id" SERIAL PRIMARY KEY,
      "productId" INTEGER NOT NULL,
      "customerName" VARCHAR(180) NOT NULL,
      "rating" INTEGER NOT NULL,
      "reviewText" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "source" VARCHAR(80) NOT NULL DEFAULT 'website',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    console.warn("[Database] Could not ensure productReviews table", err);
  }
}
async function ensureProductVariantsTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "productVariants" (
      "id" SERIAL PRIMARY KEY,
      "productId" INTEGER NOT NULL,
      "name" VARCHAR(120) NOT NULL,
      "colourHex" VARCHAR(20),
      "imageUrl" VARCHAR(800),
      "stockQuantity" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await addPgColumnIfMissing("productVariants", "colourHex", "VARCHAR(20)");
    await addPgColumnIfMissing("productVariants", "imageUrl", "VARCHAR(800)");
    await addPgColumnIfMissing("productVariants", "stockQuantity", "INTEGER NOT NULL DEFAULT 0");
    await addPgColumnIfMissing("productVariants", "createdAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
  } catch (err) {
    console.warn("[Database] Could not ensure productVariants table", err);
  }
}
async function createEmailNotificationLog(input) {
  const db = await getDb();
  if (!db) return { id: Date.now(), ...input, status: input.status ?? "pending" };
  await ensureEmailNotificationLogTable();
  const inserted = await db.insert(emailNotificationLogs).values({
    entityType: input.entityType,
    entityId: input.entityId,
    audience: input.audience,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    bodyPreview: input.bodyPreview ?? null,
    status: input.status ?? "pending",
    smtpHost: input.smtpHost ?? null,
    messageId: input.messageId ?? null,
    errorMessage: input.errorMessage ?? null,
    attempts: 0,
    lastAttemptAtMs: Date.now()
  }).returning({ id: emailNotificationLogs.id });
  return { id: inserted[0]?.id ?? 0 };
}
async function updateEmailNotificationLog(id, input) {
  const db = await getDb();
  if (!db) return { id, ...input };
  await ensureEmailNotificationLogTable();
  await db.update(emailNotificationLogs).set({
    status: input.status,
    smtpHost: input.smtpHost ?? null,
    messageId: input.messageId ?? null,
    errorMessage: input.errorMessage ?? null,
    sentAtMs: input.sentAtMs ?? null,
    lastAttemptAtMs: Date.now(),
    updatedAt: /* @__PURE__ */ new Date(),
    attempts: sql`${emailNotificationLogs.attempts} + 1`
  }).where(eq(emailNotificationLogs.id, id));
  return { id, ...input };
}
async function listEmailNotificationLogs(limit = 80) {
  const db = await getDb();
  if (!db) return [];
  await ensureEmailNotificationLogTable();
  return db.select().from(emailNotificationLogs).orderBy(desc(emailNotificationLogs.createdAt)).limit(limit);
}
async function getEmailNotificationLogById(id) {
  const db = await getDb();
  if (!db) return null;
  await ensureEmailNotificationLogTable();
  const rows = await db.select().from(emailNotificationLogs).where(eq(emailNotificationLogs.id, id)).limit(1);
  return rows[0] ?? null;
}
async function recordAnalytics(eventName, pagePath, metadata, options) {
  const db = await getDb();
  if (!db) return { success: true };
  const normalizedPagePath = normalizePathForTracking(pagePath);
  const sourceApp = truncateText(options?.sourceApp || "ebysplace", 80) || "ebysplace";
  const activityType = truncateText(options?.activityType ?? eventName, 120) || truncateText(eventName, 120) || "unknown_activity";
  if (isAdminPathForTracking(normalizedPagePath)) return { success: true, skipped: true };
  if (await shouldThrottlePublicActivity({
    sessionId: options?.sessionId ?? null,
    activityType,
    pageUrl: normalizedPagePath,
    sourceApp
  })) {
    return { success: true, skipped: true };
  }
  await db.insert(analyticsEvents).values({ eventName, pagePath: normalizedPagePath, metadata, createdAtMs: Date.now() });
  await logActivity({
    request: options?.request,
    userId: options?.user?.id ?? null,
    userName: options?.user?.name ?? null,
    userEmail: options?.user?.email ?? null,
    sessionId: options?.sessionId ?? null,
    activityType,
    activityCategory: options?.activityCategory ?? "website_visit",
    description: options?.description ?? `Visitor event: ${eventName}`,
    pageUrl: normalizedPagePath,
    metadata,
    status: options?.status ?? "info",
    relatedEntityType: options?.relatedEntityType ?? null,
    relatedEntityId: options?.relatedEntityId ?? null,
    sourceApp
  });
  return { success: true };
}
async function createTryOnGeneration(input) {
  const db = await getDb();
  if (!db) return { id: Date.now() };
  const inserted = await db.insert(tryOnGenerations).values({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, generatedImageUrl: input.generatedImageUrl, status: input.status ?? "pending", errorMessage: input.errorMessage }).returning({ id: tryOnGenerations.id });
  const id = inserted[0]?.id ?? 0;
  await logActivity({
    activityType: "ai_tryon_started",
    activityCategory: "ai_try_on",
    description: `AI Try-On started for style ${input.styleName}`,
    status: "pending",
    pageUrl: "/ai-try-on",
    relatedEntityType: "try_on",
    relatedEntityId: id || null,
    metadata: { styleName: input.styleName, imageUploaded: Boolean(input.originalImageUrl) }
  });
  return { id };
}
async function updateTryOnGeneration(id, input) {
  const db = await getDb();
  if (!db) return;
  await db.update(tryOnGenerations).set(input).where(eq(tryOnGenerations.id, id));
  await logActivity({
    activityType: input.status === "completed" ? "ai_tryon_completed" : "ai_tryon_failed",
    activityCategory: "ai_try_on",
    description: input.status === "completed" ? `AI Try-On completed for generation #${id}` : `AI Try-On failed for generation #${id}`,
    status: input.status === "completed" ? "success" : "failed",
    pageUrl: "/ai-try-on",
    relatedEntityType: "try_on",
    relatedEntityId: id,
    metadata: input.errorMessage ? { errorMessage: input.errorMessage } : void 0
  });
}
async function adminSummary() {
  await seedIfNeeded();
  const supabaseProducts = await listSupabaseProducts();
  const db = await getDb();
  if (!db) return { bookings: 0, orders: 0, pendingReviews: 0, pendingProductReviews: 0, products: supabaseProducts?.length ?? seedProducts.length, services: seedServices.length, tryOns: 0, activityLogs: 0, unreadActivities: 0 };
  await ensureProductReviewsTable();
  await ensureActivityLogsTable();
  const [bookingRows, orderRows, reviewRows, productReviewRows, dbProductRows, serviceRows, tryOnRows, activityRows, unreadRows] = await Promise.all([db.select().from(bookings), db.select().from(orders), db.select().from(reviews).where(eq(reviews.status, "pending")), db.select().from(productReviews).where(eq(productReviews.status, "pending")), db.select().from(products), db.select().from(services), db.select().from(tryOnGenerations), db.select().from(activityLogs), db.select({ value: sql`count(*)` }).from(activityLogs).where(eq(activityLogs.isRead, "false"))]);
  return { bookings: bookingRows.length, orders: orderRows.length, pendingReviews: reviewRows.length, pendingProductReviews: productReviewRows.length, products: supabaseProducts?.length ?? dbProductRows.length, services: serviceRows.length, tryOns: tryOnRows.length, activityLogs: activityRows.length, unreadActivities: Number(unreadRows[0]?.value ?? 0) };
}
async function adminLists() {
  await seedIfNeeded();
  const supabaseProducts = await listSupabaseProducts();
  const db = await getDb();
  if (db) await ensureBookingLocationColumns();
  const fallbackProducts = seedProducts.map((product, index) => ({ ...product, id: index + 1, image_url: product.imageUrl, stock: product.stockQuantity, status: product.stockStatus, colour: null, variants: [] }));
  if (!db) return { bookings: [], orders: [], reviews: seedReviews, productReviews: [], products: supabaseProducts ?? fallbackProducts, services: seedServices, gallery: [], tryOns: [], sections: [], emailNotifications: [], activityLogs: [], availability: await getAvailabilitySettings(), instagram: await getInstagramSettings() };
  await ensureEmailNotificationLogTable();
  await ensureActivityLogsTable();
  await ensureProductVariantsTable();
  await ensureProductReviewsTable();
  const [bookingRows, orderRows, reviewRows, productReviewRows, dbProductRows, variantRows, serviceRows, galleryRows, tryOnRows, sectionRows, emailNotificationRows, activityRows] = await Promise.all([db.select().from(bookings).orderBy(desc(bookings.createdAt)), db.select().from(orders).orderBy(desc(orders.createdAt)), db.select().from(reviews).orderBy(desc(reviews.createdAt)), db.select().from(productReviews).orderBy(desc(productReviews.createdAt)), db.select().from(products).orderBy(desc(products.createdAt)), db.select().from(productVariants), db.select().from(services).orderBy(asc(services.sortOrder)), db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt)), db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)), db.select().from(websiteSections).orderBy(asc(websiteSections.sortOrder)), db.select().from(emailNotificationLogs).orderBy(desc(emailNotificationLogs.createdAt)).limit(80), db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(120)]);
  const productsWithVariants = supabaseProducts ?? dbProductRows.map((product) => ({
    ...product,
    id: Number(product.id),
    image_url: product.imageUrl,
    stock: product.stockQuantity,
    status: product.stockStatus,
    colour: null,
    seoTitle: product.seoTitle || `${product.name} | Eby\u2019s Place`,
    seoDescription: product.seoDescription || product.description,
    variants: variantRows.filter((variant) => variant.productId === product.id)
  }));
  return { bookings: bookingRows, orders: orderRows, reviews: reviewRows, productReviews: productReviewRows, products: productsWithVariants, services: serviceRows, gallery: galleryRows, tryOns: tryOnRows, sections: sectionRows, emailNotifications: emailNotificationRows, activityLogs: activityRows, availability: await getAvailabilitySettings(), instagram: await getInstagramSettings() };
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
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseProduct = await updateSupabaseProduct(id, input);
  if (supabaseProduct) return supabaseProduct;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set(input).where(eq(products.id, id));
  return { id, ...input };
}
async function createProduct(input, variants = []) {
  const supabaseProduct = await createSupabaseProduct(input, variants);
  if (supabaseProduct?.id) return supabaseProduct;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const inserted = await db.insert(products).values(input).returning({ id: products.id });
  const productId = inserted[0]?.id;
  if (!productId) throw new Error("Product could not be saved with a database id.");
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId })));
  return { id: productId, ...input, variants };
}
async function replaceProductVariants(productId, variants) {
  if (!Number.isFinite(productId) || productId <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseResult = await replaceSupabaseProductVariants(productId, variants);
  if (supabaseResult) return supabaseResult;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId })));
  return { productId, variants };
}
async function deleteProduct(id) {
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseResult = await deleteSupabaseProduct(id);
  const db = await getDb();
  if (db) {
    const drizzleCleanup = async () => {
      await db.delete(productVariants).where(eq(productVariants.productId, id));
      await db.delete(products).where(eq(products.id, id));
    };
    if (supabaseResult) {
      await drizzleCleanup().catch((error) => console.warn("[Database] Drizzle cleanup after Supabase delete failed", error));
    } else {
      await drizzleCleanup();
    }
  }
  if (supabaseResult) return supabaseResult;
  if (!db) throw new Error("Database unavailable");
  return { id, deleted: true };
}
async function updateOrderStatus(id, status) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  return { id, status };
}
async function updateProductStock(id, stockQuantity, stockStatus) {
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseProduct = await updateSupabaseProduct(id, { stockQuantity, stockStatus });
  if (supabaseProduct) return { id, stockQuantity: supabaseProduct.stockQuantity ?? stockQuantity, stockStatus: supabaseProduct.stockStatus ?? stockStatus };
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
async function deleteGalleryImage(id) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
  return { id };
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
  const trimmed = trimEnvValue(value);
  if (channel === "whatsapp") {
    if (/^whatsapp:\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
    if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return `whatsapp:${trimmed}`;
    return null;
  }
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9 ]{1,11}$/.test(trimmed)) return trimmed;
  return null;
}
function getTwilioConfig(channel = "sms") {
  const accountSid = normalizeSecretKey(process.env.TWILIO_ACCOUNT_SID);
  const authToken = normalizeSecretKey(process.env.TWILIO_AUTH_TOKEN);
  const rawFrom = channel === "whatsapp" ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
  const from = normaliseSender(rawFrom, channel);
  return {
    accountSid,
    authToken,
    from,
    hasAccountSid: Boolean(accountSid),
    hasAuthToken: Boolean(authToken),
    hasRawSender: Boolean(trimEnvValue(rawFrom)),
    hasValidSender: Boolean(from)
  };
}
function getTwilioRequestTimeoutMs() {
  const parsed = Number(process.env.TWILIO_REQUEST_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 1500 ? Math.min(parsed, 15e3) : 8e3;
}
function getNotificationDiagnostics() {
  const sms = getTwilioConfig("sms");
  const whatsapp = getTwilioConfig("whatsapp");
  const ownerPhone = normalisePhone(process.env.EBYSPLACE_OWNER_PHONE_E164 || process.env.OWNER_PHONE_E164 || process.env.TWILIO_OWNER_PHONE);
  return {
    twilio: {
      sms: {
        configured: sms.hasAccountSid && sms.hasAuthToken && sms.hasValidSender,
        hasAccountSid: sms.hasAccountSid,
        hasAuthToken: sms.hasAuthToken,
        hasSender: sms.hasRawSender,
        hasValidSender: sms.hasValidSender
      },
      whatsapp: {
        configured: whatsapp.hasAccountSid && whatsapp.hasAuthToken && whatsapp.hasValidSender,
        hasAccountSid: whatsapp.hasAccountSid,
        hasAuthToken: whatsapp.hasAuthToken,
        hasSender: whatsapp.hasRawSender,
        hasValidSender: whatsapp.hasValidSender,
        expectedSenderFormat: "whatsapp:+14155238886 or an approved whatsapp:+E164 Twilio sender"
      },
      ownerPhoneConfigured: Boolean(ownerPhone),
      requestTimeoutMs: getTwilioRequestTimeoutMs()
    }
  };
}
async function sendTwilioMessage(input) {
  const channel = input.channel || "sms";
  const config = getTwilioConfig(channel);
  const { accountSid, authToken, from } = config;
  const to = normalisePhone(input.to);
  if (!accountSid || !authToken || !from || !to) {
    console.warn(`[TwilioNotification] ${channel} skipped`, {
      hasAccountSid: config.hasAccountSid,
      hasAuthToken: config.hasAuthToken,
      hasSender: config.hasRawSender,
      hasValidSender: config.hasValidSender,
      hasValidRecipient: Boolean(to)
    });
    return { sent: false, reason: `${channel}_not_configured_or_invalid_number` };
  }
  const formattedTo = channel === "whatsapp" ? `whatsapp:${to}` : to;
  const params = new URLSearchParams({ To: formattedTo, From: from, Body: input.body.slice(0, 1500) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTwilioRequestTimeoutMs());
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
async function sendCustomerWhatsApp(input) {
  return sendTwilioMessage({ ...input, channel: "whatsapp" });
}
async function sendCustomerSmsSafely(input) {
  try {
    return await sendCustomerSms(input);
  } catch (error) {
    console.warn("[CustomerSMS] Notification skipped", error);
    return { sent: false, reason: "exception" };
  }
}
async function sendCustomerWhatsAppSafely(input) {
  try {
    return await sendCustomerWhatsApp(input);
  } catch (error) {
    console.warn("[CustomerWhatsApp] Notification skipped", error);
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
function isValidEmail(value) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}
async function sendCustomerEmailSafely(input) {
  try {
    const apiKey = normalizeSecretKey(process.env.SENDGRID_API_KEY);
    const from = trimEnvValue(process.env.SENDGRID_FROM_EMAIL) || trimEnvValue(process.env.CUSTOMER_EMAIL_FROM);
    if (!apiKey || !from || !isValidEmail(input.to)) {
      return { sent: false, reason: "email_provider_not_configured_or_invalid_address" };
    }
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to.trim() }] }],
        from: { email: from.trim() },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.body.slice(0, 12e3) }]
      })
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.warn("[CustomerEmail] Send failed", response.status, details.slice(0, 300));
      return { sent: false, reason: "email_provider_error" };
    }
    return { sent: true };
  } catch (error) {
    console.warn("[CustomerEmail] Notification skipped", error);
    return { sent: false, reason: "exception" };
  }
}
async function sendOwnerSmsAndWhatsAppSafely(body) {
  const ownerPhone = process.env.EBYSPLACE_OWNER_PHONE_E164 || process.env.OWNER_PHONE_E164 || process.env.TWILIO_OWNER_PHONE;
  const results = await Promise.allSettled([
    sendCustomerSmsSafely({ to: ownerPhone, body }),
    sendCustomerWhatsAppSafely({ to: ownerPhone, body })
  ]);
  return results.map((result) => result.status === "fulfilled" ? result.value : { sent: false, reason: "exception" });
}
async function sendReviewRequestEmailSafely(input) {
  const reviewUrl = input.reviewUrl || (input.bookingId ? `/reviews?booking=${input.bookingId}` : "/reviews");
  return sendCustomerEmailSafely({
    to: input.to,
    subject: "How was your Eby\u2019s Place appointment?",
    body: [
      `Hi ${input.customerName || "there"},`,
      `Thank you for visiting Eby\u2019s Place for ${input.serviceName || "your appointment"}.`,
      `Please leave a review here: ${reviewUrl}`,
      "Reviews are checked by the Eby\u2019s Place team before appearing publicly."
    ].join("\n\n")
  });
}
async function sendNewsletterWelcomeEmailSafely(input) {
  return sendCustomerEmailSafely({
    to: input.to,
    subject: "Welcome to Eby\u2019s Place updates",
    body: [
      "Hi there,",
      "Thank you for joining Eby\u2019s Place updates. You will receive styling news, braid-care guidance, booking reminders, and selected product updates from the Eby\u2019s Place team.",
      input.productAlerts ? "You are also subscribed to product and stock alerts for Eby\u2019s Place braid-care essentials." : "You can opt into product alerts whenever you want updates on braid-care essentials.",
      "If this was not you, you can ignore this email."
    ].join("\n\n")
  });
}
async function sendShopOrderPaidEmailSafely(input) {
  return sendCustomerEmailSafely({
    to: input.to,
    subject: `Eby\u2019s Place shop order #${input.orderId} confirmed`,
    body: [
      `Hi ${input.customerName || "there"},`,
      `Your Eby\u2019s Place shop payment has been confirmed for order #${input.orderId}.`,
      input.deliveryAddress ? `Delivery address: ${input.deliveryAddress}` : "Delivery address: provided during checkout.",
      input.itemsSummary ? `Items:
${input.itemsSummary}` : "The Eby\u2019s Place team is preparing your order.",
      "Your payment receipt will be sent to the email used at checkout."
    ].join("\n\n")
  });
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

// server/smtpEmailNotifications.ts
import nodemailer from "nodemailer";
var STUDIO_CONFIRMATION_ADDRESS = "1 Bawden Close, Woolavington, Bridgwater, Somerset, TA7 8HD, England, United Kingdom";
var CONTACT_PHONE = "+447864585110";
var CONTACT_EMAIL = "info@ebysplace.com";
function trimQuotes(value) {
  return value.trim().replace(/^['\"]|['\"]$/g, "").trim();
}
function normalizeSmtpPassword(value) {
  return trimQuotes(value ?? "").replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
}
function normalizeEnv(value) {
  return trimQuotes(value ?? "");
}
function getSmtpConfig() {
  const host = normalizeEnv(process.env.SMTP_HOST) || "smtp.zoho.eu";
  const port = Number(normalizeEnv(process.env.SMTP_PORT) || "465");
  const user = normalizeEnv(process.env.SMTP_USER) || CONTACT_EMAIL;
  const pass = normalizeSmtpPassword(process.env.SMTP_PASS);
  const from = normalizeEnv(process.env.SMTP_FROM) || user;
  const ownerEmail = normalizeEnv(process.env.EBYSPLACE_OWNER_EMAIL) || CONTACT_EMAIL;
  const secure = port === 465;
  return { host, port, secure, user, pass, from, ownerEmail };
}
function assertSmtpConfigReady() {
  const config = getSmtpConfig();
  const missing = [
    !config.host && "SMTP_HOST",
    !config.port && "SMTP_PORT",
    !config.user && "SMTP_USER",
    !config.pass && "SMTP_PASS",
    !config.from && "SMTP_FROM",
    !config.ownerEmail && "EBYSPLACE_OWNER_EMAIL"
  ].filter(Boolean);
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
      pass: config.pass
    }
  });
}
function preview(body) {
  return body.replace(/\s+/g, " ").trim().slice(0, 900);
}
async function sendAndLogEmail(payload, mode = "initial", existingLogId) {
  const config = getSmtpConfig();
  if (!payload.to?.trim()) {
    const errorMessage = `No ${payload.audience} recipient email is available for ${payload.entityType} #${payload.entityId}.`;
    const logId2 = existingLogId ?? (await createEmailNotificationLog({
      entityType: payload.entityType,
      entityId: payload.entityId,
      audience: payload.audience,
      recipientEmail: "missing-recipient@invalid.local",
      subject: payload.subject,
      bodyPreview: preview(payload.body),
      status: "failed",
      smtpHost: config.host,
      errorMessage
    })).id;
    if (existingLogId) await updateEmailNotificationLog(existingLogId, { status: "failed", errorMessage, smtpHost: config.host });
    return { status: "failed", logId: logId2, errorMessage };
  }
  const pendingStatus = mode === "resend" ? "retried" : "pending";
  const logId = existingLogId ?? (await createEmailNotificationLog({
    entityType: payload.entityType,
    entityId: payload.entityId,
    audience: payload.audience,
    recipientEmail: payload.to.trim(),
    subject: payload.subject,
    bodyPreview: preview(payload.body),
    status: pendingStatus,
    smtpHost: config.host
  })).id;
  try {
    const transporter = createTransport();
    const result = await transporter.sendMail({
      from: config.from,
      to: payload.to.trim(),
      subject: payload.subject,
      text: payload.body
    });
    await updateEmailNotificationLog(logId, {
      status: mode === "resend" ? "retried" : "sent",
      messageId: result.messageId,
      errorMessage: null,
      smtpHost: config.host,
      sentAtMs: Date.now()
    });
    return { status: mode === "resend" ? "retried" : "sent", logId, messageId: result.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[SMTP] Failed to send ${payload.entityType} ${payload.audience} email`, { entityId: payload.entityId, errorMessage });
    await updateEmailNotificationLog(logId, {
      status: "failed",
      errorMessage,
      smtpHost: config.host
    });
    return { status: "failed", logId, errorMessage };
  }
}
function money(value, fallback = "confirmed in your payment receipt") {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return `\xA3${numberValue.toFixed(2)}`;
}
function bookingReference(booking) {
  return booking?.id ? `BOOK-${String(booking.id).padStart(5, "0")}` : "Booking reference pending";
}
function orderReference(order) {
  return order?.id ? `ORDER-${String(order.id).padStart(5, "0")}` : "Order reference pending";
}
function bookingLocationText(booking) {
  if (booking?.serviceLocation === "home_service") {
    const address = [booking.addressLine1, booking.addressLine2, booking.city, booking.county, booking.postcode].filter(Boolean).join(", ");
    return `Home service address: ${address || "address supplied with the booking"}`;
  }
  return `Studio address: ${STUDIO_CONFIRMATION_ADDRESS}`;
}
function orderDeliveryText(order) {
  const address = [order?.addressLine1, order?.addressLine2, order?.city, order?.county, order?.postcode].filter(Boolean).join(", ");
  if (address) return `Delivery address: ${address}`;
  return order?.serviceLocation === "studio" ? "Collection/visit option: Eby\u2019s Place studio" : "Delivery/collection information: provided during checkout";
}
function buildBookingEmailPayloads(booking, session) {
  const config = getSmtpConfig();
  const reference = bookingReference(booking);
  const amountPaid = session?.amount_total != null ? money(Number(session.amount_total) / 100) : "\xA320.00 deposit";
  const priceLine = booking?.estimatedPrice != null ? money(Number(booking.estimatedPrice) + Number(booking.homeServiceSurcharge || 0)) : amountPaid;
  const customerName = booking?.clientName ?? session?.metadata?.customer_name ?? "Customer";
  const serviceName = booking?.serviceName ?? session?.metadata?.service_name ?? "Selected service";
  const dateTime = `${booking?.appointmentDate ?? "Date TBC"}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""}`;
  const paymentStatus = booking?.depositStatus === "paid" ? "Paid" : "Stripe payment confirmed";
  const notes = booking?.deliveryNote || "No customer notes provided.";
  const ownerBody = [
    "A new paid Eby\u2019s Place booking has been confirmed through Stripe.",
    `Booking reference: ${reference}`,
    `Customer name: ${customerName}`,
    `Customer phone: ${booking?.clientPhone ?? "Not provided"}`,
    `Customer email: ${booking?.clientEmail ?? session?.customer_email ?? "Not provided"}`,
    `Service/hairstyle booked: ${serviceName}`,
    `Booking date and time: ${dateTime}`,
    `Price/payment amount: ${priceLine}`,
    `Payment status: ${paymentStatus}`,
    `Stripe session: ${session?.id ?? "Not available"}`,
    `Customer notes: ${notes}`,
    bookingLocationText(booking)
  ].join("\n");
  const customerBody = [
    `Hi ${customerName},`,
    "Thank you for booking with Eby\u2019s Place. Your secure payment has been received and your appointment is secured.",
    `Booking reference: ${reference}`,
    `Service/hairstyle booked: ${serviceName}`,
    `Booking date and time: ${dateTime}`,
    `Amount paid or amount due: ${amountPaid}`,
    bookingLocationText(booking),
    "If you need to update your appointment, please contact Eby\u2019s Place as soon as possible.",
    `Contact: ${CONTACT_EMAIL} | WhatsApp/phone: ${CONTACT_PHONE}`
  ].join("\n\n");
  return [
    { entityType: "booking", entityId: Number(booking?.id ?? session?.metadata?.booking_id ?? 0), audience: "owner", to: config.ownerEmail, subject: `New paid booking: ${reference}`, body: ownerBody },
    { entityType: "booking", entityId: Number(booking?.id ?? session?.metadata?.booking_id ?? 0), audience: "customer", to: booking?.clientEmail ?? session?.customer_email ?? session?.metadata?.customer_email, subject: `Eby\u2019s Place booking confirmation: ${reference}`, body: customerBody }
  ];
}
function buildOrderEmailPayloads(order, items, session) {
  const config = getSmtpConfig();
  const reference = orderReference(order);
  const customerName = order?.customerName ?? session?.metadata?.customer_name ?? "Customer";
  const itemsSummary = items.length ? items.map((item) => `${item.quantity} \xD7 ${item.variantName ? `${item.productName} \u2014 ${item.variantName}` : item.productName} (${money(Number(item.unitPrice) * Number(item.quantity))})`).join("\n") : "Products recorded during checkout.";
  const totalPaid = items.length ? money(items.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.quantity), 0)) : session?.amount_total != null ? money(Number(session.amount_total) / 100) : "confirmed in your payment receipt";
  const deliveryText = orderDeliveryText(order);
  const paymentStatus = order?.status === "paid" ? "Paid" : "Stripe payment confirmed";
  const ownerBody = [
    "A new paid Eby\u2019s Place shop order has been confirmed through Stripe.",
    `Order reference: ${reference}`,
    `Customer name: ${customerName}`,
    `Customer phone: ${order?.customerPhone ?? "Not provided"}`,
    `Customer email: ${order?.customerEmail ?? session?.customer_email ?? "Not provided"}`,
    `Products ordered:
${itemsSummary}`,
    `Total amount paid: ${totalPaid}`,
    deliveryText,
    `Payment status: ${paymentStatus}`,
    `Stripe session: ${session?.id ?? "Not available"}`
  ].join("\n");
  const customerBody = [
    `Hi ${customerName},`,
    "Thank you for shopping with Eby\u2019s Place. Your payment has been received and your order is being prepared.",
    `Order reference: ${reference}`,
    `Products ordered:
${itemsSummary}`,
    `Total paid: ${totalPaid}`,
    deliveryText,
    "Eby\u2019s Place will contact you if any delivery or collection details need confirming.",
    `Contact: ${CONTACT_EMAIL} | WhatsApp/phone: ${CONTACT_PHONE}`
  ].join("\n\n");
  return [
    { entityType: "order", entityId: Number(order?.id ?? session?.metadata?.order_id ?? 0), audience: "owner", to: config.ownerEmail, subject: `New paid shop order: ${reference}`, body: ownerBody },
    { entityType: "order", entityId: Number(order?.id ?? session?.metadata?.order_id ?? 0), audience: "customer", to: order?.customerEmail ?? session?.customer_email ?? session?.metadata?.customer_email, subject: `Eby\u2019s Place order confirmation: ${reference}`, body: customerBody }
  ];
}
async function sendBookingPaymentEmailsSafely(booking, session) {
  const payloads = buildBookingEmailPayloads(booking, session);
  return Promise.all(payloads.map((payload) => sendAndLogEmail(payload).catch((error) => ({ status: "failed", errorMessage: error instanceof Error ? error.message : String(error) }))));
}
async function sendOrderPaymentEmailsSafely(order, items, session) {
  const payloads = buildOrderEmailPayloads(order, items, session);
  return Promise.all(payloads.map((payload) => sendAndLogEmail(payload).catch((error) => ({ status: "failed", errorMessage: error instanceof Error ? error.message : String(error) }))));
}
async function resendEmailNotificationLog(logId) {
  const log = await getEmailNotificationLogById(logId);
  if (!log) throw new Error("Email notification log not found.");
  if (log.entityType === "booking") {
    const booking = await getBookingById(log.entityId);
    if (!booking) throw new Error("Booking for email resend was not found.");
    const payload2 = buildBookingEmailPayloads(booking, { metadata: { booking_id: booking.id }, customer_email: booking.clientEmail }).find((item) => item.audience === log.audience);
    if (!payload2) throw new Error("Booking email payload could not be rebuilt.");
    return sendAndLogEmail(payload2, "resend", log.id);
  }
  const order = await getOrderById(log.entityId);
  if (!order) throw new Error("Order for email resend was not found.");
  const items = await getOrderItemsByOrderId(order.id);
  const payload = buildOrderEmailPayloads(order, items, { metadata: { order_id: order.id }, customer_email: order.customerEmail }).find((item) => item.audience === log.audience);
  if (!payload) throw new Error("Order email payload could not be rebuilt.");
  return sendAndLogEmail(payload, "resend", log.id);
}

// server/stripeWebhook.ts
var STUDIO_CONFIRMATION_ADDRESS2 = "1 Bawden Close, Woolavington, Bridgwater, Somerset, TA7 8HD, England, United Kingdom";
var EBYSPLACE_STRIPE_WEBHOOK_PATH = "/api/stripe/ebysplace-live-webhook";
var LEGACY_STRIPE_WEBHOOK_PATH = "/api/stripe/webhook";
function getStripeWebhookConfig() {
  const secretKey = [
    normalizeSecretKey(process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY),
    normalizeSecretKey(process.env.STRIPE_SECRET_KEY)
  ].find((key) => key.startsWith("sk_live_")) || [
    normalizeSecretKey(process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY),
    normalizeSecretKey(process.env.STRIPE_SECRET_KEY)
  ].find(Boolean);
  const webhookSecret = normalizeSecretKey(process.env.EBYSPLACE_LIVE_STRIPE_WEBHOOK_SECRET) || normalizeSecretKey(process.env.STRIPE_WEBHOOK_SECRET);
  if (!secretKey || !webhookSecret) return null;
  return { stripe: new Stripe(secretKey), webhookSecret };
}
function registerStripeWebhook(app2) {
  app2.post([LEGACY_STRIPE_WEBHOOK_PATH, EBYSPLACE_STRIPE_WEBHOOK_PATH], express.raw({ type: "application/json" }), async (req, res) => {
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
          if (booking) {
            void sendBookingPaymentEmailsSafely(booking, session).catch((error) => console.warn("[StripeWebhook] SMTP booking email workflow failed", error));
          }
          const remainingBalance = booking?.estimatedPrice != null ? Math.max(Number(booking.estimatedPrice || 0) + Number(booking.homeServiceSurcharge || 0) - 20, 0).toFixed(2) : null;
          const customerConfirmation = `Your Eby\u2019s Place \xA320 booking deposit has been confirmed. Your appointment for ${booking?.serviceName ?? "your selected service"}${booking?.appointmentDate ? ` on ${booking.appointmentDate}` : ""}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""} is now secured. Your payment receipt will also be emailed to the checkout email address.`;
          const bookingLocation = booking?.serviceLocation ?? session.metadata?.service_location ?? "studio";
          const homeServiceAddress = [booking?.addressLine1, booking?.addressLine2, booking?.city, booking?.county, booking?.postcode].filter(Boolean).join(", ");
          const locationConfirmation = bookingLocation === "home_service" ? `Home service address: ${homeServiceAddress || "the address provided during booking"}` : `Studio visit address: ${STUDIO_CONFIRMATION_ADDRESS2}`;
          await Promise.allSettled([
            sendCustomerSmsSafely({
              to: booking?.clientPhone,
              body: customerConfirmation
            }),
            sendCustomerWhatsAppSafely({
              to: booking?.clientPhone,
              body: customerConfirmation
            }),
            sendCustomerEmailSafely({
              to: booking?.clientEmail ?? session.customer_email,
              subject: "Eby\u2019s Place booking deposit confirmed",
              body: [
                `Hi ${booking?.clientName ?? session.metadata?.customer_name ?? "there"},`,
                "Thank you for booking with Eby\u2019s Place.",
                customerConfirmation,
                `Service: ${booking?.serviceName ?? session.metadata?.service_name ?? "selected service"}`,
                `Date and time: ${booking?.appointmentDate ?? "date TBC"}${booking?.appointmentTime ? ` at ${booking.appointmentTime}` : ""}`,
                `Appointment location: ${bookingLocation === "home_service" ? "Home service" : "Eby\u2019s Place studio"}`,
                locationConfirmation,
                "Deposit paid: \xA320.00 non-refundable booking deposit.",
                remainingBalance ? `Estimated remaining balance due at appointment: \xA3${remainingBalance}.` : "Remaining balance: confirmed by Eby\u2019s Place according to your final service and add-ons.",
                booking?.deliveryNote ? `Booking notes and optional selections:
${booking.deliveryNote}` : void 0,
                "If anything needs changing, please contact Eby\u2019s Place before your appointment."
              ].filter(Boolean).join("\n\n")
            })
          ]);
          await sendOwnerSmsAndWhatsAppSafely(`Booking deposit paid: ${booking?.clientName ?? session.metadata?.customer_name ?? "Customer"} booked ${booking?.serviceName ?? session.metadata?.service_name ?? "a service"} on ${booking?.appointmentDate ?? "date TBC"} at ${booking?.appointmentTime ?? "time TBC"}. Email: ${booking?.clientEmail ?? session.customer_email ?? "not provided"}`);
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
          const deliveryAddress = [order?.addressLine1, order?.addressLine2, order?.city, order?.county, order?.postcode].filter(Boolean).join(", ");
          const orderReference2 = order?.id ?? session.metadata?.order_id ?? "";
          const orderItems2 = order?.id ? await getOrderItemsByOrderId(order.id) : [];
          if (order) {
            void sendOrderPaymentEmailsSafely(order, orderItems2, session).catch((error) => console.warn("[StripeWebhook] SMTP order email workflow failed", error));
          }
          const itemsSummary = orderItems2.length ? orderItems2.map((item) => `${item.quantity} \xD7 ${item.variantName ? `${item.productName} \u2014 ${item.variantName}` : item.productName} (\xA3${(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)})`).join("\n") : "Items recorded during checkout.";
          const totalPaid = orderItems2.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.quantity), 0).toFixed(2);
          const orderEmailBody = [
            `Hi ${order?.customerName ?? session.metadata?.customer_name ?? "there"},`,
            "Thank you for shopping with Eby\u2019s Place.",
            `Order reference: #${orderReference2}`,
            `Products and quantities:
${itemsSummary}`,
            orderItems2.length ? `Total paid: \xA3${totalPaid}` : "Total paid: confirmed in your payment receipt.",
            `Delivery address: ${deliveryAddress || "provided during checkout"}`,
            "Estimated delivery: 3-5 working days after dispatch."
          ].join("\n\n");
          await Promise.allSettled([
            sendCustomerSmsSafely({
              to: order?.customerPhone,
              body: `Eby's Place has received payment for order #${orderReference2}. We will prepare your items and keep you updated.`
            }),
            sendCustomerWhatsAppSafely({
              to: order?.customerPhone,
              body: `Eby's Place has received payment for order #${orderReference2}. We will prepare your items and keep you updated.`
            }),
            sendShopOrderPaidEmailSafely({
              to: order?.customerEmail ?? session.customer_email,
              customerName: order?.customerName ?? session.metadata?.customer_name,
              orderId: orderReference2,
              deliveryAddress: deliveryAddress || "provided during checkout",
              itemsSummary: `${itemsSummary}

${orderItems2.length ? `Total paid: \xA3${totalPaid}` : "Total paid: confirmed in your payment receipt."}
Estimated delivery: 3-5 working days after dispatch.`
            }),
            sendOwnerSmsAndWhatsAppSafely(`New Eby's Place shop order paid: ${order?.customerName ?? session.metadata?.customer_name ?? "Customer"}, order #${orderReference2}, deliver to ${deliveryAddress || "address on order"}.`)
          ]);
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
      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        console.log("[StripeWebhook] Payment intent succeeded", paymentIntent.id);
      }
      if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        const failureMessage = paymentIntent.last_payment_error?.message || "Stripe reported a failed payment attempt.";
        await logActivity({
          request: req,
          activityType: "payment_failed",
          activityCategory: "payment",
          description: `Stripe payment failed for payment intent ${paymentIntent.id}`,
          status: "failed",
          pageUrl: "/checkout",
          relatedEntityType: "payment_intent",
          relatedEntityId: paymentIntent.id,
          userEmail: paymentIntent.receipt_email || void 0,
          metadata: {
            reason: failureMessage,
            currency: paymentIntent.currency,
            amount: paymentIntent.amount
          }
        });
        await notifyOwner({
          title: "Eby\u2019s Place payment failed",
          content: [
            `Stripe payment failed for payment intent ${paymentIntent.id}.`,
            `Reason: ${failureMessage}`,
            paymentIntent.receipt_email ? `Customer email: ${paymentIntent.receipt_email}` : void 0
          ].filter(Boolean).join("\n")
        }).catch((error) => console.warn("[StripeWebhook] Owner failed-payment notification failed", error));
      }
      console.log("[StripeWebhook] Processed event", event.type, event.id);
      res.json({ received: true });
    } catch (error) {
      console.error("[StripeWebhook] Failed to process event", event.id, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}

// server/activityCollector.ts
import { z } from "zod";
var ACTIVITY_COLLECTOR_PATH = "/api/activity/external";
var MAX_REQUESTS_PER_MINUTE = 120;
var WINDOW_MS = 6e4;
var requestWindowByIp = /* @__PURE__ */ new Map();
function anonymizeIpForRateLimit(rawIp) {
  if (!rawIp) return "unknown";
  if (rawIp.includes(".")) {
    const parts = rawIp.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.0.0`;
  }
  if (rawIp.includes(":")) {
    const parts = rawIp.split(":").filter(Boolean);
    return parts.length ? `${parts.slice(0, 2).join(":")}::` : "unknown";
  }
  return "unknown";
}
var externalActivitySchema = z.object({
  sessionId: z.string().max(128).optional(),
  userName: z.string().max(180).optional(),
  userEmail: z.string().email().max(320).optional(),
  activityType: z.string().min(2).max(120),
  activityCategory: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  pageUrl: z.string().max(800).optional(),
  metadata: z.unknown().optional(),
  status: z.enum(["success", "failed", "pending", "info"]).default("info"),
  relatedEntityType: z.string().max(80).optional(),
  relatedEntityId: z.union([z.string(), z.number()]).optional(),
  sourceApp: z.string().max(80).default("kouviabooking")
}).strict();
function rateLimited(req) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null;
  const key = anonymizeIpForRateLimit(ip);
  const now = Date.now();
  const current = requestWindowByIp.get(key);
  if (!current || current.resetAt < now) {
    requestWindowByIp.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_MINUTE;
}
function registerActivityCollector(app2) {
  app2.post(ACTIVITY_COLLECTOR_PATH, async (req, res) => {
    const expectedKey = String(process.env.ACTIVITY_COLLECTOR_KEY || "").trim();
    const providedKey = String(req.headers["x-activity-collector-key"] || "").trim();
    if (!expectedKey || providedKey !== expectedKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (rateLimited(req)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }
    const parsed = externalActivitySchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean) });
      return;
    }
    try {
      await logActivity({
        request: req,
        ...parsed.data
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[ActivityCollector] Failed to store external activity", error);
      res.status(500).json({ error: "Failed to store activity" });
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import Stripe2 from "stripe";
import { z as z3 } from "zod";

// server/storage.ts
var SUPABASE_URL = normalizeEnvUrl(process.env.SUPABASE_URL) || "https://jcyoipbiplzrocrrhwkp.supabase.co";
var SUPABASE_BUCKET = trimEnvValue(process.env.SUPABASE_STORAGE_BUCKET) || "ebysplace-media";
function getSupabaseConfig() {
  const serviceRoleKey = normalizeSecretKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
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
function storageKeyFromPublicUrl(url) {
  try {
    const parsed = new URL(url);
    const prefix = `/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/`;
    if (parsed.origin !== SUPABASE_URL || !parsed.pathname.startsWith(prefix)) return null;
    return `supabase:${decodeURIComponent(parsed.pathname.slice(prefix.length))}`;
  } catch {
    return null;
  }
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
async function storageRemove(relKeyOrUrl) {
  const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseConfig();
  const key = relKeyOrUrl.startsWith("http") ? storageKeyFromPublicUrl(relKeyOrUrl) : relKeyOrUrl;
  if (!key) return { deleted: false };
  const normalizedKey = normalizeKey(key);
  const deleteUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectKey(normalizedKey)}`;
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey
    }
  });
  if (!response.ok && response.status !== 404) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`Supabase storage delete failed (${response.status}): ${msg}`);
  }
  return { deleted: response.ok || response.status === 404, key: `supabase:${normalizedKey}` };
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
  const apiKey = normalizeSecretKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("AI Try-On is not configured for this deployment. Add OPENAI_API_KEY in Vercel, then redeploy.");
  }
  const originals = options.originalImages || [];
  const endpoint = originals.length > 0 ? "https://api.openai.com/v1/images/edits" : "https://api.openai.com/v1/images/generations";
  const form = new FormData();
  form.set("model", trimEnvValue(process.env.OPENAI_IMAGE_MODEL) || "gpt-image-1");
  form.set("prompt", options.prompt);
  form.set("size", trimEnvValue(process.env.OPENAI_IMAGE_SIZE) || "1024x1024");
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
import { z as z2 } from "zod";

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
    z2.object({
      timestamp: z2.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z2.object({
      title: z2.string().min(1, "title is required"),
      content: z2.string().min(1, "content is required")
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
import nodemailer2 from "nodemailer";
function normalizeEmailCandidate(value) {
  const email = value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim().toLowerCase();
  return email || null;
}
function getConfiguredAdminEmails() {
  const configured = [
    normalizeEmailCandidate(process.env.EBYSPLACE_ADMIN_EMAIL),
    normalizeEmailCandidate(process.env.EBYSPLACE_OWNER_EMAIL),
    normalizeEmailCandidate(process.env.OWNER_EMAIL),
    normalizeEmailCandidate(process.env.SMTP_FROM),
    "info@ebysplace.com"
  ].filter((email) => Boolean(email));
  return Array.from(new Set(configured));
}
var ADMIN_EMAILS = getConfiguredAdminEmails();
var PRIMARY_ADMIN_EMAIL = ADMIN_EMAILS[0] ?? "info@ebysplace.com";
function isConfiguredAdminEmail(email) {
  const normalized = normalizeEmailCandidate(email);
  return Boolean(normalized && ADMIN_EMAILS.includes(normalized));
}
function getSmtpConfig2() {
  const host = trimEnvValue(process.env.SMTP_HOST) || "smtp.zoho.eu";
  const port = Number(trimEnvValue(process.env.SMTP_PORT) || "465");
  const user = trimEnvValue(process.env.SMTP_USER) || "info@ebysplace.com";
  const pass = normalizeSecretKey(process.env.SMTP_PASS);
  const from = trimEnvValue(process.env.SMTP_FROM) || user;
  return { host, port, user, pass, from, secure: port === 465 };
}
function assertPasswordResetSmtpReady() {
  const config = getSmtpConfig2();
  const missing = [
    !config.host && "SMTP_HOST",
    !config.port && "SMTP_PORT",
    !config.user && "SMTP_USER",
    !config.pass && "SMTP_PASS",
    !config.from && "SMTP_FROM"
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing SMTP configuration for password reset fallback: ${missing.join(", ")}`);
  return config;
}
async function sendAdminPasswordResetEmail(email, resetLink) {
  const config = assertPasswordResetSmtpReady();
  const transporter = nodemailer2.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.pass }
  });
  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "Reset your Eby\u2019s Place admin password",
    text: [
      "Hello,",
      "A password reset was requested for the Eby\u2019s Place admin dashboard.",
      "Open the secure reset link below to choose a new password:",
      resetLink,
      "If you did not request this, you can ignore this email."
    ].join("\n\n")
  });
}
function toTrpcError(error, fallbackMessage) {
  if (error instanceof TRPCError3) return error;
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message });
}
function getSupabaseAuthConfig() {
  const url = normalizeEnvUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = normalizeSecretKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
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
function getPreferredProductionOrigin() {
  const candidates = [
    process.env.EBYSPLACE_PUBLIC_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.VITE_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : void 0,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : void 0,
    "https://www.ebysplace.com"
  ];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(trimEnvValue(candidate));
      if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        return parsed.origin;
      }
    } catch {
    }
  }
  return "https://www.ebysplace.com";
}
function getSafeResetRedirect(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported protocol");
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const shouldUseProductionOrigin = isLocalhost && (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production");
    const safeOrigin = shouldUseProductionOrigin ? getPreferredProductionOrigin() : parsed.origin;
    return safeOrigin + "/admin/reset-password";
  } catch {
    return (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" ? getPreferredProductionOrigin() : "http://localhost:3000") + "/admin/reset-password";
  }
}
function withResetRedirect(actionLink, redirectTo) {
  try {
    const parsed = new URL(actionLink);
    parsed.searchParams.set("redirect_to", redirectTo);
    return parsed.toString();
  } catch {
    return actionLink;
  }
}
function hasPasswordResetSmtpConfig() {
  try {
    assertPasswordResetSmtpReady();
    return true;
  } catch {
    return false;
  }
}
function supabaseErrorCode(httpStatus) {
  if (httpStatus === 401 || httpStatus === 400) return "UNAUTHORIZED";
  if (httpStatus >= 500) return "BAD_GATEWAY";
  return "BAD_REQUEST";
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
  let json2 = null;
  if (body) {
    try {
      json2 = JSON.parse(body);
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
    const message = typeof json2?.msg === "string" ? json2.msg : typeof json2?.message === "string" ? json2.message : "Supabase Auth request failed.";
    console.error("[Auth] Supabase Auth request failed", { path: path2, method: init.method ?? "GET", status: response.status, message });
    throw new TRPCError3({ code: supabaseErrorCode(response.status), message });
  }
  return json2;
}
async function signInAdminWithPassword(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    if (!isConfiguredAdminEmail(normalizedEmail)) {
      console.error("[Auth] Rejected admin sign-in for non-admin email", { email: normalizedEmail, configuredAdminEmails: ADMIN_EMAILS });
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
    message: "If this email is the configured Eby\u2019s Place administrator, a password reset link has been sent."
  };
  if (!isConfiguredAdminEmail(normalizedEmail)) {
    console.warn("[Auth] Ignored password reset request for non-admin email", { email: normalizedEmail, configuredAdminEmails: ADMIN_EMAILS });
    return genericResponse;
  }
  const redirectTo = getSafeResetRedirect(origin);
  const sendGeneratedLinkThroughSmtp = async (reason) => {
    const generated = await supabaseAuthFetch("/admin/generate_link", {
      method: "POST",
      body: JSON.stringify({
        type: "recovery",
        email: normalizedEmail,
        options: { redirect_to: redirectTo }
      })
    });
    if (!generated.action_link) {
      console.error("[Auth] Supabase generated a password reset response without an action link", {
        email: normalizedEmail,
        hasHashedToken: Boolean(generated.hashed_token),
        verificationType: generated.verification_type
      });
      throw new TRPCError3({ code: "BAD_GATEWAY", message: "Supabase did not return a password reset link." });
    }
    await sendAdminPasswordResetEmail(normalizedEmail, withResetRedirect(generated.action_link, redirectTo));
    console.info("[Auth] Sent admin password reset email using app SMTP", { email: normalizedEmail, reason, redirectTo });
  };
  if (hasPasswordResetSmtpConfig()) {
    try {
      await sendGeneratedLinkThroughSmtp("preferred");
      return genericResponse;
    } catch (smtpError) {
      const safeError = toTrpcError(smtpError, "Unable to send the password reset email.");
      console.error("[Auth] App SMTP password reset failed", { email: normalizedEmail, code: safeError.code, message: safeError.message });
      throw safeError;
    }
  }
  try {
    await supabaseAuthFetch("/recover?redirect_to=" + encodeURIComponent(redirectTo), {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail })
    });
    return genericResponse;
  } catch (recoverError) {
    const recoverTrpcError = toTrpcError(recoverError, "Unable to send the Supabase password reset email.");
    if (!hasPasswordResetSmtpConfig()) {
      console.error("[Auth] Password reset failed: Supabase email delivery unavailable and SMTP is not configured", {
        email: normalizedEmail,
        code: recoverTrpcError.code,
        supabaseMessage: recoverTrpcError.message
      });
      throw new TRPCError3({
        code: "BAD_GATEWAY",
        message: "Unable to send a password reset email. Supabase email delivery is unavailable. Configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) in the deployment environment."
      });
    }
    console.warn("[Auth] Supabase recovery email failed; attempting SMTP fallback", {
      email: normalizedEmail,
      code: recoverTrpcError.code,
      message: recoverTrpcError.message
    });
  }
  try {
    await sendGeneratedLinkThroughSmtp("fallback");
    return genericResponse;
  } catch (fallbackError) {
    const safeError = toTrpcError(fallbackError, "Unable to send the password reset email.");
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
    if (!isConfiguredAdminEmail(normalizedEmail)) {
      console.error("[Auth] Rejected password update for non-admin recovery token", { email: normalizedEmail, configuredAdminEmails: ADMIN_EMAILS });
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "This reset link is not for the configured Eby\u2019s Place administrator." });
    }
    const updated = await supabaseAuthFetch("/user", {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({ password })
    });
    await upsertUser({
      openId: updated.id || user.id,
      email: PRIMARY_ADMIN_EMAIL,
      name: getDisplayName(updated.id ? updated : user, PRIMARY_ADMIN_EMAIL),
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
    const role = isConfiguredAdminEmail(normalizedEmail) ? "admin" : "user";
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
var serviceCategory = z3.enum(["Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"]);
var bookingStatus = z3.enum(["pending", "confirmed", "completed", "cancelled"]);
var reviewStatus = z3.enum(["approved", "rejected"]);
var orderStatus = z3.enum(["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
var productStockStatus = z3.enum(["in_stock", "low_stock", "out_of_stock"]);
var productCategory = z3.enum(["Accessories", "Aftercare", "Hair Attachments"]);
var galleryCategory = z3.enum(["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
var activityStatus = z3.enum(["success", "failed", "pending", "info"]);
var bookingAddOnInput = z3.object({
  id: z3.string().min(2),
  name: z3.string().min(2),
  price: z3.string().regex(/^\d+(\.\d{2})?$/)
}).strict();
var bookingProductInput = z3.object({
  productId: z3.number(),
  productName: z3.string().min(2),
  quantity: z3.number().int().positive(),
  unitPrice: z3.string().regex(/^\d+(\.\d{2})?$/)
}).strict();
var bookingInput = z3.object({
  serviceId: z3.number().optional(),
  serviceLocation: z3.enum(["studio", "home_service"]).default("studio"),
  serviceName: z3.string().min(2),
  clientName: z3.string().min(2),
  clientEmail: z3.string().email(),
  clientPhone: z3.string().min(6),
  addressLine1: z3.string().optional(),
  addressLine2: z3.string().optional(),
  city: z3.string().optional(),
  county: z3.string().optional(),
  postcode: z3.string().optional().default(""),
  deliveryNote: z3.string().optional(),
  appointmentDate: z3.string().min(8),
  appointmentTime: z3.string().min(4),
  addOns: z3.array(bookingAddOnInput).default([]),
  bookingProducts: z3.array(bookingProductInput).default([])
});
var orderInput = z3.object({
  customerName: z3.string().min(2),
  customerEmail: z3.string().email(),
  customerPhone: z3.string().optional(),
  addressLine1: z3.string().optional(),
  addressLine2: z3.string().optional(),
  city: z3.string().optional(),
  county: z3.string().optional(),
  postcode: z3.string().optional().default(""),
  deliveryNote: z3.string().optional(),
  items: z3.array(z3.object({
    productId: z3.number(),
    variantId: z3.number().optional(),
    productName: z3.string().min(2),
    variantName: z3.string().optional(),
    quantity: z3.number().int().positive(),
    unitPrice: z3.string().regex(/^\d+(\.\d{2})?$/)
  })).min(1)
});
function getLiveStripeSecretKey() {
  const candidates = [
    normalizeSecretKey(process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY),
    normalizeSecretKey(process.env.STRIPE_SECRET_KEY)
  ];
  return candidates.find((key) => key.startsWith("sk_live_")) || candidates.find(Boolean) || "";
}
function getLiveStripePublishableKey() {
  const candidates = [
    normalizeSecretKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    normalizeSecretKey(process.env.VITE_EBYSPLACE_LIVE_STRIPE_PUBLISHABLE_KEY),
    normalizeSecretKey(process.env.VITE_STRIPE_PUBLISHABLE_KEY)
  ];
  return candidates.find((key) => key.startsWith("pk_live_")) || candidates.find(Boolean) || "";
}
var CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE = "Payment is currently unavailable. Please contact us to complete your booking.";
function paymentUnavailableError() {
  return new TRPCError4({ code: "PRECONDITION_FAILED", message: CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE });
}
function getStripe() {
  const key = getLiveStripeSecretKey();
  if (!key) {
    console.warn("[Payments] Live payment checkout attempted without a configured secret key. Configure EBYSPLACE_LIVE_STRIPE_SECRET_KEY in deployment settings.");
    throw paymentUnavailableError();
  }
  if (!key.startsWith("sk_live_")) {
    console.warn("[Payments] Live payment checkout attempted without a live secret key. Configure EBYSPLACE_LIVE_STRIPE_SECRET_KEY in deployment settings.");
    throw paymentUnavailableError();
  }
  return new Stripe2(key);
}
function stripeConfigurationLogMessage(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 0;
  if (code === "api_key_expired") {
    return "Stripe secret key has expired. Replace STRIPE_SECRET_KEY / EBYSPLACE_LIVE_STRIPE_SECRET_KEY in Vercel.";
  }
  if (code === "api_key_invalid" || statusCode === 401) {
    return "Stripe secret key is invalid. Verify STRIPE_SECRET_KEY / EBYSPLACE_LIVE_STRIPE_SECRET_KEY in Vercel.";
  }
  if (code === "secret_key_required" || /api key/i.test(String(error?.message || ""))) {
    return "Stripe secret key is missing. Configure STRIPE_SECRET_KEY / EBYSPLACE_LIVE_STRIPE_SECRET_KEY in Vercel.";
  }
  return "";
}
function logStripeCheckoutFailure(context, error) {
  const configurationMessage = stripeConfigurationLogMessage(error);
  if (configurationMessage) {
    console.error(`[Payments] ${context}: ${configurationMessage}`, error);
    return;
  }
  console.error(`[Payments] ${context}`, error);
}
function getLivePaymentMode() {
  return { stripeMode: "live", publishableKeyConfigured: Boolean(getLiveStripePublishableKey().startsWith("pk_live_")) };
}
function getOrigin(req) {
  const origin = req.headers.origin;
  return typeof origin === "string" ? origin : "http://localhost:3000";
}
function normalizeTrackingPath(pathOrUrl) {
  const raw = (pathOrUrl || "/").trim();
  if (!raw) return "/";
  try {
    const parsed = new URL(raw, "https://www.ebysplace.com");
    return parsed.pathname || "/";
  } catch {
    return raw.split(/[?#]/)[0] || "/";
  }
}
function isAdminTrackingPath(pathOrUrl) {
  const pathname = normalizeTrackingPath(pathOrUrl).toLowerCase();
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
async function notifyOwnerSafely(title, content) {
  try {
    await notifyOwner({ title, content });
  } catch (error) {
    console.warn("[Notification] Owner notification skipped", error);
  }
}
async function logAdminActivity(ctx, input) {
  await logActivity({
    request: ctx.req,
    userId: ctx.user?.id ?? null,
    userName: ctx.user?.name ?? null,
    userEmail: ctx.user?.email ?? null,
    activityType: input.activityType,
    activityCategory: "admin_action",
    description: input.description,
    pageUrl: "/admin",
    status: input.status ?? "success",
    relatedEntityType: input.relatedEntityType ?? "admin",
    relatedEntityId: input.relatedEntityId ?? null,
    metadata: input.metadata,
    sourceApp: "ebysplace"
  });
}
function formatBookingExtras(input) {
  const addOns = input.addOns?.length ? input.addOns.map((item) => `${item.name} (\xA3${item.price})`).join(", ") : "None selected";
  const bookingProducts = input.bookingProducts?.length ? input.bookingProducts.map((item) => `${item.quantity} \xD7 ${item.productName} (\xA3${item.unitPrice})`).join(", ") : "None selected";
  return { addOns, bookingProducts };
}
function buildBookingNote(input) {
  const extras = formatBookingExtras(input);
  return [
    input.deliveryNote?.trim() ? input.deliveryNote.trim() : void 0,
    `Service location: ${input.serviceLocation === "home_service" ? "Home Service" : "Visit the Studio"}`,
    input.homeServiceSurcharge && Number(input.homeServiceSurcharge) > 0 ? `Home service surcharge: \xA3${input.homeServiceSurcharge}` : void 0,
    `Optional add-ons: ${extras.addOns}`,
    `Optional shop products for appointment order: ${extras.bookingProducts}`
  ].filter(Boolean).join("\n");
}
function poundsToMinorUnits(value) {
  return Math.round(Number(value || 0) * 100);
}
function buildBookingCheckoutLineItems(input) {
  return [
    { price_data: { currency: "gbp", unit_amount: 2e3, product_data: { name: "Eby\u2019s Place \xA320 non-refundable booking deposit", description: `Deposit for ${input.serviceName}` } }, quantity: 1 },
    ...(input.addOns || []).map((item) => ({
      price_data: { currency: "gbp", unit_amount: poundsToMinorUnits(item.price), product_data: { name: `Add-on: ${item.name}`, description: "Selected Eby\u2019s Place appointment add-on" } },
      quantity: 1
    })),
    ...(input.bookingProducts || []).map((item) => ({
      price_data: { currency: "gbp", unit_amount: poundsToMinorUnits(item.unitPrice), product_data: { name: item.productName, description: "Eby\u2019s Place shop product added to appointment checkout" } },
      quantity: item.quantity
    }))
  ];
}
function bookingExtrasTotal(input) {
  const addOnsTotal = (input.addOns || []).reduce((sum, item) => sum + Number(item.price), 0);
  const productsTotal = (input.bookingProducts || []).reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  return addOnsTotal + productsTotal;
}
function decodeDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new TRPCError4({ code: "BAD_REQUEST", message: "Upload must be a base64 data URL." });
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}
var ALLOWED_ADMIN_IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
var ALLOWED_ADMIN_IMAGE_MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
function extensionFromFileName(fileName) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}
async function uploadDataUrlAsset(input) {
  const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
  const extension = extensionFromFileName(input.fileName);
  const normalizedMimeType = mimeType.toLowerCase();
  if (!ALLOWED_ADMIN_IMAGE_EXTENSIONS.has(extension) || !ALLOWED_ADMIN_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    throw new TRPCError4({ code: "BAD_REQUEST", message: "Allowed image formats: jpg, jpeg, png, webp, heic, heif." });
  }
  if (extension === "heic" || extension === "heif" || normalizedMimeType === "image/heic" || normalizedMimeType === "image/heif") {
    throw new TRPCError4({ code: "BAD_REQUEST", message: "HEIC/HEIF files must be converted to JPG or WebP before upload." });
  }
  if (buffer.byteLength > 7 * 1024 * 1024) {
    throw new TRPCError4({ code: "PAYLOAD_TOO_LARGE", message: "Please upload an image smaller than 7MB." });
  }
  let normalizedExtension = "png";
  if (mimeType.includes("jpeg")) normalizedExtension = "jpg";
  else if (mimeType.includes("webp")) normalizedExtension = "webp";
  else {
    const mimeExtension = mimeType.split("/")[1];
    if (mimeExtension) normalizedExtension = mimeExtension;
  }
  const baseName = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || "upload";
  const uploaded = await storagePut(`${input.folder}/${Date.now()}-${baseName}.${normalizedExtension}`, buffer, mimeType);
  return { url: uploaded.url, key: uploaded.key, mimeType };
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(z3.object({ email: z3.string().email(), password: z3.string().min(8) })).mutation(async ({ input, ctx }) => {
      const result = await signInAdminWithPassword(input.email, input.password);
      await logActivity({
        request: ctx.req,
        userName: result.user?.name || null,
        userEmail: result.user?.email || null,
        activityType: "admin_login",
        activityCategory: "admin_auth",
        description: "Admin login successful",
        pageUrl: "/admin/login",
        status: "success",
        relatedEntityType: "admin_user",
        relatedEntityId: result.user?.openId || null,
        sourceApp: "ebysplace"
      });
      return result;
    }),
    requestPasswordReset: publicProcedure.input(z3.object({ email: z3.string().email(), origin: z3.string().url() })).mutation(({ input }) => requestAdminPasswordReset(input.email, input.origin)),
    updatePassword: publicProcedure.input(z3.object({ accessToken: z3.string().min(20), password: z3.string().min(8) })).mutation(({ input }) => updateAdminPasswordWithRecoveryToken(input.accessToken, input.password)),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await logActivity({
        request: ctx.req,
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.name ?? null,
        userEmail: ctx.user?.email ?? null,
        activityType: "user_logout",
        activityCategory: "auth",
        description: ctx.user?.role === "admin" ? "Admin logout" : "User logout",
        pageUrl: "/admin",
        status: "info",
        sourceApp: "ebysplace"
      });
      return { success: true };
    })
  }),
  public: router({
    services: publicProcedure.input(z3.object({ category: serviceCategory.optional() }).optional()).query(({ input }) => listServices(input?.category)),
    featuredServices: publicProcedure.query(() => listFeaturedServices()),
    products: publicProcedure.query(() => listProducts()),
    availability: publicProcedure.query(() => getAvailabilitySettings()),
    paymentMode: publicProcedure.query(() => getLivePaymentMode()),
    instagramSettings: publicProcedure.query(() => getInstagramSettings()),
    websiteSections: publicProcedure.query(() => listWebsiteSections()),
    reviews: publicProcedure.query(() => listApprovedReviews()),
    productReviewSummaries: publicProcedure.query(() => listProductReviewSummaries()),
    productReviews: publicProcedure.input(z3.object({ productId: z3.number().int().positive() })).query(({ input }) => listApprovedProductReviews(input.productId)),
    gallery: publicProcedure.input(z3.object({ category: z3.string().optional() }).optional()).query(({ input }) => listGallery(input?.category)),
    newsletter: publicProcedure.input(z3.object({ email: z3.string().email(), productAlerts: z3.boolean().default(false) })).mutation(async ({ input }) => {
      const result = await subscribeNewsletter(input.email, input.productAlerts);
      await logActivity({
        activityType: "newsletter_signup",
        activityCategory: "newsletter",
        description: `Newsletter signup: ${input.email}`,
        status: "success",
        pageUrl: "/",
        userEmail: input.email,
        metadata: { productAlerts: input.productAlerts }
      });
      await Promise.allSettled([
        sendNewsletterWelcomeEmailSafely({ to: input.email, productAlerts: input.productAlerts }),
        notifyOwnerSafely(
          "New Eby\u2019s Place newsletter signup",
          `${input.email} joined Eby\u2019s Place updates${input.productAlerts ? " with product alerts" : ""}.`
        )
      ]);
      return { ...result, customerNotification: "You\u2019re subscribed to Eby\u2019s Place updates." };
    }),
    submitReview: publicProcedure.input(z3.object({ customerName: z3.string().min(2), rating: z3.number().min(1).max(5), reviewText: z3.string().min(10) })).mutation(async ({ input }) => {
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
    submitProductReview: publicProcedure.input(z3.object({ productId: z3.number().int().positive(), customerName: z3.string().min(2), rating: z3.number().min(1).max(5), reviewText: z3.string().min(10) })).mutation(async ({ input }) => {
      const review = await submitProductReview(input);
      await notifyOwnerSafely(
        "New product review submitted",
        [
          `A customer submitted a product review for moderation.`,
          `Product ID: ${input.productId}`,
          `Customer: ${input.customerName}`,
          `Rating: ${input.rating}/5`,
          `Status: ${review.status}`
        ].join("\n")
      );
      return { ...review, customerNotification: "Thank you for your review. It has been received and is pending approval." };
    }),
    createBooking: publicProcedure.input(bookingInput).mutation(async ({ input }) => {
      const { addOns, bookingProducts, ...bookingFields } = input;
      const serviceLocation = input.serviceLocation || "studio";
      const settings = await getAvailabilitySettings();
      const homeServiceSurcharge = serviceLocation === "home_service" ? Number(settings.homeServiceSurcharge || 0).toFixed(2) : "0.00";
      if (serviceLocation === "home_service") {
        const missing = [input.clientName, input.addressLine1, input.city, input.county].some((value) => !value?.trim());
        if (missing) throw new TRPCError4({ code: "BAD_REQUEST", message: "Home Service bookings require the customer name, address line 1, city, and county. Postcode is optional." });
      }
      const sanitizedBookingFields = serviceLocation === "studio" ? { ...bookingFields, serviceLocation, addressLine1: "Studio visit", addressLine2: null, city: "Studio", county: null, postcode: "STUDIO", homeServiceSurcharge } : { ...bookingFields, serviceLocation, addressLine1: input.addressLine1.trim(), addressLine2: input.addressLine2?.trim() || null, city: input.city.trim(), county: input.county?.trim() || null, postcode: input.postcode?.trim() || "", homeServiceSurcharge };
      const bookingNote = buildBookingNote({ ...input, serviceLocation, homeServiceSurcharge });
      if (await isBookingSlotBlocked(input.appointmentDate, input.appointmentTime)) {
        throw new TRPCError4({ code: "BAD_REQUEST", message: "That date or time has been blocked by Eby\u2019s Place. Please choose another slot." });
      }
      const booking = await createBooking({ ...sanitizedBookingFields, deliveryNote: bookingNote, status: "pending", depositStatus: "unpaid" });
      const extras = formatBookingExtras({ addOns, bookingProducts });
      await notifyOwnerSafely(
        "New Eby\u2019s Place booking request",
        [
          `A customer has submitted a booking request and needs to complete the \xA320 secure deposit.`,
          `Booking ID: ${booking.id}`,
          `Service: ${input.serviceName}`,
          `Customer: ${input.clientName}`,
          `Email: ${input.clientEmail}`,
          `Phone: ${input.clientPhone}`,
          `Appointment: ${input.appointmentDate} at ${input.appointmentTime}`,
          `Location type: ${serviceLocation === "home_service" ? "Home Service" : "Visit the Studio"}`,
          serviceLocation === "home_service" ? `Customer address: ${[input.addressLine1, input.addressLine2, input.city, input.county, input.postcode].filter(Boolean).join(", ")}` : void 0,
          serviceLocation === "home_service" ? `Home service surcharge: \xA3${homeServiceSurcharge}` : void 0,
          `Optional add-ons: ${extras.addOns}`,
          `Optional shop products: ${extras.bookingProducts}`,
          input.deliveryNote ? `Notes: ${input.deliveryNote}` : void 0
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.clientPhone,
        body: `Eby\u2019s Place received your ${input.serviceName} booking request for ${input.appointmentDate} at ${input.appointmentTime}. Please complete the \xA320 secure deposit on the website to secure it. Optional add-ons/products are recorded only when selected.`
      });
      return { bookingId: booking.id, depositAmount: 20, homeServiceSurcharge: Number(homeServiceSurcharge), depositCurrency: "GBP", serviceLocation, message: "A \xA320 non-refundable deposit is required to secure your Eby\u2019s Place appointment. You will receive on-screen confirmation after payment is confirmed.", customerNotification: "Your Eby\u2019s Place booking request has been received. Add-ons and shop products are optional, and you can complete the secure deposit payment now." };
    }),
    createDepositCheckout: publicProcedure.input(z3.object({
      bookingId: z3.number(),
      clientEmail: z3.string().email(),
      clientName: z3.string().min(2),
      serviceName: z3.string().min(2),
      addOns: z3.array(bookingAddOnInput).default([]),
      bookingProducts: z3.array(bookingProductInput).default([])
    })).mutation(async ({ input, ctx }) => {
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const booking = await getBookingById(input.bookingId);
      const homeServiceSurcharge = Number(booking?.homeServiceSurcharge || 0);
      const extrasTotal = bookingExtrasTotal(input);
      const lineItems = buildBookingCheckoutLineItems({
        serviceName: input.serviceName,
        addOns: input.addOns,
        bookingProducts: input.bookingProducts
      });
      let session;
      try {
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: input.clientEmail,
          client_reference_id: input.bookingId.toString(),
          payment_intent_data: { receipt_email: input.clientEmail, description: `Eby\u2019s Place booking deposit for ${input.serviceName}`, statement_descriptor_suffix: "EBYSPLACE" },
          custom_text: { submit: { message: "You are paying Eby\u2019s Place securely. Your booking deposit confirmation and receipt will use the email entered for checkout." } },
          line_items: lineItems,
          allow_promotion_codes: true,
          success_url: `${origin}/booking/success?booking=${input.bookingId}`,
          cancel_url: `${origin}/booking?payment=cancelled&booking=${input.bookingId}`,
          metadata: { booking_id: input.bookingId.toString(), customer_email: input.clientEmail, customer_name: input.clientName, service_name: input.serviceName, deposit_type: "non_refundable_20_gbp", service_location: booking?.serviceLocation || "studio", home_service_surcharge: homeServiceSurcharge.toFixed(2), booking_extras_total: extrasTotal.toFixed(2) }
        });
      } catch (error) {
        logStripeCheckoutFailure("Booking checkout session creation failed", error);
        throw paymentUnavailableError();
      }
      if (!session.url) throw paymentUnavailableError();
      await updateBookingCheckout(input.bookingId, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
      return { checkoutUrl: session.url, bookingId: input.bookingId };
    }),
    createOrder: publicProcedure.input(orderInput).mutation(async ({ input, ctx }) => {
      if (!input.addressLine1?.trim() || !input.city?.trim()) {
        throw new TRPCError4({ code: "BAD_REQUEST", message: "Shop orders require delivery address line 1 and city. Postcode is optional." });
      }
      const order = await createOrderWithItems(input);
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const orderId = order.id.toString();
      let session;
      try {
        session = await stripe.checkout.sessions.create({
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
      } catch (error) {
        logStripeCheckoutFailure("Shop checkout session creation failed", error);
        throw paymentUnavailableError();
      }
      if (!session.url) throw paymentUnavailableError();
      await updateOrderCheckout(order.id, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
      await notifyOwnerSafely(
        "New Eby\u2019s Place shop order checkout started",
        [
          `A customer started secure checkout for a shop order.`,
          `Order ID: ${order.id}`,
          `Customer: ${input.customerName}`,
          `Email: ${input.customerEmail}`,
          input.customerPhone ? `Phone: ${input.customerPhone}` : void 0,
          `Items: ${order.items.map((item) => `${item.quantity} \xD7 ${item.variantName ? `${item.productName} \u2014 ${item.variantName}` : item.productName}`).join(", ")}`
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.customerPhone,
        body: `Eby\u2019s Place has prepared your secure checkout for order #${order.id}. Please complete secure payment in the browser tab to confirm your order.`
      });
      return { orderId: order.id, checkoutUrl: session.url, status: "pending_payment", message: "Your secure Eby\u2019s Place checkout is ready.", customerNotification: "Your Eby\u2019s Place order checkout is ready. Please complete secure payment to confirm the order." };
    }),
    uploadTryOnPhoto: publicProcedure.input(z3.object({ dataUrl: z3.string().min(50), fileName: z3.string().default("try-on-photo.jpg") })).mutation(async ({ input }) => {
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
    generateTryOn: publicProcedure.input(z3.object({
      styleName: z3.string().min(2),
      originalImageUrl: z3.string().min(5),
      originalImageKey: z3.string().min(3).optional(),
      mimeType: z3.string().optional(),
      gender: z3.enum(["woman", "man", "child"]).optional(),
      ageGroup: z3.enum(["child", "teen", "adult", "mature"]).optional()
    })).mutation(async ({ input }) => {
      const record = await createTryOnGeneration({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, status: "pending" });
      try {
        const selectedStyle = input.styleName;
        const ebysPlaceTryOnPromptTemplate = "Eby\u2019s Place AI hairstyle try-on: apply hairstyle {{STYLE_NAME}} only to the customer\u2019s hair area in the uploaded image. Preserve the customer\u2019s exact face and identity with zero changes. Do not change or retouch the face, skin, facial features, expression, age, body, clothing, pose, camera angle, lighting, or background. Keep the person exactly the same and generate a realistic result where only the hairstyle is changed to {{STYLE_NAME}}.";
        const prompt = ebysPlaceTryOnPromptTemplate.replaceAll("{{STYLE_NAME}}", selectedStyle);
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
            `Style: ${input.styleName}`,
            input.gender ? `Gender: ${input.gender}` : void 0,
            input.ageGroup ? `Age group: ${input.ageGroup}` : void 0
          ].filter(Boolean).join("\n")
        );
        return { id: record.id, generatedImageUrl: result.url, status: "completed", customerNotification: "Your Eby\u2019s Place AI Try-On preview is ready." };
      } catch (error) {
        const message = error instanceof Error ? error.message : "The AI could not read that photo clearly. Please upload a bright front-facing JPEG, PNG, WebP, or iPhone HEIC portrait where the face and hair are visible.";
        await updateTryOnGeneration(record.id, { status: "failed", errorMessage: message });
        throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
    track: publicProcedure.input(z3.object({
      eventName: z3.string().min(2),
      pagePath: z3.string().min(1),
      metadata: z3.unknown().optional(),
      sessionId: z3.string().max(128).optional(),
      activityType: z3.string().max(120).optional(),
      activityCategory: z3.string().max(120).optional(),
      status: activityStatus.optional(),
      description: z3.string().max(500).optional(),
      relatedEntityType: z3.string().max(80).optional(),
      relatedEntityId: z3.union([z3.string(), z3.number()]).optional(),
      sourceApp: z3.string().max(80).optional()
    })).mutation(({ input, ctx }) => {
      if (isAdminTrackingPath(input.pagePath)) return { success: true, skipped: true };
      return recordAnalytics(input.eventName, normalizeTrackingPath(input.pagePath), input.metadata, {
        request: ctx.req,
        user: ctx.user ? { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email } : null,
        sessionId: input.sessionId,
        activityType: input.activityType,
        activityCategory: input.activityCategory,
        status: input.status,
        description: input.description,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        sourceApp: input.sourceApp
      });
    }),
    logActivity: publicProcedure.input(z3.object({
      sessionId: z3.string().max(128).optional(),
      activityType: z3.string().min(2).max(120),
      activityCategory: z3.string().min(2).max(120),
      description: z3.string().min(2).max(500),
      pageUrl: z3.string().max(800).optional(),
      metadata: z3.unknown().optional(),
      status: activityStatus.default("info"),
      relatedEntityType: z3.string().max(80).optional(),
      relatedEntityId: z3.union([z3.string(), z3.number()]).optional(),
      sourceApp: z3.string().max(80).default("ebysplace"),
      userName: z3.string().max(180).optional(),
      userEmail: z3.string().email().max(320).optional(),
      country: z3.string().max(120).optional(),
      city: z3.string().max(120).optional(),
      region: z3.string().max(120).optional(),
      deviceType: z3.string().max(40).optional(),
      browser: z3.string().max(80).optional(),
      userAgent: z3.string().max(500).optional()
    })).mutation(async ({ input, ctx }) => {
      const normalizedPageUrl = normalizeTrackingPath(input.pageUrl || "/");
      if (isAdminTrackingPath(normalizedPageUrl)) return { success: true, skipped: true };
      const activityType = input.activityType;
      const shouldThrottle = await shouldThrottlePublicActivity({
        sessionId: input.sessionId ?? null,
        activityType,
        pageUrl: normalizedPageUrl,
        sourceApp: input.sourceApp
      });
      if (shouldThrottle) return { success: true, skipped: true };
      await logActivity({
        request: ctx.req,
        userId: ctx.user?.id ?? null,
        userName: input.userName ?? ctx.user?.name ?? null,
        userEmail: input.userEmail ?? ctx.user?.email ?? null,
        sessionId: input.sessionId,
        activityType: input.activityType,
        activityCategory: input.activityCategory,
        description: input.description,
        pageUrl: normalizedPageUrl,
        metadata: input.metadata,
        status: input.status,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        sourceApp: input.sourceApp,
        country: input.country,
        city: input.city,
        region: input.region,
        deviceType: input.deviceType,
        browser: input.browser,
        userAgent: input.userAgent
      });
      return { success: true };
    })
  }),
  admin: router({
    summary: adminProcedure.query(() => adminSummary()),
    lists: adminProcedure.query(() => adminLists()),
    listEmailNotificationLogs: adminProcedure.query(() => listEmailNotificationLogs()),
    listActivityLogs: adminProcedure.input(z3.object({
      query: z3.string().optional(),
      datePreset: z3.enum(["today", "yesterday", "last_7_days", "last_30_days"]).optional(),
      activityType: z3.string().optional(),
      activityCategory: z3.string().optional(),
      user: z3.string().optional(),
      status: activityStatus.optional(),
      sourceApp: z3.string().optional(),
      failedOnly: z3.boolean().optional(),
      unreadOnly: z3.boolean().optional(),
      limit: z3.number().int().min(1).max(500).optional()
    }).optional()).query(({ input }) => listActivityLogs(input || {})),
    unreadActivityCount: adminProcedure.query(() => unreadActivityCount()),
    markActivityLogsRead: adminProcedure.input(z3.object({ ids: z3.array(z3.number().int().positive()).optional() }).optional()).mutation(({ input }) => markActivityLogsRead(input?.ids)),
    notificationDiagnostics: adminProcedure.query(() => getNotificationDiagnostics()),
    moderateReview: adminProcedure.input(z3.object({ id: z3.number(), status: reviewStatus })).mutation(({ input }) => moderateReview(input.id, input.status)),
    moderateProductReview: adminProcedure.input(z3.object({ id: z3.number(), status: reviewStatus })).mutation(({ input }) => moderateProductReview(input.id, input.status)),
    updateBookingStatus: adminProcedure.input(z3.object({ id: z3.number(), status: bookingStatus })).mutation(async ({ input, ctx }) => {
      const result = await updateBookingStatus(input.id, input.status);
      await logAdminActivity(ctx, {
        activityType: "admin_booking_status_changed",
        description: `Admin changed booking #${input.id} status to ${input.status}`,
        relatedEntityType: "booking",
        relatedEntityId: input.id
      });
      return result;
    }),
    updateOrderStatus: adminProcedure.input(z3.object({ id: z3.number(), status: orderStatus })).mutation(async ({ input, ctx }) => {
      const result = await updateOrderStatus(input.id, input.status);
      await logAdminActivity(ctx, {
        activityType: "admin_order_status_changed",
        description: `Admin changed order #${input.id} status to ${input.status}`,
        relatedEntityType: "order",
        relatedEntityId: input.id
      });
      return result;
    }),
    blockAvailabilitySlot: adminProcedure.input(z3.object({ date: z3.string().min(4), time: z3.string().optional(), reason: z3.string().optional() })).mutation(({ input }) => blockBookingSlot(input)),
    unblockAvailabilitySlot: adminProcedure.input(z3.object({ date: z3.string().min(4), time: z3.string().optional() })).mutation(({ input }) => unblockBookingSlot(input)),
    updateInstagramSettings: adminProcedure.input(z3.object({ handle: z3.string().min(2), feedUrl: z3.string().url(), enabled: z3.boolean(), note: z3.string().optional() })).mutation(({ input }) => updateInstagramSettings(input)),
    updateHomeServiceSurcharge: adminProcedure.input(z3.object({ homeServiceSurcharge: z3.string().regex(/^\d+(\.\d{2})?$/) })).mutation(({ input }) => updateHomeServiceSurcharge(input.homeServiceSurcharge)),
    sendReviewRequest: adminProcedure.input(z3.object({ bookingId: z3.number() })).mutation(async ({ input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking) throw new TRPCError4({ code: "NOT_FOUND", message: "Booking not found." });
      await sendReviewRequestEmailSafely({ to: booking.clientEmail, customerName: booking.clientName, bookingId: booking.id, serviceName: booking.serviceName, reviewUrl: `/reviews?booking=${booking.id}` });
      return { success: true };
    }),
    resendEmailNotification: adminProcedure.input(z3.object({ logId: z3.number().int().positive() })).mutation(async ({ input }) => {
      try {
        const result = await resendEmailNotificationLog(input.logId);
        return { success: result.status === "sent" || result.status === "retried", result };
      } catch (error) {
        throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Email resend failed." });
      }
    }),
    updateService: adminProcedure.input(z3.object({ id: z3.number(), name: z3.string().min(2).optional(), description: z3.string().min(10).optional(), duration: z3.string().min(2).optional(), priceFrom: z3.string().regex(/^\d+(\.\d{2})?$/).optional(), badge: z3.string().optional(), imageUrl: z3.string().min(5).optional(), isBookable: z3.enum(["true", "false"]).optional(), isFeatured: z3.enum(["true", "false"]).optional() })).mutation(async ({ input, ctx }) => {
      const { id, ...changes } = input;
      const result = await updateService(id, changes);
      await logAdminActivity(ctx, {
        activityType: "admin_service_updated",
        description: `Admin updated service #${id}`,
        relatedEntityType: "service",
        relatedEntityId: id,
        metadata: changes
      });
      return result;
    }),
    createProduct: adminProcedure.input(z3.object({ name: z3.string().min(2), slug: z3.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), seoTitle: z3.string().min(8).max(255).optional(), seoDescription: z3.string().min(30).max(320).optional(), category: productCategory, description: z3.string().min(10), price: z3.string().regex(/^\d+(\.\d{2})?$/), imageUrl: z3.string().min(5).optional(), badge: z3.string().optional(), stockStatus: productStockStatus.default("in_stock"), stockQuantity: z3.number().int().min(0).default(0), isFeatured: z3.enum(["true", "false"]).default("false"), variants: z3.array(z3.object({ name: z3.string().min(1), colourHex: z3.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), imageUrl: z3.string().min(5).optional(), stockQuantity: z3.number().int().min(0).default(0) })).default([]) })).mutation(async ({ input, ctx }) => {
      const { variants, ...product } = input;
      const result = await createProduct(product, variants);
      await logAdminActivity(ctx, {
        activityType: "admin_product_created",
        description: `Admin created product ${input.name}`,
        relatedEntityType: "product",
        relatedEntityId: result?.id ?? null
      });
      return result;
    }),
    updateProduct: adminProcedure.input(z3.object({ id: z3.number().int().positive(), name: z3.string().min(2).optional(), slug: z3.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), seoTitle: z3.string().min(8).max(255).optional(), seoDescription: z3.string().min(30).max(320).optional(), category: productCategory.optional(), description: z3.string().min(10).optional(), price: z3.string().regex(/^\d+(\.\d{2})?$/).optional(), imageUrl: z3.string().min(5).optional(), badge: z3.string().optional(), stockStatus: productStockStatus.optional(), stockQuantity: z3.number().int().min(0).optional(), isFeatured: z3.enum(["true", "false"]).optional() })).mutation(async ({ input, ctx }) => {
      const { id, ...changes } = input;
      const result = await updateProduct(id, changes);
      await logAdminActivity(ctx, {
        activityType: "admin_product_updated",
        description: `Admin updated product #${id}`,
        relatedEntityType: "product",
        relatedEntityId: id,
        metadata: changes
      });
      return result;
    }),
    updateProductStock: adminProcedure.input(z3.object({ id: z3.number().int().positive(), stockQuantity: z3.number().int().min(0), stockStatus: productStockStatus })).mutation(async ({ input, ctx }) => {
      const result = await updateProductStock(input.id, input.stockQuantity, input.stockStatus);
      await logAdminActivity(ctx, {
        activityType: "admin_product_stock_updated",
        description: `Admin updated stock for product #${input.id}`,
        relatedEntityType: "product",
        relatedEntityId: input.id,
        metadata: { stockQuantity: input.stockQuantity, stockStatus: input.stockStatus }
      });
      return result;
    }),
    updateProductVariants: adminProcedure.input(z3.object({ productId: z3.number().int().positive(), variants: z3.array(z3.object({ name: z3.string().min(1), colourHex: z3.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), imageUrl: z3.string().min(5).optional(), stockQuantity: z3.number().int().min(0).default(0) })) })).mutation(({ input }) => replaceProductVariants(input.productId, input.variants)),
    deleteProduct: adminProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const result = await deleteProduct(input.id);
      await logAdminActivity(ctx, {
        activityType: "admin_product_deleted",
        description: `Admin deleted product #${input.id}`,
        relatedEntityType: "product",
        relatedEntityId: input.id
      });
      return result;
    }),
    uploadProductImage: adminProcedure.input(z3.object({ productId: z3.number().int().positive().optional(), productName: z3.string().min(2), dataUrl: z3.string().min(50), fileName: z3.string().default("product-image.png") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.productName}-${input.fileName}`, folder: "products" });
      if (input.productId) await updateProduct(input.productId, { imageUrl: uploaded.url });
      return uploaded;
    }),
    clearProductImage: adminProcedure.input(z3.object({ productId: z3.number().int().positive(), imageUrl: z3.string().min(5).optional() })).mutation(async ({ input }) => {
      await updateProduct(input.productId, { imageUrl: null });
      return { success: true };
    }),
    insights: adminProcedure.query(() => adminInsights()),
    uploadServiceImage: adminProcedure.input(z3.object({ serviceId: z3.number(), serviceName: z3.string().min(2), dataUrl: z3.string().min(50), fileName: z3.string().default("service-image.png") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.serviceName}-${input.fileName}`, folder: "services" });
      await updateService(input.serviceId, { imageUrl: uploaded.url });
      return uploaded;
    }),
    clearServiceImage: adminProcedure.input(z3.object({ serviceId: z3.number(), imageUrl: z3.string().min(5).optional() })).mutation(async ({ input }) => {
      if (input.imageUrl) await storageRemove(input.imageUrl);
      await updateService(input.serviceId, { imageUrl: null });
      return { success: true };
    }),
    uploadGalleryImage: adminProcedure.input(z3.object({ dataUrl: z3.string().min(50), fileName: z3.string().default("gallery-image.png") })).mutation(async ({ input }) => uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: input.fileName, folder: "gallery" })),
    uploadWebsiteSectionImage: adminProcedure.input(z3.object({ sectionKey: z3.string().min(2), dataUrl: z3.string().min(50), fileName: z3.string().default("section-image.png"), imageRole: z3.enum(["main", "portrait"]).default("main") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.sectionKey}-${input.imageRole}-${input.fileName}`, folder: "website-sections" });
      await updateWebsiteSection(input.sectionKey, input.imageRole === "portrait" ? { portraitImageUrl: uploaded.url, imageUrl: uploaded.url } : { imageUrl: uploaded.url });
      return uploaded;
    }),
    clearWebsiteSectionImage: adminProcedure.input(z3.object({ sectionKey: z3.string().min(2), imageRole: z3.enum(["main", "portrait"]).default("main"), imageUrl: z3.string().min(5).optional() })).mutation(async ({ input }) => {
      if (input.imageUrl) await storageRemove(input.imageUrl);
      await updateWebsiteSection(input.sectionKey, input.imageRole === "portrait" ? { portraitImageUrl: null } : { imageUrl: null });
      return { success: true };
    }),
    addGalleryImage: adminProcedure.input(z3.object({ title: z3.string().min(2), category: galleryCategory, imageUrl: z3.string().min(5), altText: z3.string().min(5), isPublished: z3.enum(["true", "false"]).default("true"), sortOrder: z3.number().int().default(0) })).mutation(({ input }) => addGalleryImage(input)),
    deleteGalleryImage: adminProcedure.input(z3.object({ id: z3.number().int().positive(), imageUrl: z3.string().min(5).optional() })).mutation(async ({ input }) => {
      if (input.imageUrl) await storageRemove(input.imageUrl);
      return deleteGalleryImage(input.id);
    }),
    updateWebsiteSection: adminProcedure.input(z3.object({ sectionKey: z3.string().min(2), title: z3.string().min(2).optional(), eyebrow: z3.string().optional(), body: z3.string().optional(), ctaLabel: z3.string().optional(), ctaHref: z3.string().optional(), imageUrl: z3.string().optional(), portraitImageUrl: z3.string().optional(), portraitDescription: z3.string().optional(), isPublished: z3.enum(["true", "false"]).optional() })).mutation(async ({ input, ctx }) => {
      const { sectionKey, ...changes } = input;
      const result = await updateWebsiteSection(sectionKey, changes);
      await logAdminActivity(ctx, {
        activityType: "admin_content_updated",
        description: `Admin updated website section ${sectionKey}`,
        relatedEntityType: "website_section",
        relatedEntityId: sectionKey,
        metadata: changes
      });
      return result;
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
registerActivityCollector(app);
app.use("/api/trpc", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
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
