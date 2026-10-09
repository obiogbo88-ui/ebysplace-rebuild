// @ts-nocheck
/**
 * Per-item link previews for shared service and product links.
 *
 * The site is a single-page app, so every URL used to return the same
 * index.html with the generic Eby's Place preview card. WhatsApp, Facebook,
 * iMessage and friends never run JavaScript, so the only way a shared
 * /shop/<slug> or /services?style=<slug> link can show that item's own photo
 * is for the server to write the item's meta tags into the HTML it returns.
 *
 * vercel.json rewrites those two URL shapes to the API function with
 * `__share=product|service&__slug=<slug>`; everything else is unchanged.
 */
import * as db from "./db";

const SITE_ORIGIN = "https://www.ebysplace.com";

export type SharePreviewMeta = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  url: string;
};

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
}

function clip(text: string, max = 200) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Replaces the page's title, description, canonical, Open Graph and Twitter tags. */
export function injectSharePreview(html: string, meta: SharePreviewMeta) {
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const image = escapeAttr(meta.image);
  const imageAlt = escapeAttr(meta.imageAlt);
  const url = escapeAttr(meta.url);
  const setMeta = (source: string, attr: "property" | "name", key: string, value: string) => {
    const pattern = new RegExp(`(<meta\\s+${attr}="${key.replace(/[:.]/g, "\\$&")}"\\s+content=")[^"]*(")`, "i");
    return pattern.test(source) ? source.replace(pattern, `$1${value}$2`) : source;
  };

  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  out = setMeta(out, "name", "description", description);
  out = out.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${url}$2`);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:image", image);
  out = setMeta(out, "property", "og:image:alt", imageAlt);
  out = setMeta(out, "property", "og:url", url);
  out = setMeta(out, "property", "og:type", "product");
  out = setMeta(out, "name", "twitter:image", image);
  out = setMeta(out, "name", "twitter:image:alt", imageAlt);
  // The generic card is 1200x630; item photos are not, so drop the fixed size.
  out = out.replace(/\s*<meta\s+property="og:image:(width|height)"\s+content="[^"]*"\s*\/?>/gi, "");
  return out;
}

export async function getSharePreviewMeta(kind: string, slug: string): Promise<SharePreviewMeta | null> {
  const cleanSlug = String(slug || "").trim().toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) return null;

  if (kind === "product") {
    const products = (await db.listProducts()) as any[];
    const product = products.find((item) => String(item.slug || "").toLowerCase() === cleanSlug);
    const image = product?.imageUrl || product?.image_url;
    if (!product || !image) return null;
    return {
      title: /eby/i.test(product.name) ? `${product.name} | £${product.price}` : `${product.name} | £${product.price} | Eby’s Place`,
      description: clip(product.seoDescription || product.description || `${product.name} from Eby’s Place.`),
      image: absoluteUrl(image),
      imageAlt: `${product.name} from Eby’s Place`,
      url: `${SITE_ORIGIN}/shop/${cleanSlug}`,
    };
  }

  if (kind === "service") {
    const services = (await db.listServices()) as any[];
    const service = services.find((item) => String(item.slug || "").toLowerCase() === cleanSlug);
    if (!service || !service.imageUrl) return null;
    return {
      title: `${service.name} from £${Number(service.priceFrom).toFixed(0)} | Eby’s Place, Bridgwater`,
      description: clip(service.description || `${service.name} at Eby’s Place, Bridgwater.`),
      image: absoluteUrl(service.imageUrl),
      imageAlt: `${service.name} hairstyle by Eby’s Place`,
      url: `${SITE_ORIGIN}/services?style=${encodeURIComponent(cleanSlug)}`,
    };
  }

  return null;
}
