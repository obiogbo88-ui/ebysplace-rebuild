import { useState } from "react";
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

export default function Admin() {
  const { user } = useAuth();
  const summary = trpc.admin.summary.useQuery(undefined, { retry: false });
  const lists = trpc.admin.lists.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const refresh = () => {
    utils.admin.lists.invalidate();
    utils.admin.summary.invalidate();
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
  const updateService = trpc.admin.updateService.useMutation(opts);
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
  const [content, setContent] = useState({ sectionKey: "homepage_hero", title: "", eyebrow: "", body: "", ctaLabel: "", ctaHref: "" });
  const [uploadingServiceId, setUploadingServiceId] = useState<number | null>(null);
  const data = (lists.data || {}) as AdminListData;

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

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="pill w-fit">Role-based backend</p>
            <h1 className="serif mt-3 text-5xl font-bold gold-text">Eby’s Place Admin Dashboard</h1>
            <p className="mt-3 max-w-3xl text-white/60">
              Manage bookings, services, ecommerce orders, stock, gallery assets, moderated reviews, AI try-on records,
              homepage content, uploaded service media, and performance indicators from one secure area.
            </p>
          </div>
          <div className="lux-card py-4">
            <p className="text-sm text-white/55">Signed in as</p>
            <b>{user?.name || user?.email || "Admin"}</b>
            <p className="text-xs text-primary">{user?.role}</p>
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

        <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Bookings" value={summary.data?.bookings ?? 0} icon={CalendarDays} />
          <Stat label="Orders" value={summary.data?.orders ?? 0} icon={ShoppingBag} />
          <Stat label="Pending reviews" value={summary.data?.pendingReviews ?? 0} icon={MessageSquare} />
          <Stat label="Products" value={summary.data?.products ?? 0} icon={Package} />
          <Stat label="Services" value={summary.data?.services ?? 0} icon={Scissors} />
          <Stat label="AI try-ons" value={summary.data?.tryOns ?? 0} icon={Sparkles} />
        </div>

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
            <h2 className="serif text-3xl font-bold"><Package className="mr-2 inline text-primary" />Products & stock</h2>
            <div className="mt-5 grid gap-3">
              {(data.products || []).map((product: any) => (
                <div className="rounded-2xl border border-white/10 p-4" key={product.id}>
                  <div className="flex justify-between gap-3"><span>{product.name}<small className="block text-white/45">{product.stockStatus}</small></span><b>£{product.price}</b></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="number" min={0} defaultValue={product.stockQuantity} id={`stock-${product.id}`} />
                    <select defaultValue={product.stockStatus} id={`stock-status-${product.id}`}><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></select>
                    <button className="btn-dark py-2" onClick={() => updateStock.mutate({ id: product.id, stockQuantity: Number((document.getElementById(`stock-${product.id}`) as HTMLInputElement).value), stockStatus: (document.getElementById(`stock-status-${product.id}`) as HTMLSelectElement).value as any })}>Save stock</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="services" className="lux-card">
            <h2 className="serif text-3xl font-bold"><Scissors className="mr-2 inline text-primary" />Services editor</h2>
            <p className="mt-2 text-sm text-white/55">Upload a model image for each exact service name, or paste a storage URL manually.</p>
            <div className="mt-5 grid gap-4">
              {(data.services || []).map((service: any) => (
                <div className="rounded-2xl border border-white/10 p-4" key={service.id}>
                  <div className="grid gap-4 md:grid-cols-[96px_1fr]">
                    <div className="h-24 overflow-hidden rounded-2xl border border-primary/20 bg-black/30">
                      {service.imageUrl ? <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-white/35">No image</div>}
                    </div>
                    <div>
                      <div className="flex justify-between gap-3"><span>{service.name}<small className="block text-white/45">{service.category} · {service.duration}</small></span><b>£{service.priceFrom}</b></div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input defaultValue={service.priceFrom} id={`price-${service.id}`} />
                        <input defaultValue={service.duration} id={`duration-${service.id}`} />
                        <button className="btn-dark py-2" onClick={() => updateService.mutate({ id: service.id, priceFrom: (document.getElementById(`price-${service.id}`) as HTMLInputElement).value, duration: (document.getElementById(`duration-${service.id}`) as HTMLInputElement).value, imageUrl: (document.getElementById(`service-image-${service.id}`) as HTMLInputElement).value })}>Save service</button>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                        <input id={`service-image-${service.id}`} defaultValue={service.imageUrl || ""} placeholder="Service image URL" />
                        <label className="btn-dark cursor-pointer py-2">
                          <UploadCloud className="mr-2 h-4 w-4" /> {uploadingServiceId === service.id ? "Uploading…" : "Upload image"}
                          <input className="sr-only" type="file" accept="image/*" disabled={uploadingServiceId === service.id} onChange={(event) => handleServiceImageUpload(service, event.target.files?.[0])} />
                        </label>
                      </div>
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
            <p className="mt-2 text-sm text-white/55">Upload a new gallery image, confirm the generated URL, then save it with the right category and alt text.</p>
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
              {gallery.imageUrl && <img src={gallery.imageUrl} alt="Gallery preview" className="h-36 w-full rounded-2xl object-cover" />}
              <input required placeholder="Alt text" value={gallery.altText} onChange={(event) => setGallery({ ...gallery, altText: event.target.value })} />
              <button className="btn-gold" disabled={addGallery.isPending}>{addGallery.isPending ? "Saving…" : "Add image"}</button>
            </form>
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
