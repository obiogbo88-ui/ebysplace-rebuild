import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getBlogPostBySlug } from "@/lib/blogContent";
import { lazy, Suspense, useEffect, useState } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { canonicalUrl } from "@/lib/canonicalUrl";
import {
  afterRouteScroll,
  navigateWithSmoothScroll,
  smoothScrollToTop,
} from "@/lib/smoothScroll";
import { trpc } from "@/lib/trpc";
import {
  createTrackingEventKey,
  getActivitySessionId,
  hasAnalyticsConsent,
  getBrowserInfo,
  shouldThrottleTrackingEvent,
  shouldTrackPublicActivity,
} from "@/lib/activityTracking";
import ErrorBoundary from "./components/ErrorBoundary";
import ChatAssistant from "./components/ChatAssistant";
import { Analytics } from "@vercel/analytics/react";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  getExistingPushSubscription,
  isPushSupported,
  pushSubscriptionToInput,
  subscribeToPush,
} from "@/lib/webPush";
import { ensureVisitorCookie, getStoredConsent } from "@/lib/cookieConsent";

const Home = lazy(() => import("./pages/Home"));
const Services = lazy(() => import("./pages/Services"));
const Booking = lazy(() => import("./pages/Booking"));
const Shop = lazy(() => import("./pages/Shop"));
const TryOn = lazy(() => import("./pages/TryOn"));
const Braiders = lazy(() => import("./pages/Braiders"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Blog = lazy(() => import("./pages/Blog"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Newsletter = lazy(() => import("./pages/Newsletter"));
const BookingSuccess = lazy(() => import("./pages/BookingSuccess"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminResetPassword = lazy(() => import("./pages/AdminResetPassword"));
const PoliciesIndex = lazy(() => import("./pages/Policies"));
const PrivacyPolicy = lazy(() =>
  import("./pages/Policies").then(module => ({
    default: () => <module.PolicyPage type="privacy" />,
  }))
);
const ShoppingPolicy = lazy(() =>
  import("./pages/Policies").then(module => ({
    default: () => <module.PolicyPage type="shopping" />,
  }))
);
const ReturnsPolicy = lazy(() =>
  import("./pages/Policies").then(module => ({
    default: () => <module.PolicyPage type="returns" />,
  }))
);
const TermsPolicy = lazy(() =>
  import("./pages/Policies").then(module => ({
    default: () => <module.PolicyPage type="terms" />,
  }))
);
const NotFound = lazy(() => import("@/pages/NotFound"));

const sharedLinkPathAliases: Record<string, string> = {
  "/home": "/",
  "/index": "/",
  "/index.html": "/",
  "/ts_footer_block": "/",
  "/ts_footer_block/footer-6": "/",
  "/footer-6": "/",
  "/service": "/services",
  "/pricing": "/services",
  "/prices": "/services",
  "/price-list": "/services",
  "/book": "/booking",
  "/book-now": "/booking",
  "/bookings": "/booking",
  "/booking.html": "/booking",
  "/booking-my-account": "/booking",
  "/my-account": "/booking",
  "/appointment": "/booking",
  "/appointments": "/booking",
  "/reserve": "/booking",
  "/reservation": "/booking",
  "/products": "/shop",
  "/product": "/shop",
  "/shop.html": "/shop",
  "/products.html": "/shop",
  "/store": "/shop",
  "/the-best-items": "/shop",
  "/the-best-items-": "/shop",
  "/ai": "/ai-try-on",
  "/try-on": "/ai-try-on",
  "/aitryon": "/ai-try-on",
  "/ai-tryon": "/ai-try-on",
  "/virtual-try-on": "/ai-try-on",
  "/braider": "/braiders-near-me",
  "/braiders": "/braiders-near-me",
  "/braider-near-me": "/braiders-near-me",
  "/find-braiders": "/braiders-near-me",
  "/find-a-braider": "/braiders-near-me",
  "/portfolio": "/gallery",
  "/photos": "/gallery",
  "/pictures": "/gallery",
  "/review": "/reviews",
  "/testimonial": "/reviews",
  "/testimonials": "/reviews",
  "/subscribe": "/newsletter",
  "/join": "/newsletter",
  "/mailing-list": "/newsletter",
  "/blogs": "/blog",
  "/articles": "/blog",
  "/journal": "/blog",
  "/privacy": "/policies/privacy",
  "/privacy-policy": "/policies/privacy",
  "/shopping": "/policies/shopping",
  "/shopping-policy": "/policies/shopping",
  "/returns": "/policies/returns",
  "/return-policy": "/policies/returns",
  "/returns-policy": "/policies/returns",
  "/terms": "/policies/terms",
  "/terms-of-use": "/policies/terms",
  "/terms-and-conditions": "/policies/terms",
};

const invisibleSharedLinkCharacters =
  /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF0-\uFFF8]+/g;

const canonicalStaticPaths = new Set([
  "/",
  "/services",
  "/booking",

  "/booking/success",
  "/shop",
  "/ai-try-on",
  "/braiders-near-me",
  "/gallery",
  "/blog",
  "/reviews",
  "/newsletter",
  "/admin",
  "/admin/login",
  "/admin/reset-password",
  "/policies",
  "/policies/privacy",
  "/policies/shopping",
  "/policies/returns",
  "/policies/terms",
  "/404",
]);

function normalizeSharedLinkPath(pathname: string) {
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const decodedPath = (() => {
    try {
      return decodeURIComponent(withoutTrailingSlash);
    } catch {
      return withoutTrailingSlash;
    }
  })();
  const cleanedSharedPath =
    decodedPath
      .replace(invisibleSharedLinkCharacters, "")
      .trim()
      .replace(/[\s.!,;:]+$/g, "")
      .replace(/\/+$/g, "") || "/";
  const lowerCasePath = cleanedSharedPath.toLowerCase();

  if (sharedLinkPathAliases[lowerCasePath])
    return sharedLinkPathAliases[lowerCasePath];

  if (lowerCasePath.endsWith(".html")) {
    const htmlStrippedPath = lowerCasePath.replace(/\.html$/i, "") || "/";
    if (sharedLinkPathAliases[htmlStrippedPath])
      return sharedLinkPathAliases[htmlStrippedPath];
    if (canonicalStaticPaths.has(htmlStrippedPath)) return htmlStrippedPath;
  }

  if (lowerCasePath.startsWith("/product/")) {
    const legacyProductSlug = lowerCasePath.replace(/^\/product\/+/, "");
    if (
      legacyProductSlug.startsWith("starter-locs") ||
      legacyProductSlug.startsWith("beads-accessories")
    )
      return "/services";
    if (legacyProductSlug) return `/shop/${legacyProductSlug}`;
    return "/shop";
  }

  if (
    lowerCasePath.startsWith("/product-category/") ||
    lowerCasePath.startsWith("/category/")
  )
    return "/shop";
  if (lowerCasePath.startsWith("/service/")) return "/services";
  if (lowerCasePath.startsWith("/journal/"))
    return `/blog/${lowerCasePath.replace(/^\/journal\/+/, "")}`;
  if (lowerCasePath.startsWith("/articles/"))
    return `/blog/${lowerCasePath.replace(/^\/articles\/+/, "")}`;
  if (lowerCasePath.startsWith("/article/"))
    return `/blog/${lowerCasePath.replace(/^\/article\/+/, "")}`;

  if (canonicalStaticPaths.has(lowerCasePath)) return lowerCasePath;
  if (lowerCasePath.startsWith("/shop/")) return lowerCasePath;
  if (lowerCasePath.startsWith("/blog/")) return lowerCasePath;

  return cleanedSharedPath;
}

const defaultSeo = {
  title: "Eby’s Place | Pain-Free Braids in Bridgwater, Somerset",
  description:
    "Pain-free knotless braids, box braids, cornrows, twists and locs in Bridgwater, Somerset. Zero pain, zero trauma, just perfection. Book online with a £20 deposit.",
};

const seoByPath: Record<string, { title: string; description: string }> = {
  "/": defaultSeo,
  "/services": {
    title: "Knotless Braids, Box Braids & Cornrows in Bridgwater | Eby’s Place",
    description:
      "Explore Eby’s Place African braiding services in Bridgwater, Somerset — knotless braids, boho knotless braids, box braids, goddess braids, cornrows, locs, twists, kids braids, men’s styles, beads, accessories, and gentle add-ons.",
  },
  "/booking": {
    title: "Book Appointment | Eby’s Place",
    description:
      "Book your Eby’s Place appointment online with a secure £20 deposit for luxury, scalp-conscious, pain-free braiding in Bridgwater, Somerset.",
  },
  "/shop": {
    title: "Braid Care Products & Accessories | Eby’s Place Shop",
    description:
      "Shop Eby’s Place braid care products, satin protection, scalp comfort oil, premium braiding hair, and aftercare essentials for protective styles.",
  },
  "/ai-try-on": {
    title: "AI Hairstyle Try-On | Eby’s Place",
    description:
      "Preview braid styles before booking with the Eby’s Place AI hairstyle try-on experience for protective styles and luxury braiding inspiration.",
  },
  "/braiders-near-me": {
    title: "Braiders Near Me | Eby’s Place",
    description:
      "Find trusted braiders and discover the Eby’s Place Braiders Near Me matching experience for luxury protective styling support.",
  },
  "/gallery": {
    title: "Braids Gallery | Eby’s Place",
    description:
      "View Eby’s Place braid inspiration, protective style examples, knotless braids, locs, twists, kids styles, and luxury scalp-conscious finishes.",
  },
  "/blog": {
    title: "Braid Care Blog | Eby’s Place",
    description:
      "Read the Eby’s Place braid journal for appointment prep, aftercare, and protective styling guidance.",
  },
  "/reviews": {
    title: "Client Reviews | Eby’s Place",
    description:
      "Read and leave reviews for Eby’s Place luxury pain-free braiding, scalp-conscious protective styling, and customer care.",
  },
  "/newsletter": {
    title: "Join the Newsletter | Eby’s Place",
    description:
      "Join the Eby’s Place list for style openings, product drops, and premium braid care guidance.",
  },
  "/policies": {
    title: "Policies | Eby’s Place",
    description:
      "Read Eby’s Place booking, shopping, returns, privacy, and terms policies before your appointment or shop purchase.",
  },
  "/policies/privacy": {
    title: "Privacy Policy | Eby’s Place",
    description:
      "Learn how Eby’s Place handles privacy, customer information, booking details, and website data.",
  },
  "/policies/shopping": {
    title: "Shopping Policy | Eby’s Place",
    description:
      "Review Eby’s Place shopping information for braid care products, accessories, and checkout support.",
  },
  "/policies/returns": {
    title: "Returns Policy | Eby’s Place",
    description:
      "Review the Eby’s Place returns policy for shop purchases, braid care products, and accessories.",
  },
  "/policies/terms": {
    title: "Terms and Conditions | Eby’s Place",
    description:
      "Read the Eby’s Place website, booking, and shop terms and conditions.",
  },
};

function upsertMeta(
  selector: string,
  attr: "name" | "property",
  key: string,
  content: string
) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonicalLink(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function DynamicSeoMetadata() {
  const [location] = useLocation();
  const track = trpc.public.track.useMutation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const pathname = location.split(/[?#]/)[0] || "/";
    const canonicalPath = pathname.startsWith("/shop/")
      ? pathname
      : normalizeSharedLinkPath(pathname);
    const blogSlug = pathname.startsWith("/blog/")
      ? pathname.replace(/^\/blog\/+/, "").split("/")[0] || ""
      : "";
    const blogPost = blogSlug ? getBlogPostBySlug(blogSlug) : undefined;
    const seo = pathname.startsWith("/shop/")
      ? {
          title: "Product Details | Eby’s Place Shop",
          description:
            "View Eby’s Place braid care products, accessories, and aftercare essentials for protective styles.",
        }
      : pathname.startsWith("/blog/")
        ? {
            title: blogPost?.title
              ? `${blogPost.title} | Eby’s Place Blog`
              : "Braid Journal Article | Eby’s Place",
            description:
              blogPost?.excerpt ||
              "Read braid care, appointment prep, and protective style guidance from Eby’s Place.",
          }
        : seoByPath[canonicalPath] || defaultSeo;
    const canonicalHref = canonicalUrl(canonicalPath);

    document.title = seo.title;
    upsertCanonicalLink(canonicalHref);
    upsertMeta(
      'meta[name="description"]',
      "name",
      "description",
      seo.description
    );
    upsertMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      canonicalPath.startsWith("/admin") || canonicalPath === "/404"
        ? "noindex, nofollow"
        : "index, follow, max-image-preview:large"
    );
    upsertMeta('meta[property="og:title"]', "property", "og:title", seo.title);
    upsertMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      seo.description
    );
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalHref);
    upsertMeta(
      'meta[name="twitter:title"]',
      "name",
      "twitter:title",
      seo.title
    );
    upsertMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      seo.description
    );
  }, [location]);

  useEffect(() => {
    const pagePath = location.split(/[?#]/)[0] || "/";
    if (!shouldTrackPublicActivity(pagePath)) return;
    // Page-visit analytics are opt-in: nothing is recorded until the visitor accepts analytics.
    if (!hasAnalyticsConsent()) return;
    const dedupeKey = "ebysplace:last-public-page-visit";
    const now = Date.now();
    try {
      const previous =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(dedupeKey)
          : null;
      if (previous) {
        const parsed = JSON.parse(previous) as {
          pagePath?: string;
          atMs?: number;
        };
        if (
          parsed.pagePath === pagePath &&
          typeof parsed.atMs === "number" &&
          now - parsed.atMs < 10000
        )
          return;
      }
      if (typeof window !== "undefined")
        window.sessionStorage.setItem(
          dedupeKey,
          JSON.stringify({ pagePath, atMs: now })
        );
    } catch {
      // Ignore dedupe storage read/write failures.
    }
    const browserInfo = getBrowserInfo();
    const sessionId = getActivitySessionId();
    const eventKey = createTrackingEventKey({
      eventName: "page_visit",
      pagePath,
      sessionId,
      activityType: "website_visit",
    });
    if (shouldThrottleTrackingEvent(eventKey)) return;
    const consent = getStoredConsent();
    const visitorCookie = ensureVisitorCookie(Boolean(consent?.analytics));
    track.mutate({
      eventName: "page_visit",
      pagePath,
      sessionId,
      activityType: "website_visit",
      activityCategory: "visit",
      description: `Visited ${pagePath}`,
      status: "info",
      metadata: {
        referrer:
          typeof document !== "undefined" ? document.referrer || null : null,
        browser: browserInfo.browser,
        deviceType: browserInfo.deviceType,
        visitorId: visitorCookie?.visitorId ?? null,
        isReturningVisitor: visitorCookie ? visitorCookie.isReturningVisitor : null,
      },
    });
  }, [location]);

  return null;
}

function RouteLoading() {
  return (
    <div
      className="min-h-screen bg-background"
      aria-label="Loading Eby’s Place"
    />
  );
}

function SharedLinkPathNormalizer() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const { pathname, search, hash } = window.location;
    const normalizedPath = normalizeSharedLinkPath(pathname || "/");
    if (normalizedPath === pathname) return;

    setLocation(`${normalizedPath}${search}${hash}`, { replace: true });
  }, [location, setLocation]);

  return null;
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    afterRouteScroll(`${location}${window.location.hash || ""}`, 40);
  }, [location]);

  return null;
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isAdmin || !visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => smoothScrollToTop(0)}
      className="back-to-top-btn fixed bottom-40 right-4 z-[79] flex h-12 w-12 items-center justify-center rounded-full shadow-[0_8px_24px_rgba(17,17,17,.28)] transition duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#C8A83A] md:bottom-24 md:right-6 md:h-14 md:w-14"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 md:h-6 md:w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
      <span className="sr-only">Back to top</span>
    </button>
  );
}

function WhatsAppButton() {
  const [location] = useLocation();
  if (location.startsWith("/admin")) return null;
  return (
    <a
      href="https://wa.me/447864585110?text=Hi%20Eby%E2%80%99s%20Place%2C%20I%E2%80%99d%20like%20to%20ask%20about%20a%20braiding%20appointment."
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Message Eby’s Place on WhatsApp (opens in new window)"
      className="fixed bottom-24 right-4 z-[79] flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(17,17,17,.28)] transition duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#C8A83A] md:bottom-6 md:right-6 md:h-14 md:w-14"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 md:h-7 md:w-7" fill="currentColor">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.44-9.44a9.4 9.4 0 0 1 9.43 9.45c0 5.2-4.23 9.43-9.44 9.43m8.03-17.47A11.3 11.3 0 0 0 12.05.7C5.8.7.7 5.8.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.4l5.8-1.52a11.3 11.3 0 0 0 5.42 1.38h.01c6.25 0 11.35-5.1 11.35-11.35 0-3.03-1.18-5.88-3.33-8.02"/>
      </svg>
    </a>
  );
}

function MobileStickyBookingCta() {
  const [location, setLocation] = useLocation();
  const isAdmin = location.startsWith("/admin");
  if (isAdmin) return null;
  return (
    <div
      className="mobile-sticky-booking fixed inset-x-0 bottom-0 z-[70] px-4 py-3 md:hidden"
      aria-label="Sticky mobile booking action"
    >
      <button
        type="button"
        onClick={() => navigateWithSmoothScroll("/booking", setLocation)}
        className="sticky-booking-cta-button flex min-h-12 w-full flex-col items-center justify-center rounded-full px-5 py-3 text-center text-base font-extrabold tracking-wide shadow-[0_14px_30px_rgba(17,17,17,.26)] transition"
      >
        <span className="sticky-booking-cta-label">Book Now</span>
        <span className="sticky-booking-cta-accent">Secure £20 Deposit</span>
      </button>
    </div>
  );
}

function BookingAliasRedirect() {
  const target =
    typeof window === "undefined"
      ? "/booking"
      : `/booking${window.location.search || ""}${window.location.hash || ""}`;

  return <Redirect to={target} replace />;
}

const PUSH_AUTO_PROMPT_STORAGE_KEY = "ebysplace:push-auto-prompt-shown";

/**
 * Replaces the old homepage "enable notifications" button: instead of
 * requiring a click, this asks for browser push permission automatically
 * the first time a visitor interacts with the site (a real user gesture is
 * required by the browser — it can't fire on page load). It only asks once
 * per browser (tracked in localStorage) and never re-prompts once the
 * visitor has granted or denied permission.
 */
function AutoPushOptIn() {
  const [location] = useLocation();
  const subscribePush = trpc.public.subscribePush.useMutation();
  const isAdmin = location.startsWith("/admin");

  useEffect(() => {
    if (isAdmin || typeof window === "undefined" || !isPushSupported()) return;
    if (Notification.permission !== "default") return;
    try {
      if (window.localStorage.getItem(PUSH_AUTO_PROMPT_STORAGE_KEY) === "1")
        return;
    } catch {
      // localStorage unavailable — fall through and prompt anyway.
    }

    const requestOnce = async () => {
      window.removeEventListener("pointerdown", requestOnce);
      window.removeEventListener("keydown", requestOnce);
      try {
        window.localStorage.setItem(PUSH_AUTO_PROMPT_STORAGE_KEY, "1");
      } catch {
        // Ignore storage failures — worst case we ask again next visit.
      }
      try {
        const existing = await getExistingPushSubscription();
        const subscription = existing || (await subscribeToPush());
        if (subscription)
          await subscribePush.mutateAsync(pushSubscriptionToInput(subscription));
      } catch (error) {
        console.warn("[WebPush] Auto opt-in failed", error);
      }
    };

    window.addEventListener("pointerdown", requestOnce, { once: true });
    window.addEventListener("keydown", requestOnce, { once: true });
    return () => {
      window.removeEventListener("pointerdown", requestOnce);
      window.removeEventListener("keydown", requestOnce);
    };
  }, [isAdmin]);

  return null;
}

function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/services" component={Services} />
        <Route path="/booking" component={Booking} />
        <Route path="/booking/" component={Booking} />
        <Route path="/book" component={Booking} />
        <Route path="/book-now" component={Booking} />
        <Route path="/bookings" component={Booking} />
        <Route path="/booking/success" component={BookingSuccess} />
        <Route path="/shop/:slug" component={Shop} />
        <Route path="/shop" component={Shop} />
        <Route path="/ai-try-on" component={TryOn} />
        <Route path="/braiders-near-me" component={Braiders} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/blog/:slug" component={Blog} />
        <Route path="/blog" component={Blog} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/newsletter" component={Newsletter} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/reset-password" component={AdminResetPassword} />
        <Route path="/admin" component={Admin} />
        <Route path="/policies" component={PoliciesIndex} />
        <Route path="/policies/privacy" component={PrivacyPolicy} />
        <Route path="/policies/shopping" component={ShoppingPolicy} />
        <Route path="/policies/returns" component={ReturnsPolicy} />
        <Route path="/policies/terms" component={TermsPolicy} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors closeButton duration={7000} />
          <SharedLinkPathNormalizer />
          <DynamicSeoMetadata />
          <AutoPushOptIn />
          <ScrollToTop />
          <Router />
          <BackToTopButton />
          <WhatsAppButton />
          <MobileStickyBookingCta />
          <ChatAssistant />
          <CookieConsentBanner />
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
