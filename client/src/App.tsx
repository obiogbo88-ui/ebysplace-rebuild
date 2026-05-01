import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Services from "./pages/Services";
import Booking from "./pages/Booking";
import Shop from "./pages/Shop";
import TryOn from "./pages/TryOn";
import Braiders from "./pages/Braiders";
import Gallery from "./pages/Gallery";
import Reviews from "./pages/Reviews";
import BookingSuccess from "./pages/BookingSuccess";
import Admin from "./pages/Admin";
import PoliciesIndex, { PolicyPage } from "./pages/Policies";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return null;
}

function Router() {
  return (
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
      <Route path="/admin" component={Admin} />
      <Route path="/policies" component={PoliciesIndex} />
      <Route path="/policies/privacy">{() => <PolicyPage type="privacy" />}</Route>
      <Route path="/policies/shopping">{() => <PolicyPage type="shopping" />}</Route>
      <Route path="/policies/returns">{() => <PolicyPage type="returns" />}</Route>
      <Route path="/policies/terms">{() => <PolicyPage type="terms" />}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <ScrollToTop />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
