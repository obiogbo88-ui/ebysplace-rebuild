const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log(JSON.stringify({ ok: false, reason: 'missing_supabase_env', hasUrl: Boolean(url), hasServiceRoleKey: Boolean(key) }, null, 2));
  process.exit(0);
}
async function request(path, init = {}) {
  const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, ok: response.ok, body };
}
const products = await request('/rest/v1/products?select=*&limit=5');
const variants = await request('/rest/v1/productVariants?select=*&limit=5');
const snakeVariants = variants.ok ? variants : await request('/rest/v1/product_variants?select=*&limit=5');
const rows = Array.isArray(products.body) ? products.body : [];
console.log(JSON.stringify({
  ok: products.ok,
  productsStatus: products.status,
  productsError: products.ok ? undefined : products.body,
  productCountSampled: rows.length,
  productColumns: rows[0] ? Object.keys(rows[0]).sort() : [],
  firstProducts: rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, price: row.price, imageUrl: row.imageUrl, image_url: row.image_url, colour: row.colour, stock: row.stock, stockQuantity: row.stockQuantity, status: row.status, stockStatus: row.stockStatus })),
  variantsStatus: snakeVariants.status,
  variantsOk: snakeVariants.ok,
  variantColumns: Array.isArray(snakeVariants.body) && snakeVariants.body[0] ? Object.keys(snakeVariants.body[0]).sort() : [],
}, null, 2));
