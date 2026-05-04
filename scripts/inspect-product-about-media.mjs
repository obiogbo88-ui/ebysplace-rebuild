const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "ebysplace-media";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, query) {
  const url = `${SUPABASE_URL}/rest/v1/${path}${query}`;
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} failed ${response.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

function keyFromPublicUrl(url) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return typeof url === "string" && url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

async function head(url) {
  if (!url) return { status: 0, ok: false };
  try {
    const response = await fetch(url, { method: "HEAD" });
    return { status: response.status, ok: response.ok };
  } catch (error) {
    return { status: -1, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function storageList(prefix = "") {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`storage list failed ${response.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const products = await rest("products", "?select=id,name,slug,imageUrl&order=id.asc");
const sections = await rest("websiteSections", "?select=id,sectionKey,title,imageUrl,portraitImageUrl&sectionKey=eq.about_us");
const entries = [
  ...products.map((row) => ({ type: "product", id: row.id, slug: row.slug, name: row.name, url: row.imageUrl, key: keyFromPublicUrl(row.imageUrl) })),
  ...sections.flatMap((row) => [
    { type: "about_image", id: row.id, slug: row.sectionKey, name: row.title, url: row.imageUrl, key: keyFromPublicUrl(row.imageUrl) },
    { type: "about_portrait", id: row.id, slug: row.sectionKey, name: row.title, url: row.portraitImageUrl, key: keyFromPublicUrl(row.portraitImageUrl) },
  ]),
];

for (const entry of entries) {
  entry.head = await head(entry.url);
}

const topLevelObjects = await storageList("");
console.log(JSON.stringify({ supabaseUrl: SUPABASE_URL, bucket: BUCKET, entries, topLevelObjects }, null, 2));
