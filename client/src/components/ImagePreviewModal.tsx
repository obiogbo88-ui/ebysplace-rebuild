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
  frameClassName = "flex h-full w-full items-center justify-center p-4 sm:p-8",
  imageClassName = "max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-h-[calc(100vh-4rem)] sm:max-w-[calc(100vw-4rem)]",
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 transition-opacity duration-300"
      role={role}
      aria-modal="true"
      aria-label={dialogLabel}
      onClick={onClose}
    >
      <div className="relative h-full w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="absolute right-4 top-3 z-10 inline-flex h-12 w-12 items-center justify-center text-5xl leading-none text-white transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6 sm:top-4"
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
