import { useState, type ChangeEvent } from "react";
import { Loader2, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
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

const AI_TRYON_FREE_LIMIT_ENV = import.meta.env.VITE_AI_TRYON_FREE_LIMIT;
const TRY_ON_ATTEMPT_LIMIT: number | null =
  !AI_TRYON_FREE_LIMIT_ENV || AI_TRYON_FREE_LIMIT_ENV === "unlimited"
    ? null
    : Number(AI_TRYON_FREE_LIMIT_ENV);
const TRY_ON_ATTEMPT_KEY = "ebysplace_tryon_attempts";

export default function TryOn() {
  const upload = trpc.public.uploadTryOnPhoto.useMutation();
  const generate = trpc.public.generateTryOn.useMutation();
  const [attemptsUsed, setAttemptsUsed] = useState(() => Number(localStorage.getItem(TRY_ON_ATTEMPT_KEY) || "0"));
  const [photo, setPhoto] = useState<UploadedPhoto>();
  const [storedPhoto, setStoredPhoto] = useState<StoredPhoto>();
  const [style, setStyle] = useState(styles[0]);
  const [error, setError] = useState<string>();
  const [isPreparing, setIsPreparing] = useState(false);

  const isBusy = isPreparing || upload.isPending || generate.isPending;

  async function onFile(file: File | undefined, source: UploadedPhoto["source"]) {
    if (!file) return;
    setError(undefined);
    setPhoto(undefined);
    setStoredPhoto(undefined);
    generate.reset();
    setIsPreparing(true);
    try {
      const compressed = await compressImage(file);
      setPhoto({ ...compressed, source });
      toast.success("Photo prepared for AI Try-On", {
        description: `Prepared to ${compressed.sizeKb}KB so the AI can read it more reliably.`,
        classNames: aiTryOnToastClassNames,
      });
    } catch (err) {
      const message = friendlyTryOnError(err);
      setError(message);
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

    if (TRY_ON_ATTEMPT_LIMIT !== null && attemptsUsed >= TRY_ON_ATTEMPT_LIMIT) {
      const message = `You have used your ${TRY_ON_ATTEMPT_LIMIT} free AI try-on attempts on this device.`;
      setError(message);
      toast.error(message);
      return;
    }

    setError(undefined);
    try {
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
      });
      const nextAttemptsUsed = attemptsUsed + 1;
      localStorage.setItem(TRY_ON_ATTEMPT_KEY, String(nextAttemptsUsed));
      setAttemptsUsed(nextAttemptsUsed);
      toast.success("AI Try-On preview generated", {
        description: result.customerNotification ?? "Your hairstyle preview is ready below.",
        classNames: aiTryOnToastClassNames,
      });
    } catch (err) {
      const message = friendlyTryOnError(err);
      setError(message);
      toast.error("AI Try-On failed", {
        description: message,
        classNames: aiTryOnToastClassNames,
      });
    }
  }

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">AI hairstyle try-on</p>
        <h1 className="serif mt-4 max-w-5xl text-4xl font-bold leading-tight text-[#2f2418] sm:text-5xl md:text-6xl">
          See yourself in any braid style.
        </h1>
        <p className="mt-5 max-w-3xl text-[#5f5142]">
          Upload a clear portrait photo, choose your style, and see an AI preview.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="lux-card border-[#d8b66b]/35 bg-[#fffaf0]/90 shadow-[0_18px_45px_rgba(93,67,32,0.12)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[#c8a552]/60 bg-white/70 p-6 text-center transition hover:border-[#9f7a25] hover:bg-[#fff7df]">
                <UploadCloud className="h-10 w-10 text-[#9f7a25]" />
                <span className="mt-3 font-semibold text-[#2f2418]">Photo Gallery</span>
                <span className="mt-2 text-sm text-[#6e604f]">Choose an image from your phone photo library.</span>
                <input
                  className="sr-only"
                  type="file"
                  accept={TRY_ON_ACCEPT}
                  disabled={isBusy}
                  onChange={(event) => void onPhotoInputChange(event, "gallery")}
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[#c8a552]/60 bg-white/70 p-6 text-center transition hover:border-[#9f7a25] hover:bg-[#fff7df]">
                <UploadCloud className="h-10 w-10 text-[#9f7a25]" />
                <span className="mt-3 font-semibold text-[#2f2418]">Take Photo</span>
                <span className="mt-2 text-sm text-[#6e604f]">On mobile, this opens your phone camera directly.</span>
                <input
                  className="sr-only"
                  type="file"
                  accept={TRY_ON_ACCEPT}
                  capture="user"
                  disabled={isBusy}
                  onChange={(event) => void onPhotoInputChange(event, "camera")}
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[#c8a552]/60 bg-white/70 p-6 text-center transition hover:border-[#9f7a25] hover:bg-[#fff7df] sm:col-span-2">
                <UploadCloud className="h-10 w-10 text-[#9f7a25]" />
                <span className="mt-3 font-semibold text-[#2f2418]">Desktop File Upload</span>
                <span className="mt-2 text-sm text-[#6e604f]">Choose an image file from your computer.</span>
                <input
                  className="sr-only"
                  type="file"
                  accept={TRY_ON_ACCEPT}
                  disabled={isBusy}
                  onChange={(event) => void onPhotoInputChange(event, "desktop")}
                />
              </label>
            </div>
            <p className="mt-4 rounded-2xl bg-[#f6edda] px-4 py-3 text-sm text-[#5f5142]">
              Step 1: use phone camera, photo gallery, or desktop file upload. Step 2: preview it below. Step 3: generate your hairstyle preview when you are happy with the image.
            </p>

            <label className="mt-6 block text-sm font-semibold uppercase tracking-[0.2em] text-[#8a6a1f]" htmlFor="try-on-style">
              Choose style
            </label>
            <select
              id="try-on-style"
              className="mt-3 w-full rounded-full border border-[#d8b66b]/50 bg-white px-5 py-3 text-[#2f2418] outline-none ring-[#c8a552]/25 focus:ring-4"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              disabled={isBusy}
            >
              {styles.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <button className="btn-gold mt-6 w-full" onClick={run} disabled={!photo || isBusy}>
              {isBusy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
              {isPreparing ? "Preparing photo…" : upload.isPending ? "Uploading photo…" : generate.isPending ? "Generating preview…" : "Generate hairstyle preview"}
            </button>

            {photo && (
              <p className="mt-4 rounded-2xl bg-[#f6edda] px-4 py-3 text-sm text-[#5f5142]">
                {photo.source === "camera"
                  ? "Camera photo ready for preview."
                  : photo.source === "gallery"
                    ? "Gallery photo ready for preview."
                    : "Desktop upload ready for preview."} Prepared upload size: <strong className="text-[#2f2418]">{photo.sizeKb}KB</strong>. This helps the AI read the portrait and prevents large-photo upload timeouts.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-2xl border-2 border-[#b42318] bg-[#fff1f0] px-4 py-3 text-sm font-semibold leading-relaxed text-[#5a160f] shadow-[0_10px_24px_rgba(180,35,24,0.16)]" role="alert">
                {error}
              </p>
            )}
            <p className="mt-4 text-sm text-[#6e604f]">
              For best results, use a bright portrait where your hair and face are clearly visible. This is a visual preview before booking, not a guarantee of an exact finished salon result.
            </p>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="lux-card border-[#d8b66b]/35 bg-[#fffaf0]/90 shadow-[0_18px_45px_rgba(93,67,32,0.12)]">
              <h2 className="serif text-3xl font-bold text-[#2f2418]">Original</h2>
              <div className="mt-4 flex aspect-[3/4] min-h-[24rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#d8b66b]/40 bg-[#f8efe0] p-2">
                {photo ? (
                  <img className="h-full w-full rounded-xl object-contain" src={photo.dataUrl} alt={photo.source === "camera" ? "Camera portrait preview before submission" : photo.source === "gallery" ? "Gallery portrait preview before submission" : "Desktop upload portrait preview before submission"} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[#d8b66b]/50 bg-white/60 p-6 text-center text-[#6e604f]">
                    Your selected portrait will appear here for preview before submission.
                  </div>
                )}
              </div>
            </div>
            <div className="lux-card border-[#d8b66b]/35 bg-[#fffaf0]/90 shadow-[0_18px_45px_rgba(93,67,32,0.12)]">
              <h2 className="serif text-3xl font-bold text-[#2f2418]">Generated</h2>
              <div className="mt-4 flex aspect-[3/4] min-h-[24rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#d8b66b]/40 bg-[#f8efe0] p-2">
                {generate.data?.generatedImageUrl ? (
                  <img className="h-full w-full rounded-xl object-contain" src={generate.data.generatedImageUrl} alt={`${style} AI Try-On preview`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[#d8b66b]/50 bg-white/60 p-6 text-center text-[#6e604f]">
                    Your AI result will appear here after upload and generation.
                  </div>
                )}
              </div>
            </div>

          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
