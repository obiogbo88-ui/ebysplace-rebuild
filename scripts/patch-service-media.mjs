import fs from 'node:fs';

const file = '/home/ubuntu/ebysplace-rebuild/server/db.ts';
let source = fs.readFileSync(file, 'utf8');

const imageBySlug = {
  'knotless-braids': '/manus-storage/ebysplace_service_knotless_braids_ee7bcfb0.png',
  'box-braids': '/manus-storage/ebysplace_service_box_braids_c219e578.png',
  'goddess-braids': '/manus-storage/ebysplace_service_goddess_braids_da92cf33.png',
  'fulani-braids': '/manus-storage/ebysplace_service_fulani_braids_0575047c.png',
  'cornrows': '/manus-storage/ebysplace_service_cornrows_2b5007dd.png',
  'stitch-braids': '/manus-storage/ebysplace_service_stitch_braids_562f3424.png',
  'lemonade-braids': '/manus-storage/ebysplace_service_lemonade_braids_71001277.png',
  'boho-goddess-braids': '/manus-storage/ebysplace_service_boho_braids_ee8557bc.png',
  'tribal-braids': '/manus-storage/ebysplace_service_tribal_braids_f0ce8622.png',
  'senegalese-twists': '/manus-storage/ebysplace_service_senegalese_twists_d58a9d66.png',
  'passion-twists': '/manus-storage/ebysplace_service_passion_twists_fb79128f.png',
  'faux-locs': '/manus-storage/ebysplace_service_faux_locs_b738d17e.png',
  'butterfly-locs': '/manus-storage/ebysplace_service_butterfly_locs_642d7503.png',
  'starter-locs': '/manus-storage/ebysplace_service_starter_locs_3cfa3435.png',
  'kids-braids': '/manus-storage/ebysplace_service_kids_braids_066faa86.png',
  'kids-cornrows': '/manus-storage/ebysplace_service_kids_cornrows_e12e1096.png',
  'hair-wash-prep': '/manus-storage/ebysplace_service_hair_wash_prep_ccec3da2.png',
  'beads-accessories': '/manus-storage/ebysplace_service_beads_accessories_05425a55.png',
  'edge-control-styling': '/manus-storage/ebysplace_service_edge_control_styling_675ed964.png',
  'braid-takedown': '/manus-storage/ebysplace_service_braid_takedown_6240fcb4.png',
};

for (const [slug, imageUrl] of Object.entries(imageBySlug)) {
  const slugLine = `    slug: "${slug}",`;
  const index = source.indexOf(slugLine);
  if (index === -1) throw new Error(`Missing service slug ${slug}`);
  const objectEnd = source.indexOf('  },', index);
  const serviceBlock = source.slice(index, objectEnd);
  if (serviceBlock.includes('imageUrl:')) {
    source = source.slice(0, index) + serviceBlock.replace(/    imageUrl: "[^"]+",/, `    imageUrl: "${imageUrl}",`) + source.slice(objectEnd);
  } else {
    const sortLineMatch = /    sortOrder: \d+,/.exec(serviceBlock);
    if (!sortLineMatch) throw new Error(`Missing sortOrder for ${slug}`);
    const insertAt = index + sortLineMatch.index + sortLineMatch[0].length;
    source = source.slice(0, insertAt) + `\n    imageUrl: "${imageUrl}",` + source.slice(insertAt);
  }
}

const oldGallery = `  const existingGallery = await db.select().from(galleryImages).limit(1);\n  if (existingGallery.length === 0) await db.insert(galleryImages).values([\n    { title: "Knotless braid finish", category: "Braids", imageUrl: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?q=80&w=1200&auto=format&fit=crop", altText: "Elegant knotless braid hairstyle", sortOrder: 1 },\n    { title: "Soft twist detail", category: "Twists", imageUrl: "https://images.unsplash.com/photo-1605980625600-88a6f024c6ac?q=80&w=1200&auto=format&fit=crop", altText: "Detailed twist protective hairstyle", sortOrder: 2 },\n    { title: "Premium salon care", category: "Behind the Chair", imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1200&auto=format&fit=crop", altText: "Premium salon styling experience", sortOrder: 3 },\n  ]);`;
const newGallery = `  const existingGallery = await db.select().from(galleryImages).limit(1);\n  if (existingGallery.length === 0) await db.insert(galleryImages).values([\n    { title: "Knotless Braids", category: "Braids", imageUrl: imageBySlug["knotless-braids"], altText: "HD model wearing Knotless Braids by Eby’s Place", sortOrder: 1 },\n    { title: "Box Braids", category: "Braids", imageUrl: imageBySlug["box-braids"], altText: "HD model wearing Box Braids by Eby’s Place", sortOrder: 2 },\n    { title: "Goddess Braids", category: "Braids", imageUrl: imageBySlug["goddess-braids"], altText: "HD model wearing Goddess Braids by Eby’s Place", sortOrder: 3 },\n    { title: "Senegalese Twists", category: "Twists", imageUrl: imageBySlug["senegalese-twists"], altText: "HD model wearing Senegalese Twists by Eby’s Place", sortOrder: 4 },\n    { title: "Faux Locs", category: "Locs", imageUrl: imageBySlug["faux-locs"], altText: "HD model wearing Faux Locs by Eby’s Place", sortOrder: 5 },\n    { title: "Kids Braids", category: "Kids Styles", imageUrl: imageBySlug["kids-braids"], altText: "HD child model wearing Kids Braids by Eby’s Place", sortOrder: 6 },\n  ]);`;
if (!source.includes('const imageBySlug: Record<string, string> = {')) {
  const mapping = `\nconst imageBySlug: Record<string, string> = ${JSON.stringify(imageBySlug, null, 2)};\n`;
  source = source.replace('\nconst seedServices = [', `${mapping}\nconst seedServices = [`);
}
if (source.includes(oldGallery)) {
  source = source.replace(oldGallery, newGallery);
}
const oldUpsert = `  await db\n    .insert(services)\n    .values(seedServices)\n    .onDuplicateKeyUpdate({ set: { slug: sql\`slug\` } });`;
const newUpsert = `  await db\n    .insert(services)\n    .values(seedServices)\n    .onDuplicateKeyUpdate({\n      set: {\n        name: sql\`VALUES(name)\`,\n        category: sql\`VALUES(category)\`,\n        description: sql\`VALUES(description)\`,\n        duration: sql\`VALUES(duration)\`,\n        priceFrom: sql\`VALUES(price_from)\`,\n        badge: sql\`VALUES(badge)\`,\n        isFeatured: sql\`VALUES(is_featured)\`,\n        imageUrl: sql\`VALUES(image_url)\`,\n        sortOrder: sql\`VALUES(sort_order)\`,\n      },\n    });`;
if (source.includes(oldUpsert)) source = source.replace(oldUpsert, newUpsert);

fs.writeFileSync(file, source);
console.log('Patched service media mappings in server/db.ts');
