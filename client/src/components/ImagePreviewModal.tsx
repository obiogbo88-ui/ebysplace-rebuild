import { useEffect } from "react";

type ImagePreviewModalProps = {
  isOpen: boolean;
  imageUrl?: string | null;
  fallbackSrc: string;
  alt: string;
  dialogLabel: string;
  role?: "dialog";
  frameClassName?: string;
  imageClassName?: string;
  onClose: () => void;
};

export default function ImagePreviewModal({
  isOpen,
  imageUrl,
  fallbackSrc,
  alt,
  dialogLabel,
  role = "dialog",
  frameClassName = "flex max-h-[92vh] w-full items-center justify-center overflow-hidden rounded-[2rem] border-2 border-neutral-950 bg-white p-4 shadow-2xl sm:rounded-[2.75rem] sm:p-6",
  imageClassName = "h-full w-full object-contain",
  onClose,
}: ImagePreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm transition-opacity duration-300 sm:p-6"
      role={role}
      aria-modal="true"
      aria-label={dialogLabel}
      onClick={onClose}
    >
      <div className="relative flex max-h-[94vh] w-full max-w-[min(96vw,920px)] items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-900/20 bg-white/90 text-2xl leading-none text-neutral-950 shadow-lg transition hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:right-4 sm:top-4"
          aria-label="Close image preview"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className={frameClassName}>
          <img
            src={imageUrl}
            alt={alt}
            className={imageClassName}
            loading="eager"
            decoding="async"
            onError={(event) => {
              if (event.currentTarget.src !== fallbackSrc) event.currentTarget.src = fallbackSrc;
            }}
          />
        </div>
      </div>
    </div>
  );
}
