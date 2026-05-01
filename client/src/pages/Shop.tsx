import { useMemo, useState } from "react";
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

export default function Shop() {
  const { data = [] } = trpc.public.products.useQuery();
  const order = trpc.public.createOrder.useMutation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [delivery, setDelivery] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    addressLine1: "",
    city: "",
    county: "",
    postcode: "",
    deliveryNote: "",
  });
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0),
    [cart],
  );

  const add = (product: any, variant?: any) =>
    setCart(current => {
      const key = `${product.id}:${variant?.id ?? "default"}`;
      const existing = current.find(item => `${item.productId}:${item.variantId ?? "default"}` === key);
      if (existing) {
        return current.map(item =>
          `${item.productId}:${item.variantId ?? "default"}` === key
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          variantId: variant?.id,
          productName: product.name,
          variantName: variant?.name,
          quantity: 1,
          unitPrice: product.price,
        },
      ];
    });

  const changeQty = (index: number, quantity: number) =>
    setCart(current =>
      current.map((item, idx) => (idx === index ? { ...item, quantity: Math.max(1, quantity) } : item)),
    );

  const remove = (index: number) => setCart(current => current.filter((_, idx) => idx !== index));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await order.mutateAsync({ ...delivery, items: cart });
    setCart([]);
  };

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">The Collection</p>
        <h1 className="serif mt-4 text-5xl font-bold md:text-6xl">
          What you use between appointments matters more.
        </h1>
        <p className="mt-4 max-w-3xl text-white/68">
          Selected hair goods and braid-care products shipped directly to your door.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-5 md:grid-cols-2">
            {(data as any[]).map(product => (
              <article className="lux-card" key={product.id}>
                <span className="pill text-xs">{product.stockStatus?.replace("_", " ")}</span>
                <h2 className="serif mt-4 text-3xl font-bold">{product.name}</h2>
                <p className="mt-3 text-white/65">{product.description}</p>
                <b className="mt-4 block text-2xl text-primary">£{product.price}</b>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(product.variants?.length ? product.variants : [{ name: "Default" }]).map((variant: any) => (
                    <button
                      key={variant.id ?? variant.name}
                      className="btn-dark py-2"
                      onClick={() => add(product, variant)}
                    >
                      {variant.name}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <aside className="lux-card h-fit">
            <h2 className="serif text-3xl font-bold">Your bag</h2>
            {cart.length === 0 ? (
              <p className="mt-4 text-white/60">Add products to begin checkout.</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {cart.map((item, index) => (
                  <div className="rounded-2xl border border-white/10 p-4" key={`${item.productId}-${item.variantId ?? "default"}`}>
                    <div className="flex justify-between gap-3">
                      <span>
                        {item.productName}
                        <small className="block text-white/50">{item.variantName}</small>
                      </span>
                      <b>£{(Number(item.unitPrice) * item.quantity).toFixed(2)}</b>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <label className="text-sm text-white/55">
                        Qty
                        <input
                          className="ml-2 w-20"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={event => changeQty(index, Number(event.target.value))}
                        />
                      </label>
                      <button type="button" className="btn-dark py-2 text-sm" onClick={() => remove(index)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t border-primary/30 pt-4 text-lg">
                  <span>Total</span>
                  <b className="text-primary">£{total.toFixed(2)}</b>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="mt-6 grid gap-3">
              <input required placeholder="Name" value={delivery.customerName} onChange={event => setDelivery({ ...delivery, customerName: event.target.value })} />
              <input required type="email" placeholder="Email" value={delivery.customerEmail} onChange={event => setDelivery({ ...delivery, customerEmail: event.target.value })} />
              <input placeholder="Phone" value={delivery.customerPhone} onChange={event => setDelivery({ ...delivery, customerPhone: event.target.value })} />
              <input required placeholder="Delivery address" value={delivery.addressLine1} onChange={event => setDelivery({ ...delivery, addressLine1: event.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input required placeholder="City" value={delivery.city} onChange={event => setDelivery({ ...delivery, city: event.target.value })} />
                <input placeholder="County" value={delivery.county} onChange={event => setDelivery({ ...delivery, county: event.target.value })} />
              </div>
              <input required placeholder="Postcode" value={delivery.postcode} onChange={event => setDelivery({ ...delivery, postcode: event.target.value })} />
              <textarea placeholder="Delivery notes" value={delivery.deliveryNote} onChange={event => setDelivery({ ...delivery, deliveryNote: event.target.value })} />
              <button disabled={!cart.length || order.isPending} className="btn-gold">
                Create order for fulfilment
              </button>
              {order.isSuccess ? <p className="text-primary">Order captured for admin fulfilment.</p> : null}
              {order.error ? <p className="text-destructive">{order.error.message}</p> : null}
            </form>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
