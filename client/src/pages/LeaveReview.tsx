import { ReviewFormCard } from "@/components/ReviewWidgets";
import { SiteFooter, SiteHeader } from "./Home";

export default function LeaveReview() {
  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <div className="mx-auto max-w-3xl text-center">
          <p className="pill mx-auto w-fit">Eby’s Place Reviews</p>
          <h1 className="serif mt-4 text-5xl font-bold md:text-6xl">Share your experience.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-white/68">
            Thank you for choosing Eby’s Place. Please leave a short review after your appointment.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-2xl">
          <ReviewFormCard />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
