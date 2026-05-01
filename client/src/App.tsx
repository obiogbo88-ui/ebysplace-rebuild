import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
