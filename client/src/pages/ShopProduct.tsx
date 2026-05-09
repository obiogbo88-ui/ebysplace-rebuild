import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { navigateWithSmoothScroll } from "@/lib/smoothScroll";
import { SiteFooter, SiteHeader } from "./Home";
import { useLocation } from "wouter";

type ProductVariant = {
  id?: number;
  name: string;
  colourHex?: string | null;
  imageUrl?: string | null;
  stockQuantity?: number;
};

const PRODUCT_IMAGE_FALLBACK_SRC = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png";
const fallbackVariant: ProductVariant = { name: "Default", colourHex: "#c8a95a" };

function readableColourLabel(variant: ProductVariant) {
  return variant.name === "Default" ? "Signature finish" : variant.name;
}

export default function ShopProduct() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.public.products.useQuery();
  const product = useMemo(
    () => ((data ?? []) as Array<{
      id: number;
      name: string;
      description: string;
      price: string;
      badge?: string | null;
      stockStatus?: string;
      stockQuantity?: number;
      imageUrl?: string | null;
      slug?: string;
      seoTitle?: string;
      seoDescription?: string;
      variants?: ProductVariant[];
    }>).find((p) => p.slug === slug),
    [data, slug]
  );

  const variants = product?.variants?.length ? product.variants : [fallbackVariant];
  const [selectedVariantKey, setSelectedVariantKey] = useState(String(variants[0]?.id ?? variants[0]?.name ?? "Default"));
  const selectedVariant = variants.find((v) => String(v.id ?? v.name) === selectedVariantKey) ?? variants[0] ?? fallbackVariant;
  const activeImageUrl = selectedVariant.imageUrl || product?.imageUrl;
  const outOfStock = product?.stockStatus === "out_of_stock" || selectedVariant.stockQuantity === 0;

  if (isLoading) {
    return (
      <div className="luxury-shell">
        <SiteHeader />
        <main className="container section-pad min-h-[40vh]">
          <div className="lux-card mt-10 text-center">
            <p className="text-white/60 text-sm">Loading product…</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="luxury-shell">
        <SiteHeader />
        <main className="container section-pad min-h-[40vh]">
          <div className="lux-card mt-10">
            <p className="pill w-fit text-xs">Product not found</p>
            <h1 className="serif mt-4 text-4xl font-bold">This product is not available.</h1>
            <p className="mt-3 text-white/65">It may have been removed or the link may be outdated.</p>
            <Link href="/shop" className="btn-gold mt-6 inline-flex">View all products</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/shop" className="hover:text-primary transition">Shop</Link>
          <span aria-hidden="true">/</span>
          <span className="text-white/80">{product.name}</span>
        </nav>

        <div className="mt-8 grid gap-8 md:grid-cols-2 lg:gap-12">
          <div
            className="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-primary/20 sm:min-h-[400px]"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${selectedVariant.colourHex || "#c8a95a"} 0%, ${selectedVariant.colourHex || "#c8a95a"}dd 24%, rgba(255,255,255,.08) 25%, rgba(14,9,6,.96) 62%), linear-gradient(135deg, ${selectedVariant.colourHex || "#c8a95a"}55, rgba(200,169,90,.18))`,
            }}
          >
            {activeImageUrl ? (
              <img
                src={activeImageUrl}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
                onError={(event) => {
                  if (event.currentTarget.src !== PRODUCT_IMAGE_FALLBACK_SRC) event.currentTarget.src = PRODUCT_IMAGE_FALLBACK_SRC;
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
                No product image
              </div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.12),transparent_38%,rgba(0,0,0,.38))]" />
            {product.badge && (
              <span className="pill absolute left-5 top-5 bg-black/60 text-xs text-primary">{product.badge}</span>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/80">{product.badge || "Eby's Pick"}</p>
              <h1 className="serif mt-2 text-4xl font-bold leading-tight sm:text-5xl">{product.name}</h1>
              <b className="mt-4 block text-3xl text-primary">£{product.price}</b>
              <span className={`pill mt-3 inline-block text-xs ${product.stockStatus === "out_of_stock" ? "border-red-400/40 text-red-300" : product.stockStatus === "low_stock" ? "border-yellow-400/40 text-yellow-300" : "text-primary"}`}>
                {product.stockStatus?.replace("_", " ") || "in stock"}
              </span>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-4 text-white/80">
              <p className="text-sm leading-7">{product.description}</p>
            </div>

            {variants.length > 1 && (
              <div className="rounded-3xl border border-primary/20 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Available colours</p>
                <p className="mt-1 text-xs text-white/60">Current: <span className="text-primary">{readableColourLabel(selectedVariant)}</span></p>
                <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label={`${product.name} colours`}>
                  {variants.map((variant) => {
                    const key = String(variant.id ?? variant.name);
                    const active = key === selectedVariantKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`Preview ${variant.name}`}
                        onClick={() => setSelectedVariantKey(key)}
                        className={`flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${active ? "border-primary bg-primary/15 text-primary shadow-[0_0_0_4px_rgba(200,169,90,.12)]" : "border-white/15 bg-white/[0.03] text-white/72 hover:border-primary/60 hover:text-white"}`}
                      >
                        <span className="h-6 w-6 rounded-full border border-white/30 shadow-inner" style={{ backgroundColor: variant.colourHex || "#c8a95a" }} />
                        <span>{variant.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={outOfStock}
              className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigateWithSmoothScroll(`/shop?search=${encodeURIComponent(product.name)}`, setLocation)}
            >
              {outOfStock ? "Currently unavailable" : `Shop ${product.name}`}
            </button>

            <Link href="/shop" className="btn-dark text-center">
              ← Back to all products
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
