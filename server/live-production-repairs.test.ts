import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("live production repair safeguards", () => {
  it("guards admin login URL generation against missing or malformed Vercel OAuth configuration", () => {
    const authConstSource = readProjectFile("client/src/const.ts");

    expect(authConstSource).toContain("normalizeAbsoluteUrl(import.meta.env.VITE_OAUTH_PORTAL_URL)");
    expect(authConstSource).toContain('const DEFAULT_OAUTH_PORTAL_URL = "https://manus.im"');
    expect(authConstSource).toContain('new URL("/app-auth", oauthPortalUrl)');
    expect(authConstSource).not.toContain("new URL(`${oauthPortalUrl}/app-auth`)");
  });

  it("serves a branded storage fallback instead of returning raw storage proxy errors in production", () => {
    const storageProxySource = readProjectFile("server/_core/storageProxy.ts");

    expect(storageProxySource).toContain("function sendImageFallback");
    expect(storageProxySource).toContain("image/svg+xml");
    expect(storageProxySource).toContain("Storage proxy not configured; serving branded fallback image");
    expect(storageProxySource).not.toContain('res.status(500).send("Storage proxy not configured")');
  });

  it("keeps the Braiders Near Me page useful with searchable demo directory data and registration CTAs", () => {
    const braidersSource = readProjectFile("client/src/pages/Braiders.tsx");

    expect(braidersSource).toContain("demoBraiders");
    expect(braidersSource).toContain("Search by town, style, or name");
    expect(braidersSource).toContain("Use my location");
    expect(braidersSource).toContain("Register as a Braider");
    expect(braidersSource).toContain("filteredBraiders");
  });

  it("repairs public seed content by upserting paid products and expanding the gallery catalogue", () => {
    const dbSource = readProjectFile("server/db.ts");

    expect(dbSource).toContain("Braid Care Starter Kit");
    expect(dbSource).toContain("const seedGallery = [");
    expect(dbSource).toContain("await ensureSeedProducts(db)");
    expect(dbSource).toContain("await ensureSeedGallery(db)");
    expect(dbSource).toContain("productRows.filter((product) => isPositivePrice(product.price))");
    expect(dbSource).toContain("safeRows.length >= 8");
  });

  it("removes the production-blocking local Manus-storage header video dependency", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx");

    expect(homeSource).toContain("LANDING_HERO_IMAGE_SRC");
    expect(homeSource).toContain("https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/");
    expect(homeSource).not.toContain("LANDING_VIDEO_SRC");
    expect(homeSource).not.toContain("/manus-storage/ebysplace_header_video_64d5fea4.mp4");
  });

  it("uses a Supabase-compatible PostgreSQL adapter for production tRPC database access", () => {
    const dbSource = readProjectFile("server/db.ts");
    const schemaSource = readProjectFile("drizzle/schema.ts");
    const packageSource = readProjectFile("package.json");
    const drizzleConfigSource = readProjectFile("drizzle.config.ts");

    expect(dbSource).toContain('from "drizzle-orm/node-postgres"');
    expect(dbSource).toContain('from "pg"');
    expect(dbSource).toContain("new Pool({");
    expect(dbSource).toContain("isPostgresConnectionString");
    expect(dbSource).toContain('parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"');
    expect(dbSource).toContain("Ignoring non-PostgreSQL DATABASE_URL");
    expect(dbSource).toContain("await _pool.query(\"select 1\")");
    expect(dbSource).toContain("ssl: requiresSsl(connectionString)");
    expect(dbSource).toContain("onConflictDoUpdate");
    expect(dbSource).toContain("returning({ id:");
    expect(dbSource).not.toContain("drizzle-orm/mysql2");
    expect(dbSource).not.toContain("onDuplicateKeyUpdate");
    expect(dbSource).not.toContain("$returningId");
    expect(schemaSource).toContain('from "drizzle-orm/pg-core"');
    expect(schemaSource).toContain('pgTable("users"');
    expect(schemaSource).not.toContain("mysqlTable");
    expect(packageSource).toContain('"pg"');
    expect(packageSource).not.toContain('"mysql2"');
    expect(drizzleConfigSource).toContain('dialect: "postgresql"');
    expect(drizzleConfigSource).not.toContain('dialect: "mysql"');
  });

  it("keeps the Supabase production seed runner on the corrected project URL and public media bucket", () => {
    const seedSource = readProjectFile("scripts/seed-supabase-content.ts");
    const packageSource = readProjectFile("package.json");

    expect(seedSource).toContain("https://jcyoipbiplzrocrrhwkp.supabase.co");
    expect(seedSource).toContain("`${supabaseUrl}/rest/v1/${path}${query}`");
    expect(seedSource).toContain('await upsertRows("services", serviceRows, "slug")');
    expect(seedSource).toContain('await upsertRows("products", seedProducts, "slug")');
    expect(seedSource).toContain('await upsertRows("websiteSections", seedWebsiteSections, "sectionKey")');
    expect(seedSource).toContain('await insertRows("productVariants", rows)');
    expect(seedSource).toContain('await insertRows("reviews", missing)');
    expect(seedSource).toContain('await insertRows("galleryImages", [{ ...item, isPublished: "true" }])');
    expect(seedSource).toContain('const BUCKET_NAME = "ebysplace-media"');
    expect(seedSource).toContain("/storage/v1/object/public/${BUCKET_NAME}/");
    expect(seedSource).not.toContain("jcyoipbiplzrocrnhwkp");
    expect(seedSource).not.toContain("/manus-storage/");
    expect(packageSource).toContain('"seed:supabase": "tsx scripts/seed-supabase-content.ts"');
  });
});
