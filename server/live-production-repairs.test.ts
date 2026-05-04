import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("live production repair safeguards", () => {
  it("uses local Supabase email/password admin auth with no Manus OAuth Vite variables", () => {
    const authConstSource = readProjectFile("client/src/const.ts");
    const mainSource = readProjectFile("client/src/main.tsx");
    const authHookSource = readProjectFile("client/src/_core/hooks/useAuth.ts");
    const supabaseAuthSource = readProjectFile("server/supabaseAuth.ts");
    const contextSource = readProjectFile("server/_core/context.ts");
    const serverSource = readProjectFile("server/_core/index.ts");
    const vercelSource = readProjectFile("server/vercel.ts");

    expect(authConstSource).toContain('ADMIN_LOGIN_PATH = "/admin/login"');
    expect(authConstSource).toContain("AUTH_TOKEN_STORAGE_KEY");
    expect(mainSource).toContain('headers.set("Authorization", `Bearer ${token}`)');
    expect(authHookSource).toContain("clearStoredAuthSession");
    expect(supabaseAuthSource).toContain('"/token?grant_type=password"');
    expect(supabaseAuthSource).toContain("authenticateSupabaseRequest");
    expect(contextSource).toContain("authenticateSupabaseRequest(req)");
    expect(serverSource).not.toContain("registerOAuthRoutes");
    expect(vercelSource).not.toContain("registerOAuthRoutes");

    const combined = [authConstSource, mainSource, authHookSource, supabaseAuthSource, contextSource, serverSource, vercelSource].join("\n");
    expect(combined).not.toContain("VITE_APP_ID");
    expect(combined).not.toContain("VITE_OAUTH_PORTAL_URL");
    expect(combined).not.toContain("getLoginUrl");
  });

  it("uses Supabase public storage for production media instead of serving images through an application proxy", () => {
    const storageSource = readProjectFile("server/storage.ts");
    const vercelSource = readProjectFile("server/vercel.ts");
    const vercelConfigSource = readProjectFile("vercel.json");

    expect(storageSource).toContain("Supabase Storage helpers for Eby’s Place production media");
    expect(storageSource).toContain("/storage/v1/object/public/");
    const removedProxyRegistration = ["register", "Storage", "Proxy"].join("");
    expect(vercelSource).not.toContain(removedProxyRegistration);
    expect(vercelConfigSource).not.toContain(["/", "man", "us", "-storage"].join(""));
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

  it("removes the production-blocking local legacy storage header video dependency", () => {
    const homeSource = readProjectFile("client/src/pages/Home.tsx");

    expect(homeSource).toContain("LANDING_HERO_IMAGE_SRC");
    expect(homeSource).toContain("https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/");
    expect(homeSource).not.toContain("LANDING_VIDEO_SRC");
    expect(homeSource).not.toContain("/ebysplace_header_video_64d5fea4.mp4");
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
    expect(seedSource).not.toContain(["/", "man", "us", "-storage/"].join(""));
    expect(packageSource).toContain('"seed:supabase": "tsx scripts/seed-supabase-content.ts"');
  });
});
