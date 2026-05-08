import { useState, type ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { navigateWithSmoothScroll, smoothScrollToElement } from "@/lib/smoothScroll";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import heic2any from "heic2any";
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
  Activity,
  Users,
  Mail,
  Trash2,
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
  availability?: { blockedSlots?: any[]; homeServiceSurcharge?: string };
  instagram?: { handle?: string; feedUrl?: string; enabled?: boolean; note?: string };
  emailNotifications?: any[];
};

type AdminGalleryItem = {
  id?: number | string;
  title: string;
  category: string;
  imageUrl: string;
  altText?: string;
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

const ADMIN_UPLOAD_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const ADMIN_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const ADMIN_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_UPLOAD_BASENAME_LENGTH = 120;

function uploadFileExtension(file: File) {
  const lastDot = file.name.lastIndexOf(".");
  return lastDot >= 0 ? file.name.slice(lastDot + 1).toLowerCase() : "";
}

function sanitizeUploadBaseName(fileName: string) {
  return (fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || "upload").slice(0, MAX_UPLOAD_BASENAME_LENGTH);
}

function isHeicLikeFile(file: File) {
  const extension = uploadFileExtension(file);
  const mime = (file.type || "").toLowerCase();
  return extension === "heic" || extension === "heif" || mime === "image/heic" || mime === "image/heif";
}

async function normalizeAdminUploadFile(file: File) {
  const extension = uploadFileExtension(file);
  const mime = (file.type || "").toLowerCase();
  if (!ADMIN_ALLOWED_EXTENSIONS.has(extension) || !ADMIN_ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error("Allowed image formats: jpg, jpeg, png, webp, heic, heif.");
  }
  if (!isHeicLikeFile(file)) return file;

  let conversionResult: Blob | Blob[];
  try {
    conversionResult = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  } catch {
    throw new Error("HEIC/HEIF conversion failed. Please try a different image or use Safari/Chrome on a recent iPhone.");
  }
  const normalizedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
  if (!(normalizedBlob instanceof Blob)) {
    throw new Error("Could not convert HEIC/HEIF image. Please try another photo.");
  }
  return new File([normalizedBlob], `${sanitizeUploadBaseName(file.name)}.jpg`, { type: "image/jpeg" });
}

const galleryCategories = ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"] as const;
const productCategories = ["Accessories", "Aftercare", "Hair Attachments"] as const;
const adminOverviewActions = [
  { label: "Bookings", sectionId: "bookings", description: "Review and update appointment statuses." },
  { label: "Orders", sectionId: "orders", description: "Open protected shop order fulfilment." },
  { label: "Email Notifications", sectionId: "email-notifications", description: "View email delivery status and resend failed notifications." },
  { label: "Products", sectionId: "products", description: "Manage shop stock, colours, prices, and SEO." },
  { label: "Services", sectionId: "services", description: "Update public braid service details." },
  { label: "Gallery", sectionId: "gallery", description: "Add or organise gallery images." },
  { label: "Reviews", sectionId: "reviews", description: "Moderate customer reviews safely." },
  { label: "Activity", sectionId: "activity-monitoring", description: "Review analytics and live activity monitoring." },
  { label: "Content", sectionId: "content", description: "Update the About Us story, round image, and image description." },
] as const;

type AdminPanelProps = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: any;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function AdminPanel({ id, title, eyebrow, description, icon: Icon, open, onToggle, children }: AdminPanelProps) {
  return (
    <section id={id} className="lux-card overflow-hidden border-primary/20 bg-card/95">
      <button
        type="button"
        className="flex w-full flex-col gap-4 text-left sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={open}
        aria-controls={`${id}-content`}
        onClick={onToggle}
      >
        <span className="flex min-w-0 gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="pill w-fit">{eyebrow}</span>
            <span className="serif mt-3 block text-3xl font-bold leading-tight text-primary">{title}</span>
            <span className="mt-2 block text-sm text-white/60">{description}</span>
          </span>
        </span>
        <span className="btn-dark shrink-0 py-2 text-sm">{open ? "Hide section" : "Open section"}</span>
      </button>
      {open && <div id={`${id}-content`} className="mt-6 border-t border-white/10 pt-6">{children}</div>}
    </section>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const summary = trpc.admin.summary.useQuery(undefined, { retry: false });
  const lists = trpc.admin.lists.useQuery(undefined, { retry: false });
  const insights = trpc.admin.insights.useQuery(undefined, { retry: false });
  const emailLogs = trpc.admin.listEmailNotificationLogs.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const refresh = () => {
    utils.admin.lists.invalidate();
    utils.admin.summary.invalidate();
    utils.admin.insights.invalidate();
    utils.admin.listEmailNotificationLogs.invalidate();
    utils.public.services.invalidate();
    utils.public.featuredServices.invalidate();
    utils.public.products.invalidate();
    utils.public.availability.invalidate();
    utils.public.instagramSettings.invalidate();
    utils.public.websiteSections.invalidate();
    utils.public.reviews.invalidate();
    utils.public.gallery.invalidate();
    utils.public.paymentMode.invalidate();
  };
  const scrollAdminFeedback = (sectionId: string) => {
    setOpenPanels((current) => new Set(current).add(sectionId));
    smoothScrollToElement(sectionId, 60);
  };
  const opts = {
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("activity-monitoring");
      toast.success("Admin update saved");
    },
    onError: (error: any) => toast.error(error.message),
  };

  const moderate = trpc.admin.moderateReview.useMutation(opts);
  const blockAvailabilitySlot = trpc.admin.blockAvailabilitySlot.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("availability"); toast.success("Availability slot blocked"); } });
  const unblockAvailabilitySlot = trpc.admin.unblockAvailabilitySlot.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("availability"); toast.success("Availability slot unblocked"); } });
  const sendReviewRequest = trpc.admin.sendReviewRequest.useMutation({ onSuccess: () => { scrollAdminFeedback("bookings"); toast.success("Review request sent"); } });
  const resendEmail = trpc.admin.resendEmailNotification.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("email-notifications"); toast.success("Email notification resend attempted"); }, onError: (error: any) => toast.error(error.message) });
  const updateInstagram = trpc.admin.updateInstagramSettings.useMutation({ onSuccess: () => { scrollAdminFeedback("instagram"); toast.success("Instagram feed settings saved"); } });
  const updateHomeServiceSurcharge = trpc.admin.updateHomeServiceSurcharge.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("content"); toast.success("Home service surcharge saved"); }, onError: (error: any) => toast.error(error.message) });
  const updateBooking = trpc.admin.updateBookingStatus.useMutation(opts);
  const updateOrder = trpc.admin.updateOrderStatus.useMutation(opts);
  const updateStock = trpc.admin.updateProductStock.useMutation(opts);
  const updateProductVariants = trpc.admin.updateProductVariants.useMutation(opts);
  const createProduct = trpc.admin.createProduct.useMutation({
    onSuccess: () => {
      refresh();
      setNewProduct({ name: "", slug: "", category: "Accessories", description: "", price: "", imageUrl: "", badge: "", stockQuantity: 0, seoTitle: "", seoDescription: "", colourChoices: "" });
      scrollAdminFeedback("products");
      toast.success("Shop product uploaded");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const updateProduct = trpc.admin.updateProduct.useMutation(opts);
  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("products");
      toast.success("Product deleted from Supabase");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const updateService = trpc.admin.updateService.useMutation(opts);
  const syncProductImageInput = (productId: number, imageUrl: string) => {
    const imageInput = document.getElementById(`product-image-${productId}`) as HTMLInputElement | null;
    if (imageInput) imageInput.value = imageUrl;
  };
  const uploadProductImage = trpc.admin.uploadProductImage.useMutation({
    onSuccess: (uploaded, variables) => {
      if (variables.productId) syncProductImageInput(Number(variables.productId), uploaded.url);
      refresh();
      scrollAdminFeedback("products");
      toast.success("Product image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const clearProductImage = trpc.admin.clearProductImage.useMutation({
    onSuccess: (_result, variables) => {
      syncProductImageInput(Number(variables.productId), "");
      refresh();
      scrollAdminFeedback("products");
      toast.success("Product image removed");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const uploadServiceImage = trpc.admin.uploadServiceImage.useMutation({
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("services");
      toast.success("Service image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const clearServiceImage = trpc.admin.clearServiceImage.useMutation({
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("services");
      toast.success("Service image removed");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const uploadGalleryImage = trpc.admin.uploadGalleryImage.useMutation({
    onSuccess: (uploaded) => {
      setGallery((current) => ({ ...current, imageUrl: uploaded.url }));
      scrollAdminFeedback("gallery");
      toast.success("Gallery image uploaded. Add a title and save it to the gallery.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const clearWebsiteSectionImage = trpc.admin.clearWebsiteSectionImage.useMutation({
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("content");
      toast.success("Website section image removed");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const uploadWebsiteSectionImage = trpc.admin.uploadWebsiteSectionImage.useMutation({
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("content");
      toast.success("About Us round image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const updateWebsiteSection = trpc.admin.updateWebsiteSection.useMutation(opts);
  const addGallery = trpc.admin.addGalleryImage.useMutation({
    onSuccess: () => {
      refresh();
      setGallery({ title: "", category: "Braids", imageUrl: "", altText: "", sortOrder: 0 });
      scrollAdminFeedback("gallery");
      toast.success("Gallery image saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const deleteGalleryImage = trpc.admin.deleteGalleryImage.useMutation({
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("gallery");
      toast.success("Gallery image removed");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const [availabilitySlot, setAvailabilitySlot] = useState({ date: "", time: "", reason: "Unavailable" });
  const [instagramSettings, setInstagramSettings] = useState({ handle: "@ebysplace", feedUrl: "https://www.instagram.com/ebysplace/", enabled: true, note: "Latest Eby’s Place Instagram posts appear here once the production feed is connected." });
  const [gallery, setGallery] = useState({ title: "", category: "Braids", imageUrl: "", altText: "", sortOrder: 0 });
  const [newProduct, setNewProduct] = useState({ name: "", slug: "", category: "Accessories", description: "", price: "", imageUrl: "", badge: "", stockQuantity: 0, seoTitle: "", seoDescription: "", colourChoices: "" });
  const [uploadingServiceId, setUploadingServiceId] = useState<number | null>(null);
  const [openPanels, setOpenPanels] = useState<Set<string>>(() => new Set(["activity-monitoring"]));
  const data = (lists.data || {}) as AdminListData;
  const galleryItems = (data.gallery || []) as AdminGalleryItem[];
  const emailNotificationRows = emailLogs.data || data.emailNotifications || [];
  const isPanelOpen = (panelId: string) => openPanels.has(panelId);
  const togglePanel = (panelId: string) => setOpenPanels((current) => {
    const next = new Set(current);
    if (next.has(panelId)) next.delete(panelId);
    else next.add(panelId);
    return next;
  });
  const openPublicHomepage = () => {
    navigateWithSmoothScroll("/");
  };
  const openProtectedOverviewSection = (sectionId: string, label: string) => {
    setOpenPanels((current) => new Set(current).add(sectionId));
    smoothScrollToElement(sectionId, 60);
    window.history.replaceState(null, "", `${window.location.pathname}#${sectionId}`);
    refresh();
    toast.success(`${label} opened with protected admin data refreshed`);
  };

  function parseColourChoices(rawValue: string) {
    return rawValue.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name = "", colourHex = "#c8a95a", stockQuantity = "0", imageUrl = ""] = line.split("|").map((part) => part.trim());
      return { name, colourHex, stockQuantity: Math.max(0, Number(stockQuantity) || 0), imageUrl: imageUrl || undefined };
    }).filter((variant) => variant.name && /^#[0-9a-fA-F]{6}$/.test(variant.colourHex));
  }

  function formatColourChoices(variants: any[] = []) {
    return (variants.length ? variants : [{ name: "Signature finish", colourHex: "#c8a95a", stockQuantity: 0 }]).map((variant: any) => {
      const base = `${variant.name}|${variant.colourHex || "#c8a95a"}|${Number(variant.stockQuantity) || 0}`;
      return variant.imageUrl ? `${base}|${variant.imageUrl}` : base;
    }).join("\n");
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
    if (!product.id) {
      toast.error("Please save the product before uploading images.");
      return;
    }
    try {
      const normalizedFile = await normalizeAdminUploadFile(file);
      const dataUrl = await fileToDataUrl(normalizedFile);
      await uploadProductImage.mutateAsync({ productId: Number(product.id), productName: product.name.trim() || "product", dataUrl, fileName: normalizedFile.name });
    } catch (error: any) {
      toast.error(error.message || "Product image upload failed");
    }
  }

  async function handleServiceImageUpload(service: any, file?: File) {
    if (!file) return;
    try {
      setUploadingServiceId(service.id);
      const normalizedFile = await normalizeAdminUploadFile(file);
      const dataUrl = await fileToDataUrl(normalizedFile);
      await uploadServiceImage.mutateAsync({ serviceId: service.id, serviceName: service.name, dataUrl, fileName: normalizedFile.name });
    } catch (error: any) {
      toast.error(error.message || "Service image upload failed");
    } finally {
      setUploadingServiceId(null);
    }
  }

  async function handleGalleryImageUpload(file?: File) {
    if (!file) return;
    try {
      const normalizedFile = await normalizeAdminUploadFile(file);
      const dataUrl = await fileToDataUrl(normalizedFile);
      await uploadGalleryImage.mutateAsync({ dataUrl, fileName: normalizedFile.name });
    } catch (error: any) {
      toast.error(error.message || "Gallery image upload failed");
    }
  }

  async function handleAboutPortraitUpload(file?: File) {
    if (!file) return;
    try {
      const normalizedFile = await normalizeAdminUploadFile(file);
      const dataUrl = await fileToDataUrl(normalizedFile);
      await uploadWebsiteSectionImage.mutateAsync({ sectionKey: "about_us", imageRole: "portrait", dataUrl, fileName: normalizedFile.name });
    } catch (error: any) {
      toast.error(error.message || "About Us round image upload failed");
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
              <h2 className="serif mt-3 text-3xl font-bold text-primary">Eby’s Place command centre</h2>
              <p className="mt-2 text-sm text-white/65">Use these protected shortcuts to open each owner area on demand. Dense records stay hidden until clicked, keeping daily management calm, branded, and easy to scan.</p>
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

        <div className="mt-8 grid gap-6">
          <AdminPanel id="activity-monitoring" eyebrow="Live intelligence" title="Analytics and activity monitoring" description="Open the current Eby’s Place performance view for product sales, booked styles, AI Try-On usage, and recent owner activity." icon={Activity} open={isPanelOpen("activity-monitoring")} onToggle={() => togglePanel("activity-monitoring")}>
            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div>
                <h3 className="serif text-2xl font-bold text-primary"><TrendingUp className="mr-2 inline h-5 w-5" />Best-selling analytics</h3>
                <p className="mt-2 text-sm text-white/55">Track the strongest shop products, booked braid styles, and requested services from real shop, booking, and AI Try-On activity.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><b className="text-primary">Products</b>{(insights.data?.bestSellingProducts || []).length ? (insights.data?.bestSellingProducts || []).map((item: any) => <p className="mt-3 text-sm" key={item.label}>{item.label}<small className="block text-white/45">{item.units} sold · £{Number(item.revenue || 0).toFixed(2)}</small></p>) : <p className="mt-3 text-sm text-white/45">No paid product sales yet.</p>}</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><b className="text-primary">Braid styles & services</b>{(insights.data?.bestBookedServices || []).length ? (insights.data?.bestBookedServices || []).map((item: any) => <p className="mt-3 text-sm" key={item.label}>{item.label}<small className="block text-white/45">{item.total} bookings</small></p>) : <p className="mt-3 text-sm text-white/45">No booking volume yet.</p>}</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><b className="text-primary">AI Try-On styles</b>{(insights.data?.bestTriedStyles || []).length ? (insights.data?.bestTriedStyles || []).map((item: any) => <p className="mt-3 text-sm" key={item.label}>{item.label}<small className="block text-white/45">{item.total} try-ons</small></p>) : <p className="mt-3 text-sm text-white/45">No try-on style data yet.</p>}</div>
                </div>
              </div>
              <div>
                <h3 className="serif text-2xl font-bold text-primary">Recent activity</h3>
                <p className="mt-2 text-sm text-white/55">Monitor bookings, orders, reviews, visits, AI Try-On generations, and newsletter actions in one compact feed.</p>
                <div className="mt-4 max-h-[22rem] overflow-y-auto pr-2">
                  {(insights.data?.recentActivity || []).length ? (insights.data?.recentActivity || []).map((item: any, index: number) => <div className="border-t border-white/10 py-3 text-sm" key={`${item.type}-${index}`}><b className="text-primary">{item.type}</b><span className="ml-2">{item.label}</span><small className="block text-white/45">{item.detail}</small></div>) : <p className="text-sm text-white/45">No recent activity to show yet.</p>}
                </div>
              </div>
            </div>
          </AdminPanel>
        </div>

        <div className="mt-8 grid gap-6">
          <AdminPanel id="bookings" eyebrow="Appointments" title="Bookings manager" description="Open appointment requests, deposits, dates, and status controls only when you need to manage the diary." icon={CalendarDays} open={isPanelOpen("bookings")} onToggle={() => togglePanel("bookings")}>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-primary">
                <tr><th>Client</th><th>Service</th><th>Location</th><th>Date</th><th>Deposit</th><th>Status</th><th>Change status</th></tr>
              </thead>
              <tbody>
                {(data.bookings || []).map((booking: any) => (
                  <tr className="border-t border-white/10" key={booking.id}>
                    <td className="py-3">{booking.clientName}<small className="block text-white/45">{booking.clientEmail}</small></td>
                    <td>{booking.serviceName}</td>
                    <td>{booking.serviceLocation === "home_service" ? "Home Service" : "Visit the Studio"}<small className="block text-white/45">{booking.serviceLocation === "home_service" ? [booking.addressLine1, booking.addressLine2, booking.city, booking.county, booking.postcode].filter(Boolean).join(", ") : "Studio address hidden until paid confirmation"}</small></td>
                    <td>{booking.appointmentDate} {booking.appointmentTime}</td>
                    <td>{booking.depositStatus}</td>
                    <td>{booking.status}</td>
                    <td>
                      <select value={booking.status} onChange={(event) => updateBooking.mutate({ id: booking.id, status: event.target.value as any })}>
                        <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                      </select>
                      {booking.status === "completed" ? <button className="btn-dark mt-2 py-2 text-xs" type="button" onClick={() => sendReviewRequest.mutate({ bookingId: booking.id })}>Send review request</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </AdminPanel>


          <AdminPanel id="availability" eyebrow="Calendar controls" title="Availability calendar" description="Block and unblock specific appointment dates or individual time slots. Customers cannot book blocked slots." icon={CalendarDays} open={isPanelOpen("availability")} onToggle={() => togglePanel("availability")}>
            <form className="mt-5 grid gap-3 rounded-2xl border border-primary/20 bg-black/20 p-4 md:grid-cols-[1fr_auto]" onSubmit={(event) => { event.preventDefault(); const value = readAdminPrice("home-service-surcharge", "Home service surcharge"); if (value) updateHomeServiceSurcharge.mutate({ homeServiceSurcharge: value }); }}>
              <label className="grid gap-2 text-sm text-white/70">Home service surcharge (£)<input id="home-service-surcharge" defaultValue={data.availability?.homeServiceSurcharge || "0.00"} inputMode="decimal" /></label>
              <button className="btn-gold self-end py-2" type="submit">Save surcharge</button>
            </form>
            <form className="mt-5 grid gap-3 rounded-2xl border border-primary/20 bg-black/20 p-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); blockAvailabilitySlot.mutate(availabilitySlot); }}>
              <input required type="date" value={availabilitySlot.date} onChange={(event) => setAvailabilitySlot({ ...availabilitySlot, date: event.target.value })} />
              <input type="time" value={availabilitySlot.time} onChange={(event) => setAvailabilitySlot({ ...availabilitySlot, time: event.target.value })} />
              <input placeholder="Reason" value={availabilitySlot.reason} onChange={(event) => setAvailabilitySlot({ ...availabilitySlot, reason: event.target.value })} />
              <button className="btn-gold py-2" type="submit">Block slot</button>
            </form>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(data.availability?.blockedSlots || []).length ? (data.availability?.blockedSlots || []).map((slot: any) => <div className="rounded-2xl border border-white/10 p-4" key={`${slot.date}-${slot.time || 'day'}`}><b className="text-primary">{slot.date} {slot.time || 'All day'}</b><p className="text-sm text-white/55">{slot.reason || 'Unavailable'}</p><button className="btn-dark mt-3 py-2 text-sm" type="button" onClick={() => unblockAvailabilitySlot.mutate({ date: slot.date, time: slot.time || undefined })}>Unblock</button></div>) : <p className="text-sm text-white/55">No blocked slots yet.</p>}
            </div>
          </AdminPanel>

          <AdminPanel id="orders" eyebrow="Fulfilment" title="Shop orders and delivery" description="Review paid orders, customer delivery details, and fulfilment statuses in a protected Eby’s Place order workspace." icon={ShoppingBag} open={isPanelOpen("orders")} onToggle={() => togglePanel("orders")}>
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
          </AdminPanel>

          <AdminPanel id="email-notifications" eyebrow="Zoho EU SMTP" title="Email notifications" description="Review booking and shop confirmation delivery status, including customer and owner messages sent through smtp.zoho.eu." icon={Mail} open={isPanelOpen("email-notifications")} onToggle={() => togglePanel("email-notifications")}>
            <div className="mt-5 grid gap-4">
              {emailLogs.isLoading ? <p className="text-sm text-white/55">Loading email notification logs...</p> : null}
              {emailNotificationRows.length ? emailNotificationRows.map((log: any) => {
                const statusClass = log.status === "sent" ? "bg-emerald-500/15 text-emerald-100 border-emerald-300/30" : log.status === "failed" ? "bg-red-500/15 text-red-100 border-red-300/30" : "bg-primary/15 text-primary border-primary/30";
                const lastAttempt = log.lastAttemptAtMs ? new Date(Number(log.lastAttemptAtMs)).toLocaleString() : log.sentAtMs ? new Date(Number(log.sentAtMs)).toLocaleString() : log.createdAt ? new Date(log.createdAt).toLocaleString() : "Not attempted yet";
                const canResend = log.status !== "sent";
                return (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={log.id}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${statusClass}`}>{log.status}</span>
                          <b className="text-primary">{log.entityType === "booking" ? "Booking" : "Shop order"} #{log.entityId}</b>
                          <span className="text-xs uppercase tracking-[0.18em] text-white/45">{log.audience}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/80">{log.subject}</p>
                        <p className="mt-1 break-all text-xs text-white/55">To: {log.recipientEmail}</p>
                        <p className="mt-1 text-xs text-white/45">Provider: {log.provider || "zoho_smtp"} · Host: {log.smtpHost || "smtp.zoho.eu"} · Attempts: {log.attempts ?? 0}</p>
                        <p className="mt-1 text-xs text-white/45">Last activity: {lastAttempt}</p>
                        {log.errorMessage ? <p className="mt-2 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-xs text-red-100">{log.errorMessage}</p> : null}
                        {log.bodyPreview ? <p className="mt-2 text-xs text-white/45">Preview: {log.bodyPreview}</p> : null}
                      </div>
                      {canResend ? <button className="btn-gold shrink-0 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={resendEmail.isPending} onClick={() => resendEmail.mutate({ logId: log.id })}>{resendEmail.isPending ? "Resending..." : "Resend email"}</button> : <span className="rounded-full border border-emerald-300/25 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Delivered</span>}
                    </div>
                  </div>
                );
              }) : <p className="text-white/55">No Zoho SMTP email notification logs yet. New paid bookings and shop orders will appear here after Stripe checkout completion.</p>}
            </div>
          </AdminPanel>

          <AdminPanel id="reviews" eyebrow="Trust & reputation" title="Reviews moderator" description="Approve or reject customer reviews from a focused moderation panel without crowding the daily overview." icon={MessageSquare} open={isPanelOpen("reviews")} onToggle={() => togglePanel("reviews")}>
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
          </AdminPanel>

          <AdminPanel id="products" eyebrow="Shop catalogue" title="Products, prices, stock & SEO" description="Open product names, prices, search-friendly slugs, SEO titles, colour choices, and stock controls when catalogue maintenance is needed." icon={Package} open={isPanelOpen("products")} onToggle={() => togglePanel("products")}>
            <details className="mt-5 rounded-2xl border border-primary/20 bg-black/20 p-4">
              <summary className="cursor-pointer font-semibold text-primary">Add more shop products</summary>
              <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); const price = Number(newProduct.price); if (!Number.isFinite(price) || price < 0) { toast.error("Product price must be valid."); return; } createProduct.mutate({ name: newProduct.name, slug: (newProduct.slug || newProduct.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), category: newProduct.category as any, description: newProduct.description, price: price.toFixed(2), imageUrl: newProduct.imageUrl || undefined, badge: newProduct.badge || undefined, stockQuantity: Number(newProduct.stockQuantity) || 0, seoTitle: newProduct.seoTitle || `${newProduct.name} | Eby’s Place`, seoDescription: newProduct.seoDescription || newProduct.description, stockStatus: "in_stock", isFeatured: "false", variants: parseColourChoices(newProduct.colourChoices) }); }}>
                <div className="grid gap-3 sm:grid-cols-2"><input required placeholder="Product name" value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} /><input placeholder="SEO slug" value={newProduct.slug} onChange={(event) => setNewProduct({ ...newProduct, slug: event.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2"><select value={newProduct.category} onChange={(event) => setNewProduct({ ...newProduct, category: event.target.value })}>{productCategories.map((category) => <option key={category}>{category}</option>)}</select><input required type="number" min="0" step="0.01" placeholder="Price (£)" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} /></div>
                <textarea required placeholder="Public product description" value={newProduct.description} onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2"><input placeholder="Badge" value={newProduct.badge} onChange={(event) => setNewProduct({ ...newProduct, badge: event.target.value })} /><input type="number" min="0" placeholder="Stock quantity" value={newProduct.stockQuantity} onChange={(event) => setNewProduct({ ...newProduct, stockQuantity: Number(event.target.value) })} /></div>
                <input placeholder="SEO title" value={newProduct.seoTitle} onChange={(event) => setNewProduct({ ...newProduct, seoTitle: event.target.value })} />
                <textarea placeholder="SEO meta description" value={newProduct.seoDescription} onChange={(event) => setNewProduct({ ...newProduct, seoDescription: event.target.value })} />
                <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-white/70"><UploadCloud className="mr-2 inline h-4 w-4 text-primary" />To upload a product image, <b className="text-primary">save the product first</b>, then use the &quot;Update product image&quot; button on the saved product below. You can also paste an image URL directly into the field below.</p>
                <input placeholder="Product image URL (optional — paste URL or upload after saving)" value={newProduct.imageUrl} onChange={(event) => setNewProduct({ ...newProduct, imageUrl: event.target.value })} />
                <textarea placeholder={"Available colours in stock, one per line: Colour name|#hexcode|stock|imageUrl"} value={newProduct.colourChoices} onChange={(event) => setNewProduct({ ...newProduct, colourChoices: event.target.value })} />
                {newProduct.imageUrl && <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={newProduct.imageUrl} alt="New product preview" loading="lazy" decoding="async" /></div>}
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
                    <details className="rounded-2xl border border-primary/20 bg-black/20 p-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Update product image</summary><div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]"><input key={`product-image-${product.id}-${product.imageUrl || "empty"}`} id={`product-image-${product.id}`} defaultValue={product.imageUrl || ""} placeholder="Supabase Storage public image URL" /><label className="btn-dark cursor-pointer py-2"><UploadCloud className="mr-2 h-4 w-4" /> Upload product image<input className="sr-only" type="file" accept={ADMIN_UPLOAD_ACCEPT} onChange={(event) => handleProductImageUpload(product, event.target.files?.[0])} /></label><button className="btn-dark py-2" type="button" disabled={!product.imageUrl || clearProductImage.isPending} onClick={() => clearProductImage.mutate({ productId: Number(product.id), imageUrl: product.imageUrl || undefined })}><Trash2 className="mr-2 h-4 w-4" /> Remove image</button></div>{product.imageUrl && <div className="mt-3 media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /></div>}</details>
                    <div className="rounded-2xl border border-primary/20 bg-black/20 p-3 text-sm text-white/70">
                      <b className="block text-primary">Shop colour previews</b>
                      <span className="mt-1 block text-white/55">These are the colour options customers click on the shop page to update the product preview before checkout.</span>
                      <label className="mt-3 grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Available colours in stock<textarea defaultValue={formatColourChoices(product.variants)} id={`product-colours-${product.id}`} rows={4} placeholder="Colour name|#hexcode|stock|imageUrl" /></label>
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
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="btn-gold flex-1 py-2" onClick={() => { if (!product.id) { toast.error("This product has no database ID. Please reload the page and try again."); return; } const price = readAdminPrice(`product-price-${product.id}`, "Shop price"); if (!price) return; updateProduct.mutate({ id: product.id, name: (document.getElementById(`product-name-${product.id}`) as HTMLInputElement).value, price, slug: (document.getElementById(`product-slug-${product.id}`) as HTMLInputElement).value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), seoTitle: (document.getElementById(`product-seo-title-${product.id}`) as HTMLInputElement).value, seoDescription: (document.getElementById(`product-seo-description-${product.id}`) as HTMLTextAreaElement).value, description: (document.getElementById(`product-description-${product.id}`) as HTMLTextAreaElement).value, imageUrl: (document.getElementById(`product-image-${product.id}`) as HTMLInputElement).value.trim() || undefined, badge: (document.getElementById(`product-badge-${product.id}`) as HTMLInputElement).value }); updateProductVariants.mutate({ productId: product.id, variants: parseColourChoices((document.getElementById(`product-colours-${product.id}`) as HTMLTextAreaElement).value) }); }}>Save product price, SEO & colours</button>
                      <button type="button" className="btn-dark border-red-400/40 py-2 text-red-100 hover:border-red-300 hover:text-red-50" disabled={deleteProduct.isPending} onClick={() => { if (!product.id) { toast.error("This product has no database ID. Please reload the page and try again."); return; } if (window.confirm(`Delete ${product.name} from the Supabase products table?`)) deleteProduct.mutate({ id: Number(product.id) }); }}><Trash2 className="mr-2 h-4 w-4" />Delete product</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="number" min={0} defaultValue={product.stockQuantity} id={`stock-${product.id}`} />
                    <select defaultValue={product.stockStatus} id={`stock-status-${product.id}`}><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></select>
                    <button className="btn-dark py-2" onClick={() => { if (!product.id) { toast.error("This product has no database ID. Please reload the page and try again."); return; } updateStock.mutate({ id: product.id, stockQuantity: Number((document.getElementById(`stock-${product.id}`) as HTMLInputElement).value), stockStatus: (document.getElementById(`stock-status-${product.id}`) as HTMLSelectElement).value as any }); }}>Save stock</button>
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel id="services" eyebrow="Service catalogue" title="Services prices editor" description="Maintain braid-service pricing, duration, and service imagery from a dedicated owner-only panel." icon={Scissors} open={isPanelOpen("services")} onToggle={() => togglePanel("services")}>
            <div className="mt-5 grid gap-4">
              {(data.services || []).map((service: any) => (
                <div className="rounded-2xl border border-white/10 p-4" key={service.id}>
                  <div className="grid gap-4 md:grid-cols-[128px_1fr]">
                    <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]">
                      {service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <div className="flex h-full items-center justify-center text-xs text-white/35">No image</div>}
                    </div>
                    <div>
                      <div className="flex justify-between gap-3"><span>{service.name}<small className="block text-white/45">{service.category} · {service.duration}</small></span><b>£{service.priceFrom}</b></div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Service price (£)<input type="number" min="0" step="0.01" defaultValue={service.priceFrom} id={`price-${service.id}`} /></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Duration<input defaultValue={service.duration} id={`duration-${service.id}`} /></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Availability<select defaultValue={service.isBookable || "true"} id={`availability-${service.id}`}><option value="true">Available for booking</option><option value="false">Unavailable for booking</option></select></label>
                        <button className="btn-dark py-2" onClick={() => { const priceFrom = readAdminPrice(`price-${service.id}`, "Service price"); if (!priceFrom) return; updateService.mutate({ id: service.id, priceFrom, duration: (document.getElementById(`duration-${service.id}`) as HTMLInputElement).value, imageUrl: (document.getElementById(`service-image-${service.id}`) as HTMLInputElement).value, isBookable: (document.getElementById(`availability-${service.id}`) as HTMLSelectElement).value as "true" | "false" }); }}>Save service availability</button>
                      </div>
                      <details className="mt-3 rounded-2xl border border-primary/20 bg-black/20 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-primary">Add or replace service image</summary>
                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                          <input id={`service-image-${service.id}`} defaultValue={service.imageUrl || ""} placeholder="Supabase Storage public image URL" />
                          <label className="btn-dark cursor-pointer py-2">
                            <UploadCloud className="mr-2 h-4 w-4" /> {uploadingServiceId === service.id ? "Uploading…" : "Upload image"}
                            <input className="sr-only" type="file" accept={ADMIN_UPLOAD_ACCEPT} disabled={uploadingServiceId === service.id} onChange={(event) => handleServiceImageUpload(service, event.target.files?.[0])} />
                          </label>
                          <button className="btn-dark py-2" type="button" disabled={!service.imageUrl || clearServiceImage.isPending} onClick={() => clearServiceImage.mutate({ serviceId: service.id, imageUrl: service.imageUrl || undefined })}><Trash2 className="mr-2 h-4 w-4" /> Remove image</button>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel id="content" eyebrow="Homepage story" title="About Us content" description="Update the public About Us wording, round image frame, and the description shown beneath that image." icon={Sparkles} open={isPanelOpen("content")} onToggle={() => togglePanel("content")}>
            {(() => {
              const about = (data.sections || []).find((section: any) => section.sectionKey === "about_us") || {};
              return (
                <div className="grid gap-4">
                  <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Eyebrow label<input id="about-eyebrow" defaultValue={about.eyebrow || "Our Story"} /></label>
                  <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Heading<input id="about-title" defaultValue={about.title || "From Passion to Power"} /></label>
                  <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">About Us write-up<textarea id="about-body" defaultValue={about.body || "Eby’s Place was born from a love for braiding and a belief that beautiful hair should never come with pain, pulling, or damage. What began as a passion for helping women and families feel confident has grown into a premium braid-care experience built on gentle hands, neat finishing, protective styling, and genuine customer care."} rows={5} /></label>
                  <div className="grid gap-4 md:grid-cols-[10rem_1fr] md:items-start">
                    <div className="mx-auto h-32 w-32 overflow-hidden rounded-full border border-primary/25 bg-[#171009] p-2">
                      {about.portraitImageUrl || about.imageUrl ? <img className="h-full w-full rounded-full object-cover object-[center_18%]" src={about.portraitImageUrl || about.imageUrl} alt="About Us round preview" /> : <div className="flex h-full w-full items-center justify-center rounded-full text-center text-xs text-white/40">No round image</div>}
                    </div>
                    <div className="grid gap-3">
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-dark cursor-pointer justify-start"><UploadCloud className="mr-2 h-4 w-4" /> {uploadWebsiteSectionImage.isPending ? "Uploading About Us round image…" : "Upload About Us round image"}<input className="sr-only" type="file" accept={ADMIN_UPLOAD_ACCEPT} disabled={uploadWebsiteSectionImage.isPending} onChange={(event) => handleAboutPortraitUpload(event.target.files?.[0])} /></label>
                        <button className="btn-dark" type="button" disabled={!(about.portraitImageUrl || about.imageUrl) || clearWebsiteSectionImage.isPending} onClick={() => clearWebsiteSectionImage.mutate({ sectionKey: "about_us", imageRole: "portrait", imageUrl: about.portraitImageUrl || about.imageUrl || undefined })}><Trash2 className="mr-2 h-4 w-4" /> Remove round image</button>
                      </div>
                      <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Round image URL<input id="about-portrait-image" defaultValue={about.portraitImageUrl || about.imageUrl || ""} placeholder="Supabase Storage public image URL" /></label>
                      <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Description beneath round image<textarea id="about-portrait-description" defaultValue={about.portraitDescription || "Eberechi Ogbo | Founder & Service Lead"} rows={3} /></label>
                    </div>
                  </div>
                  <button className="btn-gold" disabled={updateWebsiteSection.isPending} onClick={() => updateWebsiteSection.mutate({ sectionKey: "about_us", eyebrow: (document.getElementById("about-eyebrow") as HTMLInputElement).value, title: (document.getElementById("about-title") as HTMLInputElement).value, body: (document.getElementById("about-body") as HTMLTextAreaElement).value, portraitImageUrl: (document.getElementById("about-portrait-image") as HTMLInputElement).value, portraitDescription: (document.getElementById("about-portrait-description") as HTMLTextAreaElement).value, ctaLabel: about.ctaLabel || "Read our services", ctaHref: about.ctaHref || "/services", isPublished: "true" })}>{updateWebsiteSection.isPending ? "Saving About Us…" : "Save About Us story"}</button>
                </div>
              );
            })()}
          </AdminPanel>

          <AdminPanel id="gallery" eyebrow="Portfolio" title="Gallery uploader" description="Open the gallery uploader when adding fresh braid, twist, loc, kids-style, or behind-the-chair images." icon={Images} open={isPanelOpen("gallery")} onToggle={() => togglePanel("gallery")}>
            <details className="mt-4 rounded-2xl border border-primary/20 bg-black/20 p-4">
              <summary className="cursor-pointer font-semibold text-primary">Add more gallery images</summary>
            <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); addGallery.mutate({ ...gallery, category: gallery.category as any }); }}>
              <input required placeholder="Image title" value={gallery.title} onChange={(event) => setGallery({ ...gallery, title: event.target.value })} />
              <select value={gallery.category} onChange={(event) => setGallery({ ...gallery, category: event.target.value })}>
                {galleryCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <label className="btn-dark cursor-pointer justify-start">
                <UploadCloud className="mr-2 h-4 w-4" /> {uploadGalleryImage.isPending ? "Uploading image…" : "Upload gallery image"}
                <input className="sr-only" type="file" accept={ADMIN_UPLOAD_ACCEPT} disabled={uploadGalleryImage.isPending} onChange={(event) => handleGalleryImageUpload(event.target.files?.[0])} />
              </label>
              <input required placeholder="Supabase Storage public image URL" value={gallery.imageUrl} onChange={(event) => setGallery({ ...gallery, imageUrl: event.target.value })} />
              {gallery.imageUrl && <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={gallery.imageUrl} alt="Gallery preview" /></div>}
              <input required placeholder="Alt text" value={gallery.altText} onChange={(event) => setGallery({ ...gallery, altText: event.target.value })} />
              <button className="btn-gold" disabled={addGallery.isPending}>{addGallery.isPending ? "Saving…" : "Add image"}</button>
            </form>
            </details>
            <b className="mt-4 block text-primary">{data.gallery?.length || 0} images</b>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {galleryItems.map((item, index) => (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3" key={String(item.id ?? `gallery-${index}`)}>
                  <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]">
                    <img src={item.imageUrl} alt={item.altText || item.title} loading="lazy" decoding="async" />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="block break-words">{item.title}</b>
                      <small className="block text-white/50">{item.category}</small>
                    </div>
                    <button
                      type="button"
                      className="btn-dark border-red-400/40 py-2 text-red-100 hover:border-red-300 hover:text-red-50"
                      disabled={!item.id || deleteGalleryImage.isPending}
                      onClick={() => {
                        const galleryId = typeof item.id === "number" ? item.id : Number(item.id);
                        if (!Number.isInteger(galleryId) || galleryId <= 0) {
                          toast.error("This gallery image cannot be deleted because it has no database ID.");
                          return;
                        }
                        if (window.confirm(`Delete "${item.title}" from the gallery?`)) {
                          deleteGalleryImage.mutate({ id: galleryId, imageUrl: item.imageUrl || undefined });
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel id="instagram" eyebrow="Social feed" title="Instagram feed settings" description="Store the official Eby’s Place Instagram handle and feed URL used by the public gallery section." icon={Images} open={isPanelOpen("instagram")} onToggle={() => togglePanel("instagram")}>
            <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); updateInstagram.mutate(instagramSettings); }}>
              <input required placeholder="Instagram handle" value={instagramSettings.handle} onChange={(event) => setInstagramSettings({ ...instagramSettings, handle: event.target.value })} />
              <input required placeholder="Instagram feed URL" value={instagramSettings.feedUrl} onChange={(event) => setInstagramSettings({ ...instagramSettings, feedUrl: event.target.value })} />
              <textarea placeholder="Integration note" value={instagramSettings.note} onChange={(event) => setInstagramSettings({ ...instagramSettings, note: event.target.value })} />
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={instagramSettings.enabled} onChange={(event) => setInstagramSettings({ ...instagramSettings, enabled: event.target.checked })} /> Show Instagram feed section</label>
              <button className="btn-gold w-fit py-2" type="submit">Save Instagram settings</button>
            </form>
          </AdminPanel>


          <AdminPanel id="users" eyebrow="Owner access" title="Admin users" description="Review secure owner access guidance and keep role-protected management controls separate from customer-facing pages." icon={Users} open={isPanelOpen("users")} onToggle={() => togglePanel("users")}>
            <p className="text-white/60">
              Eby’s Place uses secure owner sign-in with admin role protection on every backend dashboard procedure. Promote
              additional admins by updating the user role in the database management panel.
            </p>
          </AdminPanel>
        </div>
      </div>
    </DashboardLayout>
  );
}
