const SUPABASE_URL = "https://jcyoipbiplzrocrrhwkp.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
  console.error(JSON.stringify({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, null, 2));
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
};

async function rest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${body.slice(0, 300)}`);
  }
  return body ? JSON.parse(body) : [];
}

async function checkMedia(url) {
  const response = await fetch(url, { method: "HEAD" });
  return {
    url,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
  };
}

const [services, products, variants, reviews, galleryImages, websiteSections] = await Promise.all([
  rest("services?select=id,slug,name,category,imageUrl,isBookable&order=sortOrder.asc"),
  rest("products?select=id,slug,name,imageUrl,stockStatus&order=createdAt.asc"),
  rest("productVariants?select=id,productId,name,stockQuantity"),
  rest("reviews?select=id,customerName,rating,status&order=createdAt.desc"),
  rest("galleryImages?select=id,title,category,imageUrl,isPublished&order=sortOrder.asc"),
  rest("websiteSections?select=id,sectionKey,title,body,isPublished"),
]);

const activeServices = services.filter((service) => service.isBookable !== "false");
const activeProducts = products.filter((product) => product.stockStatus !== "out_of_stock");
const approvedReviews = reviews.filter((review) => review.status === "approved");
const publishedGallery = galleryImages.filter((item) => item.isPublished !== "false");

const categoryCounts = activeServices.reduce((acc, service) => {
  acc[service.category] = (acc[service.category] ?? 0) + 1;
  return acc;
}, {});

const mediaUrls = [
  ...activeServices.map((item) => item.imageUrl),
  ...activeProducts.map((item) => item.imageUrl),
  ...publishedGallery.map((item) => item.imageUrl),
].filter(Boolean);
const uniqueMediaUrls = [...new Set(mediaUrls)];
const requiredPrefix = `${SUPABASE_URL}/storage/v1/object/public/ebysplace-media/`;
const badHosts = uniqueMediaUrls.filter((url) => !url.startsWith(requiredPrefix));
const mediaChecks = await Promise.all(uniqueMediaUrls.map(checkMedia));
const inaccessibleMedia = mediaChecks.filter((check) => !check.ok);

const summary = {
  ok:
    activeServices.length >= 20 &&
    activeProducts.length >= 4 &&
    variants.length >= 5 &&
    approvedReviews.length >= 20 &&
    publishedGallery.length >= 12 &&
    websiteSections.length >= 1 &&
    badHosts.length === 0 &&
    inaccessibleMedia.length === 0,
  supabaseUrl: SUPABASE_URL,
  counts: {
    activeServices: activeServices.length,
    activeProducts: activeProducts.length,
    productVariants: variants.length,
    approvedReviews: approvedReviews.length,
    totalReviews: reviews.length,
    publishedGalleryImages: publishedGallery.length,
    websiteSections: websiteSections.length,
    uniqueMediaUrls: uniqueMediaUrls.length,
  },
  categoryCounts,
  serviceSlugs: activeServices.map((service) => service.slug),
  badHosts,
  inaccessibleMedia,
  sampledMediaChecks: mediaChecks.slice(0, 8),
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
