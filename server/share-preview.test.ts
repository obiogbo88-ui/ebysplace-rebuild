import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { injectSharePreview } from "./sharePreview";

const indexHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));

const meta = {
  title: "Weave Sew-In from £80 | Eby’s Place, Bridgwater",
  description: "Natural-looking weave sew-in & more",
  image: "https://www.ebysplace.com/weave-sew-in-bridgwater.jpg",
  imageAlt: "Weave Sew-In hairstyle by Eby’s Place",
  url: "https://www.ebysplace.com/services?style=weave-sew-in",
};

describe("per-item share previews", () => {
  const html = injectSharePreview(indexHtml, meta);

  it("puts the item's own photo, title and link in the Open Graph and Twitter tags", () => {
    expect(html).toContain('<meta property="og:image" content="https://www.ebysplace.com/weave-sew-in-bridgwater.jpg"');
    expect(html).toContain('<meta name="twitter:image" content="https://www.ebysplace.com/weave-sew-in-bridgwater.jpg"');
    expect(html).toContain('<meta property="og:title" content="Weave Sew-In from £80 | Eby’s Place, Bridgwater"');
    expect(html).toContain('<meta property="og:url" content="https://www.ebysplace.com/services?style=weave-sew-in"');
    expect(html).toContain("<title>Weave Sew-In from £80 | Eby’s Place, Bridgwater</title>");
    expect(html).toContain('<meta property="og:description" content="Natural-looking weave sew-in &amp; more"');
  });

  it("drops the generic card's fixed 1200x630 size and leaves no generic image behind", () => {
    expect(html).not.toContain("og:image:width");
    // The generic card may remain in the business JSON-LD, but not in any preview tag.
    const previewTags = html.match(/<meta\s+(property|name)="(og|twitter):[^>]*>/g) ?? [];
    expect(previewTags.length).toBeGreaterThan(5);
    expect(previewTags.join("\n")).not.toContain("ebysplace-link-preview_6583844d");
  });

  it("routes shared product and service links through the preview renderer before the SPA fallback", () => {
    const sources = vercelConfig.rewrites.map((rule: { source: string }) => rule.source);
    expect(sources.indexOf("/shop/:slug")).toBeLessThan(sources.indexOf("/:path*"));
    expect(sources.indexOf("/services")).toBeLessThan(sources.indexOf("/:path*"));
  });
});
