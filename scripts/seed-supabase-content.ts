import {
  seedGallery,
  seedProducts,
  seedReviews,
  seedServices,
  seedWebsiteSections,
} from "../server/db";

const CORRECT_SUPABASE_URL = "https://jcyoipbiplzrocrrhwkp.supabase.co";
const BUCKET_NAME = "ebysplace-media";

type AnyRecord = Record<string, unknown>;

type Summary = {
  services: number;
  products: number;
  productVariants: number;
  reviews: number;
  galleryImages: number;
  websiteSections: number;
  checkedMediaUrls: number;
  inaccessibleMediaUrls: Array<{ url: string; status: number; table: string }>;
};

function getSupabaseUrl() {
  const configured = (process.env.SUPABASE_URL || CORRECT_SUPABASE_URL).replace(/\/$/, "");
  if (configured !== CORRECT_SUPABASE_URL) {
    throw new Error(
      `Refusing to seed against unexpected Supabase URL ${configured}. Use corrected URL ${CORRECT_SUPABASE_URL}.`,
    );
  }
  return configured;
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to seed production Supabase content.");
  return key;
}

const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = getServiceRoleKey();

function restHeaders(extra: HeadersInit = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function endpoint(path: string, query = "") {
  return `${supabaseUrl}/rest/v1/${path}${query}`;
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: restHeaders(init.headers),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed ${response.status} ${response.statusText} for ${url}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ([] as T);
}

async function upsertRows<T extends AnyRecord>(table: string, rows: T[], conflictTarget: string) {
  if (rows.length === 0) return [];
  return requestJson<T[]>(endpoint(table, `?on_conflict=${encodeURIComponent(conflictTarget)}`), {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
}

async function fetchRows<T extends AnyRecord>(table: string, select = "*") {
  return requestJson<T[]>(endpoint(table, `?select=${encodeURIComponent(select)}`), { method: "GET" });
}

async function patchById<T extends AnyRecord>(table: string, id: number, patch: T) {
  return requestJson<T[]>(endpoint(table, `?id=eq.${id}`), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
}

async function insertRows<T extends AnyRecord>(table: string, rows: T[]) {
  if (rows.length === 0) return [];
  return requestJson<T[]>(endpoint(table), {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
}

async function ensureReviews() {
  const existing = await fetchRows<{ id: number; customerName: string; reviewText: string }>(
    "reviews",
    "id,customerName,reviewText",
  );
  const known = new Set(existing.map((row) => `${row.customerName}::${row.reviewText}`));
  const missing = seedReviews.filter((review) => !known.has(`${review.customerName}::${review.reviewText}`));
  await insertRows("reviews", missing);
  return existing.length + missing.length;
}

async function ensureGallery() {
  const existing = await fetchRows<{ id: number; title: string }>("galleryImages", "id,title");
  const byTitle = new Map(existing.map((row) => [row.title, row.id]));
  let count = existing.length;
  for (const item of seedGallery) {
    const id = byTitle.get(item.title);
    if (id) {
      await patchById("galleryImages", id, { ...item, isPublished: "true" });
    } else {
      await insertRows("galleryImages", [{ ...item, isPublished: "true" }]);
      count += 1;
    }
  }
  return count;
}

async function ensureProductVariants() {
  const products = await fetchRows<{ id: number; slug: string }>("products", "id,slug");
  const variants = await fetchRows<{ id: number; productId: number; name: string }>("productVariants", "id,productId,name");
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const variantKey = new Set(variants.map((variant) => `${variant.productId}::${variant.name}`));
  const rows: Array<{ productId: number; name: string; colourHex: string; stockQuantity: number }> = [];
  const scarf = productBySlug.get("satin-edge-scarf");
  if (scarf) {
    for (const variant of [
      { productId: scarf.id, name: "Black", colourHex: "#111111", stockQuantity: 18 },
      { productId: scarf.id, name: "Gold", colourHex: "#c8a95a", stockQuantity: 16 },
    ]) {
      if (!variantKey.has(`${variant.productId}::${variant.name}`)) rows.push(variant);
    }
  }
  const hair = productBySlug.get("premium-braiding-hair");
  if (hair) {
    for (const variant of [
      { productId: hair.id, name: "1B Natural Black", colourHex: "#1b1715", stockQuantity: 42 },
      { productId: hair.id, name: "30 Auburn", colourHex: "#8a4b2a", stockQuantity: 28 },
      { productId: hair.id, name: "613 Blonde", colourHex: "#d6b779", stockQuantity: 24 },
    ]) {
      if (!variantKey.has(`${variant.productId}::${variant.name}`)) rows.push(variant);
    }
  }
  await insertRows("productVariants", rows);
  return variants.length + rows.length;
}

async function checkStorageBucket() {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    headers: restHeaders(),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Unable to list Supabase storage buckets: ${response.status} ${text}`);
  const buckets = JSON.parse(text) as Array<{ name?: string; id?: string }>;
  if (!buckets.some((bucket) => bucket.name === BUCKET_NAME || bucket.id === BUCKET_NAME)) {
    throw new Error(`Supabase bucket ${BUCKET_NAME} was not found under ${supabaseUrl}.`);
  }
}

function collectSeedMediaUrls() {
  const entries: Array<{ url: string; table: string }> = [];
  for (const service of seedServices) if (service.imageUrl) entries.push({ url: service.imageUrl, table: "services" });
  for (const product of seedProducts) if (product.imageUrl) entries.push({ url: product.imageUrl, table: "products" });
  for (const gallery of seedGallery) if (gallery.imageUrl) entries.push({ url: gallery.imageUrl, table: "galleryImages" });
  for (const section of seedWebsiteSections) {
    if (section.imageUrl) entries.push({ url: section.imageUrl, table: "websiteSections.imageUrl" });
    if (section.portraitImageUrl) entries.push({ url: section.portraitImageUrl, table: "websiteSections.portraitImageUrl" });
  }
  const unique = new Map<string, { url: string; table: string }>();
  for (const entry of entries) unique.set(entry.url, entry);
  return [...unique.values()];
}

async function verifyPublicMediaUrls(summary: Summary) {
  for (const entry of collectSeedMediaUrls()) {
    if (!entry.url.startsWith(`${CORRECT_SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`)) {
      summary.inaccessibleMediaUrls.push({ ...entry, status: 0 });
      continue;
    }
    const response = await fetch(entry.url, { method: "HEAD" });
    summary.checkedMediaUrls += 1;
    if (!response.ok) summary.inaccessibleMediaUrls.push({ ...entry, status: response.status });
  }
}

async function main() {
  console.log(`[Seed] Using corrected Supabase project: ${supabaseUrl}`);
  await checkStorageBucket();

  const serviceRows = seedServices.map((service) => ({ ...service, isBookable: "true" }));
  const insertedServices = await upsertRows("services", serviceRows, "slug");
  const insertedProducts = await upsertRows("products", seedProducts, "slug");
  const insertedSections = await upsertRows("websiteSections", seedWebsiteSections, "sectionKey");
  const productVariantsCount = await ensureProductVariants();
  const reviewsCount = await ensureReviews();
  const galleryCount = await ensureGallery();

  const summary: Summary = {
    services: insertedServices.length,
    products: insertedProducts.length,
    productVariants: productVariantsCount,
    reviews: reviewsCount,
    galleryImages: galleryCount,
    websiteSections: insertedSections.length,
    checkedMediaUrls: 0,
    inaccessibleMediaUrls: [],
  };
  await verifyPublicMediaUrls(summary);

  console.log(JSON.stringify(summary, null, 2));
  if (summary.inaccessibleMediaUrls.length > 0) {
    throw new Error(`Seed completed but ${summary.inaccessibleMediaUrls.length} media URL(s) were not publicly accessible.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
