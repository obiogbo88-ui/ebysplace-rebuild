from pathlib import Path

path = Path('/home/ubuntu/ebysplace-rebuild/server/db.ts')
text = path.read_text()

text = text.replace(
'''const seedProducts = [
  { name: "Satin Edge Scarf", slug: "satin-edge-scarf", seoTitle: "Satin Edge Scarf for Braids | Eby’s Place", seoDescription: "Protect fresh braids overnight with a silky satin edge scarf from Eby’s Place, designed to preserve edges and reduce friction.", category: "Accessories" as const, description: "A silky black satin scarf for preserving edges and protecting fresh braids overnight.", price: "18.00", badge: "Best Seller", stockStatus: "in_stock" as const, stockQuantity: 34, isFeatured: "true" as const },
  { name: "Scalp Comfort Oil", slug: "scalp-comfort-oil", seoTitle: "Scalp Comfort Oil for Protective Styles | Eby’s Place", seoDescription: "Shop lightweight scalp comfort oil for braids, twists, and locs, created to support shine and comfort between salon appointments.", category: "Aftercare" as const, description: "A lightweight scalp oil for protective styles, designed to support comfort and shine.", price: "14.00", badge: "Aftercare", stockStatus: "low_stock" as const, stockQuantity: 8, isFeatured: "true" as const },
  { name: "Premium Braiding Hair", slug: "premium-braiding-hair", seoTitle: "Premium Braiding Hair in Natural and Statement Shades | Eby’s Place", seoDescription: "Buy soft-touch premium braiding hair from Eby’s Place in natural tones and statement shades for protective styles.", category: "Hair Attachments" as const, description: "Soft-touch braiding hair available in classic natural tones and statement shades.", price: "6.50", badge: "Salon Pick", stockStatus: "in_stock" as const, stockQuantity: 120, isFeatured: "true" as const },
];''',
'''const seedProducts = [
  { name: "Satin Edge Scarf", slug: "satin-edge-scarf", seoTitle: "Satin Edge Scarf for Braids | Eby’s Place", seoDescription: "Protect fresh braids overnight with a silky satin edge scarf from Eby’s Place, designed to preserve edges and reduce friction.", category: "Accessories" as const, description: "A silky black satin scarf for preserving edges and protecting fresh braids overnight.", price: "18.00", imageUrl: imageBySlug["edge-control-styling"], badge: "Best Seller", stockStatus: "in_stock" as const, stockQuantity: 34, isFeatured: "true" as const },
  { name: "Scalp Comfort Oil", slug: "scalp-comfort-oil", seoTitle: "Scalp Comfort Oil for Protective Styles | Eby’s Place", seoDescription: "Shop lightweight scalp comfort oil for braids, twists, and locs, created to support shine and comfort between salon appointments.", category: "Aftercare" as const, description: "A lightweight scalp oil for protective styles, designed to support comfort and shine.", price: "14.00", imageUrl: imageBySlug["hair-wash-prep"], badge: "Aftercare", stockStatus: "low_stock" as const, stockQuantity: 8, isFeatured: "true" as const },
  { name: "Premium Braiding Hair", slug: "premium-braiding-hair", seoTitle: "Premium Braiding Hair in Natural and Statement Shades | Eby’s Place", seoDescription: "Buy soft-touch premium braiding hair from Eby’s Place in natural tones and statement shades for protective styles.", category: "Hair Attachments" as const, description: "Soft-touch braiding hair available in classic natural tones and statement shades.", price: "6.50", imageUrl: imageBySlug["beads-accessories"], badge: "Salon Pick", stockStatus: "in_stock" as const, stockQuantity: 120, isFeatured: "true" as const },
  { name: "Braid Care Starter Kit", slug: "braid-care-starter-kit", seoTitle: "Braid Care Starter Kit | Eby’s Place", seoDescription: "A practical starter kit for maintaining fresh protective styles between Eby’s Place appointments.", category: "Aftercare" as const, description: "A simple aftercare bundle with satin protection, scalp comfort guidance, and braid maintenance essentials.", price: "28.00", imageUrl: imageBySlug["boho-goddess-braids"], badge: "New", stockStatus: "in_stock" as const, stockQuantity: 20, isFeatured: "true" as const },
];''')

insert_after = '''async function ensureSeedReviews(db: Awaited<ReturnType<typeof getDb>>) {
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
'''
addition = '''async function ensureSeedReviews(db: Awaited<ReturnType<typeof getDb>>) {
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
        seoTitle: sql`VALUES(seo_title)`,
        seoDescription: sql`VALUES(seo_description)`,
        category: sql`VALUES(category)`,
        description: sql`VALUES(description)`,
        price: sql`VALUES(price)`,
        imageUrl: sql`VALUES(image_url)`,
        badge: sql`VALUES(badge)`,
        stockStatus: sql`VALUES(stock_status)`,
        stockQuantity: sql`VALUES(stock_quantity)`,
        isFeatured: sql`VALUES(is_featured)`,
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
'''
text = text.replace(insert_after, addition)

text = text.replace(
'''  const existingProducts = await db.select().from(products).limit(1);
  if (existingProducts.length === 0) {
    const inserted = await db.insert(products).values(seedProducts).$returningId();
    if (inserted[0]?.id) await db.insert(productVariants).values([{ productId: inserted[0].id, name: "Black", colourHex: "#111111", stockQuantity: 18 }, { productId: inserted[0].id, name: "Gold", colourHex: "#c8a95a", stockQuantity: 16 }]);
    if (inserted[2]?.id) await db.insert(productVariants).values([{ productId: inserted[2].id, name: "1B Natural Black", colourHex: "#1b1715", stockQuantity: 42 }, { productId: inserted[2].id, name: "30 Auburn", colourHex: "#8a4b2a", stockQuantity: 28 }, { productId: inserted[2].id, name: "613 Blonde", colourHex: "#d6b779", stockQuantity: 24 }]);
  }
  await ensureSeedReviews(db);
''',
'''  await ensureSeedProducts(db);
  const productRows = await db.select().from(products);
  const variantRows = await db.select().from(productVariants);
  const scarf = productRows.find((product) => product.slug === "satin-edge-scarf");
  const hair = productRows.find((product) => product.slug === "premium-braiding-hair");
  if (scarf && !variantRows.some((variant) => variant.productId === scarf.id)) await db.insert(productVariants).values([{ productId: scarf.id, name: "Black", colourHex: "#111111", stockQuantity: 18 }, { productId: scarf.id, name: "Gold", colourHex: "#c8a95a", stockQuantity: 16 }]);
  if (hair && !variantRows.some((variant) => variant.productId === hair.id)) await db.insert(productVariants).values([{ productId: hair.id, name: "1B Natural Black", colourHex: "#1b1715", stockQuantity: 42 }, { productId: hair.id, name: "30 Auburn", colourHex: "#8a4b2a", stockQuantity: 28 }, { productId: hair.id, name: "613 Blonde", colourHex: "#d6b779", stockQuantity: 24 }]);
  await ensureSeedReviews(db);
''')

text = text.replace(
'''  const existingGallery = await db.select().from(galleryImages).limit(1);
  if (existingGallery.length === 0) await db.insert(galleryImages).values([
    { title: "Knotless Braids", category: "Braids", imageUrl: imageBySlug["knotless-braids"], altText: "HD model wearing Knotless Braids by Eby’s Place", sortOrder: 1 },
    { title: "Box Braids", category: "Braids", imageUrl: imageBySlug["box-braids"], altText: "HD model wearing Box Braids by Eby’s Place", sortOrder: 2 },
    { title: "Goddess Braids", category: "Braids", imageUrl: imageBySlug["goddess-braids"], altText: "HD model wearing Goddess Braids by Eby’s Place", sortOrder: 3 },
    { title: "Senegalese Twists", category: "Twists", imageUrl: imageBySlug["senegalese-twists"], altText: "HD model wearing Senegalese Twists by Eby’s Place", sortOrder: 4 },
    { title: "Faux Locs", category: "Locs", imageUrl: imageBySlug["faux-locs"], altText: "HD model wearing Faux Locs by Eby’s Place", sortOrder: 5 },
    { title: "Kids Braids", category: "Kids Styles", imageUrl: imageBySlug["kids-braids"], altText: "HD child model wearing Kids Braids by Eby’s Place", sortOrder: 6 },
  ]);
''',
'''  await ensureSeedGallery(db);
''')

text = text.replace(
'''  const productRows = await db.select().from(products).orderBy(desc(products.isFeatured), asc(products.name));
  const variantRows = await db.select().from(productVariants);
  return productRows.map((product) => ({
    ...product,
    seoTitle: product.seoTitle || `${product.name} | Eby’s Place`,
    seoDescription: product.seoDescription || product.description,
    variants: variantRows.filter((variant) => variant.productId === product.id),
  }));
''',
'''  const productRows = await db.select().from(products).orderBy(desc(products.isFeatured), asc(products.name));
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
''')

text = text.replace(
'''  if (!db) return [];
  const filter = category && category !== "All" ? and(eq(galleryImages.isPublished, "true"), eq(galleryImages.category, category as any)) : eq(galleryImages.isPublished, "true");
  return db.select().from(galleryImages).where(filter).orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt));
''',
'''  if (!db) return category && category !== "All" ? seedGallery.filter((item) => item.category === category) : seedGallery;
  const filter = category && category !== "All" ? and(eq(galleryImages.isPublished, "true"), eq(galleryImages.category, category as any)) : eq(galleryImages.isPublished, "true");
  const rows = await db.select().from(galleryImages).where(filter).orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt));
  const safeRows = rows.filter((row) => isUsableImageUrl(row.imageUrl));
  if (safeRows.length >= 8 || (category && category !== "All")) return safeRows;
  const existingTitles = new Set(safeRows.map((row) => row.title));
  return [...safeRows, ...seedGallery.filter((item) => !existingTitles.has(item.title))];
''')

path.write_text(text)
