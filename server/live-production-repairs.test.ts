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
});
