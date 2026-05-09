import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { afterRouteScroll, navigateWithSmoothScroll } from "@/lib/smoothScroll";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Services = lazy(() => import("./pages/Services"));
const Booking = lazy(() => import("./pages/Booking"));
const Shop = lazy(() => import("./pages/Shop"));
const ShopProduct = lazy(() => import("./pages/ShopProduct"));
const TryOn = lazy(() => import("./pages/TryOn"));
const Braiders = lazy(() => import("./pages/Braiders"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Reviews = lazy(() => import("./pages/Reviews"));
const BookingSuccess = lazy(() => import("./pages/BookingSuccess"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminResetPassword = lazy(() => import("./pages/AdminResetPassword"));
const PoliciesIndex = lazy(() => import("./pages/Policies"));
const PrivacyPolicy = lazy(() => import("./pages/Policies").then((module) => ({ default: () => <module.PolicyPage type="privacy" /> })));
const ShoppingPolicy = lazy(() => import("./pages/Policies").then((module) => ({ default: () => <module.PolicyPage type="shopping" /> })));
const ReturnsPolicy = lazy(() => import("./pages/Policies").then((module) => ({ default: () => <module.PolicyPage type="returns" /> })));
const TermsPolicy = lazy(() => import("./pages/Policies").then((module) => ({ default: () => <module.PolicyPage type="terms" /> })));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteLoading() {
  return <div className="min-h-screen bg-background" aria-label="Loading Eby’s Place" />;
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    afterRouteScroll(`${location}${window.location.hash || ""}`, 40);
  }, [location]);

  return null;
}

function FloatingWhatsAppButton() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const isHome = location === "/";
  if (isAdmin || isHome) return null;

  const whatsappUrl = "https://wa.me/447864585110?text=Hi%20Eby%27s%20Place%2C%20I%20would%20like%20to%20make%20an%20enquiry.";

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Message Eby’s Place on WhatsApp"
      className="group fixed bottom-24 right-4 z-[80] flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#C9A84C] bg-[#111111] text-[#C9A84C] shadow-[0_18px_42px_rgba(17,17,17,.28)] transition duration-200 hover:-translate-y-1 hover:bg-[#C9A84C] hover:text-[#111111] hover:no-underline focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#C9A84C] md:bottom-6 md:right-6 md:h-16 md:w-16"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 md:h-8 md:w-8" fill="currentColor">
        <path d="M16.02 3.2A12.67 12.67 0 0 0 5.24 22.5L3.5 28.82l6.48-1.7A12.62 12.62 0 0 0 16 28.66h.01A12.73 12.73 0 0 0 28.7 15.95 12.67 12.67 0 0 0 16.02 3.2Zm0 23.3h-.01a10.5 10.5 0 0 1-5.35-1.47l-.38-.22-3.85 1.01 1.03-3.75-.25-.39a10.49 10.49 0 1 1 8.81 4.82Zm5.76-7.86c-.31-.16-1.86-.92-2.15-1.02-.29-.11-.5-.16-.71.15-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.31-.16-1.33-.49-2.54-1.56-.94-.84-1.57-1.87-1.75-2.19-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.32-.52.1-.21.05-.39-.03-.55-.08-.16-.71-1.71-.97-2.34-.25-.61-.51-.53-.71-.54h-.61c-.21 0-.55.08-.84.39-.29.32-1.1 1.08-1.1 2.63 0 1.55 1.13 3.05 1.29 3.26.16.21 2.23 3.4 5.39 4.76.75.32 1.34.52 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.86-.76 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.13-.29-.21-.61-.37Z" />
      </svg>
      <span className="sr-only">Message Eby’s Place on WhatsApp</span>
    </a>
  );
}

function MobileStickyBookingCta() {
  const [location, setLocation] = useLocation();
  const isAdmin = location.startsWith("/admin");
  if (isAdmin) return null;
  return (
    <div className="mobile-sticky-booking fixed inset-x-0 bottom-0 z-[70] px-4 py-3 md:hidden" aria-label="Sticky mobile booking action">
      <button type="button" onClick={() => navigateWithSmoothScroll("/booking", setLocation)} className="sticky-booking-cta-button flex min-h-12 w-full flex-col items-center justify-center rounded-full px-5 py-3 text-center text-base font-extrabold tracking-wide shadow-[0_14px_30px_rgba(17,17,17,.26)] transition">
        <span className="sticky-booking-cta-label">Book Now</span>
        <span className="sticky-booking-cta-accent">Secure £20 Deposit</span>
      </button>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/services" component={Services} />
        <Route path="/booking" component={Booking} />
        <Route path="/booking/success" component={BookingSuccess} />
        <Route path="/shop" component={Shop} />
        <Route path="/shop/:slug" component={ShopProduct} />
        <Route path="/ai-try-on" component={TryOn} />
        <Route path="/braiders-near-me" component={Braiders} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/reviews" component={Reviews} />
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
          <Toaster />
          <ScrollToTop />
          <Router />
          <FloatingWhatsAppButton />
          <MobileStickyBookingCta />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
