import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

type CartItem = {
  productId: number;
  variantId?: number;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: string;
};

type ProductVariant = {
  id?: number;
  name: string;
  colourHex?: string | null;
  stockQuantity?: number;
};

type ShopProduct = {
  id: number;
  name: string;
  description: string;
  price: string;
  badge?: string | null;
  stockStatus?: string;
  stockQuantity?: number;
  imageUrl?: string | null;
  variants?: ProductVariant[];
};

const fallbackVariant: ProductVariant = { name: "Default", colourHex: "#c8a95a" };
const PRODUCT_IMAGE_FALLBACK_SRC = "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png";
const PRODUCT_THUMBNAIL_SIZES = "(max-width: 767px) calc(100vw - 2rem), (max-width: 1023px) calc((100vw - 4rem) / 2), calc((100vw - 34rem) / 2)";

function previewDescription(description: string) {
  const trimmed = description.trim();
  const firstSentence = trimmed.match(/^[^.!?]+[.!?]/)?.[0]?.trim();
  if (firstSentence) return firstSentence;
  const firstLine = trimmed.split(/\n+/)[0]?.trim();
  return firstLine || trimmed;
}

function readableColourLabel(variant: ProductVariant) {
  return variant.name === "Default" ? "Signature finish" : variant.name;
}

function productMatchesSearch(product: ShopProduct, query: string) {
  const searchableText = [
    product.name,
    product.description,
    product.badge || "",
    product.stockStatus || "",
    ...(product.variants || []).map((variant) => variant.name),
  ].join(" ").toLowerCase();
  return searchableText.includes(query.toLowerCase());
}

function ProductCard({ product, onAdd }: { product: ShopProduct; onAdd: (product: ShopProduct, variant?: ProductVariant) => void }) {
  const variants = product.variants?.length ? product.variants : [fallbackVariant];
  const [selectedVariantKey, setSelectedVariantKey] = useState(String(variants[0]?.id ?? variants[0]?.name ?? "Default"));
  const selectedVariant = variants.find((variant) => String(variant.id ?? variant.name) === selectedVariantKey) ?? variants[0] ?? fallbackVariant;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const selectedColour = selectedVariant.colourHex || "#c8a95a";
  const outOfStock = product.stockStatus === "out_of_stock" || selectedVariant.stockQuantity === 0;
  const collapsedDescription = previewDescription(product.description);
  const canToggleDescription = product.description.trim() !== collapsedDescription;
  const visibleDescription = isDescriptionExpanded ? product.description : collapsedDescription;

  return (
    <article className="lux-card group min-w-0 overflow-hidden p-0">
      <div
        className="relative min-h-[220px] overflow-hidden rounded-t-[1.75rem] border-b border-primary/20"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${selectedColour} 0%, ${selectedColour}dd 24%, rgba(255,255,255,.08) 25%, rgba(14,9,6,.96) 62%), linear-gradient(135deg, ${selectedColour}55, rgba(200,169,90,.18))`,
        }}
      >
        <img
          src={product.imageUrl || PRODUCT_IMAGE_FALLBACK_SRC}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover"
          sizes={PRODUCT_THUMBNAIL_SIZES}
          loading="lazy"
          decoding="async"
          onError={(event) => {
            if (event.currentTarget.src !== PRODUCT_IMAGE_FALLBACK_SRC) event.currentTarget.src = PRODUCT_IMAGE_FALLBACK_SRC;
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.18),transparent_38%,rgba(0,0,0,.45))]" />
        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
          <span className="pill bg-black/55 text-xs text-primary">{product.badge || "Eby’s Pick"}</span>
          <span className="pill bg-black/55 text-xs text-primary">{product.stockStatus?.replace("_", " ") || "available"}</span>
        </div>

      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="serif break-words text-3xl font-bold text-white">{product.name}</h2>
          </div>
          <b className="shrink-0 text-2xl text-primary">£{product.price}</b>
        </div>

        <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-white/72">
          <p className="text-sm leading-6">{visibleDescription}</p>
          {canToggleDescription ? (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-expanded={isDescriptionExpanded}
              onClick={() => setIsDescriptionExpanded((current) => !current)}
            >
              {isDescriptionExpanded ? "Read less" : "Read full details"}
            </button>
          ) : null}
        </div>

        <div className="mt-5 rounded-3xl border border-primary/20 bg-black/20 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-white">Available colours</p>
            <p className="text-xs text-white/60">Current: <span className="text-primary">{readableColourLabel(selectedVariant)}</span></p>
          </div>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label={`${product.name} colours`}>
            {variants.map((variant) => {
              const key = String(variant.id ?? variant.name);
              const active = key === selectedVariantKey;
              const swatchColour = variant.colourHex || "#c8a95a";
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`Preview ${variant.name}`}
                  onClick={() => setSelectedVariantKey(key)}
                  className={`flex min-h-12 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${active ? "border-primary bg-primary/15 text-primary shadow-[0_0_0_4px_rgba(200,169,90,.12)]" : "border-white/15 bg-white/[0.03] text-white/72 hover:border-primary/60 hover:text-white"}`}
                >
                  <span className="h-7 w-7 rounded-full border border-white/30 shadow-inner" style={{ backgroundColor: swatchColour }} />
                  <span>{variant.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={outOfStock}
          className="btn-gold mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onAdd(product, selectedVariant)}
        >
          {outOfStock ? "Currently unavailable" : `Add ${readableColourLabel(selectedVariant)} to bag`}
        </button>
      </div>
    </article>
  );
}

export default function Shop() {
  const { data } = trpc.public.products.useQuery();
  const order = trpc.public.createOrder.useMutation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [delivery, setDelivery] = useState({ customerName: "", customerEmail: "", customerPhone: "", addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", deliveryNote: "" });
  const total = useMemo(() => cart.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0), [cart]);
  const searchQuery = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("search")?.trim() || "";
  }, []);
  const products = useMemo(() => (data ?? []) as ShopProduct[], [data]);
  const visibleProducts = useMemo(
    () => searchQuery ? products.filter((product) => productMatchesSearch(product, searchQuery)) : products,
    [products, searchQuery]
  );
  const checkoutReturn = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const orderId = params.get("order");
    if (payment === "success") return { status: "success" as const, orderId };
    if (payment === "cancelled") return { status: "cancelled" as const, orderId };
    return null;
  }, []);

  const add = (product: ShopProduct, variant?: ProductVariant) => setCart((current) => {
    const key = `${product.id}:${variant?.id ?? variant?.name ?? "default"}`;
    const existing = current.find((item) => `${item.productId}:${item.variantId ?? item.variantName ?? "default"}` === key);
    if (existing) return current.map((item) => `${item.productId}:${item.variantId ?? item.variantName ?? "default"}` === key ? { ...item, quantity: item.quantity + 1 } : item);
    return [...current, { productId: product.id, variantId: variant?.id, productName: product.name, variantName: variant?.name, quantity: 1, unitPrice: product.price }];
  });

  const changeQty = (index: number, quantity: number) => setCart((current) => current.map((item, idx) => idx === index ? { ...item, quantity: Math.max(1, quantity) } : item));
  const remove = (index: number) => setCart((current) => current.filter((_, idx) => idx !== index));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!delivery.addressLine1.trim() || !delivery.city.trim()) {
      toast.error("Please add your delivery address and city before opening secure checkout.");
      return;
    }
    const result = await order.mutateAsync({ ...delivery, items: cart });
    toast.success(result.customerNotification);
    if (result.checkoutUrl) {
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
    }
    setCart([]);
  };

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <div className="grid gap-6 lg:grid-cols-[1fr_.7fr] lg:items-end">
          <div>
            <p className="pill w-fit">Shop</p>
            <h1 className="serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">Premium braid care and accessories.</h1>
            <p className="mt-4 max-w-3xl text-white/75">Choose scalp-friendly braid-care essentials, click available colours to preview each finish, then leave your delivery details at checkout.</p>
          </div>

        </div>

        {searchQuery ? (
          <div className="mt-8 rounded-3xl border border-primary/30 bg-black/25 p-5 text-white" role="status" aria-live="polite">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">Product search</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg font-semibold">
                Showing {visibleProducts.length} result{visibleProducts.length === 1 ? "" : "s"} for <span className="text-primary">“{searchQuery}”</span>
              </p>
              <a className="btn-dark w-fit bg-white/90 px-4 py-2 text-sm" href="/shop">Clear search</a>
            </div>
          </div>
        ) : null}

        {checkoutReturn ? (
          <div className={`mt-8 rounded-3xl border p-5 ${checkoutReturn.status === "success" ? "border-primary/35 bg-primary/10 text-primary" : "border-white/15 bg-white/[0.05] text-white/78"}`} role="status">
            <p className="font-semibold">{checkoutReturn.status === "success" ? "Stripe payment successful" : "Stripe checkout cancelled"}</p>
            <p className="mt-2 text-sm leading-6">
              {checkoutReturn.status === "success"
                ? `Thank you. Your Eby’s Place shop order${checkoutReturn.orderId ? ` #${checkoutReturn.orderId}` : ""} has returned from Stripe, and a receipt will be sent to the email used at checkout once payment is confirmed.`
                : `Your Eby’s Place shop order${checkoutReturn.orderId ? ` #${checkoutReturn.orderId}` : ""} was not paid. You can adjust your bag and start secure Stripe checkout again when ready.`}
            </p>
          </div>
        ) : null}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid gap-6 md:grid-cols-2">
            {visibleProducts.length ? (
              visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={add} />)
            ) : (
              <div className="lux-card md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">No products found</p>
                <h2 className="serif mt-2 text-3xl font-bold">Try another search term.</h2>
                <p className="mt-3 text-white/72">Search by product name, care need, colour, or braid accessory. You can also clear the search to see every Eby’s Place product.</p>
                <a className="btn-gold mt-5" href="/shop">View all products</a>
              </div>
            )}
          </div>

          <aside className="lux-card h-fit min-w-0 lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Checkout</p>
                <h2 className="serif mt-1 text-3xl font-bold">Your bag</h2>
              </div>
              <span className="rounded-full border border-primary/30 px-3 py-1 text-sm text-primary">{cart.length} item{cart.length === 1 ? "" : "s"}</span>
            </div>

            {cart.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-white/70">Add a product after choosing a colour to begin checkout.</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {cart.map((item, index) => (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={`${item.productId}-${item.variantId ?? item.variantName ?? "default"}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                      <span className="break-words font-semibold">
                        {item.productName}
                        <small className="block text-primary/85">{item.variantName || "Signature finish"}</small>
                      </span>
                      <b>£{(Number(item.unitPrice) * item.quantity).toFixed(2)}</b>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-sm text-white/65">Qty <input className="ml-2 w-20" type="number" min={1} value={item.quantity} onChange={(event) => changeQty(index, Number(event.target.value))} /></label>
                      <button type="button" className="btn-dark py-2 text-sm" onClick={() => remove(index)}>Remove</button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t border-primary/30 pt-4 text-lg"><span>Total</span><b className="text-primary">£{total.toFixed(2)}</b></div>
              </div>
            )}

            <form onSubmit={submit} className="mt-6 grid gap-3">
              <input required placeholder="Name" value={delivery.customerName} onChange={(event) => setDelivery({ ...delivery, customerName: event.target.value })} />
              <input required type="email" placeholder="Email" value={delivery.customerEmail} onChange={(event) => setDelivery({ ...delivery, customerEmail: event.target.value })} />
              <input placeholder="Phone" value={delivery.customerPhone} onChange={(event) => setDelivery({ ...delivery, customerPhone: event.target.value })} />
              <input required placeholder="Delivery address" value={delivery.addressLine1} onChange={(event) => setDelivery({ ...delivery, addressLine1: event.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input placeholder="Address line 2 (optional)" value={delivery.addressLine2} onChange={(event) => setDelivery({ ...delivery, addressLine2: event.target.value })} />
              <input required placeholder="City" value={delivery.city} onChange={(event) => setDelivery({ ...delivery, city: event.target.value })} />
                <input placeholder="County" value={delivery.county} onChange={(event) => setDelivery({ ...delivery, county: event.target.value })} />
              </div>
              <input placeholder="Postcode (optional if unavailable)" value={delivery.postcode} onChange={(event) => setDelivery({ ...delivery, postcode: event.target.value })} />
              <textarea placeholder="Delivery notes" value={delivery.deliveryNote} onChange={(event) => setDelivery({ ...delivery, deliveryNote: event.target.value })} />
              <button disabled={!cart.length || order.isPending} className="btn-gold disabled:cursor-not-allowed disabled:opacity-50">Pay securely with Stripe</button>
              {order.isSuccess && <p className="rounded-2xl border border-primary/30 bg-primary/10 p-3 font-semibold text-primary">Secure Stripe checkout opened in a new tab.</p>}
              {order.error && <p className="rounded-2xl border border-red-500/40 bg-red-50 p-3 font-semibold text-red-900">{order.error.message}</p>}
            </form>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
