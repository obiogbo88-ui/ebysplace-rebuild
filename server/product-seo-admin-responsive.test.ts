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

  it("keeps SEO metadata in admin only while public shop descriptions stay customer-friendly and collapsible", () => {
    const shopSource = readSource("client/src/pages/Shop.tsx");
    const homeSource = readSource("client/src/pages/Home.tsx");

    expect(shopSource).not.toContain("product.seoTitle");
    expect(shopSource).not.toContain("product.seoDescription");
    expect(shopSource).not.toContain("product.slug");
    expect(shopSource).not.toContain("SEO title");
    expect(shopSource).toContain("function previewDescription(description: string)");
    expect(shopSource).toContain("trimmed.match(/^[^.!?]+[.!?]/)");
    expect(shopSource).toContain("Read full details");
    expect(shopSource).toContain("Read less");
    expect(shopSource).toContain("aria-expanded={isDescriptionExpanded}");
    expect(shopSource).toContain("selectedVariant");
    expect(shopSource).toContain("Add ${readableColourLabel(selectedVariant)} to bag");
    expect(shopSource).toContain("<p className=\"pill w-fit\">Shop</p>");
    expect(shopSource).toContain("payment === \"success\"");
    expect(shopSource).toContain("Stripe payment successful");
    expect(shopSource).toContain("Stripe checkout cancelled");
    expect(shopSource).not.toContain("Better shopping flow");
    expect(shopSource).not.toContain("Selected colour");
    expect(shopSource).not.toContain("admin order manager");
    expect(homeSource).toContain("Shop preview");
    expect(homeSource).toContain("Shop products");
    expect(homeSource).not.toContain("Aftercare with a premium finish.");
    expect(homeSource).not.toContain("Sell braid care, accessories, and hair products");
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

  it("adds controlled admin product uploads, branded click-to-open panels, analytics, monitoring, and removes website-section sharing UI", () => {
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
    expect(adminSource).toContain("Best-selling analytics");
    expect(adminSource).toContain("Analytics and activity monitoring");
    expect(adminSource).toContain("<AdminPanel id=\"bookings\"");
    expect(adminSource).toContain("<AdminPanel id=\"orders\"");
    expect(adminSource).toContain("<AdminPanel id=\"reviews\"");
    expect(adminSource).toContain("<AdminPanel id=\"products\"");
    expect(adminSource).toContain("<AdminPanel id=\"services\"");
    expect(adminSource).toContain("<AdminPanel id=\"gallery\"");
    expect(adminSource).toContain("<AdminPanel id=\"users\"");
    expect(adminSource).toContain("open={isPanelOpen(\"bookings\")}");
    expect(adminSource).toContain("onToggle={() => togglePanel(\"bookings\")}");
    expect(adminSource).toContain("Eby’s Place uses secure owner sign-in");
    expect(adminSource).not.toContain("Share different website sections");
    expect(adminSource).not.toContain("publicSectionLinks");
    expect(adminSource).not.toContain("Add or replace website section image");
    expect(adminSource).not.toContain("Content & analytics");
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
    expect(adminSource).toContain("Eby’s Place command centre");
    expect(adminSource).toContain("Dense records stay hidden until clicked");
    expect(adminSource).toContain("Protected overview");
    expect(adminSource).toContain("openProtectedOverviewSection");
    expect(adminSource).toContain("Refresh overview data");
    expect(adminSource).toContain("overflow-hidden rounded-[2rem]");
    expect(adminSource).toContain("refresh();");
    expect(routerSource).toContain("summary: adminProcedure");
    expect(routerSource).toContain("lists: adminProcedure");
    expect(routerSource).toContain("insights: adminProcedure");
  });

  it("protects the About Us story and round image workflow across homepage and admin dashboard breakpoints", () => {
    const homeSource = readSource("client/src/pages/Home.tsx");
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const routerSource = readSource("server/routers.ts");

    expect(homeSource).toContain("Our Story");
    expect(homeSource).toContain("From Passion to Power");
    expect(homeSource).toContain("Eby’s Place round story portrait");
    expect(homeSource).toContain("h-32 w-32");
    expect(homeSource).toContain("sm:h-36 sm:w-36");
    expect(homeSource).toContain("portraitDescription");
    expect(homeSource.indexOf("Join the Eby’s Place list.")).toBeLessThan(homeSource.lastIndexOf("From Passion to Power"));
    expect(homeSource).toContain("review-marquee-track");
    expect(homeSource).toContain("md:text-6xl");
    expect(adminSource).toContain("AdminPanel id=\"content\"");
    expect(adminSource).toContain("Upload About Us round image");
    expect(adminSource).toContain("Description beneath round image");
    expect(adminSource).toContain("AdminPanel id=\"gallery\"");
    expect(routerSource).toContain("uploadWebsiteSectionImage");
    expect(routerSource).toContain("portraitImageUrl");
    expect(routerSource).toContain("portraitDescription");
  });
});
