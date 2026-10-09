import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const shareSource = readSource("client/src/components/ShareLinkButton.tsx");
const servicesSource = readSource("client/src/pages/Services.tsx");
const shopSource = readSource("client/src/pages/Shop.tsx");
const gallerySource = readSource("client/src/pages/Gallery.tsx");

describe("shareable service and product links", () => {
  it("shares absolute ebysplace.com links via the native share sheet with a copy fallback", () => {
    expect(shareSource).toContain('const SITE_ORIGIN = "https://www.ebysplace.com"');
    expect(shareSource).toContain("navigator.share");
    expect(shareSource).toContain("navigator.clipboard.writeText");
  });

  it("gives every service a deep link that scrolls to and highlights it", () => {
    expect(servicesSource).toContain("/services?style=${encodeURIComponent(service.slug)}");
    expect(servicesSource).toContain('get("style")');
    expect(servicesSource).toContain("id={`service-${service.slug}`}");
    expect(servicesSource).toContain("<ShareLinkButton");
  });

  it("shares product pages but not the picture gallery", () => {
    expect(shopSource).toContain("<ShareLinkButton path={productPublicPath(product)}");
    expect(gallerySource).not.toContain("ShareLinkButton");
  });
});
