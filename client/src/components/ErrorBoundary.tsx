import { CANONICAL_SITE_ORIGIN } from "@/lib/canonicalUrl";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRecovering: boolean;
}

const CHUNK_RECOVERY_STORAGE_KEY = "ebysplace:chunk-recovery-attempted";

function isDynamicImportFailure(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message} ${error.stack || ""}` : String(error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed|error loading dynamically imported module/i.test(message);
}

function currentCanonicalUrlWithRefreshMarker() {
  if (typeof window === "undefined") return CANONICAL_SITE_ORIGIN;
  const url = new URL(window.location.href);
  const canonical = new URL(`${url.pathname}${url.search}${url.hash}`, CANONICAL_SITE_ORIGIN);
  canonical.searchParams.set("_refresh", Date.now().toString());
  return canonical.toString();
}

async function clearBrowserCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  } catch {
    // Cache access can be blocked in some browsers. A cache-busting canonical reload still helps.
  }
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isRecovering: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isRecovering: isDynamicImportFailure(error) };
  }

  componentDidCatch(error: Error) {
    if (!isDynamicImportFailure(error) || typeof window === "undefined") return;

    const alreadyAttempted = window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY) === "1";
    if (alreadyAttempted) {
      this.setState({ isRecovering: false });
      return;
    }

    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, "1");
    void clearBrowserCaches().finally(() => {
      window.setTimeout(() => {
        window.location.replace(currentCanonicalUrlWithRefreshMarker());
      }, 150);
    });
  }

  render() {
    if (this.state.hasError) {
      const isChunkFailure = isDynamicImportFailure(this.state.error);
      const title = this.state.isRecovering ? "Refreshing the latest Eby’s Place page" : "An unexpected error occurred.";
      const description = this.state.isRecovering
        ? "We found an old page file from a previous update. The site is opening the latest www.ebysplace.com version now."
        : isChunkFailure
          ? "Your browser still has an old website file cached. Please reload once to fetch the latest page files."
          : "Please reload the page. If the problem continues, try a private browser window or clear this site’s cache.";

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="flex w-full max-w-2xl flex-col items-center p-8 text-center">
            <AlertTriangle
              size={48}
              className="mb-6 flex-shrink-0 text-destructive"
            />

            <h2 className="mb-4 text-xl">{title}</h2>
            <p className="mb-6 max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>

            {!this.state.isRecovering ? (
              <button
                onClick={() => window.location.replace(currentCanonicalUrlWithRefreshMarker())}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2",
                  "bg-primary text-primary-foreground",
                  "cursor-pointer hover:opacity-90"
                )}
              >
                <RotateCcw size={16} />
                Reload Latest Page
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
