import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as db from "./db";

const projectRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("product SEO administration and responsive page safeguards", () => {
  it("provides seeded products with editable SEO metadata fallbacks", async () => {
    process.env.DATABASE_URL = "";
    const products = await db.listProducts();

    expect(products.length).toBeGreaterThanOrEqual(3);
    for (const product of products) {
      expect(product.name).toBeTruthy();
      expect(product.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(product.seoTitle || `${product.name} | Eby’s Place`).toContain("Eby");
      expect(product.seoDescription || product.description).toBeTruthy();
    }
  });

  it("exposes product name, slug, SEO title, and SEO description editing inside the admin dashboard", () => {
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const routerSource = readSource("server/routers.ts");

    expect(routerSource).toContain("updateProduct: adminProcedure");
    expect(routerSource).toContain("seoTitle");
    expect(routerSource).toContain("seoDescription");
    expect(adminSource).toContain("Product name");
    expect(adminSource).toContain("SEO title");
    expect(adminSource).toContain("SEO meta description");
    expect(adminSource).toContain("updateProduct.mutate");
  });

  it("reflects admin-managed SEO fields and requested colour-selection shopping feedback in the public shop", () => {
    const shopSource = readSource("client/src/pages/Shop.tsx");

    expect(shopSource).toContain("product.seoTitle");
    expect(shopSource).toContain("product.seoDescription");
    expect(shopSource).toContain("product.slug");
    expect(shopSource).toContain("selectedVariant");
    expect(shopSource).toContain("Add ${readableColourLabel(selectedVariant)} to bag");
    expect(shopSource).toContain("<p className=\"pill w-fit\">Shop</p>");
    expect(shopSource).not.toContain("Better shopping flow");
    expect(shopSource).not.toContain("Selected colour");
    expect(shopSource).not.toContain("Tap a colour below to preview this product before adding it to your bag.");
    expect(shopSource).toContain("md:grid-cols-2");
    expect(shopSource).toContain("lg:grid-cols-[minmax(0,1fr)_420px]");
  });

  it("keeps every main public and admin page responsive between mobile and desktop views", () => {
    const pages = ["Home", "Services", "Booking", "Shop", "TryOn", "Braiders", "Gallery", "Reviews", "Admin"];

    for (const page of pages) {
      const source = readSource(`client/src/pages/${page}.tsx`);
      expect(source, `${page} should include mobile-first sizing`).toMatch(/text-4xl/);
      expect(source, `${page} should include a responsive breakpoint`).toMatch(/(?:sm|md|lg|xl):/);
      expect(source, `${page} should avoid fixed desktop-only overflow risks`).toMatch(/(?:min-w-0|overflow-x-auto|grid gap|container)/);
    }
  });

  it("adds controlled admin product uploads, decluttered upload panels, analytics, monitoring, and shareable section links", () => {
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const routerSource = readSource("server/routers.ts");
    const dbSource = readSource("server/db.ts");
    const shopSource = readSource("client/src/pages/Shop.tsx");
    const appSource = readSource("client/src/App.tsx");

    expect(routerSource).toContain("createProduct: adminProcedure");
    expect(routerSource).toContain("uploadProductImage: adminProcedure");
    expect(routerSource).toContain("insights: adminProcedure");
    expect(dbSource).toContain("export async function createProduct");
    expect(dbSource).toContain("export async function adminInsights");
    expect(adminSource).toContain("Add more shop products");
    expect(adminSource).toContain("Upload product image");
    expect(routerSource).toContain("updateProductVariants");
    expect(dbSource).toContain("replaceProductVariants");
    expect(adminSource).toContain("Available colours in stock");
    expect(adminSource).toContain("Colour name|#hexcode|stock");
    expect(adminSource).toContain("Add more gallery images");
    expect(adminSource).toContain("Add or replace service image");
    expect(adminSource).toContain("Add or replace website section image");
    expect(adminSource).toContain("Best-selling analytics");
    expect(adminSource).toContain("Activity monitoring");
    expect(adminSource).toContain("Share different website sections");
    expect(adminSource).toContain("publicSectionLinks");
    expect(shopSource).toContain("product.imageUrl ? <img src={product.imageUrl}");
    expect(appSource).toContain("document.getElementById(hash.slice(1))?.scrollIntoView");
  });

  it("keeps admin dashboard exit paths, clean overview actions, and protected overview data scoped to admin", () => {
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const layoutSource = readSource("client/src/components/DashboardLayout.tsx");
    const routerSource = readSource("server/routers.ts");

    expect(layoutSource).toContain("Back to Website");
    expect(layoutSource).toContain("Back to website homepage");
    expect(layoutSource).toContain("handleSignOut");
    expect(layoutSource).toContain("window.location.assign(`${window.location.origin}/`)");
    expect(layoutSource).toContain("navigateAdminMenu");
    expect(layoutSource).toContain("scrollIntoView({ behavior: \"smooth\", block: \"start\" })");
    expect(adminSource).toContain("Back to Homepage");
    expect(adminSource).toContain("adminOverviewActions");
    expect(adminSource).toContain("Clean admin overview");
    expect(adminSource).toContain("Protected overview");
    expect(adminSource).toContain("openProtectedOverviewSection");
    expect(adminSource).toContain("Refresh overview data");
    expect(adminSource).toContain("overflow-hidden rounded-[2rem]");
    expect(adminSource).toContain("refresh();");
    expect(routerSource).toContain("summary: adminProcedure");
    expect(routerSource).toContain("lists: adminProcedure");
    expect(routerSource).toContain("insights: adminProcedure");
  });

  it("protects the About Us story and CEO image workflow across homepage and admin dashboard breakpoints", () => {
    const homeSource = readSource("client/src/pages/Home.tsx");
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const routerSource = readSource("server/routers.ts");

    expect(homeSource).toContain("From Passion to Power");
    expect(homeSource).toContain("Eby’s Place CEO portrait");
    expect(homeSource).toContain("lg:grid-cols-[minmax(0,1fr)_13rem]");
    expect(homeSource).toContain("sm:w-44 lg:w-52");
    expect(homeSource.indexOf("Join the Eby’s Place list.")).toBeLessThan(homeSource.lastIndexOf("From Passion to Power"));
    expect(homeSource).toContain("review-marquee-track");
    expect(homeSource).toContain("md:text-6xl");
    expect(adminSource).toContain("Upload About Us CEO image");
    expect(adminSource).toContain("CEO / founder image URL");
    expect(adminSource).toContain("lg:grid-cols-3");
    expect(routerSource).toContain("uploadWebsiteSectionImage");
  });
});
