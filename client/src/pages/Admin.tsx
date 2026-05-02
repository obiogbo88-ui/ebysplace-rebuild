import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CalendarDays,
  Images,
  MessageSquare,
  Package,
  Scissors,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Link as LinkIcon,
  Activity,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type AdminListData = {
  bookings?: any[];
  orders?: any[];
  reviews?: any[];
  products?: any[];
  services?: any[];
  gallery?: any[];
  sections?: any[];
};

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="lux-card bg-card">
      <Icon className="text-primary" />
      <p className="mt-4 text-sm text-white/55">{label}</p>
      <b className="mt-1 block text-3xl text-primary">{value}</b>
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

const galleryCategories = ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"] as const;
const productCategories = ["Accessories", "Aftercare", "Hair Attachments"] as const;
const publicSectionLinks = [
  { label: "Homepage", path: "/" },
  { label: "Services", path: "/services" },
  { label: "Booking", path: "/booking" },
  { label: "Shop", path: "/shop" },
  { label: "AI Try-On", path: "/ai-try-on" },
  { label: "Braiders Near Me", path: "/braiders-near-me" },
  { label: "Gallery", path: "/gallery" },
  { label: "Reviews", path: "/reviews" },
  { label: "Policies", path: "/policies" },
];

const adminOverviewActions = [
  { label: "Bookings", sectionId: "bookings", description: "Review and update appointment statuses." },
  { label: "Orders", sectionId: "orders", description: "Open protected shop order fulfilment." },
  { label: "Products", sectionId: "products", description: "Manage shop stock, colours, prices, and SEO." },
  { label: "Services", sectionId: "services", description: "Update public braid service details." },
  { label: "Gallery", sectionId: "gallery", description: "Add or organise gallery images." },
  { label: "Reviews", sectionId: "reviews", description: "Moderate customer reviews safely." },
] as const;

export default function Admin() {
  const { user } = useAuth();
  const summary = trpc.admin.summary.useQuery(undefined, { retry: false });
  const lists = trpc.admin.lists.useQuery(undefined, { retry: false });
  const insights = trpc.admin.insights.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const refresh = () => {
    utils.admin.lists.invalidate();
    utils.admin.summary.invalidate();
    utils.admin.insights.invalidate();
  };
  const opts = {
    onSuccess: () => {
      refresh();
      toast.success("Admin update saved");
    },
    onError: (error: any) => toast.error(error.message),
  };

  const moderate = trpc.admin.moderateReview.useMutation(opts);
  const updateBooking = trpc.admin.updateBookingStatus.useMutation(opts);
  const updateOrder = trpc.admin.updateOrderStatus.useMutation(opts);
  const updateStock = trpc.admin.updateProductStock.useMutation(opts);
  const updateProductVariants = trpc.admin.updateProductVariants.useMutation(opts);
  const createProduct = trpc.admin.createProduct.useMutation({
    onSuccess: () => {
      refresh();
      setNewProduct({ name: "", slug: "", category: "Accessories", description: "", price: "", imageUrl: "", badge: "", stockQuantity: 0, seoTitle: "", seoDescription: "", colourChoices: "" });
      toast.success("Shop product uploaded");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const updateProduct = trpc.admin.updateProduct.useMutation(opts);
  const updateService = trpc.admin.updateService.useMutation(opts);
  const uploadProductImage = trpc.admin.uploadProductImage.useMutation({
    onSuccess: (uploaded, variables) => {
      if (!variables.productId) setNewProduct((current) => ({ ...current, imageUrl: uploaded.url }));
      refresh();
      toast.success(variables.productId ? "Product image uploaded and saved" : "Product image uploaded. Add the product details and save it to the shop.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const uploadServiceImage = trpc.admin.uploadServiceImage.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Service image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const uploadGalleryImage = trpc.admin.uploadGalleryImage.useMutation({
    onSuccess: (uploaded) => {
      setGallery((current) => ({ ...current, imageUrl: uploaded.url }));
      toast.success("Gallery image uploaded. Add a title and save it to the gallery.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const uploadWebsiteSectionImage = trpc.admin.uploadWebsiteSectionImage.useMutation({
    onSuccess: (uploaded) => {
      setContent((current) => ({ ...current, imageUrl: uploaded.url }));
      refresh();
      toast.success("About Us CEO image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const addGallery = trpc.admin.addGalleryImage.useMutation({
    onSuccess: () => {
      refresh();
      setGallery({ title: "", category: "Braids", imageUrl: "", altText: "", sortOrder: 0 });
      toast.success("Gallery image saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const updateContent = trpc.admin.updateWebsiteSection.useMutation(opts);
  const [gallery, setGallery] = useState({ title: "", category: "Braids", imageUrl: "", altText: "", sortOrder: 0 });
  const [newProduct, setNewProduct] = useState({ name: "", slug: "", category: "Accessories", description: "", price: "", imageUrl: "", badge: "", stockQuantity: 0, seoTitle: "", seoDescription: "", colourChoices: "" });
  const [content, setContent] = useState({ sectionKey: "about_us", title: "", eyebrow: "", body: "", ctaLabel: "", ctaHref: "", imageUrl: "" });
  const [uploadingServiceId, setUploadingServiceId] = useState<number | null>(null);
  const data = (lists.data || {}) as AdminListData;
  const siteOrigin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);
  const makePublicLink = (path: string) => `${siteOrigin}${path}`;
  const copyPublicLink = async (path: string) => {
    const url = makePublicLink(path);
    await navigator.clipboard.writeText(url);
    toast.success("Shareable link copied");
  };
  const openPublicHomepage = () => {
    window.location.assign(`${window.location.origin}/`);
  };
  const openProtectedOverviewSection = (sectionId: string, label: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `${window.location.pathname}#${sectionId}`);
    refresh();
    toast.success(`${label} opened with protected admin data refreshed`);
  };

  function parseColourChoices(rawValue: string) {
    return rawValue.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name = "", colourHex = "#c8a95a", stockQuantity = "0"] = line.split("|").map((part) => part.trim());
      return { name, colourHex, stockQuantity: Math.max(0, Number(stockQuantity) || 0) };
    }).filter((variant) => variant.name && /^#[0-9a-fA-F]{6}$/.test(variant.colourHex));
  }

  function formatColourChoices(variants: any[] = []) {
    return (variants.length ? variants : [{ name: "Signature finish", colourHex: "#c8a95a", stockQuantity: 0 }]).map((variant: any) => `${variant.name}|${variant.colourHex || "#c8a95a"}|${Number(variant.stockQuantity) || 0}`).join("\n");
  }

  function readAdminPrice(inputId: string, label: string) {
    const rawValue = (document.getElementById(inputId) as HTMLInputElement).value;
    const numericValue = Number(rawValue);
    if (!rawValue.trim() || !Number.isFinite(numericValue) || numericValue < 0) {
      toast.error(`${label} must be a valid price of 0 or more.`);
      return null;
    }
    return numericValue.toFixed(2);
  }

  async function handleProductImageUpload(product: { id?: number; name: string }, file?: File) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadProductImage.mutateAsync({ productId: product.id, productName: product.name || "new-product", dataUrl, fileName: file.name });
    } catch (error: any) {
      toast.error(error.message || "Product image upload failed");
    }
  }

  async function handleServiceImageUpload(service: any, file?: File) {
    if (!file) return;
    try {
      setUploadingServiceId(service.id);
      const dataUrl = await fileToDataUrl(file);
      await uploadServiceImage.mutateAsync({ serviceId: service.id, serviceName: service.name, dataUrl, fileName: file.name });
    } catch (error: any) {
      toast.error(error.message || "Service image upload failed");
    } finally {
      setUploadingServiceId(null);
    }
  }

  async function handleGalleryImageUpload(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadGalleryImage.mutateAsync({ dataUrl, fileName: file.name });
    } catch (error: any) {
      toast.error(error.message || "Gallery image upload failed");
    }
  }

  async function handleWebsiteSectionImageUpload(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadWebsiteSectionImage.mutateAsync({ sectionKey: content.sectionKey || "about_us", dataUrl, fileName: file.name });
    } catch (error: any) {
      toast.error(error.message || "About Us CEO image upload failed");
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="pill w-fit">Role-based backend</p>
            <h1 className="serif mt-3 text-4xl font-bold leading-tight gold-text sm:text-5xl">Eby’s Place Admin Dashboard</h1>
            <p className="mt-3 max-w-3xl text-white/60">
              Manage bookings, services, ecommerce orders, stock, gallery assets, moderated reviews, AI try-on records,
              homepage content, uploaded service media, and performance indicators from one secure area.
            </p>
          </div>
          <div className="lux-card grid gap-3 py-4">
            <div>
              <p className="text-sm text-white/55">Signed in as</p>
              <b>{user?.name || user?.email || "Admin"}</b>
              <p className="text-xs text-primary">{user?.role}</p>
            </div>
            <button className="btn-dark py-2 text-sm" type="button" onClick={openPublicHomepage}>Back to Homepage</button>
          </div>
        </div>

        {summary.error && (
          <div className="lux-card border-destructive/50">
            <h2 className="font-bold text-destructive">Admin access required</h2>
            <p className="mt-2 text-white/65">
              This dashboard is protected by role-based access control. Sign in with the site owner account or promote the
              user role to admin.
            </p>
          </div>
        )}

        <section id="overview" className="mt-8 overflow-hidden rounded-[2rem] border border-primary/20 bg-card/95 p-5 shadow-[0_24px_80px_rgba(46,27,16,.12)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="pill w-fit">Protected overview</p>
              <h2 className="serif mt-3 text-3xl font-bold text-primary">Clean admin overview</h2>
              <p className="mt-2 text-sm text-white/65">Use these protected shortcuts to open each admin area, refresh live dashboard data, and keep the overview clear without stacked overlays.</p>
            </div>
            <button className="btn-gold w-fit py-2 text-sm" type="button" onClick={refresh}>Refresh overview data</button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {adminOverviewActions.map((action) => (
              <button className="rounded-2xl border border-white/10 bg-white/70 p-4 text-left transition hover:border-primary/40 hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" type="button" key={action.sectionId} onClick={() => openProtectedOverviewSection(action.sectionId, action.label)}>
                <b className="text-primary">{action.label}</b>
                <small className="mt-1 block text-white/55">{action.description}</small>
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Bookings" value={summary.data?.bookings ?? 0} icon={CalendarDays} />
            <Stat label="Orders" value={summary.data?.orders ?? 0} icon={ShoppingBag} />
            <Stat label="Pending reviews" value={summary.data?.pendingReviews ?? 0} icon={MessageSquare} />
            <Stat label="Products" value={summary.data?.products ?? 0} icon={Package} />
            <Stat label="Services" value={summary.data?.services ?? 0} icon={Scissors} />
            <Stat label="AI try-ons" value={summary.data?.tryOns ?? 0} icon={Sparkles} />
          </div>
        </section>

        <section id="control-center" className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="lux-card">
            <TrendingUp className="text-primary" />
            <h2 className="serif mt-3 text-3xl font-bold">Best-selling analytics</h2>
            <p className="mt-2 text-sm text-white/55">Track the strongest shop products, booked braid styles, and requested services from real shop, booking, and AI Try-On activity.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><b className="text-primary">Products</b>{(insights.data?.bestSellingProducts || []).length ? (insights.data?.bestSellingProducts || []).map((item: any) => <p className="mt-3 text-sm" key={item.label}>{item.label}<small className="block text-white/45">{item.units} sold · £{Number(item.revenue || 0).toFixed(2)}</small></p>) : <p className="mt-3 text-sm text-white/45">No paid product sales yet.</p>}</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><b className="text-primary">Braid styles & services</b>{(insights.data?.bestBookedServices || []).length ? (insights.data?.bestBookedServices || []).map((item: any) => <p className="mt-3 text-sm" key={item.label}>{item.label}<small className="block text-white/45">{item.total} bookings</small></p>) : <p className="mt-3 text-sm text-white/45">No booking volume yet.</p>}</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><b className="text-primary">AI Try-On styles</b>{(insights.data?.bestTriedStyles || []).length ? (insights.data?.bestTriedStyles || []).map((item: any) => <p className="mt-3 text-sm" key={item.label}>{item.label}<small className="block text-white/45">{item.total} try-ons</small></p>) : <p className="mt-3 text-sm text-white/45">No try-on style data yet.</p>}</div>
            </div>
          </div>
          <div className="lux-card">
            <Activity className="text-primary" />
            <h2 className="serif mt-3 text-3xl font-bold">Activity monitoring</h2>
            <p className="mt-2 text-sm text-white/55">Monitor recent bookings, orders, reviews, visits, AI Try-On generations, and newsletter actions in one compact feed.</p>
            <div className="mt-4 max-h-[22rem] overflow-y-auto pr-2">
              {(insights.data?.recentActivity || []).length ? (insights.data?.recentActivity || []).map((item: any, index: number) => <div className="border-t border-white/10 py-3 text-sm" key={`${item.type}-${index}`}><b className="text-primary">{item.type}</b><span className="ml-2">{item.label}</span><small className="block text-white/45">{item.detail}</small></div>) : <p className="text-sm text-white/45">No recent activity to show yet.</p>}
            </div>
          </div>
        </section>

        <section id="shareable-links" className="mt-8 lux-card">
          <LinkIcon className="text-primary" />
          <h2 className="serif mt-3 text-3xl font-bold">Share different website sections</h2>
          <p className="mt-2 text-sm text-white/55">Copy a direct link to each major public section so you can share the shop, gallery, booking, AI Try-On, reviews, or policies without changing the visitor journey.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicSectionLinks.map((link) => <button className="btn-dark justify-between py-3" key={link.path} onClick={() => copyPublicLink(link.path)}><span>{link.label}</span><small className="text-primary">Copy link</small></button>)}
          </div>
        </section>

        <section id="bookings" className="mt-10 lux-card">
          <h2 className="serif text-3xl font-bold">Bookings manager</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-primary">
                <tr><th>Client</th><th>Service</th><th>Date</th><th>Deposit</th><th>Status</th><th>Change status</th></tr>
              </thead>
              <tbody>
                {(data.bookings || []).map((booking: any) => (
                  <tr className="border-t border-white/10" key={booking.id}>
                    <td className="py-3">{booking.clientName}<small className="block text-white/45">{booking.clientEmail}</small></td>
                    <td>{booking.serviceName}</td>
                    <td>{booking.appointmentDate} {booking.appointmentTime}</td>
                    <td>{booking.depositStatus}</td>
                    <td>{booking.status}</td>
                    <td>
                      <select value={booking.status} onChange={(event) => updateBooking.mutate({ id: booking.id, status: event.target.value as any })}>
                        <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="orders" className="mt-8 lux-card">
          <h2 className="serif text-3xl font-bold">Shop orders and delivery</h2>
          <div className="mt-5 grid gap-4">
            {(data.orders || []).length ? data.orders!.map((order: any) => (
              <div className="rounded-2xl border border-white/10 p-4" key={order.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <div><b>{order.customerName}</b><p className="text-sm text-white/55">{order.customerEmail} · {order.addressLine1}, {order.city}, {order.postcode}</p></div>
                  <select value={order.status} onChange={(event) => updateOrder.mutate({ id: order.id, status: event.target.value as any })}>
                    <option value="draft">Draft</option><option value="pending_payment">Pending payment</option><option value="paid">Paid</option><option value="fulfilling">Fulfilling</option><option value="shipped">Shipped</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            )) : <p className="text-white/55">No shop orders yet.</p>}
          </div>
        </section>

        <section id="reviews" className="mt-8 lux-card">
          <h2 className="serif text-3xl font-bold">Reviews moderator</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {(data.reviews || []).map((review: any) => (
              <div className="rounded-2xl border border-white/10 p-4" key={review.id}>
                <div className="text-primary">{"★".repeat(review.rating)}</div>
                <p className="mt-2 text-white/70">{review.reviewText}</p>
                <b className="mt-3 block">{review.customerName}</b>
                <p className="text-xs text-white/45">Status: {review.status}</p>
                <div className="mt-4 flex gap-2">
                  <button className="btn-gold py-2" onClick={() => moderate.mutate({ id: review.id, status: "approved" })}>Approve</button>
                  <button className="btn-dark py-2" onClick={() => moderate.mutate({ id: review.id, status: "rejected" })}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <div id="products" className="lux-card">
            <h2 className="serif text-3xl font-bold"><Package className="mr-2 inline text-primary" />Products, prices, stock & SEO</h2>
            <p className="mt-2 text-sm text-white/65">Edit product names, prices, search-friendly slugs, SEO titles, and meta descriptions here. Changes refresh the admin dashboard and public shop after saving.</p>
            <details className="mt-5 rounded-2xl border border-primary/20 bg-black/20 p-4">
              <summary className="cursor-pointer font-semibold text-primary">Add more shop products</summary>
              <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); const price = Number(newProduct.price); if (!Number.isFinite(price) || price < 0) { toast.error("Product price must be valid."); return; } createProduct.mutate({ name: newProduct.name, slug: (newProduct.slug || newProduct.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), category: newProduct.category as any, description: newProduct.description, price: price.toFixed(2), imageUrl: newProduct.imageUrl || undefined, badge: newProduct.badge || undefined, stockQuantity: Number(newProduct.stockQuantity) || 0, seoTitle: newProduct.seoTitle || `${newProduct.name} | Eby’s Place`, seoDescription: newProduct.seoDescription || newProduct.description, stockStatus: "in_stock", isFeatured: "false", variants: parseColourChoices(newProduct.colourChoices) }); }}>
                <div className="grid gap-3 sm:grid-cols-2"><input required placeholder="Product name" value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} /><input placeholder="SEO slug" value={newProduct.slug} onChange={(event) => setNewProduct({ ...newProduct, slug: event.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2"><select value={newProduct.category} onChange={(event) => setNewProduct({ ...newProduct, category: event.target.value })}>{productCategories.map((category) => <option key={category}>{category}</option>)}</select><input required type="number" min="0" step="0.01" placeholder="Price (£)" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} /></div>
                <textarea required placeholder="Public product description" value={newProduct.description} onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2"><input placeholder="Badge" value={newProduct.badge} onChange={(event) => setNewProduct({ ...newProduct, badge: event.target.value })} /><input type="number" min="0" placeholder="Stock quantity" value={newProduct.stockQuantity} onChange={(event) => setNewProduct({ ...newProduct, stockQuantity: Number(event.target.value) })} /></div>
                <input placeholder="SEO title" value={newProduct.seoTitle} onChange={(event) => setNewProduct({ ...newProduct, seoTitle: event.target.value })} />
                <textarea placeholder="SEO meta description" value={newProduct.seoDescription} onChange={(event) => setNewProduct({ ...newProduct, seoDescription: event.target.value })} />
                <label className="btn-dark cursor-pointer justify-start"><UploadCloud className="mr-2 h-4 w-4" /> {uploadProductImage.isPending ? "Uploading product image…" : "Upload product image"}<input className="sr-only" type="file" accept="image/*" disabled={uploadProductImage.isPending} onChange={(event) => handleProductImageUpload({ name: newProduct.name }, event.target.files?.[0])} /></label>
                <input placeholder="Product image URL" value={newProduct.imageUrl} onChange={(event) => setNewProduct({ ...newProduct, imageUrl: event.target.value })} />
                <textarea placeholder={"Available colours in stock, one per line: Colour name|#hexcode|stock"} value={newProduct.colourChoices} onChange={(event) => setNewProduct({ ...newProduct, colourChoices: event.target.value })} />
                {newProduct.imageUrl && <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={newProduct.imageUrl} alt="New product preview" /></div>}
                <button className="btn-gold" disabled={createProduct.isPending}>{createProduct.isPending ? "Saving product…" : "Save product to shop"}</button>
              </form>
            </details>
            <div className="mt-5 grid gap-4">
              {(data.products || []).map((product: any) => (
                <div className="rounded-2xl border border-white/10 p-4" key={product.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0"><b className="block break-words">{product.name}</b><small className="block text-white/55">/{product.slug} · {product.stockStatus}</small></span>
                    <b className="text-primary">£{product.price}</b>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Product name<input defaultValue={product.name} id={`product-name-${product.id}`} /></label>
                    <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Shop price (£)<input type="number" min="0" step="0.01" defaultValue={product.price} id={`product-price-${product.id}`} /></label>
                    <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">SEO slug<input defaultValue={product.slug} id={`product-slug-${product.id}`} placeholder="premium-braiding-hair" /></label>
                    <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">SEO page title<input defaultValue={product.seoTitle || `${product.name} | Eby’s Place`} id={`product-seo-title-${product.id}`} /></label>
                    <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">SEO meta description<textarea defaultValue={product.seoDescription || product.description} id={`product-seo-description-${product.id}`} rows={3} /></label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Public description<textarea defaultValue={product.description} id={`product-description-${product.id}`} rows={3} /></label>
                      <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Badge<input defaultValue={product.badge || ""} id={`product-badge-${product.id}`} /></label>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] p-3 text-sm text-white/70"><b className="text-primary">SEO preview:</b> {product.seoTitle || `${product.name} | Eby’s Place`}<span className="block text-white/55">{product.seoDescription || product.description}</span></div>
                    <details className="rounded-2xl border border-primary/20 bg-black/20 p-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Update product image</summary><div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"><input id={`product-image-${product.id}`} defaultValue={product.imageUrl || ""} placeholder="Product image URL" /><label className="btn-dark cursor-pointer py-2"><UploadCloud className="mr-2 h-4 w-4" /> Upload image<input className="sr-only" type="file" accept="image/*" onChange={(event) => handleProductImageUpload(product, event.target.files?.[0])} /></label></div>{product.imageUrl && <div className="mt-3 media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={product.imageUrl} alt={product.name} /></div>}</details>
                    <div className="rounded-2xl border border-primary/20 bg-black/20 p-3 text-sm text-white/70">
                      <b className="block text-primary">Shop colour previews</b>
                      <span className="mt-1 block text-white/55">These are the colour options customers click on the shop page to update the product preview before checkout.</span>
                      <label className="mt-3 grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Available colours in stock<textarea defaultValue={formatColourChoices(product.variants)} id={`product-colours-${product.id}`} rows={4} placeholder="Colour name|#hexcode|stock" /></label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(product.variants?.length ? product.variants : [{ name: "Default", colourHex: "#c8a95a" }]).map((variant: any) => (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2" key={`${product.id}-${variant.id || variant.name}`}>
                            <span className="h-5 w-5 rounded-full border border-white/30" style={{ backgroundColor: variant.colourHex || "#c8a95a" }} />
                            <span>{variant.name}</span>
                            {typeof variant.stockQuantity === "number" && <small className="text-white/45">{variant.stockQuantity} left</small>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="btn-gold py-2" onClick={() => { const price = readAdminPrice(`product-price-${product.id}`, "Shop price"); if (!price) return; updateProduct.mutate({ id: product.id, name: (document.getElementById(`product-name-${product.id}`) as HTMLInputElement).value, price, slug: (document.getElementById(`product-slug-${product.id}`) as HTMLInputElement).value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), seoTitle: (document.getElementById(`product-seo-title-${product.id}`) as HTMLInputElement).value, seoDescription: (document.getElementById(`product-seo-description-${product.id}`) as HTMLTextAreaElement).value, description: (document.getElementById(`product-description-${product.id}`) as HTMLTextAreaElement).value, imageUrl: (document.getElementById(`product-image-${product.id}`) as HTMLInputElement).value || undefined, badge: (document.getElementById(`product-badge-${product.id}`) as HTMLInputElement).value }); updateProductVariants.mutate({ productId: product.id, variants: parseColourChoices((document.getElementById(`product-colours-${product.id}`) as HTMLTextAreaElement).value) }); }}>Save product price, SEO & colours</button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="number" min={0} defaultValue={product.stockQuantity} id={`stock-${product.id}`} />
                    <select defaultValue={product.stockStatus} id={`stock-status-${product.id}`}><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></select>
                    <button className="btn-dark py-2" onClick={() => updateStock.mutate({ id: product.id, stockQuantity: Number((document.getElementById(`stock-${product.id}`) as HTMLInputElement).value), stockStatus: (document.getElementById(`stock-status-${product.id}`) as HTMLSelectElement).value as any })}>Save stock</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="services" className="lux-card">
            <h2 className="serif text-3xl font-bold"><Scissors className="mr-2 inline text-primary" />Services prices editor</h2>
            <p className="mt-2 text-sm text-white/55">Edit service prices and duration, upload a model image for each exact service name, or paste a storage URL manually.</p>
            <div className="mt-5 grid gap-4">
              {(data.services || []).map((service: any) => (
                <div className="rounded-2xl border border-white/10 p-4" key={service.id}>
                  <div className="grid gap-4 md:grid-cols-[128px_1fr]">
                    <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]">
                      {service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <div className="flex h-full items-center justify-center text-xs text-white/35">No image</div>}
                    </div>
                    <div>
                      <div className="flex justify-between gap-3"><span>{service.name}<small className="block text-white/45">{service.category} · {service.duration}</small></span><b>£{service.priceFrom}</b></div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Service price (£)<input type="number" min="0" step="0.01" defaultValue={service.priceFrom} id={`price-${service.id}`} /></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Duration<input defaultValue={service.duration} id={`duration-${service.id}`} /></label>
                        <button className="btn-dark py-2" onClick={() => { const priceFrom = readAdminPrice(`price-${service.id}`, "Service price"); if (!priceFrom) return; updateService.mutate({ id: service.id, priceFrom, duration: (document.getElementById(`duration-${service.id}`) as HTMLInputElement).value, imageUrl: (document.getElementById(`service-image-${service.id}`) as HTMLInputElement).value }); }}>Save service price</button>
                      </div>
                      <details className="mt-3 rounded-2xl border border-primary/20 bg-black/20 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-primary">Add or replace service image</summary>
                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                          <input id={`service-image-${service.id}`} defaultValue={service.imageUrl || ""} placeholder="Service image URL" />
                          <label className="btn-dark cursor-pointer py-2">
                            <UploadCloud className="mr-2 h-4 w-4" /> {uploadingServiceId === service.id ? "Uploading…" : "Upload image"}
                            <input className="sr-only" type="file" accept="image/*" disabled={uploadingServiceId === service.id} onChange={(event) => handleServiceImageUpload(service, event.target.files?.[0])} />
                          </label>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-3">
          <div id="gallery" className="lux-card">
            <Images className="text-primary" />
            <h2 className="serif mt-3 text-3xl font-bold">Gallery uploader</h2>
            <p className="mt-2 text-sm text-white/55">Use the expandable add-more control to keep the dashboard clear while still uploading fresh gallery work when needed.</p>
            <details className="mt-4 rounded-2xl border border-primary/20 bg-black/20 p-4">
              <summary className="cursor-pointer font-semibold text-primary">Add more gallery images</summary>
            <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); addGallery.mutate({ ...gallery, category: gallery.category as any }); }}>
              <input required placeholder="Image title" value={gallery.title} onChange={(event) => setGallery({ ...gallery, title: event.target.value })} />
              <select value={gallery.category} onChange={(event) => setGallery({ ...gallery, category: event.target.value })}>
                {galleryCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <label className="btn-dark cursor-pointer justify-start">
                <UploadCloud className="mr-2 h-4 w-4" /> {uploadGalleryImage.isPending ? "Uploading image…" : "Upload gallery image"}
                <input className="sr-only" type="file" accept="image/*" disabled={uploadGalleryImage.isPending} onChange={(event) => handleGalleryImageUpload(event.target.files?.[0])} />
              </label>
              <input required placeholder="S3 image URL" value={gallery.imageUrl} onChange={(event) => setGallery({ ...gallery, imageUrl: event.target.value })} />
              {gallery.imageUrl && <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={gallery.imageUrl} alt="Gallery preview" /></div>}
              <input required placeholder="Alt text" value={gallery.altText} onChange={(event) => setGallery({ ...gallery, altText: event.target.value })} />
              <button className="btn-gold" disabled={addGallery.isPending}>{addGallery.isPending ? "Saving…" : "Add image"}</button>
            </form>
            </details>
            <b className="mt-4 block text-primary">{data.gallery?.length || 0} images</b>
          </div>

          <div className="lux-card">
            <TrendingUp className="text-primary" />
            <h2 className="serif mt-3 text-3xl font-bold">Content & analytics</h2>
            <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); updateContent.mutate(content); }}>
              <input required placeholder="Section key" value={content.sectionKey} onChange={(event) => setContent({ ...content, sectionKey: event.target.value })} />
              <input placeholder="Title" value={content.title} onChange={(event) => setContent({ ...content, title: event.target.value })} />
              <input placeholder="Eyebrow" value={content.eyebrow} onChange={(event) => setContent({ ...content, eyebrow: event.target.value })} />
              <textarea placeholder="Body copy" value={content.body} onChange={(event) => setContent({ ...content, body: event.target.value })} />
              <input placeholder="CTA label" value={content.ctaLabel} onChange={(event) => setContent({ ...content, ctaLabel: event.target.value })} />
              <input placeholder="CTA link" value={content.ctaHref} onChange={(event) => setContent({ ...content, ctaHref: event.target.value })} />
              <details className="rounded-2xl border border-primary/20 bg-black/20 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-primary">Add or replace website section image</summary>
                <div className="mt-3 grid gap-3">
                  <input placeholder="CEO / founder image URL" value={content.imageUrl} onChange={(event) => setContent({ ...content, imageUrl: event.target.value })} />
                  <label className="btn-dark cursor-pointer justify-start">
                    <UploadCloud className="mr-2 h-4 w-4" /> {uploadWebsiteSectionImage.isPending ? "Uploading CEO image…" : "Upload About Us CEO image"}
                    <input className="sr-only" type="file" accept="image/*" disabled={uploadWebsiteSectionImage.isPending} onChange={(event) => handleWebsiteSectionImageUpload(event.target.files?.[0])} />
                  </label>
                  {content.imageUrl && <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={content.imageUrl} alt="About Us CEO preview" /></div>}
                </div>
              </details>
              <p className="text-xs font-semibold text-white/55">Use section key <b>about_us</b> to update the homepage “From Passion to Power” story and CEO portrait panel.</p>
              <button className="btn-gold">Save content section</button>
            </form>
          </div>

          <div id="users" className="lux-card">
            <Users className="text-primary" />
            <h2 className="serif mt-3 text-3xl font-bold">Admin users</h2>
            <p className="mt-3 text-white/60">
              Authentication uses Manus OAuth with admin role protection on every backend dashboard procedure. Promote
              additional admins by updating the user role in the database management panel.
            </p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
