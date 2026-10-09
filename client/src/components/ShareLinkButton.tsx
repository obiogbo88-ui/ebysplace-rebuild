import { Share2 } from "lucide-react";
import { toast } from "sonner";

const SITE_ORIGIN = "https://www.ebysplace.com";

/** Absolute, shareable ebysplace.com URL for a site path such as "/shop/edge-gel". */
export function shareableUrl(path: string) {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shares a service or product link: opens the phone's native share sheet
 * (WhatsApp, Instagram, Messages…) where supported, otherwise copies the link.
 */
export function ShareLinkButton({
  path,
  title,
  text,
  className = "",
}: {
  path: string;
  title: string;
  text?: string;
  className?: string;
}) {
  const handleShare = async () => {
    const url = shareableUrl(path);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: text || title, url });
        return;
      } catch (error) {
        // The visitor closed the share sheet — nothing else to do.
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    if (await copyToClipboard(url)) {
      toast.success("Link copied — paste it anywhere to share.");
    } else {
      toast.message("Copy this link to share", { description: url });
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={`Share ${title}`}
      className={`inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <Share2 className="h-4 w-4" aria-hidden="true" /> Share
    </button>
  );
}
