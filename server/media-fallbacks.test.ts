import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const productFallback = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png";
const aboutFallback = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-about-story-portrait.png";

describe("public media fallbacks", () => {
  it("keeps product and About image fallbacks on canonical Supabase public URLs", () => {
    const dbSource = readFileSync(join(root, "server/db.ts"), "utf8");
    const shopSource = readFileSync(join(root, "client/src/pages/Shop.tsx"), "utf8");
    const homeSource = readFileSync(join(root, "client/src/pages/Home.tsx"), "utf8");

    expect(dbSource).toContain(productFallback);
    expect(dbSource).toContain(aboutFallback);
    expect(shopSource).toContain(productFallback);
    expect(homeSource).toContain(aboutFallback);
  });

  it("guards product and About image elements with onError fallbacks", () => {
    const shopSource = readFileSync(join(root, "client/src/pages/Shop.tsx"), "utf8");
    const homeSource = readFileSync(join(root, "client/src/pages/Home.tsx"), "utf8");
    const servicesSource = readFileSync(join(root, "client/src/pages/Services.tsx"), "utf8");
    const bookingSource = readFileSync(join(root, "client/src/pages/Booking.tsx"), "utf8");
    const adminSource = readFileSync(join(root, "client/src/pages/Admin.tsx"), "utf8");

    expect(shopSource).toContain("PRODUCT_IMAGE_FALLBACK_SRC");
    expect(shopSource).toContain("onError={(event) =>");
    expect(homeSource).toContain("ABOUT_PORTRAIT_FALLBACK_SRC");
    expect(homeSource).toContain("onError={(event) =>");
    expect(homeSource).toContain("getServiceImageSrc");
    expect(servicesSource).toContain("getServiceImageSrc");
    expect(bookingSource).toContain("getServiceImageSrc");
    expect(adminSource).toContain("getServiceImageSrc");
    expect(adminSource).toContain("getServiceImageFallback");
  });

  it("lazy-loads every product image surface to reduce initial page weight", () => {
    const shopSource = readFileSync(join(root, "client/src/pages/Shop.tsx"), "utf8");
    const adminSource = readFileSync(join(root, "client/src/pages/Admin.tsx"), "utf8");

    expect(shopSource).toContain('loading="lazy"');
    expect(shopSource).toContain('decoding="async"');
    expect(adminSource).toContain('alt="New product preview" loading="lazy" decoding="async"');
    expect(adminSource).toContain('alt={product.name} loading="lazy" decoding="async"');
  });
});
