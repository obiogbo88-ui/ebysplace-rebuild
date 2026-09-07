import { useEffect, useState, useRef, type ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { navigateWithSmoothScroll, smoothScrollToElement } from "@/lib/smoothScroll";
import { getServiceImageFallback, getServiceImageSrc } from "@/lib/serviceImageFallback";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Bell,
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
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AdminListData = {
  bookings?: any[];
  orders?: any[];
  reviews?: any[];
  productReviews?: any[];
  products?: any[];
  services?: any[];
  gallery?: any[];
  sections?: any[];
  availability?: { blockedSlots?: any[]; homeServiceSurcharge?: string };
  instagram?: { handle?: string; feedUrl?: string; enabled?: boolean; note?: string };
  emailNotifications?: any[];
  activityLogs?: any[];
};

type AdminGalleryItem = {
  id?: number | string;
  title: string;
  category: string;
  imageUrl: string;
  altText?: string;
};

type AdminReviewItem = {
  id: number;
  rating: number;
  reviewText: string;
  customerName: string;
  status: "pending" | "approved" | "rejected";
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

function mimeFromExtension(ext: string): string {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "";
}

function isHeicLikeFile(file: File) {
  const extension = uploadFileExtension(file);
  const mime = (file.type || "").toLowerCase();
  return extension === "heic" || extension === "heif" || mime === "image/heic" || mime === "image/heif";
}

async function compressAdminImage(file: File, maxPx = 2400, quality = 0.92): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read the selected image."));
      img.src = objectUrl;
    });
    const scale = Math.min(1, maxPx / Math.max(image.width, image.height, 1));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare this image for upload.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not compress image for upload."))), "image/jpeg", quality),
    );
    const baseName = sanitizeUploadBaseName(file.name);
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeAdminUploadFile(file: File) {
  const extension = uploadFileExtension(file);
  const mime = ((file.type || mimeFromExtension(extension)) || "").toLowerCase();
  if (!ADMIN_ALLOWED_EXTENSIONS.has(extension) || !ADMIN_ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error("Allowed image formats: jpg, jpeg, png, webp, heic, heif.");
  }

  let workingFile = file;
  if (isHeicLikeFile(file)) {
    const { default: heic2any } = await import("heic2any");
    let conversionResult: Blob | Blob[];
    try {
      conversionResult = await (heic2any as (o: { blob: Blob; toType: string; quality?: number }) => Promise<Blob | Blob[]>)({ blob: file, toType: "image/jpeg", quality: 0.9 });
    } catch {
      throw new Error("HEIC/HEIF conversion failed. Please try a different image or use Safari/Chrome on a recent iPhone.");
    }
    const normalizedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    if (!(normalizedBlob instanceof Blob)) {
      throw new Error("Could not convert HEIC/HEIF image. Please try another photo.");
    }
    workingFile = new File([normalizedBlob], `${sanitizeUploadBaseName(file.name)}.jpg`, { type: "image/jpeg" });
  }

  return compressAdminImage(workingFile);
}

const galleryCategories = ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"] as const;
const productCategories = ["Accessories", "Aftercare", "Hair Attachments"] as const;
const serviceCategories = ["Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"] as const;
const adminOverviewActions = [
  { label: "Bookings", sectionId: "bookings", description: "Review and update appointment statuses." },
  { label: "Orders", sectionId: "orders", description: "Open protected shop order fulfilment." },
  { label: "Email Notifications", sectionId: "email-notifications", description: "View email delivery status and resend failed notifications." },
  { label: "Newsletter Subscribers", sectionId: "newsletter-subscribers", description: "See everyone who joined the Eby's Place list." },
  { label: "Send Announcement", sectionId: "announcements", description: "Broadcast to web push, email, and SMS subscribers at once." },
  { label: "Products", sectionId: "products", description: "Manage shop stock, colours, prices, and SEO." },
  { label: "Services", sectionId: "services", description: "Update public braid service details." },
  { label: "Gallery", sectionId: "gallery", description: "Add or organise gallery images." },
  { label: "Reviews", sectionId: "reviews", description: "Moderate customer reviews safely." },
  { label: "Product Reviews", sectionId: "product-reviews", description: "Moderate shop product reviews." },
  { label: "Activity & Notifications", sectionId: "activity-monitoring", description: "Review visitor activity, notifications, and operational events." },
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

function isImportantAdminNotification(item: any) {
  return item?.status === "failed"
    || ["booking", "payment", "shop", "ai_try_on", "kouvia", "visit"].includes(item?.activityCategory || "");
}

function adminNotificationTitle(item: any) {
  if (item?.status === "failed") return "Attention needed";
  if (item?.activityCategory === "booking") return "New booking";
  if (item?.activityCategory === "payment" || item?.activityCategory === "shop") return "New order or payment";
  if (item?.activityCategory === "ai_try_on") return "New AI Try-On activity";
  if (item?.activityCategory === "kouvia" && String(item?.activityType || "").includes("registration")) return "New braider registration";
  if (item?.activityCategory === "kouvia") return "Braiders / Kouvia activity";
  if (item?.activityCategory === "visit") return "Website visitor activity";
  return "Admin notification";
}

const EMPTY_REPLY = {
  to: "",
  cc: "info@ebysplace.com",
  subject: "",
  body: "",
  ctaLabel: "Browse Styles & Book",
  ctaUrl: "https://www.ebysplace.com/services",
};

export default function Admin() {
  const { user } = useAuth();
  const summary = trpc.admin.summary.useQuery(undefined, { retry: false });
  const lists = trpc.admin.lists.useQuery(undefined, { retry: false });
  const insights = trpc.admin.insights.useQuery(undefined, { retry: false });
  const emailLogs = trpc.admin.listEmailNotificationLogs.useQuery(undefined, { retry: false });
  const newsletterSubscribers = trpc.admin.listNewsletterSubscribers.useQuery(undefined, { retry: false });
  const announcementStatus = trpc.admin.announcementStatus.useQuery(undefined, { retry: false });
  const sendAnnouncement = trpc.admin.sendAnnouncement.useMutation({
    onSuccess: (result) => {
      setAnnouncementForm((prev) => ({ ...prev, title: "", body: "", url: "" }));
      const parts: string[] = [];
      if (result.webPush) parts.push(`Web push: ${result.webPush.deliveredCount}/${result.webPush.recipientCount}`);
      if (result.email) parts.push(`Email: ${result.email.deliveredCount}/${result.email.recipientCount}`);
      if (result.sms) parts.push(`SMS: ${result.sms.deliveredCount}/${result.sms.recipientCount}`);
      toast.success(parts.length ? parts.join(" · ") : "Nothing was sent — pick at least one channel.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const notificationFeed = trpc.admin.listActivityLogs.useQuery({
    limit: 12,
  }, { retry: false, refetchInterval: 15000 });
  const utils = trpc.useUtils();
  const [activityFilters, setActivityFilters] = useState({
    query: "",
    datePreset: "last_7_days" as "today" | "yesterday" | "last_7_days" | "last_30_days",
    activityCategory: "",
    status: "",
    sourceApp: "",
    failedOnly: false,
    unreadOnly: false,
  });
  const activityLogs = trpc.admin.listActivityLogs.useQuery({
    query: activityFilters.query || undefined,
    datePreset: activityFilters.datePreset,
    activityCategory: activityFilters.activityCategory || undefined,
    status: (activityFilters.status || undefined) as any,
    sourceApp: activityFilters.sourceApp || undefined,
    failedOnly: activityFilters.failedOnly || undefined,
    unreadOnly: activityFilters.unreadOnly || undefined,
    limit: 200,
  }, { retry: false, refetchInterval: 15000 });
  const unreadActivityCount = trpc.admin.unreadActivityCount.useQuery(undefined, { retry: false, refetchInterval: 15000 });
  const markActivityLogsRead = trpc.admin.markActivityLogsRead.useMutation({
    onSuccess: () => {
      utils.admin.listActivityLogs.invalidate();
      utils.admin.unreadActivityCount.invalidate();
      utils.admin.summary.invalidate();
      toast.success("Activity notifications marked as read");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const refresh = () => {
    utils.admin.lists.invalidate();
    utils.admin.summary.invalidate();
    utils.admin.insights.invalidate();
    utils.admin.listEmailNotificationLogs.invalidate();
    utils.admin.listActivityLogs.invalidate();
    utils.admin.unreadActivityCount.invalidate();
    utils.public.services.invalidate();
    utils.public.featuredServices.invalidate();
    utils.public.products.invalidate();
    utils.public.availability.invalidate();
    utils.public.instagramSettings.invalidate();
    utils.public.websiteSections.invalidate();
    utils.public.reviews.invalidate();
    utils.public.productReviewSummaries.invalidate();
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
  const moderateProductReview = trpc.admin.moderateProductReview.useMutation(opts);
  const blockAvailabilitySlot = trpc.admin.blockAvailabilitySlot.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("availability"); toast.success("Availability slot blocked"); } });
  const unblockAvailabilitySlot = trpc.admin.unblockAvailabilitySlot.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("availability"); toast.success("Availability slot unblocked"); } });
  const sendReviewRequest = trpc.admin.sendReviewRequest.useMutation({ onSuccess: () => { scrollAdminFeedback("bookings"); toast.success("Review request sent"); } });
  const resendEmail = trpc.admin.resendEmailNotification.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("email-notifications"); toast.success("Email notification resend attempted"); }, onError: (error: any) => toast.error(error.message) });
  const resendStatus = trpc.admin.resendStatus.useQuery(undefined, { retry: false });
  const sendCustomerReply = trpc.admin.sendCustomerReply.useMutation({
    onSuccess: () => { setReplyForm({ ...EMPTY_REPLY }); scrollAdminFeedback("customer-replies"); toast.success("Reply sent"); },
    onError: (error: any) => toast.error(error.message),
  });
  const updateInstagram = trpc.admin.updateInstagramSettings.useMutation({ onSuccess: () => { scrollAdminFeedback("instagram"); toast.success("Instagram feed settings saved"); } });
  const updateHomeServiceSurcharge = trpc.admin.updateHomeServiceSurcharge.useMutation({ onSuccess: () => { refresh(); scrollAdminFeedback("content"); toast.success("Home service surcharge saved"); }, onError: (error: any) => toast.error(error.message) });
  const updateBooking = trpc.admin.updateBookingStatus.useMutation(opts);
  const updateOrder = trpc.admin.updateOrderStatus.useMutation(opts);
  const updateStock = trpc.admin.updateProductStock.useMutation(opts);
  const updateProductVariants = trpc.admin.updateProductVariants.useMutation(opts);
  const createProduct = trpc.admin.createProduct.useMutation({
    onSuccess: async (createdProduct) => {
      const pending = newProductFileRef.current;
      refresh();
      setNewProduct({ name: "", slug: "", category: "Accessories", description: "", price: "", imageUrl: "", badge: "", stockQuantity: 0, seoTitle: "", seoDescription: "", colourChoices: "" });
      if (pending && createdProduct?.id) {
        try {
          await uploadProductImage.mutateAsync({ productId: Number(createdProduct.id), productName: createdProduct.name || "product", dataUrl: pending.dataUrl, fileName: pending.file.name });
          toast.success("Shop product uploaded with image");
        } catch {
          toast.error("Product saved but image upload failed. Use the 'Update product image' button on the saved product below to retry.");
        }
        newProductFileRef.current = null;
        setNewProductPreviewUrl("");
      } else {
        newProductFileRef.current = null;
        setNewProductPreviewUrl("");
        toast.success("Shop product uploaded");
      }
      scrollAdminFeedback("products");
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
  const createService = trpc.admin.createService.useMutation({
    onSuccess: () => {
      refresh();
      setNewService({ name: "", slug: "", category: "Braids", description: "", duration: "", priceFrom: "", badge: "", imageUrl: "", isBookable: "true", isFeatured: "false", sortOrder: 0 });
      scrollAdminFeedback("services");
      toast.success("Service saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const updateService = trpc.admin.updateService.useMutation(opts);
  const deleteService = trpc.admin.deleteService.useMutation({
    onSuccess: () => {
      refresh();
      scrollAdminFeedback("services");
      toast.success("Service deleted");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const syncProductImageInput = (productId: number, imageUrl: string) => {
    const imageInput = document.getElementById(`product-image-${productId}`) as HTMLInputElement | null;
    if (imageInput) imageInput.value = imageUrl;
  };
  const uploadProductImage = trpc.admin.uploadProductImage.useMutation({
    onSuccess: (uploaded, variables) => {
      if (variables && variables.productId) syncProductImageInput(Number(variables.productId), uploaded.url);
      refresh();
      scrollAdminFeedback("products");
      toast.success("Product image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const clearProductImage = trpc.admin.clearProductImage.useMutation({
    onSuccess: (_result, variables) => {
      if (variables) syncProductImageInput(Number(variables.productId), "");
      refresh();
      scrollAdminFeedback("products");
      toast.success("Product image removed");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const syncServiceImageInput = (serviceId: number, imageUrl: string) => {
    const imageInput = document.getElementById(`service-image-${serviceId}`) as HTMLInputElement | null;
    if (imageInput) imageInput.value = imageUrl;
  };
  const uploadServiceImage = trpc.admin.uploadServiceImage.useMutation({
    onSuccess: (uploaded, variables) => {
      if (variables) syncServiceImageInput(Number(variables.serviceId), uploaded.url);
      refresh();
      scrollAdminFeedback("services");
      toast.success("Service image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const clearServiceImage = trpc.admin.clearServiceImage.useMutation({
    onSuccess: (_result, variables) => {
      if (variables) syncServiceImageInput(Number(variables.serviceId), "");
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
    onSuccess: (uploaded) => {
      const imageInput = document.getElementById("about-portrait-image") as HTMLInputElement | null;
      if (imageInput) imageInput.value = uploaded.url;
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
      setDeletingGalleryId(null);
      refresh();
      scrollAdminFeedback("gallery");
      toast.success("Gallery image removed");
    },
    onError: (error: any) => { setDeletingGalleryId(null); toast.error(error.message); },
  });
  const [replyForm, setReplyForm] = useState({ ...EMPTY_REPLY });
  const [availabilitySlot, setAvailabilitySlot] = useState({ date: "", time: "", reason: "Unavailable" });
  const [instagramSettings, setInstagramSettings] = useState({ handle: "@ebysplace", feedUrl: "https://www.instagram.com/ebysplace/", enabled: true, note: "Latest Eby’s Place Instagram posts appear here once the production feed is connected." });
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", url: "", channels: { webPush: true, email: false, sms: false }, emailAudience: "newsletter" as "newsletter" | "all_clients" });
  const [gallery, setGallery] = useState({ title: "", category: "Braids", imageUrl: "", altText: "", sortOrder: 0 });
  const [newProduct, setNewProduct] = useState({ name: "", slug: "", category: "Accessories", description: "", price: "", imageUrl: "", badge: "", stockQuantity: 0, seoTitle: "", seoDescription: "", colourChoices: "" });
  const [newService, setNewService] = useState({ name: "", slug: "", category: "Braids", description: "", duration: "", priceFrom: "", badge: "", imageUrl: "", isBookable: "true", isFeatured: "false", sortOrder: 0 });
  const [uploadingServiceId, setUploadingServiceId] = useState<number | null>(null);
  const [deletingGalleryId, setDeletingGalleryId] = useState<number | null>(null);
  const [openPanels, setOpenPanels] = useState<Set<string>>(() => new Set(["activity-monitoring"]));
  const newProductFileRef = useRef<{ file: File; dataUrl: string } | null>(null);
  const [newProductPreviewUrl, setNewProductPreviewUrl] = useState<string>("");
  const data = (lists.data || {}) as AdminListData;
  const galleryItems = (data.gallery || []) as AdminGalleryItem[];
  const reviewRows = (data.reviews || []) as AdminReviewItem[];
  const pendingReviewRows = reviewRows.filter((review) => review.status === "pending");
  const moderatedReviewRows = reviewRows.filter((review) => review.status !== "pending");
  const productReviewRows = (data.productReviews || []) as AdminReviewItem[];
  const pendingProductReviewRows = productReviewRows.filter((review) => review.status === "pending");
  const moderatedProductReviewRows = productReviewRows.filter((review) => review.status !== "pending");
  const emailNotificationRows = emailLogs.data || data.emailNotifications || [];
  const newsletterSubscriberRows = newsletterSubscribers.data || [];
  const activityRows = activityLogs.data || data.activityLogs || [];
  const notificationRows = (notificationFeed.data || []).filter(isImportantAdminNotification).slice(0, 6);
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
  const resolvePanelFromHash = (hashValue: string) => {
    const hash = hashValue.replace(/^#/, "").trim().toLowerCase();
    if (!hash || hash === "overview") return null;
    if (hash === "activity" || hash === "activity-monitoring") return "activity-monitoring";
    const validPanels = new Set([
      "bookings",
      "availability",
      "orders",
      "products",
      "services",
      "gallery",
      "instagram",
      "reviews",
      "email-notifications",
      "content",
      "product-reviews",
      "users",
    ]);
    return validPanels.has(hash) ? hash : null;
  };
  useEffect(() => {
    const syncPanelFromHash = () => {
      const panelId = resolvePanelFromHash(window.location.hash || "");
      if (!panelId) return;
      setOpenPanels((current) => {
        if (current.has(panelId)) return current;
        return new Set(current).add(panelId);
      });
      window.setTimeout(() => smoothScrollToElement(panelId, 60), 10);
    };
    syncPanelFromHash();
    window.addEventListener("hashchange", syncPanelFromHash);
    return () => window.removeEventListener("hashchange", syncPanelFromHash);
  }, []);
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
    if (!service.id) {
      toast.error("Please connect the live database before editing this service.");
      return;
    }
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


  async function handleNewProductFileSelect(file?: File) {
    if (!file) return;
    try {
      const normalizedFile = await normalizeAdminUploadFile(file);
      const dataUrl = await fileToDataUrl(normalizedFile);
      newProductFileRef.current = { file: normalizedFile, dataUrl };
      setNewProductPreviewUrl(dataUrl);
    } catch (error: any) {
      toast.error(error.message || "Image could not be loaded");
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/55">Signed in as</p>
                <b>{user?.name || user?.email || "Admin"}</b>
                <p className="text-xs text-primary">{user?.role}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-black text-primary transition hover:bg-primary hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Open admin notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {(unreadActivityCount.data ?? 0) > 0 ? (
                      <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-black">
                        {unreadActivityCount.data}
                      </span>
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-primary/25 bg-[#fffaf0] p-3 shadow-[0_20px_55px_rgba(46,27,16,.18)]">
                  <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Notifications</p>
                      <p className="text-sm text-[#5f5142]">{(unreadActivityCount.data ?? 0) > 0 ? `${unreadActivityCount.data} unread alerts` : "No new notifications"}</p>
                    </div>
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1.5 text-xs font-semibold text-[#2f2418] transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={markActivityLogsRead.isPending || !(unreadActivityCount.data ?? 0)}
                      onClick={() => markActivityLogsRead.mutate({})}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark as read
                    </button>
                  </div>
                  <div className="grid gap-2">
                    {notificationRows.length ? notificationRows.map((item: any) => (
                      <div key={item.id} className="rounded-2xl border border-primary/15 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#2f2418]">{adminNotificationTitle(item)}</p>
                            <p className="mt-1 text-sm text-[#5f5142]">{item.description}</p>
                            <p className="mt-2 text-xs text-[#7b6547]">{new Date(item.createdAt).toLocaleString()}</p>
                          </div>
                          {item.isRead === "false" ? (
                            <button className="shrink-0 rounded-full border border-primary/30 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary transition hover:bg-primary/10" type="button" onClick={() => markActivityLogsRead.mutate({ ids: [item.id] })}>
                              Mark read
                            </button>
                          ) : (
                            <span className="shrink-0 rounded-full border border-emerald-300/50 bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                              Read
                            </span>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-primary/25 bg-white px-4 py-6 text-center text-sm text-[#5f5142]">
                        No new notifications
                      </div>
                    )}
                  </div>
                  <button
                    className="mt-3 w-full rounded-full border border-primary/25 px-4 py-2 text-sm font-semibold text-[#2f2418] transition hover:bg-primary/10"
                    type="button"
                    onClick={() => openProtectedOverviewSection("activity-monitoring", "Activity & Notifications")}
                  >
                    Open full activity feed
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Bookings" value={summary.data?.bookings ?? 0} icon={CalendarDays} />
            <Stat label="Orders" value={summary.data?.orders ?? 0} icon={ShoppingBag} />
            <Stat label="Pending reviews" value={summary.data?.pendingReviews ?? 0} icon={MessageSquare} />
            <Stat label="Pending product reviews" value={summary.data?.pendingProductReviews ?? 0} icon={MessageSquare} />
            <Stat label="Products" value={summary.data?.products ?? 0} icon={Package} />
            <Stat label="Services" value={summary.data?.services ?? 0} icon={Scissors} />
            <Stat label="AI try-ons" value={summary.data?.tryOns ?? 0} icon={Sparkles} />
            <Stat label="Unread alerts" value={unreadActivityCount.data ?? summary.data?.unreadActivities ?? 0} icon={Activity} />
          </div>
        </section>

        <div className="mt-8 grid gap-6">
          <AdminPanel id="activity-monitoring" eyebrow="Live intelligence" title="Analytics and activity monitoring" description="View visits, booking/payment/shop/AI actions, Braiders Near Me/Kouvia events, failures, and admin audit updates in one feed." icon={Activity} open={isPanelOpen("activity-monitoring")} onToggle={() => togglePanel("activity-monitoring")}>
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
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="serif text-2xl font-bold text-primary">Activity notifications</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-primary/35 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                    Unread {unreadActivityCount.data ?? 0}
                  </span>
                  <button
                    className="btn-dark py-2 text-sm"
                    type="button"
                    disabled={markActivityLogsRead.isPending || !(unreadActivityCount.data ?? 0)}
                    onClick={() => markActivityLogsRead.mutate({})}
                  >
                    Mark all as read
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  placeholder="Search user/email/page/activity/ID"
                  value={activityFilters.query}
                  onChange={(event) => setActivityFilters((current) => ({ ...current, query: event.target.value }))}
                />
                <select value={activityFilters.datePreset} onChange={(event) => setActivityFilters((current) => ({ ...current, datePreset: event.target.value as any }))}>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_7_days">Last 7 days</option>
                  <option value="last_30_days">Last 30 days</option>
                </select>
                <select value={activityFilters.activityCategory} onChange={(event) => setActivityFilters((current) => ({ ...current, activityCategory: event.target.value }))}>
                  <option value="">All categories</option>
                  <option value="visit">Visits</option>
                  <option value="booking">Bookings</option>
                  <option value="payment">Payments</option>
                  <option value="shop">Shop</option>
                  <option value="ai_try_on">AI Try-On</option>
                  <option value="kouvia">Braiders/Kouvia</option>
                  <option value="admin_action">Admin actions</option>
                </select>
                <select value={activityFilters.status} onChange={(event) => setActivityFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">All statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="info">Info</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <button type="button" className={`btn-dark py-2 ${activityFilters.failedOnly ? "border-red-400/60 text-red-100" : ""}`} onClick={() => setActivityFilters((current) => ({ ...current, failedOnly: !current.failedOnly }))}>
                  Failed only
                </button>
                <button type="button" className={`btn-dark py-2 ${activityFilters.unreadOnly ? "border-primary/60 text-primary" : ""}`} onClick={() => setActivityFilters((current) => ({ ...current, unreadOnly: !current.unreadOnly }))}>
                  Unread only
                </button>
                <button type="button" className="btn-dark py-2" onClick={() => setActivityFilters({ query: "", datePreset: "last_7_days", activityCategory: "", status: "", sourceApp: "", failedOnly: false, unreadOnly: false })}>
                  Reset filters
                </button>
              </div>
              <div className="mt-4 max-h-[30rem] overflow-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-black/40 text-primary">
                    <tr>
                      <th className="px-3 py-2">Time/Date</th>
                      <th className="px-3 py-2">Activity</th>
                      <th className="px-3 py-2">User/Guest</th>
                      <th className="px-3 py-2">Page/Feature</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Location/Device</th>
                      <th className="px-3 py-2">Details</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.isLoading ? (
                      <tr><td className="px-3 py-4 text-white/60" colSpan={8}>Loading activity notifications…</td></tr>
                    ) : !activityRows.length ? (
                      <tr><td className="px-3 py-4 text-white/60" colSpan={8}>No activity records found for this filter.</td></tr>
                    ) : (
                      activityRows.map((item: any) => (
                        <tr key={item.id} className="border-t border-white/10">
                          <td className="px-3 py-3 text-white/70">{new Date(item.createdAt).toLocaleString()}</td>
                          <td className="px-3 py-3">
                            <b className="text-primary">{item.activityType}</b>
                            <small className="block text-white/50">{item.activityCategory}</small>
                          </td>
                          <td className="px-3 py-3 text-white/70">
                            {item.userName || item.userEmail || "Guest"}
                            <small className="block text-white/45">{item.userEmail || item.sessionId || "-"}</small>
                          </td>
                          <td className="px-3 py-3 text-white/70">{item.pageUrl || "-"}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full border px-2 py-1 text-xs uppercase tracking-[0.12em] ${item.status === "failed" ? "border-red-400/50 text-red-200" : item.status === "success" ? "border-emerald-400/40 text-emerald-200" : item.status === "pending" ? "border-amber-400/40 text-amber-200" : "border-white/20 text-white/70"}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-white/70">
                            {[item.city, item.region, item.country].filter(Boolean).join(", ") || "N/A"}
                            <small className="block text-white/45">{[item.deviceType, item.browser].filter(Boolean).join(" · ") || "-"}</small>
                          </td>
                          <td className="px-3 py-3 text-white/70">
                            {item.description}
                            {(item.relatedEntityType || item.relatedEntityId) ? <small className="block text-white/45">{item.relatedEntityType || "entity"}: {item.relatedEntityId || "-"}</small> : null}
                          </td>
                          <td className="px-3 py-3">
                            {item.isRead === "false" ? (
                              <button className="btn-dark py-2 text-xs" type="button" onClick={() => markActivityLogsRead.mutate({ ids: [item.id] })}>
                                Mark read
                              </button>
                            ) : (
                              <span className="text-xs text-white/45">Read</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </AdminPanel>
        </div>

        <div className="mt-8 grid gap-6">
          <AdminPanel id="bookings" eyebrow="Appointments" title="Bookings manager" description="Open appointment requests, deposits, dates, and status controls only when you need to manage the diary." icon={CalendarDays} open={isPanelOpen("bookings")} onToggle={() => togglePanel("bookings")}>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-primary">
                <tr><th>Client</th><th>Service</th><th>Location</th><th>Date</th><th>Deposit</th><th>Surcharge</th><th>Stripe total</th><th>Status</th><th>Change status</th></tr>
              </thead>
              <tbody>
                {(data.bookings || []).map((booking: any) => (
                  <tr className="border-t border-white/10" key={booking.id}>
                    <td className="py-3">{booking.clientName}<small className="block text-white/45">{booking.clientEmail}</small></td>
                    <td>{booking.serviceName}</td>
                    <td>{booking.serviceLocation === "home_service" ? "Home Service" : "Visit the Studio"}<small className="block text-white/45">{booking.serviceLocation === "home_service" ? [booking.addressLine1, booking.addressLine2, booking.city, booking.county, booking.postcode].filter(Boolean).join(", ") : "Studio address hidden until paid confirmation"}</small></td>
                    <td>{booking.appointmentDate} {booking.appointmentTime}</td>
                    <td>{booking.depositStatus}</td>
                    <td>£{Number(booking.checkoutSurchargeCharged ?? booking.homeServiceSurcharge ?? 0).toFixed(2)}</td>
                    <td>{booking.checkoutTotalCharged != null ? `£${Number(booking.checkoutTotalCharged).toFixed(2)}` : "Pending"}</td>
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
                  <div><b>{order.customerName}</b><p className="text-sm text-white/55">{order.customerEmail} · {order.addressLine1}, {order.city}, {order.postcode}</p><p className="text-xs text-white/45">Stripe total: {order.checkoutTotalCharged != null ? `£${Number(order.checkoutTotalCharged).toFixed(2)}` : "Pending"}</p></div>
                  <select value={order.status} onChange={(event) => updateOrder.mutate({ id: order.id, status: event.target.value as any })}>
                    <option value="draft">Draft</option><option value="pending_payment">Pending payment</option><option value="paid">Paid</option><option value="fulfilling">Fulfilling</option><option value="shipped">Shipped</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            )) : <p className="text-white/55">No shop orders yet.</p>}
          </div>
          </AdminPanel>

          <AdminPanel id="customer-replies" eyebrow="Resend · ebysplace.com" title="Reply to a customer" description="Send a branded one-off reply to a customer enquiry. Delivered through Resend from info@ebysplace.com and recorded in the activity log." icon={Mail} open={isPanelOpen("customer-replies")} onToggle={() => togglePanel("customer-replies")}>
            {resendStatus.data && !resendStatus.data.configured ? (
              <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                RESEND_API_KEY is not available in this environment, so sending is disabled here. It is configured for Production only.
              </p>
            ) : null}
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Customer email</span>
                  <input type="email" value={replyForm.to} placeholder="customer@example.com" onChange={(event) => setReplyForm({ ...replyForm, to: event.target.value })} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Cc (for your records)</span>
                  <input type="email" value={replyForm.cc} onChange={(event) => setReplyForm({ ...replyForm, cc: event.target.value })} />
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Subject</span>
                <input value={replyForm.subject} placeholder="Re: Your enquiry" onChange={(event) => setReplyForm({ ...replyForm, subject: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Message</span>
                <textarea className="min-h-[200px]" value={replyForm.body} placeholder={"Hi Tanya,\n\nThank you so much for getting in touch.\n\nLeave a blank line between paragraphs."} onChange={(event) => setReplyForm({ ...replyForm, body: event.target.value })} />
                <span className="text-xs text-white/45">Blank lines separate paragraphs. The Eby&rsquo;s Place logo, signature, and footer are added automatically.</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Button label (optional)</span>
                  <input value={replyForm.ctaLabel} onChange={(event) => setReplyForm({ ...replyForm, ctaLabel: event.target.value })} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Button link (optional)</span>
                  <input value={replyForm.ctaUrl} onChange={(event) => setReplyForm({ ...replyForm, ctaUrl: event.target.value })} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn-gold py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={sendCustomerReply.isPending || !replyForm.to.trim() || replyForm.subject.trim().length < 3 || !replyForm.body.trim()}
                  onClick={() => {
                    const paragraphs = replyForm.body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
                    if (!paragraphs.length) { toast.error("Add a message before sending"); return; }
                    const hasCta = Boolean(replyForm.ctaLabel.trim() && replyForm.ctaUrl.trim());
                    sendCustomerReply.mutate({
                      to: replyForm.to.trim(),
                      cc: replyForm.cc.trim() || undefined,
                      subject: replyForm.subject.trim(),
                      paragraphs,
                      ctaLabel: hasCta ? replyForm.ctaLabel.trim() : undefined,
                      ctaUrl: hasCta ? replyForm.ctaUrl.trim() : undefined,
                    });
                  }}
                >
                  {sendCustomerReply.isPending ? "Sending..." : "Send reply"}
                </button>
                <button className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70" type="button" onClick={() => setReplyForm({ ...EMPTY_REPLY })}>Clear</button>
              </div>
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

          <AdminPanel id="newsletter-subscribers" eyebrow="Join the list" title="Newsletter subscribers" description="Everyone who has joined the Eby's Place list from the website, newest first." icon={Users} open={isPanelOpen("newsletter-subscribers")} onToggle={() => togglePanel("newsletter-subscribers")}>
            <div className="mt-5">
              {newsletterSubscribers.isLoading ? <p className="text-sm text-white/55">Loading subscribers...</p> : null}
              {newsletterSubscribers.error ? <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">Could not load subscribers: {newsletterSubscribers.error.message}</p> : null}
              {!newsletterSubscribers.isLoading && !newsletterSubscribers.error ? (
                newsletterSubscriberRows.length ? (
                  <>
                    <p className="text-sm text-white/65">Total subscribers: <b className="text-primary">{newsletterSubscriberRows.length}</b></p>
                    <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-white/45">
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Product alerts</th>
                            <th className="px-4 py-3">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {newsletterSubscriberRows.map((subscriber: any) => (
                            <tr className="border-b border-white/5 last:border-0" key={subscriber.id}>
                              <td className="break-all px-4 py-3 text-white/85">{subscriber.email}</td>
                              <td className="px-4 py-3">{subscriber.productAlerts === "true" ? <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Yes</span> : <span className="text-xs text-white/45">No</span>}</td>
                              <td className="px-4 py-3 text-xs text-white/55">{subscriber.createdAt ? new Date(subscriber.createdAt).toLocaleString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : <p className="text-white/55">No one has joined the Eby's Place list yet. New signups from the homepage form will appear here.</p>
              ) : null}
            </div>
          </AdminPanel>

          <AdminPanel id="announcements" eyebrow="Multi-channel" title="Send an announcement" description="Send the same message to opted-in web push subscribers, newsletter subscribers by email, and SMS opt-ins, all from one place." icon={Bell} open={isPanelOpen("announcements")} onToggle={() => togglePanel("announcements")}>
            <div className="mt-5">
              <div className="grid gap-2 text-sm text-white/65 sm:grid-cols-3">
                <p>Web push subscribers: <b className="text-primary">{announcementStatus.data?.webPush.subscriberCount ?? "..."}</b>{announcementStatus.data && !announcementStatus.data.webPush.configured ? <span className="block text-xs text-white/45">VAPID keys not configured yet</span> : null}</p>
                <p>Email subscribers: <b className="text-primary">{announcementStatus.data?.email.subscriberCount ?? "..."}</b> · All clients: <b className="text-primary">{announcementStatus.data?.email.allClientCount ?? "..."}</b>{announcementStatus.data && !announcementStatus.data.email.configured ? <span className="block text-xs text-white/45">Resend not configured yet</span> : null}</p>
                <p>SMS opt-ins: <b className="text-primary">{announcementStatus.data?.sms.subscriberCount ?? "..."}</b>{announcementStatus.data && !announcementStatus.data.sms.configured ? <span className="block text-xs text-white/45">Twilio not configured yet</span> : null}</p>
              </div>
              <form
                className="mt-4 grid gap-3 rounded-2xl border border-primary/20 bg-black/20 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendAnnouncement.mutate({ title: announcementForm.title, body: announcementForm.body, url: announcementForm.url || undefined, channels: announcementForm.channels, emailAudience: announcementForm.emailAudience });
                }}
              >
                <input required maxLength={80} placeholder="Title (e.g. New style openings this week)" value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} />
                <textarea required maxLength={200} placeholder="Message" value={announcementForm.body} onChange={(event) => setAnnouncementForm({ ...announcementForm, body: event.target.value })} />
                <input type="url" placeholder="Link to open when tapped (optional)" value={announcementForm.url} onChange={(event) => setAnnouncementForm({ ...announcementForm, url: event.target.value })} />
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={announcementForm.channels.webPush} onChange={(event) => setAnnouncementForm({ ...announcementForm, channels: { ...announcementForm.channels, webPush: event.target.checked } })} /> Web push</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={announcementForm.channels.email} onChange={(event) => setAnnouncementForm({ ...announcementForm, channels: { ...announcementForm.channels, email: event.target.checked } })} /> Email</label>
                  {announcementForm.channels.email ? (
                    <select value={announcementForm.emailAudience} onChange={(event) => setAnnouncementForm({ ...announcementForm, emailAudience: event.target.value as "newsletter" | "all_clients" })}>
                      <option value="newsletter">Newsletter subscribers only</option>
                      <option value="all_clients">Everyone who's booked or ordered</option>
                    </select>
                  ) : null}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={announcementForm.channels.sms} onChange={(event) => setAnnouncementForm({ ...announcementForm, channels: { ...announcementForm.channels, sms: event.target.checked } })} /> SMS</label>
                </div>
                <button className="btn-gold w-fit py-2 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={sendAnnouncement.isPending || !(announcementForm.channels.webPush || announcementForm.channels.email || announcementForm.channels.sms)}>
                  {sendAnnouncement.isPending ? "Sending..." : "Send announcement"}
                </button>
              </form>
            </div>
          </AdminPanel>

          <AdminPanel id="reviews" eyebrow="Trust & reputation" title="Reviews moderator" description="Approve or reject customer reviews from a focused moderation panel without crowding the daily overview." icon={MessageSquare} open={isPanelOpen("reviews")} onToggle={() => togglePanel("reviews")}>
          {lists.isLoading && <p className="mt-4 text-sm text-white/55">Loading reviews…</p>}
          {lists.error && <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">Could not load reviews: {lists.error.message}</p>}
          {!lists.isLoading && !lists.error && (
            <>
              <p className="text-sm text-white/65">Pending reviews ready for moderation: <b className="text-primary">{pendingReviewRows.length}</b></p>
              {!pendingReviewRows.length ? (
                <p className="mt-4 text-sm text-white/55">{reviewRows.length ? "All reviews have already been moderated. New website submissions will appear here with approve and reject buttons." : "No customer reviews yet. New website submissions will appear here with approve and reject buttons."}</p>
              ) : (
                <>
                  <h3 className="mt-5 font-semibold text-primary">Needs moderation</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {pendingReviewRows.map((review) => (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4" key={review.id}>
                        <div className="text-primary">{"★".repeat(review.rating)}</div>
                        <p className="mt-2 text-white/70">{review.reviewText}</p>
                        <b className="mt-3 block">{review.customerName}</b>
                        <p className="text-xs text-white/45">Status: pending</p>
                        <div className="mt-4 flex gap-2">
                          <button className="btn-gold py-2" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review.id, status: "approved" })}>Approve</button>
                          <button className="btn-dark py-2" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review.id, status: "rejected" })}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {moderatedReviewRows.length > 0 && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-white/55 hover:text-white/80">Show all moderated reviews ({moderatedReviewRows.length})</summary>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {moderatedReviewRows.map((review) => (
                      <div className="rounded-2xl border border-white/10 p-4" key={review.id}>
                        <div className="text-primary">{"★".repeat(review.rating)}</div>
                        <p className="mt-2 text-white/70">{review.reviewText}</p>
                        <b className="mt-3 block">{review.customerName}</b>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${review.status === "approved" ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"}`}>{review.status}</span>
                        <div className="mt-3 flex gap-2">
                          <button className="btn-gold py-1 text-xs" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review.id, status: "approved" })}>Approve</button>
                          <button className="btn-dark py-1 text-xs" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review.id, status: "rejected" })}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
          </AdminPanel>

          <AdminPanel id="product-reviews" eyebrow="Shop trust" title="Product reviews moderator" description="Approve or reject customer reviews for shop products. Approved reviews appear live on each product page." icon={MessageSquare} open={isPanelOpen("product-reviews")} onToggle={() => togglePanel("product-reviews")}>
          {lists.isLoading && <p className="mt-4 text-sm text-white/55">Loading product reviews…</p>}
          {lists.error && <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">Could not load product reviews: {lists.error.message}</p>}
          {!lists.isLoading && !lists.error && (
            <>
              <p className="text-sm text-white/65">Pending product reviews: <b className="text-primary">{pendingProductReviewRows.length}</b></p>
              {!pendingProductReviewRows.length ? (
                <p className="mt-4 text-sm text-white/55">{productReviewRows.length ? "All product reviews have already been moderated." : "No product reviews yet. Customer reviews from the shop will appear here."}</p>
              ) : (
                <>
                  <h3 className="mt-5 font-semibold text-primary">Needs moderation</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {pendingProductReviewRows.map((review) => (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4" key={review.id}>
                        <div className="text-primary">{"★".repeat(review.rating)}</div>
                        <p className="mt-2 text-white/70">{review.reviewText}</p>
                        <b className="mt-3 block">{review.customerName}</b>
                        <p className="text-xs text-white/45">Status: pending</p>
                        <div className="mt-4 flex gap-2">
                          <button className="btn-gold py-2" disabled={moderateProductReview.isPending} onClick={() => moderateProductReview.mutate({ id: review.id, status: "approved" })}>Approve</button>
                          <button className="btn-dark py-2" disabled={moderateProductReview.isPending} onClick={() => moderateProductReview.mutate({ id: review.id, status: "rejected" })}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {moderatedProductReviewRows.length > 0 && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-white/55 hover:text-white/80">Show all moderated product reviews ({moderatedProductReviewRows.length})</summary>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {moderatedProductReviewRows.map((review) => (
                      <div className="rounded-2xl border border-white/10 p-4" key={review.id}>
                        <div className="text-primary">{"★".repeat(review.rating)}</div>
                        <p className="mt-2 text-white/70">{review.reviewText}</p>
                        <b className="mt-3 block">{review.customerName}</b>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${review.status === "approved" ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"}`}>{review.status}</span>
                        <div className="mt-3 flex gap-2">
                          <button className="btn-gold py-1 text-xs" disabled={moderateProductReview.isPending} onClick={() => moderateProductReview.mutate({ id: review.id, status: "approved" })}>Approve</button>
                          <button className="btn-dark py-1 text-xs" disabled={moderateProductReview.isPending} onClick={() => moderateProductReview.mutate({ id: review.id, status: "rejected" })}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
          </AdminPanel>

          <AdminPanel id="products" eyebrow="Shop catalogue" title="Products, prices, stock & SEO" description="Open product names, prices, search-friendly slugs, SEO titles, colour choices, and stock controls when catalogue maintenance is needed." icon={Package} open={isPanelOpen("products")} onToggle={() => togglePanel("products")}>
            <details open className="mt-5 rounded-2xl border border-primary/20 bg-black/20 p-4">
              <summary className="cursor-pointer font-semibold text-primary">Add more shop products</summary>
              <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); const price = Number(newProduct.price); if (!Number.isFinite(price) || price < 0) { toast.error("Product price must be valid."); return; } createProduct.mutate({ name: newProduct.name, slug: (newProduct.slug || newProduct.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), category: newProduct.category as any, description: newProduct.description, price: price.toFixed(2), imageUrl: newProduct.imageUrl || undefined, badge: newProduct.badge || undefined, stockQuantity: Number(newProduct.stockQuantity) || 0, seoTitle: newProduct.seoTitle || `${newProduct.name} | Eby’s Place`, seoDescription: newProduct.seoDescription || newProduct.description, stockStatus: "in_stock", isFeatured: "false", variants: parseColourChoices(newProduct.colourChoices) }); }}>
                <div className="grid gap-3 sm:grid-cols-2"><input required placeholder="Product name" value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} /><input placeholder="SEO slug" value={newProduct.slug} onChange={(event) => setNewProduct({ ...newProduct, slug: event.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2"><select value={newProduct.category} onChange={(event) => setNewProduct({ ...newProduct, category: event.target.value })}>{productCategories.map((category) => <option key={category}>{category}</option>)}</select><input required type="number" min="0" step="0.01" placeholder="Price (£)" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} /></div>
                <textarea required placeholder="Public product description" value={newProduct.description} onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2"><input placeholder="Badge" value={newProduct.badge} onChange={(event) => setNewProduct({ ...newProduct, badge: event.target.value })} /><input type="number" min="0" placeholder="Stock quantity" value={newProduct.stockQuantity} onChange={(event) => setNewProduct({ ...newProduct, stockQuantity: Number(event.target.value) })} /></div>
                <input placeholder="SEO title" value={newProduct.seoTitle} onChange={(event) => setNewProduct({ ...newProduct, seoTitle: event.target.value })} />
                <textarea placeholder="SEO meta description" value={newProduct.seoDescription} onChange={(event) => setNewProduct({ ...newProduct, seoDescription: event.target.value })} />
                <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-white/70"><UploadCloud className="mr-2 inline h-4 w-4 text-primary" />Pick an image now and it will be uploaded automatically after the product is saved.</p>
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input placeholder="Product image URL (optional — paste URL or upload below)" value={newProduct.imageUrl} onChange={(event) => setNewProduct({ ...newProduct, imageUrl: event.target.value })} />
                  <label className="btn-dark cursor-pointer py-2"><UploadCloud className="mr-2 h-4 w-4" /> Upload product image<input className="sr-only" type="file" accept={ADMIN_UPLOAD_ACCEPT} onChange={(event) => handleNewProductFileSelect(event.target.files?.[0])} /></label>
                </div>
                {(newProductPreviewUrl || newProduct.imageUrl) && <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={newProductPreviewUrl || newProduct.imageUrl} alt="New product preview" loading="lazy" decoding="async" /></div>}
                <textarea placeholder={"Available colours in stock, one per line: Colour name|#hexcode|stock|imageUrl"} value={newProduct.colourChoices} onChange={(event) => setNewProduct({ ...newProduct, colourChoices: event.target.value })} />
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
                    <details open className="rounded-2xl border border-primary/20 bg-black/20 p-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Update product image</summary><div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]"><input key={`product-image-${product.id}-${product.imageUrl || "empty"}`} id={`product-image-${product.id}`} defaultValue={product.imageUrl || ""} placeholder="Supabase Storage public image URL" /><label className="btn-dark cursor-pointer py-2"><UploadCloud className="mr-2 h-4 w-4" /> Upload product image<input className="sr-only" type="file" accept={ADMIN_UPLOAD_ACCEPT} onChange={(event) => handleProductImageUpload(product, event.target.files?.[0])} /></label><button className="btn-dark py-2" type="button" disabled={!product.imageUrl || clearProductImage.isPending} onClick={() => clearProductImage.mutate({ productId: Number(product.id), imageUrl: product.imageUrl || undefined })}><Trash2 className="mr-2 h-4 w-4" /> Remove image</button></div>{product.imageUrl && <div className="mt-3 media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]"><img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /></div>}</details>
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
            <details open className="mt-4 rounded-2xl border border-primary/20 bg-black/20 p-4">
              <summary className="cursor-pointer font-semibold text-primary">Add a new service</summary>
              <form
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const priceFrom = Number(newService.priceFrom);
                  if (!Number.isFinite(priceFrom) || priceFrom < 0) {
                    toast.error("Service price must be valid.");
                    return;
                  }
                  createService.mutate({
                    name: newService.name,
                    slug: (newService.slug || newService.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
                    category: newService.category as any,
                    description: newService.description,
                    duration: newService.duration,
                    priceFrom: priceFrom.toFixed(2),
                    badge: newService.badge || undefined,
                    imageUrl: newService.imageUrl || undefined,
                    isBookable: newService.isBookable as "true" | "false",
                    isFeatured: newService.isFeatured as "true" | "false",
                    sortOrder: Number(newService.sortOrder) || 0,
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required placeholder="Service name" value={newService.name} onChange={(event) => setNewService({ ...newService, name: event.target.value })} />
                  <input placeholder="SEO slug" value={newService.slug} onChange={(event) => setNewService({ ...newService, slug: event.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={newService.category} onChange={(event) => setNewService({ ...newService, category: event.target.value })}>
                    {serviceCategories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                  <input required placeholder="Duration" value={newService.duration} onChange={(event) => setNewService({ ...newService, duration: event.target.value })} />
                </div>
                <textarea required placeholder="Public service description" value={newService.description} onChange={(event) => setNewService({ ...newService, description: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required type="number" min="0" step="0.01" placeholder="Price from (£)" value={newService.priceFrom} onChange={(event) => setNewService({ ...newService, priceFrom: event.target.value })} />
                  <input placeholder="Badge" value={newService.badge} onChange={(event) => setNewService({ ...newService, badge: event.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select value={newService.isBookable} onChange={(event) => setNewService({ ...newService, isBookable: event.target.value })}>
                    <option value="true">Available for booking</option>
                    <option value="false">Unavailable for booking</option>
                  </select>
                  <select value={newService.isFeatured} onChange={(event) => setNewService({ ...newService, isFeatured: event.target.value })}>
                    <option value="false">Standard service</option>
                    <option value="true">Featured service</option>
                  </select>
                  <input type="number" min="0" placeholder="Sort order" value={newService.sortOrder} onChange={(event) => setNewService({ ...newService, sortOrder: Number(event.target.value) })} />
                </div>
                <input placeholder="Supabase Storage public image URL (optional)" value={newService.imageUrl} onChange={(event) => setNewService({ ...newService, imageUrl: event.target.value })} />
                <button className="btn-gold" disabled={createService.isPending}>{createService.isPending ? "Saving service…" : "Save service"}</button>
              </form>
            </details>
            <div className="mt-5 grid gap-4">
              {(data.services || []).map((service: any) => (
              <div className="rounded-2xl border border-white/10 p-4" key={service.id ?? service.slug ?? service.name}>
                  <div className="grid gap-4 md:grid-cols-[128px_1fr]">
                    <div className="media-portrait overflow-hidden rounded-2xl border border-primary/20 bg-[#171009]">
                      {getServiceImageSrc(service) ? (
                        <img
                          src={getServiceImageSrc(service)!}
                          alt={service.name}
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            const fallback = getServiceImageFallback(service);
                            if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                          }}
                        />
                      ) : <div className="flex h-full items-center justify-center text-xs text-white/35">No image</div>}
                    </div>
                    <div>
                      <div className="flex justify-between gap-3"><span>{service.name}<small className="block text-white/45">{service.category} · {service.duration}</small></span><b>£{service.priceFrom}</b></div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Service name<input defaultValue={service.name} id={`service-name-${service.id}`} /></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Slug<input defaultValue={service.slug} id={`service-slug-${service.id}`} /></label>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Category<select defaultValue={service.category} id={`service-category-${service.id}`}>{serviceCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Featured<select defaultValue={service.isFeatured || "false"} id={`service-featured-${service.id}`}><option value="false">Standard</option><option value="true">Featured</option></select></label>
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr]">
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Service price (£)<input type="number" min="0" step="0.01" defaultValue={service.priceFrom} id={`price-${service.id}`} /></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Duration<input defaultValue={service.duration} id={`duration-${service.id}`} /></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Availability<select defaultValue={service.isBookable || "true"} id={`availability-${service.id}`}><option value="true">Available for booking</option><option value="false">Unavailable for booking</option></select></label>
                        <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Sort order<input type="number" min="0" defaultValue={service.sortOrder ?? 0} id={`service-sort-${service.id}`} /></label>
                      </div>
                      <label className="mt-3 grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Description<textarea defaultValue={service.description} id={`service-description-${service.id}`} rows={4} /></label>
                      <label className="mt-3 grid gap-1 text-xs uppercase tracking-[0.2em] text-primary/80">Badge<input defaultValue={service.badge || ""} id={`service-badge-${service.id}`} /></label>
                      <details open className="mt-3 rounded-2xl border border-primary/20 bg-black/20 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-primary">Add or replace service image</summary>
                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                          <input id={`service-image-${service.id}`} defaultValue={service.imageUrl || ""} placeholder="Supabase Storage public image URL" />
                          <label className="btn-dark cursor-pointer py-2">
                            <UploadCloud className="mr-2 h-4 w-4" /> {uploadingServiceId === service.id ? "Uploading…" : "Upload image"}
                            <input className="sr-only" type="file" accept={ADMIN_UPLOAD_ACCEPT} disabled={uploadingServiceId === service.id} onChange={(event) => handleServiceImageUpload(service, event.target.files?.[0])} />
                          </label>
                          <button className="btn-dark py-2" type="button" disabled={!service.id || !service.imageUrl || clearServiceImage.isPending} onClick={() => clearServiceImage.mutate({ serviceId: service.id, imageUrl: service.imageUrl || undefined })}><Trash2 className="mr-2 h-4 w-4" /> Remove image</button>
                        </div>
                      </details>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          className="btn-gold flex-1 py-2"
                          type="button"
                          onClick={() => {
                            if (!service.id) {
                              toast.error("This service has no database ID. Please connect the live database and refresh.");
                              return;
                            }
                            const priceFrom = readAdminPrice(`price-${service.id}`, "Service price");
                            if (!priceFrom) return;
                            updateService.mutate({
                              id: service.id,
                              name: (document.getElementById(`service-name-${service.id}`) as HTMLInputElement).value,
                              slug: (document.getElementById(`service-slug-${service.id}`) as HTMLInputElement).value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
                              category: (document.getElementById(`service-category-${service.id}`) as HTMLSelectElement).value as any,
                              description: (document.getElementById(`service-description-${service.id}`) as HTMLTextAreaElement).value,
                              duration: (document.getElementById(`duration-${service.id}`) as HTMLInputElement).value,
                              priceFrom,
                              badge: (document.getElementById(`service-badge-${service.id}`) as HTMLInputElement).value || undefined,
                              imageUrl: (document.getElementById(`service-image-${service.id}`) as HTMLInputElement)?.value.trim() || undefined,
                              isBookable: (document.getElementById(`availability-${service.id}`) as HTMLSelectElement).value as "true" | "false",
                              isFeatured: (document.getElementById(`service-featured-${service.id}`) as HTMLSelectElement).value as "true" | "false",
                              sortOrder: Number((document.getElementById(`service-sort-${service.id}`) as HTMLInputElement).value) || 0,
                            });
                          }}
                        >
                          Save service
                        </button>
                        <button
                          type="button"
                          className="btn-dark border-red-400/40 py-2 text-red-100 hover:border-red-300 hover:text-red-50"
                          disabled={deleteService.isPending || !service.id}
                          onClick={() => {
                            if (!service.id) {
                              toast.error("This service has no database ID. Please connect the live database and refresh.");
                              return;
                            }
                            if (window.confirm(`Delete ${service.name}?`)) deleteService.mutate({ id: service.id, imageUrl: service.imageUrl || undefined });
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete service
                        </button>
                      </div>
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
            <details open className="mt-4 rounded-2xl border border-primary/20 bg-black/20 p-4">
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
              {galleryItems.map((item, index) => {
                const galleryId = typeof item.id === "number" ? item.id : Number(item.id);
                const isDeleting = deletingGalleryId === galleryId;
                return (
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
                      disabled={!item.id || isDeleting}
                      onClick={() => {
                        if (!Number.isInteger(galleryId) || galleryId <= 0) {
                          toast.error("This gallery image cannot be deleted because it has no database ID.");
                          return;
                        }
                        if (window.confirm(`Delete "${item.title}" from the gallery?`)) {
                          setDeletingGalleryId(galleryId);
                          deleteGalleryImage.mutate({ id: galleryId, imageUrl: item.imageUrl || undefined });
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
              })}
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
