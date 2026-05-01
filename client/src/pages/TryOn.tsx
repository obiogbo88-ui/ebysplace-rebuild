import { useState } from "react";
import { Loader2, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

const styles = [
  "Knotless Braids",
  "Boho Goddess Braids",
  "Senegalese Twists",
  "Invisible Locs",
  "Fulani Braids",
  "Kids Cornrows",
];

type UploadedPhoto = {
  dataUrl: string;
  fileName: string;
  sizeKb: number;
};

type StoredPhoto = {
  url: string;
  key: string;
  mimeType: string;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image. Please try a JPEG or PNG portrait photo."));
    image.src = src;
  });
}

async function compressImage(file: File): Promise<UploadedPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file for the AI Try-On.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Please choose a photo under 20MB. Very large camera files can time out before upload.");
  }

  const objectUrl = URL.createObjectURL(file);
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
      }, "image/jpeg", 0.82);
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
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function TryOn() {
  const upload = trpc.public.uploadTryOnPhoto.useMutation();
  const generate = trpc.public.generateTryOn.useMutation();
  const [photo, setPhoto] = useState<UploadedPhoto>();
  const [storedPhoto, setStoredPhoto] = useState<StoredPhoto>();
  const [style, setStyle] = useState(styles[0]);
  const [error, setError] = useState<string>();
  const [isPreparing, setIsPreparing] = useState(false);

  const isBusy = isPreparing || upload.isPending || generate.isPending;

  async function onFile(file?: File) {
    if (!file) return;
    setError(undefined);
    setStoredPhoto(undefined);
    generate.reset();
    setIsPreparing(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      toast.success("Photo prepared for AI Try-On", {
        description: `Compressed to ${compressed.sizeKb}KB to avoid upload timeouts.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not prepare this image.";
      setError(message);
      toast.error("Photo could not be prepared", { description: message });
    } finally {
      setIsPreparing(false);
    }
  }

  async function run() {
    if (!photo) {
      setError("Please upload a clear portrait photo before generating a preview.");
      return;
    }

    setError(undefined);
    try {
      const uploaded = storedPhoto ?? await upload.mutateAsync({
        dataUrl: photo.dataUrl,
        fileName: `${photo.fileName}.jpg`,
      });
      setStoredPhoto(uploaded);

      await generate.mutateAsync({
        styleName: style,
        originalImageUrl: uploaded.url,
        originalImageKey: uploaded.key,
        mimeType: uploaded.mimeType,
      });
      toast.success("AI Try-On preview generated", {
        description: "Your hairstyle preview is ready below.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI Try-On could not generate a preview right now.";
      setError(message);
      toast.error("AI Try-On failed", { description: message });
    }
  }

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">AI hairstyle try-on</p>
        <h1 className="serif mt-4 max-w-5xl text-5xl font-bold text-[#2f2418] md:text-6xl">
          Preview braid styles while preserving your face.
        </h1>
        <p className="mt-5 max-w-3xl text-[#5f5142]">
          Upload a clear portrait photo, choose a braid style, and generate a visual preview. The page compresses large camera photos before upload so the request does not time out.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="lux-card border-[#d8b66b]/35 bg-[#fffaf0]/90 shadow-[0_18px_45px_rgba(93,67,32,0.12)]">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[#c8a552]/60 bg-white/70 p-8 text-center transition hover:border-[#9f7a25] hover:bg-[#fff7df]">
              <UploadCloud className="h-10 w-10 text-[#9f7a25]" />
              <span className="mt-3 font-semibold text-[#2f2418]">Upload a clear front-facing photo</span>
              <span className="mt-2 text-sm text-[#6e604f]">JPEG or PNG works best. Large photos are resized automatically before upload.</span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                disabled={isBusy}
                onChange={(event) => onFile(event.target.files?.[0])}
              />
            </label>

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
                Prepared upload size: <strong className="text-[#2f2418]">{photo.sizeKb}KB</strong>. This prevents the large-photo timeout that can happen with uncompressed camera images.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <p className="mt-4 text-sm text-[#6e604f]">
              For best results, use a bright portrait where your hair and face are visible. This is a preview before booking, not a guarantee of an exact finished salon result.
            </p>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="lux-card border-[#d8b66b]/35 bg-[#fffaf0]/90 shadow-[0_18px_45px_rgba(93,67,32,0.12)]">
              <h2 className="serif text-3xl font-bold text-[#2f2418]">Original</h2>
              <div className="mt-4 flex aspect-[3/4] min-h-[24rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#d8b66b]/40 bg-[#f8efe0] p-2">
                {photo ? (
                  <img className="h-full w-full rounded-xl object-contain" src={photo.dataUrl} alt="Uploaded customer portrait preview" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[#d8b66b]/50 bg-white/60 p-6 text-center text-[#6e604f]">
                    Your uploaded portrait will appear here.
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
