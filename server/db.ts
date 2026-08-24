import type { Request } from "express";
import { and, asc, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { normalizeEnvUrl, normalizeSecretKey, trimEnvValue } from "./_core/envSecrets";
import {
  analyticsEvents,
  activityLogs,
  bookings,
  emailNotificationLogs,
  galleryImages,
  InsertUser,
  newsletterSubscribers,
  orderItems,
  orders,
  productReviews,
  productVariants,
  products,
  reviews,
  services,
  tryOnAccounts,
  tryOnGenerations,
  users,
  websiteSections,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _pool: Pool | null = null;
let _db: any | null = null;

let _seeded = false;
let _seedingPromise: Promise<void> | null = null;
let _unsupportedDatabaseUrlWarned = false;
let _missingDatabaseUrlWarned = false;
let _databaseConnectionFailed = false;
let _lastDatabaseUrlFingerprint: string | null = null;

function isPostgresConnectionString(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return ["postgresql:", "postgres:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function requiresSsl(connectionString: string) {
  return /sslmode=require|ssl=true|supabase\.co/i.test(connectionString);
}

function getDatabaseUrl() {
  return trimEnvValue(process.env.DATABASE_URL);
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
    console.log("[Database] DATABASE_URL detected for PostgreSQL initialisation", {
      fingerprint,
      isPostgres: isPostgresConnectionString(connectionString),
      requiresSsl: requiresSsl(connectionString),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
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
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
        ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
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

type SupabaseProductRow = Record<string, any>;

type ProductVariantInput = { name: string; colourHex?: string; imageUrl?: string; stockQuantity: number };

type SupabaseColumnStyle = "camel" | "snake";

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

function cleanUndefinedValues<T extends Record<string, any>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

async function supabaseRest<T>(path: string, init: RequestInit = {}) {
  const config = getSupabaseRestConfig();
  if (!config) return { ok: false, status: 0, body: null as T | null, unavailable: true };
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body: T | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = text as T;
    }
  }
  if (!response.ok) console.warn("[Supabase Products] REST request failed", { path, status: response.status, body });
  return { ok: response.ok, status: response.status, body, unavailable: false };
}

function formatProductPrice(value: unknown) {
  const price = Number(value ?? 0);
  return Number.isFinite(price) ? price.toFixed(2) : "0.00";
}

function normalizeStockStatus(value: unknown, stockQuantity: number): "in_stock" | "low_stock" | "out_of_stock" {
  if (value === "in_stock" || value === "low_stock" || value === "out_of_stock") return value;
  if (value === "active" || value === "published" || value === "available") return stockQuantity > 0 ? "in_stock" : "out_of_stock";
  if (value === "inactive" || value === "draft" || value === "archived" || value === "disabled") return "out_of_stock";
  if (stockQuantity <= 0) return "out_of_stock";
  if (stockQuantity <= 10) return "low_stock";
  return "in_stock";
}

function normalizeFeaturedFlag(value: unknown) {
  return value === true || value === "true" || value === 1 ? "true" : "false";
}

function stockStatusAfterDecrement(stockQuantity: number, currentStatus?: unknown): "in_stock" | "low_stock" | "out_of_stock" {
  if (stockQuantity <= 0) return "out_of_stock";
  if (stockQuantity <= 10) return "low_stock";
  return currentStatus === "out_of_stock" ? "in_stock" : normalizeStockStatus(currentStatus, stockQuantity);
}

function normalizeSupabaseProduct(row: SupabaseProductRow, variants: SupabaseProductRow[] = []) {
  const id = Number(row.id);
  const stockQuantity = Number(row.stockQuantity ?? row.stock ?? 0);
  const stockStatus = normalizeStockStatus(row.stockStatus ?? row.status, Number.isFinite(stockQuantity) ? stockQuantity : 0);
  const imageUrl = row.imageUrl ?? row.image_url ?? null;
  const normalizedVariants = variants.map((variant) => {
    const variantId = Number(variant.id);
    const variantStock = Number(variant.stockQuantity ?? variant.stock ?? 0);
    return {
      ...variant,
      id: Number.isFinite(variantId) && variantId > 0 ? variantId : undefined,
      productId: Number(variant.productId ?? variant.product_id ?? id),
      name: String(variant.name ?? variant.colour ?? "Default"),
      colourHex: variant.colourHex ?? variant.colour_hex ?? variant.colour ?? "#c8a95a",
      imageUrl: variant.imageUrl ?? variant.image_url ?? null,
      stockQuantity: Number.isFinite(variantStock) ? variantStock : 0,
      stock: Number.isFinite(variantStock) ? variantStock : 0,
    };
  });
  const normalized = {
    ...row,
    id: Number.isFinite(id) && id > 0 ? id : undefined,
    name: String(row.name ?? "Untitled product"),
    slug: String(row.slug ?? row.name ?? "product").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    seoTitle: row.seoTitle ?? row.seo_title ?? `${row.name ?? "Product"} | Eby’s Place`,
    seoDescription: row.seoDescription ?? row.seo_description ?? row.description ?? "Eby’s Place shop product.",
    category: row.category ?? "Accessories",
    description: row.description ?? "Eby’s Place shop product.",
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
    variants: normalizedVariants,
  };
  return normalized;
}

async function getSupabaseProductColumnStyle(): Promise<SupabaseColumnStyle | null> {
  const result = await supabaseRest<SupabaseProductRow[]>("/rest/v1/products?select=*&limit=1");
  if (!result.ok || !Array.isArray(result.body)) return null;
  const first = result.body[0];
  if (first && ("image_url" in first || "stock" in first || "status" in first || "seo_title" in first)) return "snake";
  return "camel";
}

async function getSupabaseVariantTableName() {
  const camel = await supabaseRest<SupabaseProductRow[]>("/rest/v1/productVariants?select=*&limit=1");
  if (camel.ok) return "productVariants";
  const snake = await supabaseRest<SupabaseProductRow[]>("/rest/v1/product_variants?select=*&limit=1");
  if (snake.ok) return "product_variants";
  return null;
}

function supabaseProductPayload(input: Partial<typeof products.$inferInsert>, style: SupabaseColumnStyle) {
  const stockQuantity = Number(input.stockQuantity ?? 0);
  const base = {
    name: input.name,
    slug: input.slug,
    category: input.category,
    description: input.description,
    price: input.price,
    badge: input.badge,
  };
  if (style === "snake") {
    return cleanUndefinedValues({
      ...base,
      image_url: input.imageUrl,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
      stock: Number.isFinite(stockQuantity) ? stockQuantity : undefined,
      status: input.stockStatus,
      is_featured: input.isFeatured,
    });
  }
  return cleanUndefinedValues({
    ...base,
    imageUrl: input.imageUrl,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    stockQuantity: input.stockQuantity,
    stockStatus: input.stockStatus,
    isFeatured: input.isFeatured,
  });
}

function supabaseVariantPayload(variant: ProductVariantInput & { productId: number }, tableName: string) {
  if (tableName === "product_variants") {
    return cleanUndefinedValues({ product_id: variant.productId, name: variant.name, colour_hex: variant.colourHex, image_url: variant.imageUrl, stock: variant.stockQuantity });
  }
  return cleanUndefinedValues({ productId: variant.productId, name: variant.name, colourHex: variant.colourHex, imageUrl: variant.imageUrl, stockQuantity: variant.stockQuantity });
}

async function listSupabaseProducts() {
  const style = await getSupabaseProductColumnStyle();
  if (!style) return null;
  const productResult = await supabaseRest<SupabaseProductRow[]>("/rest/v1/products?select=*");
  if (!productResult.ok || !Array.isArray(productResult.body)) return null;
  const variantTable = await getSupabaseVariantTableName();
  const variantResult = variantTable ? await supabaseRest<SupabaseProductRow[]>(`/rest/v1/${variantTable}?select=*`) : { ok: false, body: [] as SupabaseProductRow[] };
  const variants = variantResult.ok && Array.isArray(variantResult.body) ? variantResult.body : [];
  return productResult.body
    .map((product) => normalizeSupabaseProduct(product, variants.filter((variant) => Number(variant.productId ?? variant.product_id) === Number(product.id))))
    .filter((product) => product.id && isPositivePrice(product.price))
    .sort((a, b) => (b.isFeatured === "true" ? 1 : 0) - (a.isFeatured === "true" ? 1 : 0) || a.name.localeCompare(b.name));
}

async function createSupabaseProduct(input: typeof products.$inferInsert, variants: ProductVariantInput[] = []) {
  const style = await getSupabaseProductColumnStyle();
  if (!style) return null;
  const result = await supabaseRest<SupabaseProductRow[]>("/rest/v1/products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(supabaseProductPayload(input, style)),
  });
  if (!result.ok || !Array.isArray(result.body) || !result.body[0]?.id) throw new Error("Supabase product could not be saved with a database id.");
  const product = normalizeSupabaseProduct(result.body[0]);
  if (product.id && variants.length) await replaceSupabaseProductVariants(product.id, variants);
  const refreshed = product.id ? await getSupabaseProductById(product.id) : null;
  return refreshed ?? product;
}

async function getSupabaseProductById(id: number) {
  const result = await supabaseRest<SupabaseProductRow[]>(`/rest/v1/products?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`);
  if (!result.ok || !Array.isArray(result.body) || !result.body[0]) return null;
  const variantTable = await getSupabaseVariantTableName();
  const variantResult = variantTable ? await supabaseRest<SupabaseProductRow[]>(`/rest/v1/${variantTable}?select=*&${variantTable === "product_variants" ? "product_id" : "productId"}=eq.${encodeURIComponent(String(id))}`) : { ok: false, body: [] as SupabaseProductRow[] };
  const variants = variantResult.ok && Array.isArray(variantResult.body) ? variantResult.body : [];
  return normalizeSupabaseProduct(result.body[0], variants);
}

async function updateSupabaseProduct(id: number, input: Partial<typeof products.$inferInsert>) {
  const style = await getSupabaseProductColumnStyle();
  if (!style) return null;
  const result = await supabaseRest<SupabaseProductRow[]>(`/rest/v1/products?id=eq.${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(supabaseProductPayload(input, style)),
  });
  if (!result.ok) throw new Error(`Supabase product ${id} could not be updated.`);
  return result.body && Array.isArray(result.body) && result.body[0] ? normalizeSupabaseProduct(result.body[0]) : await getSupabaseProductById(id);
}

async function replaceSupabaseProductVariants(productId: number, variants: ProductVariantInput[]) {
  const tableName = await getSupabaseVariantTableName();
  if (!tableName) return null;
  const productColumn = tableName === "product_variants" ? "product_id" : "productId";
  const deleteResult = await supabaseRest(`/rest/v1/${tableName}?${productColumn}=eq.${encodeURIComponent(String(productId))}`, { method: "DELETE" });
  if (!deleteResult.ok) throw new Error(`Existing Supabase variants for product ${productId} could not be replaced.`);
  if (!variants.length) return { productId, variants: [] };
  const payload = variants.map((variant) => supabaseVariantPayload({ ...variant, productId }, tableName));
  const insertResult = await supabaseRest<SupabaseProductRow[]>(`/rest/v1/${tableName}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!insertResult.ok) throw new Error(`Supabase variants for product ${productId} could not be saved.`);
  return { productId, variants: insertResult.body ?? [] };
}

async function deleteSupabaseProduct(id: number) {
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

async function decrementSupabaseProductStock(productId: number, quantity: number, variantId?: number | null) {
  const product = await getSupabaseProductById(productId);
  if (!product?.id) return null;

  if (variantId) {
    const variantTable = await getSupabaseVariantTableName();
    const variant = product.variants?.find((row: SupabaseProductRow) => Number(row.id) === Number(variantId));
    if (variantTable && variant?.id) {
      const style = variantTable === "product_variants" ? "snake" : "camel";
      const nextVariantStock = Math.max(Number(variant.stockQuantity ?? variant.stock ?? 0) - quantity, 0);
      await supabaseRest(`/rest/v1/${variantTable}?id=eq.${encodeURIComponent(String(variant.id))}`, {
        method: "PATCH",
        body: JSON.stringify(style === "snake" ? { stock: nextVariantStock } : { stockQuantity: nextVariantStock }),
      });
    }
  }

  const nextProductStock = Math.max(Number(product.stockQuantity ?? product.stock ?? 0) - quantity, 0);
  const nextStatus = stockStatusAfterDecrement(nextProductStock, product.stockStatus ?? product.status);
  return updateSupabaseProduct(product.id, { stockQuantity: nextProductStock, stockStatus: nextStatus });
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
    description: "Boho knotless braids finished with soft curly ends — weightless at the root, full and flowing through the length. Zero-tension parting with bohemian curl placement tailored to your chosen size and length.",
    duration: "6–8 hours",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_men_cornrows_braids_7a3f1b2e-4c8d9e0f12.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_men_box_braids_model_3b9c2d1a-6e4f5a7b89.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_men_twists_model_5d1e8f3c-2a7b4c6d90.png",
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
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_locs_men_model_9f2a5c4b-1d3e7f8a06.png",
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
  await db.insert(reviews).values(seedReviews).onConflictDoUpdate({
    target: [reviews.customerName, reviews.reviewText, reviews.source],
    set: {
      rating: sql`excluded."rating"`,
      status: sql`excluded."status"`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    },
  });
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

async function runSeedStep(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.warn(`[Database] Seed step skipped for ${label}`, error);
  }
}

async function ensureSeedProducts(db: Awaited<ReturnType<typeof getDb>>) {
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
      updatedAt: sql`CURRENT_TIMESTAMP`,
    },
  });
}

async function ensureSeedGallery(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  await db.insert(galleryImages).values(seedGallery.map((item) => ({ ...item, isPublished: "true" as const }))).onConflictDoUpdate({
    target: [galleryImages.title, galleryImages.category],
    set: {
      imageUrl: sql`excluded."imageUrl"`,
      altText: sql`excluded."altText"`,
      sortOrder: sql`excluded."sortOrder"`,
      isPublished: sql`excluded."isPublished"`,
    },
  });
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
  if (_seedingPromise) return _seedingPromise;
  _seedingPromise = (async () => {
    await runSeedStep("services", async () => {
      await db.insert(services).values(seedServices).onConflictDoNothing({
        target: services.slug,
      });
    });
    // Only seed products into Drizzle when Supabase is not configured.
    // When Supabase is active it is the authoritative product store, so seeding
    // Drizzle would re-insert products that were intentionally deleted by an admin.
    if (!isSupabaseConfigured()) {
      await runSeedStep("products", () => ensureSeedProducts(db));
      const productRows = await db.select().from(products);
      const scarf = productRows.find((product) => product.slug === "satin-edge-scarf");
      const hair = productRows.find((product) => product.slug === "premium-braiding-hair");
      if (scarf) {
        await runSeedStep("scarf variants", async () => {
          await db.insert(productVariants).values([
            { productId: scarf.id, name: "Black", colourHex: "#111111", stockQuantity: 18 },
            { productId: scarf.id, name: "Gold", colourHex: "#c8a95a", stockQuantity: 16 },
          ]).onConflictDoUpdate({
            target: [productVariants.productId, productVariants.name],
            set: {
              colourHex: sql`excluded."colourHex"`,
              stockQuantity: sql`excluded."stockQuantity"`,
            },
          });
        });
      }
      if (hair) {
        await runSeedStep("hair variants", async () => {
          await db.insert(productVariants).values([
            { productId: hair.id, name: "1B Natural Black", colourHex: "#1b1715", stockQuantity: 42 },
            { productId: hair.id, name: "30 Auburn", colourHex: "#8a4b2a", stockQuantity: 28 },
            { productId: hair.id, name: "613 Blonde", colourHex: "#d6b779", stockQuantity: 24 },
          ]).onConflictDoUpdate({
            target: [productVariants.productId, productVariants.name],
            set: {
              colourHex: sql`excluded."colourHex"`,
              stockQuantity: sql`excluded."stockQuantity"`,
            },
          });
        });
      }
    }
    await runSeedStep("reviews", () => ensureSeedReviews(db));
    await runSeedStep("website sections", async () => {
      await db.insert(websiteSections).values(seedWebsiteSections).onConflictDoNothing({
        target: websiteSections.sectionKey,
      });
    });
    await runSeedStep("gallery", () => ensureSeedGallery(db));
    _seeded = true;
  })().finally(() => {
    _seedingPromise = null;
  });
  await _seedingPromise;
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
    await ensureServicesTable();
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
    await ensureServicesTable();
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
    await ensureWebsiteSectionColumns();
    const rows = await db.select().from(websiteSections).where(eq(websiteSections.isPublished, "true")).orderBy(asc(websiteSections.sortOrder));
    return rows.length ? rows : fallback;
  } catch (error) {
    console.warn("[Database] Falling back to seeded website sections", error);
    return fallback;
  }
}

export async function listProducts() {
  // When Supabase is configured it is the authoritative product store.  Using the
  // hardcoded seed list as a fallback would resurface products that an admin has
  // intentionally deleted from Supabase.
  const supabaseConfigured = isSupabaseConfigured();
  const fallback = supabaseConfigured
    ? []
    : seedProducts.map((product, index) => ({ ...product, id: index + 1, image_url: product.imageUrl, stock: product.stockQuantity, status: product.stockStatus, colour: null, variants: [] }));
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
      seoTitle: product.seoTitle || `${product.name} | Eby’s Place`,
      seoDescription: product.seoDescription || product.description,
      stock: product.stockQuantity,
      status: product.stockStatus,
      colour: null,
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
    await ensureReviewsTable();
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
  await ensureReviewsTable();
  const inserted = await db.insert(reviews).values({ ...input, status: "pending", source: "website" }).returning({ id: reviews.id });
  return { id: inserted[0]?.id ?? 0, status: "pending" as const };
}

export async function listApprovedProductReviews(productId: number) {
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

export async function listProductReviewSummaries() {
  try {
    const db = await getDb();
    if (!db) return [];
    await ensureProductReviewsTable();
    const rows = await db
      .select({
        productId: productReviews.productId,
        avgRating: sql<number>`ROUND(AVG(${productReviews.rating})::numeric, 1)`,
        reviewCount: sql<number>`COUNT(*)`,
      })
      .from(productReviews)
      .where(eq(productReviews.status, "approved"))
      .groupBy(productReviews.productId);
    return rows.map((row) => ({ productId: row.productId, avgRating: Number(row.avgRating), reviewCount: Number(row.reviewCount) }));
  } catch (error) {
    console.warn("[Database] Could not load product review summaries", error);
    return [];
  }
}

export async function submitProductReview(input: { productId: number; customerName: string; rating: number; reviewText: string }) {
  const db = await getDb();
  if (!db) return { id: Date.now(), status: "pending" as const };
  await ensureProductReviewsTable();
  const inserted = await db.insert(productReviews).values({ ...input, status: "pending", source: "website" }).returning({ id: productReviews.id });
  return { id: inserted[0]?.id ?? 0, status: "pending" as const };
}

export async function moderateProductReview(id: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) return { success: true };
  await ensureProductReviewsTable();
  await db.update(productReviews).set({ status }).where(eq(productReviews.id, id));
  return { success: true };
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

export const BOOKING_REMINDER_SUBJECT = "Unconfirmed booking reminder";

/**
 * Bookings that have sat unconfirmed (deposit unpaid) past the given
 * threshold and haven't already had a reminder email logged for them.
 * Used by the daily booking-reminder cron.
 */
export async function getUnconfirmedBookingsNeedingReminder(hoursThreshold: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureBookingLocationColumns();
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
  const staleBookings = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "pending"), lt(bookings.createdAt, cutoff)));
  if (!staleBookings.length) return [];
  await ensureEmailNotificationLogTable();
  const alreadyReminded = await db
    .select({ entityId: emailNotificationLogs.entityId })
    .from(emailNotificationLogs)
    .where(and(eq(emailNotificationLogs.entityType, "booking"), eq(emailNotificationLogs.subject, BOOKING_REMINDER_SUBJECT)));
  const remindedIds = new Set(alreadyReminded.map((row) => row.entityId));
  return staleBookings.filter((booking) => !remindedIds.has(booking.id));
}

export async function subscribeNewsletter(email: string, productAlerts = false) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(newsletterSubscribers).values({ email, productAlerts: productAlerts ? "true" : "false" }).onConflictDoUpdate({ target: newsletterSubscribers.email, set: { productAlerts: productAlerts ? "true" : "false" } });
  return { success: true };
}

export async function listGallery(category?: string) {
  const fallback = category && category !== "All" ? seedGallery.filter((item) => item.category === category) : seedGallery;
  try {
    await seedIfNeeded();
    const db = await getDb();
    if (!db) return fallback;
    await ensureGalleryTable();
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

async function addPgColumnIfMissing(tableName: string, columnName: string, definition: string) {
  if (!_pool) return;
  try {
    await _pool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${columnName}" ${definition}`);
  } catch (err) {
    console.warn(`[Database] Could not add column ${tableName}.${columnName}`, err);
  }
}

async function renamePgColumnIfMissing(tableName: string, oldColumnName: string, newColumnName: string) {
  if (!_pool || oldColumnName === newColumnName) return;
  try {
    await _pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name = '${oldColumnName}'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name = '${newColumnName}'
        ) THEN
          EXECUTE 'ALTER TABLE "${tableName}" RENAME COLUMN "${oldColumnName}" TO "${newColumnName}"';
        END IF;
      END $$;
    `);
  } catch (err) {
    console.warn(`[Database] Could not rename column ${tableName}.${oldColumnName} -> ${newColumnName}`, err);
  }
}

async function makePgColumnNullable(tableName: string, columnName: string) {
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
  await addPgColumnIfMissing("bookings", "checkoutSurchargeCharged", "NUMERIC(10,2) NOT NULL DEFAULT 0.00");
  await addPgColumnIfMissing("bookings", "checkoutTotalCharged", "NUMERIC(10,2)");
  await makePgColumnNullable("bookings", "addressLine1");
  await makePgColumnNullable("bookings", "city");
  await makePgColumnNullable("bookings", "postcode");
}

async function ensureOrderLocationColumns() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "orders" (
      "id" SERIAL PRIMARY KEY,
      "customerName" VARCHAR(180) NOT NULL DEFAULT 'Guest',
      "customerEmail" VARCHAR(320) NOT NULL DEFAULT 'unknown@example.com',
      "customerPhone" VARCHAR(80),
      "serviceLocation" TEXT NOT NULL DEFAULT 'studio',
      "addressLine1" VARCHAR(255),
      "addressLine2" VARCHAR(255),
      "city" VARCHAR(120),
      "county" VARCHAR(120),
      "postcode" VARCHAR(40),
      "deliveryNote" TEXT,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "checkoutTotalCharged" NUMERIC(10,2),
      "stripeCheckoutSessionId" VARCHAR(255),
      "stripePaymentIntentId" VARCHAR(255),
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    console.warn("[Database] Could not ensure orders table", err);
  }
  await renamePgColumnIfMissing("orders", "customer_name", "customerName");
  await renamePgColumnIfMissing("orders", "customer_email", "customerEmail");
  await renamePgColumnIfMissing("orders", "customer_phone", "customerPhone");
  await renamePgColumnIfMissing("orders", "servicelocation", "serviceLocation");
  await renamePgColumnIfMissing("orders", "service_location", "serviceLocation");
  await renamePgColumnIfMissing("orders", "address_line1", "addressLine1");
  await renamePgColumnIfMissing("orders", "address_line2", "addressLine2");
  await renamePgColumnIfMissing("orders", "delivery_note", "deliveryNote");
  await renamePgColumnIfMissing("orders", "checkout_total_charged", "checkoutTotalCharged");
  await renamePgColumnIfMissing("orders", "stripe_checkout_session_id", "stripeCheckoutSessionId");
  await renamePgColumnIfMissing("orders", "stripe_payment_intent_id", "stripePaymentIntentId");
  await renamePgColumnIfMissing("orders", "created_at", "createdAt");
  await renamePgColumnIfMissing("orders", "updated_at", "updatedAt");
  await addPgColumnIfMissing("orders", "serviceLocation", "TEXT NOT NULL DEFAULT 'studio'");
  await addPgColumnIfMissing("orders", "customerPhone", "VARCHAR(80)");
  await addPgColumnIfMissing("orders", "addressLine2", "VARCHAR(255)");
  await addPgColumnIfMissing("orders", "county", "VARCHAR(120)");
  await addPgColumnIfMissing("orders", "deliveryNote", "TEXT");
  await addPgColumnIfMissing("orders", "status", "TEXT NOT NULL DEFAULT 'draft'");
  await addPgColumnIfMissing("orders", "checkoutTotalCharged", "NUMERIC(10,2)");
  await addPgColumnIfMissing("orders", "stripeCheckoutSessionId", "VARCHAR(255)");
  await addPgColumnIfMissing("orders", "stripePaymentIntentId", "VARCHAR(255)");
  await addPgColumnIfMissing("orders", "createdAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await addPgColumnIfMissing("orders", "updatedAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await makePgColumnNullable("orders", "addressLine1");
  await makePgColumnNullable("orders", "city");
  await makePgColumnNullable("orders", "postcode");
}

async function ensureTryOnAccountsTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "tryOnAccounts" (
      "id" SERIAL PRIMARY KEY,
      "email" VARCHAR(320) NOT NULL,
      "phone" VARCHAR(80),
      "freeTrialUsed" TEXT NOT NULL DEFAULT 'false',
      "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    console.warn("[Database] Could not ensure tryOnAccounts table", err);
  }
}

async function ensureReviewsTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "reviews" (
      "id" SERIAL PRIMARY KEY,
      "customerName" VARCHAR(180) NOT NULL DEFAULT 'Guest',
      "rating" INTEGER NOT NULL DEFAULT 5,
      "reviewText" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'pending',
      "source" VARCHAR(80) NOT NULL DEFAULT 'website',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    console.warn("[Database] Could not ensure reviews table", err);
  }
  await renamePgColumnIfMissing("reviews", "customer_name", "customerName");
  await renamePgColumnIfMissing("reviews", "review_text", "reviewText");
  await renamePgColumnIfMissing("reviews", "created_at", "createdAt");
  await renamePgColumnIfMissing("reviews", "updated_at", "updatedAt");
  await addPgColumnIfMissing("reviews", "status", "TEXT NOT NULL DEFAULT 'pending'");
  await addPgColumnIfMissing("reviews", "source", "VARCHAR(80) NOT NULL DEFAULT 'website'");
  await addPgColumnIfMissing("reviews", "createdAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await addPgColumnIfMissing("reviews", "updatedAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
}

async function ensureServicesTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "services" (
      "id" SERIAL PRIMARY KEY,
      "name" VARCHAR(180) NOT NULL DEFAULT 'Untitled service',
      "slug" VARCHAR(220) NOT NULL DEFAULT 'untitled-service',
      "category" VARCHAR(120) NOT NULL DEFAULT 'Braids',
      "description" TEXT NOT NULL DEFAULT '',
      "duration" VARCHAR(80) NOT NULL DEFAULT 'Unknown duration',
      "priceFrom" NUMERIC(10,2) NOT NULL DEFAULT 0,
      "badge" VARCHAR(80),
      "imageUrl" VARCHAR(800),
      "isBookable" TEXT NOT NULL DEFAULT 'true',
      "isFeatured" TEXT NOT NULL DEFAULT 'false',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    console.warn("[Database] Could not ensure services table", err);
  }
  await renamePgColumnIfMissing("services", "price_from", "priceFrom");
  await renamePgColumnIfMissing("services", "image_url", "imageUrl");
  await renamePgColumnIfMissing("services", "is_bookable", "isBookable");
  await renamePgColumnIfMissing("services", "is_featured", "isFeatured");
  await renamePgColumnIfMissing("services", "sort_order", "sortOrder");
  await renamePgColumnIfMissing("services", "created_at", "createdAt");
  await renamePgColumnIfMissing("services", "updated_at", "updatedAt");
  await addPgColumnIfMissing("services", "duration", "VARCHAR(80) NOT NULL DEFAULT 'Unknown duration'");
  await addPgColumnIfMissing("services", "priceFrom", "NUMERIC(10,2) NOT NULL DEFAULT 0");
  await addPgColumnIfMissing("services", "badge", "VARCHAR(80)");
  await addPgColumnIfMissing("services", "imageUrl", "VARCHAR(800)");
  await addPgColumnIfMissing("services", "isBookable", "TEXT NOT NULL DEFAULT 'true'");
  await addPgColumnIfMissing("services", "isFeatured", "TEXT NOT NULL DEFAULT 'false'");
  await addPgColumnIfMissing("services", "sortOrder", "INTEGER NOT NULL DEFAULT 0");
  await addPgColumnIfMissing("services", "createdAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await addPgColumnIfMissing("services", "updatedAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
}

async function ensureGalleryTable() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "galleryImages" (
      "id" SERIAL PRIMARY KEY,
      "title" VARCHAR(180) NOT NULL DEFAULT 'Gallery image',
      "category" TEXT NOT NULL DEFAULT 'Braids',
      "imageUrl" VARCHAR(800) NOT NULL DEFAULT '',
      "altText" VARCHAR(255) NOT NULL DEFAULT 'Eby’s Place gallery image',
      "isPublished" TEXT NOT NULL DEFAULT 'true',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    console.warn("[Database] Could not ensure galleryImages table", err);
  }
  await renamePgColumnIfMissing("galleryImages", "image_url", "imageUrl");
  await renamePgColumnIfMissing("galleryImages", "alt_text", "altText");
  await renamePgColumnIfMissing("galleryImages", "is_published", "isPublished");
  await renamePgColumnIfMissing("galleryImages", "sort_order", "sortOrder");
  await renamePgColumnIfMissing("galleryImages", "created_at", "createdAt");
  await addPgColumnIfMissing("galleryImages", "isPublished", "TEXT NOT NULL DEFAULT 'true'");
  await addPgColumnIfMissing("galleryImages", "sortOrder", "INTEGER NOT NULL DEFAULT 0");
  await addPgColumnIfMissing("galleryImages", "createdAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
}

async function ensureWebsiteSectionColumns() {
  if (!_pool) return;
  try {
    await _pool.query(`CREATE TABLE IF NOT EXISTS "websiteSections" (
      "id" SERIAL PRIMARY KEY,
      "sectionKey" VARCHAR(80) NOT NULL UNIQUE,
      "title" VARCHAR(255) NOT NULL DEFAULT 'section',
      "eyebrow" VARCHAR(160),
      "body" TEXT,
      "ctaLabel" VARCHAR(120),
      "ctaHref" VARCHAR(500),
      "imageUrl" VARCHAR(800),
      "portraitImageUrl" VARCHAR(800),
      "portraitDescription" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isPublished" TEXT NOT NULL DEFAULT 'true',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch (err) {
    console.warn("[Database] Could not ensure websiteSections table", err);
  }
  await renamePgColumnIfMissing("websiteSections", "section_key", "sectionKey");
  await renamePgColumnIfMissing("websiteSections", "cta_label", "ctaLabel");
  await renamePgColumnIfMissing("websiteSections", "cta_href", "ctaHref");
  await renamePgColumnIfMissing("websiteSections", "image_url", "imageUrl");
  await renamePgColumnIfMissing("websiteSections", "portrait_image_url", "portraitImageUrl");
  await renamePgColumnIfMissing("websiteSections", "portrait_description", "portraitDescription");
  await renamePgColumnIfMissing("websiteSections", "sort_order", "sortOrder");
  await renamePgColumnIfMissing("websiteSections", "is_published", "isPublished");
  await renamePgColumnIfMissing("websiteSections", "created_at", "createdAt");
  await renamePgColumnIfMissing("websiteSections", "updated_at", "updatedAt");
  await addPgColumnIfMissing("websiteSections", "portraitImageUrl", "VARCHAR(800)");
  await addPgColumnIfMissing("websiteSections", "portraitDescription", "TEXT");
  await addPgColumnIfMissing("websiteSections", "createdAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await addPgColumnIfMissing("websiteSections", "updatedAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
}

async function ensureOrderItemSnapshotColumns() {
  if (!_pool) return;
  await addPgColumnIfMissing("orderItems", "imageUrl", "VARCHAR(800)");
}

const SENSITIVE_METADATA_KEY_PATTERN = /(password|passwd|secret|token|key|auth|credential|card|cvv|cvc|iban|stripe|supabase|database|cookie|sessioncookie)/i;
const MAX_METADATA_KEYS = 50;
const MAX_METADATA_TEXT = 500;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PAGE_URL_LENGTH = 800;

type ActivityStatus = "success" | "failed" | "pending" | "info";

type ActivityLogInput = {
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  sessionId?: string | null;
  activityType: string;
  activityCategory: string;
  description: string;
  pageUrl?: string | null;
  metadata?: unknown;
  status?: ActivityStatus;
  relatedEntityType?: string | null;
  relatedEntityId?: string | number | null;
  sourceApp?: string | null;
  request?: Request | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type ActivityLogFilterInput = {
  query?: string;
  datePreset?: "today" | "yesterday" | "last_7_days" | "last_30_days";
  activityType?: string;
  activityCategory?: string;
  user?: string;
  status?: ActivityStatus;
  sourceApp?: string;
  failedOnly?: boolean;
  unreadOnly?: boolean;
  limit?: number;
};

function truncateText(value: unknown, max = MAX_METADATA_TEXT) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function shouldStoreActivityLogIpAddress() {
  return String(process.env.ACTIVITY_LOG_STORE_IP ?? "false").trim().toLowerCase() === "true";
}

function anonymizeIpAddress(rawIp: string | null) {
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

function detectDeviceType(userAgent: string | null) {
  if (!userAgent) return null;
  const normalized = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook/.test(normalized)) return "tablet";
  if (/mobi|android|iphone|ipod|blackberry|windows phone/.test(normalized)) return "mobile";
  return "desktop";
}

function detectBrowser(userAgent: string | null) {
  if (!userAgent) return null;
  const normalized = userAgent.toLowerCase();
  if (normalized.includes("edg/")) return "Edge";
  if (normalized.includes("opr/") || normalized.includes("opera")) return "Opera";
  if (normalized.includes("chrome/") && !normalized.includes("edg/")) return "Chrome";
  if (normalized.includes("firefox/")) return "Firefox";
  if (normalized.includes("safari/") && !normalized.includes("chrome/")) return "Safari";
  return "Unknown";
}

function sanitizeMetadataValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return truncateText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 25).map((entry) => sanitizeMetadataValue(entry, depth + 1));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_METADATA_KEY_PATTERN.test(key))
      .slice(0, MAX_METADATA_KEYS)
      .map(([key, entry]) => [key, sanitizeMetadataValue(entry, depth + 1)] as const)
      .filter(([, entry]) => entry !== null && entry !== undefined && entry !== "");
    return Object.fromEntries(entries);
  }
  return truncateText(String(value));
}

function sanitizeMetadata(input: unknown) {
  const sanitized = sanitizeMetadataValue(input);
  if (!sanitized || (typeof sanitized === "object" && !Array.isArray(sanitized) && Object.keys(sanitized as Record<string, unknown>).length === 0)) return null;
  return sanitized;
}

function getRequestContext(request?: Request | null) {
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
    browser: detectBrowser(userAgent),
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

function normalizePathForTracking(value?: string | null) {
  const raw = (value || "/").trim();
  if (!raw) return "/";
  try {
    const parsed = new URL(raw, "https://www.ebysplace.com");
    return parsed.pathname || "/";
  } catch {
    return raw.split(/[?#]/)[0] || "/";
  }
}

function isAdminPathForTracking(value?: string | null) {
  const pathname = normalizePathForTracking(value).toLowerCase();
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function shouldThrottlePublicActivity(input: {
  sessionId?: string | null;
  activityType?: string | null;
  pageUrl?: string | null;
  sourceApp?: string | null;
  windowMs?: number;
}) {
  const db = await getDb();
  if (!db) return false;
  const sessionId = truncateText(input.sessionId, 128);
  const activityType = truncateText(input.activityType, 120);
  const pageUrl = truncateText(normalizePathForTracking(input.pageUrl), MAX_PAGE_URL_LENGTH);
  const sourceApp = truncateText(input.sourceApp || "ebysplace", 80) || "ebysplace";
  if (!sessionId || !activityType) return false;
  await ensureActivityLogsTable();
  const windowStart = Date.now() - Math.max(input.windowMs ?? 8000, 500);
  const rows = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(
      eq(activityLogs.sessionId, sessionId),
      eq(activityLogs.activityType, activityType),
      eq(activityLogs.sourceApp, sourceApp),
      eq(activityLogs.pageUrl, pageUrl),
      sql`${activityLogs.createdAtMs} >= ${windowStart}`,
    ))
    .limit(1);
  return rows.length > 0;
}

export async function logActivity(input: ActivityLogInput) {
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
    ipAddress: shouldStoreIp ? (inputIpAddress ?? requestContext.ipAddress) : null,
    country: input.country ?? requestContext.country,
    city: input.city ?? requestContext.city,
    region: input.region ?? requestContext.region,
    deviceType: input.deviceType ?? requestContext.deviceType,
    browser: input.browser ?? requestContext.browser,
    userAgent: input.userAgent ?? requestContext.userAgent,
    relatedEntityType: truncateText(input.relatedEntityType, 80),
    relatedEntityId: truncateText(input.relatedEntityId, 120),
    sourceApp: truncateText(input.sourceApp || "ebysplace", 80) || "ebysplace",
    isRead: "false" as const,
    createdAtMs: Date.now(),
    updatedAt: new Date(),
  };
  await db.insert(activityLogs).values(payload);
  return { success: true };
}

export async function listActivityLogs(filters: ActivityLogFilterInput = {}) {
  const db = await getDb();
  if (!db) return [];
  await ensureActivityLogsTable();
  const conditions = [
    sql`${activityLogs.activityType} NOT LIKE 'admin_%'`,
    sql`COALESCE(${activityLogs.pageUrl}, '') NOT LIKE '/admin%'`,
  ];
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
      ilike(activityLogs.relatedEntityId, query),
    ));
  }
  if (filters.datePreset) {
    if (filters.datePreset === "today") conditions.push(sql`${activityLogs.createdAt} >= CURRENT_DATE`);
    if (filters.datePreset === "yesterday") conditions.push(sql`${activityLogs.createdAt} >= CURRENT_DATE - INTERVAL '1 day' AND ${activityLogs.createdAt} < CURRENT_DATE`);
    if (filters.datePreset === "last_7_days") conditions.push(sql`${activityLogs.createdAt} >= NOW() - INTERVAL '7 days'`);
    if (filters.datePreset === "last_30_days") conditions.push(sql`${activityLogs.createdAt} >= NOW() - INTERVAL '30 days'`);
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  return db.select().from(activityLogs).where(whereClause).orderBy(desc(activityLogs.createdAt)).limit(Math.min(Math.max(filters.limit ?? 150, 1), 500));
}

export async function unreadActivityCount() {
  const db = await getDb();
  if (!db) return 0;
  await ensureActivityLogsTable();
  const rows = await db
    .select({ value: sql<number>`count(*)` })
    .from(activityLogs)
    .where(and(
      eq(activityLogs.isRead, "false"),
      sql`${activityLogs.activityType} NOT LIKE 'admin_%'`,
      sql`COALESCE(${activityLogs.pageUrl}, '') NOT LIKE '/admin%'`,
    ));
  return Number(rows[0]?.value ?? 0);
}

export async function markActivityLogsRead(ids?: number[]) {
  const db = await getDb();
  if (!db) return { success: true };
  await ensureActivityLogsTable();
  if (ids?.length) {
    const normalizedIds = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!normalizedIds.length) return { success: true };
    await db
      .update(activityLogs)
      .set({ isRead: "true", updatedAt: new Date() })
      .where(inArray(activityLogs.id, normalizedIds));
    return { success: true };
  }
  await db.update(activityLogs).set({ isRead: "true", updatedAt: new Date() }).where(eq(activityLogs.isRead, "false"));
  return { success: true };
}

export async function createBooking(input: typeof bookings.$inferInsert) {
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
      clientEmail: input.clientEmail,
    },
  });
  return { id: bookingId };
}

export async function updateBookingCheckout(
  id: number,
  stripeCheckoutSessionId: string,
  stripePaymentIntentId?: string | null,
  checkoutDetails?: { surchargeAmount?: number; checkoutTotal?: number },
) {
  const db = await getDb();
  if (!db) return;
  const surchargeAmount = Number(checkoutDetails?.surchargeAmount ?? 0);
  const checkoutTotal = Number(checkoutDetails?.checkoutTotal);
  await db.update(bookings).set({
    depositStatus: "checkout_started",
    stripeCheckoutSessionId,
    stripePaymentIntentId: stripePaymentIntentId ?? null,
    checkoutSurchargeCharged: Number.isFinite(surchargeAmount) ? surchargeAmount.toFixed(2) : "0.00",
    checkoutTotalCharged: Number.isFinite(checkoutTotal) ? checkoutTotal.toFixed(2) : null,
  }).where(eq(bookings.id, id));
  await logActivity({
    activityType: "checkout_started",
    activityCategory: "payment",
    description: `Checkout started for booking #${id}`,
    status: "pending",
    pageUrl: "/booking",
    relatedEntityType: "booking",
    relatedEntityId: id,
    metadata: {
      stripeCheckoutSessionId,
      checkoutSurchargeCharged: Number.isFinite(surchargeAmount) ? surchargeAmount.toFixed(2) : "0.00",
      checkoutTotalCharged: Number.isFinite(checkoutTotal) ? checkoutTotal.toFixed(2) : null,
    },
  });
}

export async function markBookingDepositPaid(stripeCheckoutSessionId: string, stripePaymentIntentId?: string | null) {
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
    metadata: { stripeCheckoutSessionId, stripePaymentIntentId },
  });
}

export async function recordBookingCheckoutSettlement(stripeCheckoutSessionId: string, input: { checkoutTotal?: number; surchargeAmount?: number }) {
  const db = await getDb();
  if (!db) return;
  await ensureBookingLocationColumns();
  const checkoutTotal = Number(input.checkoutTotal);
  const surchargeAmount = Number(input.surchargeAmount ?? 0);
  await db.update(bookings).set({
    checkoutTotalCharged: Number.isFinite(checkoutTotal) ? checkoutTotal.toFixed(2) : null,
    checkoutSurchargeCharged: Number.isFinite(surchargeAmount) ? surchargeAmount.toFixed(2) : "0.00",
  }).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId));
}

export async function getBookingByCheckoutSession(stripeCheckoutSessionId: string) {
  const db = await getDb();
  if (!db) return null;
  await ensureBookingLocationColumns();
  const rows = await db.select().from(bookings).where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}

export async function createOrderWithItems(input: { customerName: string; customerEmail: string; customerPhone?: string; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; county?: string | null; postcode?: string | null; deliveryNote?: string; items: Array<{ productId: number; variantId?: number; productName: string; variantName?: string; quantity: number; unitPrice: string }> }) {
  const db = await getDb();
  if (!db) return { id: Date.now(), items: input.items };
  await ensureOrderLocationColumns();
  await ensureOrderItemSnapshotColumns();

  const supabaseProductRows = await listSupabaseProducts();
  const [dbProductRows, dbVariantRows] = supabaseProductRows ? [[], []] : await Promise.all([
    db.select().from(products),
    db.select().from(productVariants),
  ]);
  const productRows = supabaseProductRows ?? dbProductRows;
  const variantRows = supabaseProductRows ? supabaseProductRows.flatMap((product) => product.variants ?? []) : dbVariantRows;
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
      imageUrl: product.imageUrl || null,
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
      itemCount: validatedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    },
  });
  return { id: orderId, items: validatedItems };
}

export async function updateOrderCheckout(
  id: number,
  stripeCheckoutSessionId: string,
  stripePaymentIntentId?: string | null,
  checkoutDetails?: { checkoutTotal?: number },
) {
  const db = await getDb();
  if (!db) return;
  const checkoutTotal = Number(checkoutDetails?.checkoutTotal);
  await db.update(orders).set({
    status: "pending_payment",
    stripeCheckoutSessionId,
    stripePaymentIntentId: stripePaymentIntentId ?? null,
    checkoutTotalCharged: Number.isFinite(checkoutTotal) ? checkoutTotal.toFixed(2) : null,
  }).where(eq(orders.id, id));
  await logActivity({
    activityType: "checkout_started",
    activityCategory: "payment",
    description: `Order checkout session created for order #${id}`,
    status: "pending",
    pageUrl: "/shop",
    relatedEntityType: "order",
    relatedEntityId: id,
    metadata: {
      stripeCheckoutSessionId,
      checkoutTotalCharged: Number.isFinite(checkoutTotal) ? checkoutTotal.toFixed(2) : null,
    },
  });
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
  await logActivity({
    activityType: "payment_successful",
    activityCategory: "payment",
    description: `Payment successful for order #${order.id}`,
    status: "success",
    pageUrl: "/shop",
    relatedEntityType: "order",
    relatedEntityId: order.id,
    metadata: { stripeCheckoutSessionId, stripePaymentIntentId },
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
      await db.update(productVariants)
        .set({ stockQuantity: sql`GREATEST(${productVariants.stockQuantity} - ${item.quantity}, 0)` })
        .where(eq(productVariants.id, item.variantId));
    }
    await db.update(products)
      .set({
        stockQuantity: sql`GREATEST(${products.stockQuantity} - ${item.quantity}, 0)`,
        stockStatus: sql`CASE WHEN GREATEST(${products.stockQuantity} - ${item.quantity}, 0) = 0 THEN 'out_of_stock' ELSE ${products.stockStatus} END`,
      })
      .where(eq(products.id, item.productId));
  }
}

export async function recordOrderCheckoutSettlement(stripeCheckoutSessionId: string, input: { checkoutTotal?: number }) {
  const db = await getDb();
  if (!db) return;
  await ensureOrderLocationColumns();
  const checkoutTotal = Number(input.checkoutTotal);
  await db.update(orders).set({
    checkoutTotalCharged: Number.isFinite(checkoutTotal) ? checkoutTotal.toFixed(2) : null,
  }).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId));
}

export async function getOrderByCheckoutSession(stripeCheckoutSessionId: string) {
  const db = await getDb();
  if (!db) return null;
  await ensureOrderLocationColumns();
  const rows = await db.select().from(orders).where(eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  await ensureOrderLocationColumns();
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderItemsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

/** Current stock snapshot for a set of product ids — used by the post-purchase low-stock alert. */
export async function getProductsById(ids: number[]) {
  const db = await getDb();
  if (!db || !ids.length) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}

/**
 * Confirmed bookings whose appointment is tomorrow — used by the daily
 * day-before customer reminder. Naturally deduped: a given booking's
 * appointmentDate only matches "tomorrow" on the one day before it, so
 * running this once a day never re-finds the same booking twice.
 */
export async function getConfirmedBookingsForTomorrow() {
  const db = await getDb();
  if (!db) return [];
  await ensureBookingLocationColumns();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), eq(bookings.appointmentDate, tomorrow)));
}

export const ORDER_ABANDONED_REMINDER_SUBJECT = "Abandoned shop checkout reminder";

/**
 * Orders stuck at status="pending_payment" (Stripe checkout session was
 * created but never completed) past the given threshold, excluding any
 * already reminded. Used by the daily abandoned-checkout reminder.
 */
export async function getAbandonedOrdersNeedingReminder(hoursThreshold: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureOrderLocationColumns();
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
  const staleOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lt(orders.createdAt, cutoff)));
  if (!staleOrders.length) return [];
  await ensureEmailNotificationLogTable();
  const alreadyReminded = await db
    .select({ entityId: emailNotificationLogs.entityId })
    .from(emailNotificationLogs)
    .where(and(eq(emailNotificationLogs.entityType, "order"), eq(emailNotificationLogs.subject, ORDER_ABANDONED_REMINDER_SUBJECT)));
  const remindedIds = new Set(alreadyReminded.map((row) => row.entityId));
  return staleOrders.filter((order) => !remindedIds.has(order.id));
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
    await renamePgColumnIfMissing("productReviews", "product_id", "productId");
    await renamePgColumnIfMissing("productReviews", "customer_name", "customerName");
    await renamePgColumnIfMissing("productReviews", "review_text", "reviewText");
    await renamePgColumnIfMissing("productReviews", "created_at", "createdAt");
    await renamePgColumnIfMissing("productReviews", "updated_at", "updatedAt");
    await addPgColumnIfMissing("productReviews", "status", "TEXT NOT NULL DEFAULT 'pending'");
    await addPgColumnIfMissing("productReviews", "source", "VARCHAR(80) NOT NULL DEFAULT 'website'");
    await addPgColumnIfMissing("productReviews", "createdAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
    await addPgColumnIfMissing("productReviews", "updatedAt", "TIMESTAMP NOT NULL DEFAULT NOW()");
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

export async function createEmailNotificationLog(input: {
  entityType: "booking" | "order";
  entityId: number;
  audience: "owner" | "customer";
  recipientEmail: string;
  subject: string;
  bodyPreview?: string | null;
  status?: "pending" | "sent" | "failed" | "retried";
  smtpHost?: string | null;
  messageId?: string | null;
  errorMessage?: string | null;
}) {
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
    lastAttemptAtMs: Date.now(),
  }).returning({ id: emailNotificationLogs.id });
  return { id: inserted[0]?.id ?? 0 };
}

export async function updateEmailNotificationLog(id: number, input: {
  status: "pending" | "sent" | "failed" | "retried";
  smtpHost?: string | null;
  messageId?: string | null;
  errorMessage?: string | null;
  sentAtMs?: number | null;
}) {
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
    updatedAt: new Date(),
    attempts: sql`${emailNotificationLogs.attempts} + 1`,
  }).where(eq(emailNotificationLogs.id, id));
  return { id, ...input };
}

export async function listEmailNotificationLogs(limit = 80) {
  const db = await getDb();
  if (!db) return [];
  await ensureEmailNotificationLogTable();
  return db.select().from(emailNotificationLogs).orderBy(desc(emailNotificationLogs.createdAt)).limit(limit);
}

export async function getEmailNotificationLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  await ensureEmailNotificationLogTable();
  const rows = await db.select().from(emailNotificationLogs).where(eq(emailNotificationLogs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function recordAnalytics(
  eventName: string,
  pagePath: string,
  metadata?: unknown,
  options?: {
    request?: Request | null;
    user?: { id?: number; name?: string | null; email?: string | null } | null;
    sessionId?: string | null;
    activityType?: string;
    activityCategory?: string;
    status?: ActivityStatus;
    description?: string;
    relatedEntityType?: string | null;
    relatedEntityId?: string | number | null;
    sourceApp?: string | null;
  }
) {
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
    sourceApp,
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
    sourceApp,
  });
  return { success: true };
}

export async function createTryOnGeneration(input: { styleName: string; originalImageUrl: string; generatedImageUrl?: string; status?: "pending" | "completed" | "failed"; errorMessage?: string }) {
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
    metadata: { styleName: input.styleName, imageUploaded: Boolean(input.originalImageUrl) },
  });
  return { id };
}

export async function updateTryOnGeneration(id: number, input: { generatedImageUrl?: string; status: "completed" | "failed"; errorMessage?: string }) {
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
    metadata: input.errorMessage ? { errorMessage: input.errorMessage } : undefined,
  });
}

function normalizeTryOnIdentity(email: string, phone?: string | null) {
  return {
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
  };
}

export async function getTryOnAccount(email: string, phone?: string | null) {
  await ensureTryOnAccountsTable();
  const db = await getDb();
  if (!db) return null;
  const { email: normalizedEmail, phone: normalizedPhone } = normalizeTryOnIdentity(email, phone);
  const conditions = normalizedPhone
    ? or(eq(tryOnAccounts.email, normalizedEmail), eq(tryOnAccounts.phone, normalizedPhone))
    : eq(tryOnAccounts.email, normalizedEmail);
  const rows = await db.select().from(tryOnAccounts).where(conditions).limit(1);
  return rows[0] ?? null;
}

export async function consumeTryOnTrialOrCredit(email: string, phone?: string | null): Promise<
  | { allowed: true; reason: "trial" | "credit"; creditsRemaining: number }
  | { allowed: false; reason: "no_credits"; creditsRemaining: 0 }
> {
  const db = await getDb();
  const { email: normalizedEmail, phone: normalizedPhone } = normalizeTryOnIdentity(email, phone);
  if (!db) return { allowed: true, reason: "trial", creditsRemaining: 0 };

  const account = await getTryOnAccount(normalizedEmail, normalizedPhone);

  if (!account) {
    await db.insert(tryOnAccounts).values({ email: normalizedEmail, phone: normalizedPhone, freeTrialUsed: "true", creditsRemaining: 0 });
    return { allowed: true, reason: "trial", creditsRemaining: 0 };
  }

  if (account.freeTrialUsed === "false") {
    await db.update(tryOnAccounts).set({ freeTrialUsed: "true", updatedAt: new Date() }).where(eq(tryOnAccounts.id, account.id));
    return { allowed: true, reason: "trial", creditsRemaining: account.creditsRemaining };
  }

  if (account.creditsRemaining > 0) {
    const nextCredits = account.creditsRemaining - 1;
    await db.update(tryOnAccounts).set({ creditsRemaining: nextCredits, updatedAt: new Date() }).where(eq(tryOnAccounts.id, account.id));
    return { allowed: true, reason: "credit", creditsRemaining: nextCredits };
  }

  return { allowed: false, reason: "no_credits", creditsRemaining: 0 };
}

export async function refundTryOnCredit(email: string, phone?: string | null) {
  const db = await getDb();
  if (!db) return;
  const account = await getTryOnAccount(email, phone);
  if (!account) return;
  await db.update(tryOnAccounts).set({ creditsRemaining: account.creditsRemaining + 1, updatedAt: new Date() }).where(eq(tryOnAccounts.id, account.id));
}

export async function creditTryOnPurchase(email: string, phone: string | undefined | null, credits: number) {
  const db = await getDb();
  if (!db) return;
  const { email: normalizedEmail, phone: normalizedPhone } = normalizeTryOnIdentity(email, phone);
  const account = await getTryOnAccount(normalizedEmail, normalizedPhone);
  if (!account) {
    await db.insert(tryOnAccounts).values({ email: normalizedEmail, phone: normalizedPhone, freeTrialUsed: "true", creditsRemaining: credits });
  } else {
    await db.update(tryOnAccounts).set({ creditsRemaining: account.creditsRemaining + credits, updatedAt: new Date() }).where(eq(tryOnAccounts.id, account.id));
  }
  await logActivity({
    activityType: "tryon_credits_purchased",
    activityCategory: "ai_try_on",
    description: `Purchased ${credits} AI Try-On credit${credits === 1 ? "" : "s"} for ${normalizedEmail}`,
    status: "success",
    pageUrl: "/ai-try-on",
    relatedEntityType: "try_on_account",
    userEmail: normalizedEmail,
    metadata: { credits },
  });
}

export async function adminSummary() {
  await seedIfNeeded();
  const supabaseProducts = await listSupabaseProducts();
  const db = await getDb();
  if (!db) return { bookings: 0, orders: 0, pendingReviews: 0, pendingProductReviews: 0, products: supabaseProducts?.length ?? seedProducts.length, services: seedServices.length, tryOns: 0, activityLogs: 0, unreadActivities: 0 };
  await ensureBookingLocationColumns();
  await ensureOrderLocationColumns();
  await ensureReviewsTable();
  await ensureServicesTable();
  await ensureProductReviewsTable();
  await ensureActivityLogsTable();
  const safeAdminRows = async <T>(label: string, fallback: T, action: () => Promise<T>) => {
    try {
      return await action();
    } catch (error) {
      console.warn(`[Admin] Could not load ${label}`, error);
      return fallback;
    }
  };
  const [bookingRows, orderRows, reviewRows, productReviewRows, dbProductRows, serviceRows, tryOnRows, activityRows, unreadRows] = await Promise.all([
    safeAdminRows("bookings summary", [], () => db.select().from(bookings)),
    safeAdminRows("orders summary", [], () => db.select().from(orders)),
    safeAdminRows("reviews summary", [], () => db.select().from(reviews).where(eq(reviews.status, "pending"))),
    safeAdminRows("product reviews summary", [], () => db.select().from(productReviews).where(eq(productReviews.status, "pending"))),
    safeAdminRows("products summary", [], () => db.select().from(products)),
    safeAdminRows("services summary", [], () => db.select().from(services)),
    safeAdminRows("try-on summary", [], () => db.select().from(tryOnGenerations)),
    safeAdminRows("activity summary", [], () => db.select().from(activityLogs)),
    safeAdminRows("unread activity summary", [{ value: 0 }], () => db.select({ value: sql<number>`count(*)` }).from(activityLogs).where(eq(activityLogs.isRead, "false"))),
  ]);
  return { bookings: bookingRows.length, orders: orderRows.length, pendingReviews: reviewRows.length, pendingProductReviews: productReviewRows.length, products: supabaseProducts?.length ?? dbProductRows.length, services: serviceRows.length, tryOns: tryOnRows.length, activityLogs: activityRows.length, unreadActivities: Number(unreadRows[0]?.value ?? 0) };
}

export async function adminLists() {
  await seedIfNeeded();
  const supabaseProducts = await listSupabaseProducts();
  const db = await getDb();
  if (db) {
    await ensureBookingLocationColumns();
    await ensureOrderLocationColumns();
    await ensureReviewsTable();
    await ensureServicesTable();
    await ensureGalleryTable();
    await ensureWebsiteSectionColumns();
  }
  const fallbackProducts = seedProducts.map((product, index) => ({ ...product, id: index + 1, image_url: product.imageUrl, stock: product.stockQuantity, status: product.stockStatus, colour: null, variants: [] }));
  if (!db) return { bookings: [], orders: [], reviews: seedReviews, productReviews: [], products: supabaseProducts ?? fallbackProducts, services: seedServices, gallery: [], tryOns: [], sections: [], emailNotifications: [], activityLogs: [], availability: await getAvailabilitySettings(), instagram: await getInstagramSettings() };
  await ensureEmailNotificationLogTable();
  await ensureActivityLogsTable();
  await ensureProductVariantsTable();
  await ensureProductReviewsTable();
  const loadAdminCollection = async <T>(label: string, fallback: T, action: () => Promise<T>) => {
    try {
      return await action();
    } catch (error) {
      console.warn(`[Admin] Could not load ${label}`, error);
      return fallback;
    }
  };
  const [bookingRows, orderRows, reviewRows, productReviewRows, dbProductRows, variantRows, serviceRows, galleryRows, tryOnRows, sectionRows, emailNotificationRows, activityRows] = await Promise.all([
    loadAdminCollection("bookings", [], () => db.select().from(bookings).orderBy(desc(bookings.createdAt))),
    loadAdminCollection("orders", [], () => db.select().from(orders).orderBy(desc(orders.createdAt))),
    loadAdminCollection("reviews", seedReviews, () => db.select().from(reviews).orderBy(desc(reviews.createdAt))),
    loadAdminCollection("product reviews", [], () => db.select().from(productReviews).orderBy(desc(productReviews.createdAt))),
    loadAdminCollection("products", [], () => db.select().from(products).orderBy(desc(products.createdAt))),
    loadAdminCollection("product variants", [], () => db.select().from(productVariants)),
    loadAdminCollection("services", seedServices, () => db.select().from(services).orderBy(asc(services.sortOrder))),
    loadAdminCollection("gallery", [], () => db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt))),
    loadAdminCollection("try-ons", [], () => db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt))),
    loadAdminCollection("website sections", seedWebsiteSections, () => db.select().from(websiteSections).orderBy(asc(websiteSections.sortOrder))),
    loadAdminCollection("email notifications", [], () => db.select().from(emailNotificationLogs).orderBy(desc(emailNotificationLogs.createdAt)).limit(80)),
    loadAdminCollection("activity logs", [], () => db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(120)),
  ]);
  const productsWithVariants = supabaseProducts ?? dbProductRows.map((product) => ({
    ...product,
    id: Number(product.id),
    image_url: product.imageUrl,
    stock: product.stockQuantity,
    status: product.stockStatus,
    colour: null,
    seoTitle: product.seoTitle || `${product.name} | Eby’s Place`,
    seoDescription: product.seoDescription || product.description,
    variants: variantRows.filter((variant) => variant.productId === product.id),
  }));
  return { bookings: bookingRows, orders: orderRows, reviews: reviewRows, productReviews: productReviewRows, products: productsWithVariants, services: serviceRows, gallery: galleryRows, tryOns: tryOnRows, sections: sectionRows, emailNotifications: emailNotificationRows, activityLogs: activityRows, availability: await getAvailabilitySettings(), instagram: await getInstagramSettings() };
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
  await ensureServicesTable();
  await db.update(services).set(input).where(eq(services.id, id));
  return { id, ...input };
}

export async function createService(input: typeof services.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensureServicesTable();
  const inserted = await db.insert(services).values(input).returning({ id: services.id });
  return { id: inserted[0]?.id ?? 0, ...input };
}

export async function updateProduct(id: number, input: Partial<typeof products.$inferInsert>) {
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseProduct = await updateSupabaseProduct(id, input);
  if (supabaseProduct) return supabaseProduct;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set(input).where(eq(products.id, id));
  return { id, ...input };
}

export async function createProduct(input: typeof products.$inferInsert, variants: Array<{ name: string; colourHex?: string; stockQuantity: number }> = []) {
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

export async function replaceProductVariants(productId: number, variants: Array<{ name: string; colourHex?: string; stockQuantity: number }>) {
  if (!Number.isFinite(productId) || productId <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseResult = await replaceSupabaseProductVariants(productId, variants);
  if (supabaseResult) return supabaseResult;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId })));
  return { productId, variants };
}

export async function deleteProduct(id: number) {
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseResult = await deleteSupabaseProduct(id);
  const db = await getDb();
  if (db) {
    const drizzleCleanup = async () => {
      await db.delete(productVariants).where(eq(productVariants.productId, id));
      await db.delete(products).where(eq(products.id, id));
    };
    if (supabaseResult) {
      // Supabase is the authoritative store; Drizzle cleanup is best-effort so a
      // transient DB error does not surface as a user-facing failure.
      await drizzleCleanup().catch((error) => console.warn("[Database] Drizzle cleanup after Supabase delete failed", error));
    } else {
      await drizzleCleanup();
    }
  }
  if (supabaseResult) return supabaseResult;
  if (!db) throw new Error("Database unavailable");
  return { id, deleted: true };
}

export async function updateOrderStatus(id: number, status: "draft" | "pending_payment" | "paid" | "fulfilling" | "shipped" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  return { id, status };
}

export async function updateProductStock(id: number, stockQuantity: number, stockStatus: "in_stock" | "low_stock" | "out_of_stock") {
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid Supabase product id is required.");
  const supabaseProduct = await updateSupabaseProduct(id, { stockQuantity, stockStatus });
  if (supabaseProduct) return { id, stockQuantity: supabaseProduct.stockQuantity ?? stockQuantity, stockStatus: supabaseProduct.stockStatus ?? stockStatus };
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set({ stockQuantity, stockStatus }).where(eq(products.id, id));
  return { id, stockQuantity, stockStatus };
}

export async function addGalleryImage(input: typeof galleryImages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensureGalleryTable();
  const result = await db.insert(galleryImages).values(input).returning({ id: galleryImages.id });
  return { id: result[0]?.id, ...input };
}

export async function deleteGalleryImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensureGalleryTable();
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
  return { id };
}

export async function updateWebsiteSection(sectionKey: string, input: Partial<typeof websiteSections.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensureWebsiteSectionColumns();
  await db.insert(websiteSections).values({ sectionKey, title: input.title ?? sectionKey, ...input }).onConflictDoUpdate({ target: websiteSections.sectionKey, set: { ...input, updatedAt: new Date() } });
  return { sectionKey, ...input };
}

export async function deleteService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensureServicesTable();
  await db.delete(services).where(eq(services.id, id));
  return { id, deleted: true };
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
  await ensureBookingLocationColumns();
  await ensureOrderLocationColumns();
  await ensureReviewsTable();

  const safeInsightRows = async <T>(label: string, fallback: T, action: () => Promise<T>) => {
    try {
      return await action();
    } catch (error) {
      console.warn(`[Admin] Could not load ${label}`, error);
      return fallback;
    }
  };
  const [productSales, bookedServices, triedStyles, bookingRows, orderRows, reviewRows, analyticsRows, tryOnRows, subscriberRows] = await Promise.all([
    safeInsightRows("product sales insight", [], () => db.select({ label: orderItems.productName, units: sql<number>`sum(${orderItems.quantity})`, revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})` }).from(orderItems).groupBy(orderItems.productName).orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(8)),
    safeInsightRows("booked services insight", [], () => db.select({ label: bookings.serviceName, total: sql<number>`count(*)` }).from(bookings).groupBy(bookings.serviceName).orderBy(desc(sql`count(*)`)).limit(8)),
    safeInsightRows("try-on styles insight", [], () => db.select({ label: tryOnGenerations.styleName, total: sql<number>`count(*)` }).from(tryOnGenerations).groupBy(tryOnGenerations.styleName).orderBy(desc(sql`count(*)`)).limit(8)),
    safeInsightRows("recent bookings insight", [], () => db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(6)),
    safeInsightRows("recent orders insight", [], () => db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6)),
    safeInsightRows("recent reviews insight", [], () => db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(6)),
    safeInsightRows("recent analytics insight", [], () => db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt)).limit(6)),
    safeInsightRows("recent try-ons insight", [], () => db.select().from(tryOnGenerations).orderBy(desc(tryOnGenerations.createdAt)).limit(6)),
    safeInsightRows("recent subscribers insight", [], () => db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(6)),
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
