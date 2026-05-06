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
          <MobileStickyBookingCta />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
