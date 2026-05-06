export const DEFAULT_SCROLL_OFFSET = 112;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function smoothScrollToTop(delay = 0): void {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    window.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, delay);
}

export function smoothScrollToElement(elementId: string, delay = 0, offset = DEFAULT_SCROLL_OFFSET): void {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const element = document.getElementById(elementId);
    if (!element) {
      smoothScrollToTop(0);
      return;
    }
    const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top, left: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, delay);
}

export function smoothScrollToHash(hash: string, delay = 0): void {
  const normalized = hash.replace(/^#/, "");
  if (!normalized) {
    smoothScrollToTop(delay);
    return;
  }
  smoothScrollToElement(normalized, delay);
}

export function afterRouteScroll(path: string, delay = 80): void {
  if (path.includes("#")) {
    smoothScrollToHash(path.split("#")[1] || "", delay);
    return;
  }
  smoothScrollToTop(delay);
}

export function navigateWithSmoothScroll(path: string, setLocation?: (path: string) => void, delay = 80): void {
  if (typeof window === "undefined") return;
  if (setLocation) {
    setLocation(path);
  } else {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  afterRouteScroll(path, delay);
}
