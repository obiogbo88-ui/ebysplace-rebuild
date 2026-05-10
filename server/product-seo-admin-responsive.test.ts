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

    expect(shopSource).toContain("function productPublicPath(product: ShopProduct)");
    expect(shopSource).toContain("/shop/${product.slug}");
    expect(shopSource).toContain("Copy product URL");
    expect(shopSource).toContain("selectedProduct ? selectedProduct.name");
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
    expect(shopSource).toContain("Payment successful");
    expect(shopSource).not.toContain("Stripe payment successful");
    expect(shopSource).toContain("Checkout cancelled");
    expect(shopSource).not.toContain("Stripe checkout cancelled");
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

  it("normalizes shop cart product IDs before submitting checkout items", () => {
    const shopSource = readSource("client/src/pages/Shop.tsx");

    expect(shopSource).toContain("function normalizeProductId(product: ShopProduct)");
    expect(shopSource).toContain("const rawId = product.id ?? (product as ShopProduct & { productId?: number | string }).productId;");
    expect(shopSource).toContain("const productId = normalizeProductId(product);");
    expect(shopSource).toContain("return [...current, { productId, variantId, productName: product.name");
    expect(shopSource).toContain("const checkoutItems = normalizeCartForCheckout(cart);");
    expect(shopSource).toContain("items: checkoutItems");
    expect(shopSource).not.toContain("items: cart");
  });

  it("normalizes booking shop product IDs before submitting booking checkout products", () => {
    const bookingSource = readSource("client/src/pages/Booking.tsx");

    expect(bookingSource).toContain("function normalizeProductId(product: BookingShopProduct)");
    expect(bookingSource).toContain("return parsePositiveInteger(product.id ?? product.productId);");
    expect(bookingSource).toContain("const productId = parsePositiveInteger(item.productId);");
    expect(bookingSource).toContain("const productId = normalizeProductId(product);");
    expect(bookingSource).toContain("This product cannot be added to your booking");
    expect(bookingSource).toContain("function normalizeBookingProductsForCheckout(products: BookingProductSelection[])");
    expect(bookingSource).toContain("const checkoutProducts = normalizeBookingProductsForCheckout(selectedProducts);");
    expect(bookingSource).toContain("bookingProducts: checkoutProducts");
    expect(bookingSource).not.toContain("const productId = Number(product.id);");
    expect(bookingSource).not.toContain("bookingProducts: selectedProducts");
  });

  it("keeps Supabase product IDs valid across admin actions, public product reads, and paid stock reduction", () => {
    const dbSource = readSource("server/db.ts");
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const routerSource = readSource("server/routers.ts");

    expect(dbSource).toContain("const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;");
    expect(dbSource).toContain("const id = Number(row.id);");
    expect(dbSource).toContain("id: Number.isFinite(id) && id > 0 ? id : undefined");
    expect(dbSource).toContain("if (!Number.isFinite(id) || id <= 0) throw new Error(\"A valid Supabase product id is required.\");");
    expect(dbSource).toContain("async function decrementSupabaseProductStock(productId: number, quantity: number, variantId?: number | null)");
    expect(dbSource).toContain("const supabaseProductRows = await listSupabaseProducts();");
    expect(dbSource).toContain("await decrementSupabaseProductStock(item.productId, item.quantity, item.variantId);");
    expect(adminSource).toContain("This product has no database ID. Please reload the page and try again.");
    expect(adminSource).toContain("deleteProduct.mutate({ id: Number(product.id) })");
    expect(adminSource).toContain("updateProductVariants.mutate({ productId: product.id");
    expect(routerSource).toContain("productId: z.number().int().positive()");
  });

  it("keeps admin-managed services, gallery, reviews, website sections, add-ons, and checkout records wired to live database flows", () => {
    const dbSource = readSource("server/db.ts");
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const bookingSource = readSource("client/src/pages/Booking.tsx");
    const homeSource = readSource("client/src/pages/Home.tsx");
    const gallerySource = readSource("client/src/pages/Gallery.tsx");

    expect(dbSource).toContain("export async function listServices(category?: string)");
    expect(dbSource).toContain("export async function updateService(id: number");
    expect(dbSource).toContain("export async function addGalleryImage");
    expect(dbSource).toContain("export async function moderateReview");
    expect(dbSource).toContain("export async function updateWebsiteSection");
    expect(dbSource).toContain("export async function updateBookingStatus");
    expect(dbSource).toContain("export async function updateOrderStatus");
    expect(dbSource).toContain("await db.insert(services).values(seedServices).onConflictDoNothing({");
    expect(dbSource).toContain("await db.insert(products).values(seedProducts).onConflictDoUpdate({");
    expect(adminSource).toContain("updateService.mutate");
    expect(adminSource).toContain("Public product URL");
    expect(adminSource).toContain("Save service price, image & availability");
    expect(adminSource).toContain("updateWebsiteSection.mutate");
    expect(adminSource).toContain("addGallery.mutate");
    expect(bookingSource).toContain("trpc.public.services.useQuery");
    expect(bookingSource).toContain("service.category === \"Add-ons\"");
    expect(bookingSource).toContain("const bookingCheckoutTotal = calculateBookingCheckoutTotal({");
    expect(bookingSource).toContain("addOns: selectedAddOns");
    expect(homeSource).toContain("trpc.public.websiteSections.useQuery");
    expect(homeSource).toContain("trpc.public.featuredServices.useQuery");
    expect(gallerySource).toContain("trpc.public.gallery.useQuery");
  });

  it("keeps booking checkout live Stripe configuration failures clear for production", () => {
    const bookingSource = readSource("client/src/pages/Booking.tsx");
    const routerSource = readSource("server/routers.ts");

    expect(routerSource).toContain("Payment is currently unavailable. Please contact us to complete your booking.");
    expect(routerSource).not.toContain("Live Stripe payments require a live Stripe secret key");
    expect(bookingSource).toContain("bookingCheckoutErrorDescription(error)");
    expect(bookingSource).toContain("Payment is currently unavailable. Please contact us to complete your booking.");
    expect(bookingSource).not.toContain("Settings → Payment");
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
    const homeSource = readSource("client/src/pages/Home.tsx");
    const appSource = readSource("client/src/App.tsx");

    expect(routerSource).toContain("createProduct: adminProcedure");
    expect(routerSource).toContain("uploadProductImage: adminProcedure");
    expect(routerSource).toContain("insights: adminProcedure");
    expect(dbSource).toContain("export async function createProduct");
    expect(dbSource).toContain("export async function adminInsights");
    expect(adminSource).toContain("Add more shop products");
    expect(adminSource).toContain("Upload product image");
    expect(adminSource).toContain("syncProductImageInput(Number(variables.productId), uploaded.url)");
    expect(adminSource).toContain("syncProductImageInput(Number(variables.productId), \"\")");
    expect(adminSource).toContain("key={`product-image-${product.id}-${product.imageUrl || \"empty\"}`}");
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
    expect(shopSource).toContain("PRODUCT_IMAGE_FALLBACK_SRC");
    expect(shopSource).toContain("const selectedVariantImageUrl = selectedVariant.imageUrl?.trim() || \"\"");
    expect(shopSource).toContain("const activeImageUrl = selectedVariantImageUrl || product.imageUrl");
    expect(shopSource).toContain("const activeImageKey = `${product.id}-${selectedVariantKey}-${activeImageUrl || \"colour-preview\"}`;");
    expect(shopSource).toContain("mixBlendMode: hasVariantSpecificImage ? \"soft-light\" : \"color\"");
    expect(shopSource).toContain("const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);");
    expect(shopSource).toContain("Open full picture of ${product.name} in ${selectedColourLabel}");
    expect(shopSource).toContain("role=\"dialog\"");
    expect(shopSource).not.toContain("Previewing {selectedColourLabel}");
    expect(shopSource).not.toContain("Colour tint preview");
    expect(shopSource).toContain("{activeImageUrl ? (");
    expect(shopSource).toContain("No product image");
    expect(shopSource).not.toContain("src={product.imageUrl || PRODUCT_IMAGE_FALLBACK_SRC}");
    expect(homeSource).not.toContain("src={product.imageUrl || PRODUCT_IMAGE_FALLBACK_SRC}");
    expect(shopSource).toContain("onError={(event) =>");
    expect(appSource).toContain('afterRouteScroll(`${location}${window.location.hash || ""}`, 40)');
    expect(appSource).toContain('import { afterRouteScroll, navigateWithSmoothScroll } from "@/lib/smoothScroll";');
  });

  it("clears product image references without deleting stored product image assets", () => {
    const routerSource = readSource("server/routers.ts");
    const clearProductImageStart = routerSource.indexOf("clearProductImage: adminProcedure");
    const uploadServiceImageStart = routerSource.indexOf("uploadServiceImage: adminProcedure");
    const clearProductImageSource = routerSource.slice(clearProductImageStart, uploadServiceImageStart);

    expect(clearProductImageStart).toBeGreaterThan(-1);
    expect(clearProductImageSource).toContain("await db.updateProduct(input.productId, { imageUrl: null });");
    expect(clearProductImageSource).not.toContain("storageRemove");
    expect(clearProductImageSource).toContain("without deleting the underlying Supabase Storage object");
  });

  it("keeps admin dashboard exit paths, clean overview actions, and protected overview data scoped to admin", () => {
    const adminSource = readSource("client/src/pages/Admin.tsx");
    const layoutSource = readSource("client/src/components/DashboardLayout.tsx");
    const routerSource = readSource("server/routers.ts");

    expect(layoutSource).toContain("Back to Website");
    expect(layoutSource).toContain("Back to website homepage");
    expect(layoutSource).toContain("handleSignOut");
    expect(layoutSource).toContain('navigateWithSmoothScroll("/", setLocation)');
    expect(layoutSource).toContain("navigateAdminMenu");
    expect(layoutSource).toContain('smoothScrollToElement(sectionId, 60)');
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
    expect(homeSource).toContain("Eberechi Ogbo | Founder & Service Lead");
    expect(homeSource).toContain("h-32 w-32");
    expect(homeSource).toContain("sm:h-36 sm:w-36");
    expect(homeSource).toContain("object-[center_18%]");
    expect(homeSource).not.toContain("low-tension styling");
    expect(homeSource).not.toContain("clean salon finish");
    expect(homeSource).not.toContain("hairline-first care");
    expect(homeSource.indexOf("Join the Eby’s Place list.")).toBeLessThan(homeSource.lastIndexOf("From Passion to Power"));
    expect(homeSource).toContain("review-marquee-track");
    expect(homeSource).toContain("md:text-6xl");
    expect(adminSource).toContain("AdminPanel id=\"content\"");
    expect(adminSource).toContain("Upload About Us round image");
    expect(adminSource).toContain("Description beneath round image");
    expect(adminSource).toContain("Eberechi Ogbo | Founder & Service Lead");
    expect(adminSource).toContain("AdminPanel id=\"gallery\"");
    expect(routerSource).toContain("uploadWebsiteSectionImage");
    expect(routerSource).toContain("portraitImageUrl");
    expect(routerSource).toContain("portraitDescription");
  });
});
