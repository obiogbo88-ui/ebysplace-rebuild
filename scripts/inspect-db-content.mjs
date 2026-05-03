import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { products, galleryImages, services } from '../drizzle/schema.ts';
import { asc } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);
const productRows = await db.select().from(products).orderBy(asc(products.id));
const galleryRows = await db.select().from(galleryImages).orderBy(asc(galleryImages.sortOrder));
const serviceRows = await db.select().from(services).orderBy(asc(services.sortOrder));
console.log(JSON.stringify({
  products: productRows.map((p) => ({ id: p.id, name: p.name, slug: p.slug, price: p.price, imageUrl: p.imageUrl, stockStatus: p.stockStatus, isFeatured: p.isFeatured })),
  gallery: galleryRows.map((g) => ({ id: g.id, title: g.title, category: g.category, imageUrl: g.imageUrl, sortOrder: g.sortOrder })),
  serviceCount: serviceRows.length,
  featuredServices: serviceRows.filter((s) => s.isFeatured === 'true').map((s) => ({ name: s.name, slug: s.slug, imageUrl: s.imageUrl })),
}, null, 2));
