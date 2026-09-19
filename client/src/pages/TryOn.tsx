import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Loader2, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getActivitySessionId, getBrowserInfo, getCurrentPageUrl } from "@/lib/activityTracking";
import { SiteFooter, SiteHeader } from "./Home";

const aiTryOnToastClassNames = {
  title: "!text-black",
  description: "!text-black",
};

const styles = [
  "Knotless Braids",
  "Box Braids",
  "Goddess Braids",
  "Fulani Braids",
  "Cornrows",
  "Stitch Braids",
  "Lemonade Braids",
  "Boho Braids",
  "Tribal Braids",
  "Senegalese Twists",
  "Passion Twists",
  "Faux Locs",
  "Butterfly Locs",
  "Starter Locs",
  "Men Cornrows",
  "Men Box Braids",
  "Men Twists",
  "Kids Braids",
  "Kids Cornrows",
  "Kids Box Braids",
];

type UploadedPhoto = {
  dataUrl: string;
  fileName: string;
  sizeKb: number;
  source: "camera" | "gallery" | "desktop";
};

type StoredPhoto = {
  url: string;
  key: string;
  mimeType: string;
};

type HeicConverter = (options: {
  blob: Blob;
  toType: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

function isHeicLike(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

async function convertHeicToJpeg(file: File) {
  try {
    const imported = await import("heic2any");
    const heic2any = imported.default as HeicConverter;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.88 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob || blob.size === 0) throw new Error("Converted file was empty.");
    return blob;
  } catch {
    throw new Error("This iPhone HEIC photo could not be converted. Please try saving it as JPEG, or choose another clear portrait photo.");
  }
}

const MAX_TRY_ON_FILE_SIZE_MB = 20;
const TRY_ON_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,image/*";
const TRY_ON_CONTACT_KEY = "ebysplace_tryon_contact";

const TRY_ON_CREDIT_BUNDLES: Array<{ id: "single" | "small" | "large"; label: string; price: string }> = [
  { id: "single", label: "1 extra Try-On", price: "£1.49" },
  { id: "small", label: "3 extra Try-Ons", price: "£2.99" },
  { id: "large", label: "6 extra Try-Ons", price: "£4.99" },
];

function readStoredContact(): { email: string; phone: string } {
  if (typeof window === "undefined") return { email: "", phone: "" };
  try {
    const raw = window.localStorage.getItem(TRY_ON_CONTACT_KEY);
    if (!raw) return { email: "", phone: "" };
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
    };
  } catch {
    return { email: "", phone: "" };
  }
}

function persistStoredContact(email: string, phone: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRY_ON_CONTACT_KEY, JSON.stringify({ email, phone }));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image. Please try a JPEG, PNG, WebP, or iPhone HEIC portrait photo."));
    image.src = src;
  });
}

async function compressImage(file: File): Promise<UploadedPhoto> {
  if (!file.type.startsWith("image/") && !isHeicLike(file)) {
    throw new Error("Please choose an image file for the AI Try-On.");
  }

  if (file.size > MAX_TRY_ON_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Please choose a photo under ${MAX_TRY_ON_FILE_SIZE_MB}MB. Very large camera files can time out before upload.`);
  }

  const preparedBlob = isHeicLike(file) ? await convertHeicToJpeg(file) : file;
  const objectUrl = URL.createObjectURL(preparedBlob);
  try {
    const image = await loadImage(objectUrl);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image for upload.");
    context.fillStyle = "#fffaf0";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("Your browser could not compress this photo. Please try a different image."));
      }, "image/jpeg", 0.84);
    });

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not prepare this photo for upload."));
      reader.readAsDataURL(blob);
    });

    return {
      dataUrl,
      fileName: file.name.replace(/\.[^.]+$/, "") || "customer-photo",
      sizeKb: Math.round(blob.size / 1024),
      source: "gallery",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function friendlyTryOnError(error: unknown) {
  const message = error instanceof Error ? error.message : "AI Try-On could not generate a preview right now.";
  const lower = message.toLowerCase();
  if (lower.includes("read") || lower.includes("12007") || lower.includes("unsupported") || lower.includes("image generation failed")) {
    return "The AI could not read that photo clearly. Please upload a bright front-facing JPEG, PNG, WebP, or iPhone HEIC portrait where the face and hair are visible.";
  }
  if (lower.includes("payload") || lower.includes("smaller") || lower.includes("too large")) {
    return "That photo is still too large after preparation. Please choose a smaller portrait or screenshot, then try again.";
  }
  return message;
}

export default function TryOn() {
  const upload = trpc.public.uploadTryOnPhoto.useMutation();
  const generate = trpc.public.generateTryOn.useMutation();
  const purchaseCredits = trpc.public.purchaseTryOnCredits.useMutation();
  const logActivity = trpc.public.logActivity.useMutation();
  const [photo, setPhoto] = useState<UploadedPhoto>();
  const [storedPhoto, setStoredPhoto] = useState<StoredPhoto>();
  const [style, setStyle] = useState(styles[0]);
  const [error, setError] = useState<string>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [contact, setContact] = useState(() => readStoredContact());
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [purchaseNotice, setPurchaseNotice] = useState<string>();
  const [showOriginal, setShowOriginal] = useState(false);
  const resultRef = useRef<HTMLElement>(null);

  const balance = trpc.public.tryOnBalance.useQuery(
    { email: contact.email, phone: contact.phone || undefined },
    { enabled: Boolean(contact.email) }
  );

  const isBusy = isPreparing || upload.isPending || generate.isPending;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("tryon_credits");
    if (status === "success") {
      setPurchaseNotice("Payment received — your AI Try-On credits have been added.");
    } else if (status === "cancelled") {
      setPurchaseNotice("Credit purchase was cancelled. No payment was taken.");
    }
    if (status) {
      params.delete("tryon_credits");
      const nextSearch = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    }
  }, []);

  function updateContact(next: Partial<{ email: string; phone: string }>) {
    setContact((current) => {
      const updated = { ...current, ...next };
      persistStoredContact(updated.email, updated.phone);
      return updated;
    });
  }

  async function buyCredits(bundle: "single" | "small" | "large") {
    if (!contact.email) {
      setError("Please enter your email above before purchasing Try-On credits.");
      return;
    }
    try {
      const result = await purchaseCredits.mutateAsync({ email: contact.email, phone: contact.phone || undefined, bundle });
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start checkout. Please try again.";
      toast.error("Checkout could not start", { description: message, classNames: aiTryOnToastClassNames });
    }
  }

  async function onFile(file: File | undefined, source: UploadedPhoto["source"]) {
    if (!file) return;
    setError(undefined);
    setPhoto(undefined);
    setStoredPhoto(undefined);
    generate.reset();
    setShowOriginal(false);
    setIsPreparing(true);
    try {
      const compressed = await compressImage(file);
      setPhoto({ ...compressed, source });
      logActivity.mutate({
        sessionId: getActivitySessionId(),
        activityType: "ai_tryon_image_uploaded",
        activityCategory: "ai_try_on",
        description: "AI Try-On image prepared for upload",
        pageUrl: getCurrentPageUrl(),
        status: "success",
        metadata: {
          source,
          sizeKb: compressed.sizeKb,
          browser: getBrowserInfo().browser,
          deviceType: getBrowserInfo().deviceType,
        },
      });
      toast.success("Photo prepared for AI Try-On", {
        description: `Prepared to ${compressed.sizeKb}KB so the AI can read it more reliably.`,
        classNames: aiTryOnToastClassNames,
      });
    } catch (err) {
      const message = friendlyTryOnError(err);
      setError(message);
      logActivity.mutate({
        sessionId: getActivitySessionId(),
        activityType: "ai_tryon_failed",
        activityCategory: "ai_try_on",
        description: "AI Try-On image preparation failed",
        pageUrl: getCurrentPageUrl(),
        status: "failed",
        metadata: { errorMessage: message },
      });
      toast.error("Photo could not be prepared", {
        description: message,
        classNames: aiTryOnToastClassNames,
      });
    } finally {
      setIsPreparing(false);
    }
  }

  async function onPhotoInputChange(event: ChangeEvent<HTMLInputElement>, source: UploadedPhoto["source"]) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    await onFile(selectedFile, source);
  }

  async function run() {
    if (!photo) {
      setError("Please upload a clear portrait photo before generating a preview.");
      return;
    }

    if (!contact.email) {
      setError("Please enter your email above so we can track your free Try-On and any credits you purchase.");
      return;
    }

    setError(undefined);
    setPaywallOpen(false);
    setShowOriginal(false);
    window.setTimeout(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    try {
      logActivity.mutate({
        sessionId: getActivitySessionId(),
        activityType: "ai_tryon_started",
        activityCategory: "ai_try_on",
        description: `AI Try-On generation started for ${style}`,
        pageUrl: getCurrentPageUrl(),
        status: "pending",
        metadata: { styleName: style, imageUploaded: true },
      });
      const uploaded = storedPhoto ?? await upload.mutateAsync({
        dataUrl: photo.dataUrl,
        fileName: `${photo.fileName}.jpg`,
      });
      setStoredPhoto(uploaded);

      const result = await generate.mutateAsync({
        styleName: style,
        originalImageUrl: uploaded.url,
        originalImageKey: uploaded.key,
        mimeType: uploaded.mimeType,
        gender: "woman" as const,
        ageGroup: "adult" as const,
        email: contact.email,
        phone: contact.phone || undefined,
      });
      void balance.refetch();
      toast.success("AI Try-On preview generated", {
        description: result.customerNotification ?? "Your hairstyle preview is ready below.",
        classNames: aiTryOnToastClassNames,
      });
      logActivity.mutate({
        sessionId: getActivitySessionId(),
        activityType: "ai_tryon_completed",
        activityCategory: "ai_try_on",
        description: `AI Try-On generation completed for ${style}`,
        pageUrl: getCurrentPageUrl(),
        status: "success",
        relatedEntityType: "try_on",
        relatedEntityId: result.id,
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "";
      if (rawMessage.includes("Purchase more credits")) {
        setPaywallOpen(true);
        void balance.refetch();
        return;
      }
      const message = friendlyTryOnError(err);
      setError(message);
      logActivity.mutate({
        sessionId: getActivitySessionId(),
        activityType: "ai_tryon_failed",
        activityCategory: "ai_try_on",
        description: `AI Try-On generation failed for ${style}`,
        pageUrl: getCurrentPageUrl(),
        status: "failed",
        metadata: { errorMessage: message },
      });
      toast.error("AI Try-On failed", {
        description: message,
        classNames: aiTryOnToastClassNames,
      });
    }
  }

  const generatedUrl = generate.data?.generatedImageUrl;
  const shownImage = generatedUrl && !showOriginal ? generatedUrl : photo?.dataUrl;
  const showResultPanel = generate.isPending || Boolean(generatedUrl);
  const inputClass = "mt-2 w-full rounded-full border border-[#d8b66b]/50 bg-white px-5 py-3 text-[#2f2418] outline-none ring-[#c8a552]/25 focus:ring-4";
  const labelClass = "block text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6a1f]";

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">AI hairstyle try-on</p>
        <h1 className="serif mt-4 max-w-5xl text-4xl font-bold leading-tight text-[#2f2418] sm:text-5xl md:text-6xl">
          See yourself in any braid style.
        </h1>
        <p className="mt-4 max-w-3xl text-[#5f5142]">
          Upload a clear portrait photo, choose your style, and see an AI preview.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <section className="lux-card border-[#d8b66b]/35 bg-[#fffaf0]/90 shadow-[0_18px_45px_rgba(93,67,32,0.12)]">
            {photo ? (
              <div className="flex items-center gap-4 rounded-3xl border border-[#c8a552]/40 bg-white/70 p-3">
                <img className="h-20 w-16 shrink-0 rounded-xl object-cover object-top" src={photo.dataUrl} alt="Your selected portrait" />
                <div className="min-w-0 flex-1 text-sm text-[#5f5142]">
                  <p className="font-semibold text-[#2f2418]">Photo ready</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <label className="cursor-pointer font-semibold text-[#8a6a1f] underline underline-offset-2">
                      Change photo
                      <input className="sr-only" type="file" accept={TRY_ON_ACCEPT} disabled={isBusy} onChange={(event) => void onPhotoInputChange(event, "gallery")} />
                    </label>
                    <label className="cursor-pointer font-semibold text-[#8a6a1f] underline underline-offset-2">
                      Take new photo
                      <input className="sr-only" type="file" accept={TRY_ON_ACCEPT} capture="user" disabled={isBusy} onChange={(event) => void onPhotoInputChange(event, "camera")} />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[#c8a552]/60 bg-white/70 px-6 py-8 text-center transition hover:border-[#9f7a25] hover:bg-[#fff7df]">
                  {isPreparing ? <Loader2 className="h-9 w-9 animate-spin text-[#9f7a25]" /> : <UploadCloud className="h-9 w-9 text-[#9f7a25]" />}
                  <span className="mt-3 font-semibold text-[#2f2418]">{isPreparing ? "Preparing photo…" : "Upload a portrait photo"}</span>
                  <span className="mt-1 text-sm text-[#6e604f]">From your gallery or computer</span>
                  <input className="sr-only" type="file" accept={TRY_ON_ACCEPT} disabled={isBusy} onChange={(event) => void onPhotoInputChange(event, "gallery")} />
                </label>
                <label className="mt-2 block cursor-pointer text-center text-sm font-semibold text-[#8a6a1f] underline underline-offset-2">
                  or take a photo with your camera
                  <input className="sr-only" type="file" accept={TRY_ON_ACCEPT} capture="user" disabled={isBusy} onChange={(event) => void onPhotoInputChange(event, "camera")} />
                </label>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="try-on-email">Email</label>
                <input
                  id="try-on-email"
                  type="email"
                  required
                  className={inputClass}
                  value={contact.email}
                  onChange={(event) => updateContact({ email: event.target.value })}
                  placeholder="you@example.com"
                  disabled={isBusy}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="try-on-phone">Phone (optional)</label>
                <input
                  id="try-on-phone"
                  type="tel"
                  className={inputClass}
                  value={contact.phone}
                  onChange={(event) => updateContact({ phone: event.target.value })}
                  placeholder="07…"
                  disabled={isBusy}
                />
              </div>
            </div>

            <label className={`mt-5 ${labelClass}`} htmlFor="try-on-style">Choose style</label>
            <select
              id="try-on-style"
              className={inputClass}
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              disabled={isBusy}
            >
              {styles.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <button className="btn-gold mt-5 w-full" onClick={run} disabled={!photo || !contact.email || isBusy}>
              {isBusy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
              {isPreparing ? "Preparing photo…" : upload.isPending ? "Uploading photo…" : generate.isPending ? "Generating your preview…" : "Generate hairstyle preview"}
            </button>
            {generate.isPending && (
              <p className="mt-3 text-center text-xs text-[#6e604f]">
                This can take up to a minute — please do not close this tab.
              </p>
            )}
            {purchaseNotice && (
              <p className="mt-4 rounded-2xl bg-[#eaf6ec] px-4 py-3 text-sm font-semibold text-[#1f5f2d]">
                {purchaseNotice}
              </p>
            )}
            {contact.email && balance.data && (
              <p className="mt-4 rounded-2xl bg-[#f6edda] px-4 py-3 text-sm text-[#5f5142]">
                {balance.data.freeTrialAvailable ? (
                  "You have 1 free AI Try-On available."
                ) : balance.data.creditsRemaining > 0 ? (
                  <>You have <strong className="text-[#2f2418]">{balance.data.creditsRemaining}</strong> Try-On credit{balance.data.creditsRemaining === 1 ? "" : "s"} remaining.</>
                ) : (
                  "Your free Try-On has been used. Purchase more credits below to continue."
                )}
              </p>
            )}
            {paywallOpen && (
              <div className="mt-4 rounded-2xl border-2 border-[#c8a552] bg-[#fffaf0] px-5 py-4">
                <p className="font-semibold text-[#2f2418]">Your free Try-On has been used</p>
                <p className="mt-1 text-sm text-[#5f5142]">Purchase more credits to keep trying styles — each credit is one more AI hairstyle preview.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {TRY_ON_CREDIT_BUNDLES.map((bundle) => (
                    <button
                      key={bundle.id}
                      type="button"
                      className="btn-dark py-3 text-sm"
                      disabled={purchaseCredits.isPending}
                      onClick={() => void buyCredits(bundle.id)}
                    >
                      {bundle.label}
                      <br />
                      <span className="font-bold text-[#2f2418]">{bundle.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <p className="mt-4 rounded-2xl border-2 border-[#b42318] bg-[#fff1f0] px-4 py-3 text-sm font-semibold leading-relaxed text-[#5a160f] shadow-[0_10px_24px_rgba(180,35,24,0.16)]" role="alert">
                {error}
              </p>
            )}
            <p className="mt-4 text-xs text-[#6e604f]">
              Best with a bright, front-facing portrait. This is a visual preview before booking, not a guarantee of an exact finished salon result.
            </p>
          </section>

          <section ref={resultRef} className={`lux-card border-[#d8b66b]/35 bg-[#fffaf0]/90 shadow-[0_18px_45px_rgba(93,67,32,0.12)] ${showResultPanel ? "" : "hidden lg:block"}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="serif text-2xl font-bold text-[#2f2418]">{generatedUrl && !showOriginal ? "Your preview" : photo ? "Your photo" : "Preview"}</h2>
              {generatedUrl && photo && (
                <div className="inline-flex rounded-full border border-[#d8b66b]/50 bg-white p-1 text-sm font-semibold" role="group" aria-label="Compare original and generated">
                  <button type="button" className={`rounded-full px-4 py-1 ${!showOriginal ? "bg-[#2f2418] text-white" : "text-[#5f5142]"}`} onClick={() => setShowOriginal(false)}>Preview</button>
                  <button type="button" className={`rounded-full px-4 py-1 ${showOriginal ? "bg-[#2f2418] text-white" : "text-[#5f5142]"}`} onClick={() => setShowOriginal(true)}>Original</button>
                </div>
              )}
            </div>
            <div className="relative mt-4 flex aspect-[4/5] max-h-[32rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#d8b66b]/40 bg-[#f8efe0] p-3">
              {shownImage ? (
                <img className="h-full w-full rounded-xl object-contain object-top" src={shownImage} alt={generatedUrl && !showOriginal ? `${style} AI Try-On preview` : "Your portrait before the AI Try-On"} />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[#d8b66b]/50 bg-white/60 p-6 text-center text-[#6e604f]">
                  Your photo and AI result will appear here.
                </div>
              )}
              {generate.isPending && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#fffaf0]/80 text-[#2f2418]">
                  <Loader2 className="h-8 w-8 animate-spin text-[#9f7a25]" />
                  <span className="font-semibold">Generating your preview…</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
