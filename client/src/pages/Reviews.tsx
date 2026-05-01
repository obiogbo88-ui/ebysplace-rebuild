import { MovingReviewStrip, ReviewFormCard, ShareReviewLinkCard } from "@/components/ReviewWidgets";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

export default function Reviews() {
  const { data = [] } = trpc.public.reviews.useQuery();

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="section-pad overflow-hidden">
        <div className="container">
          <p className="pill w-fit">The Inner Circle</p>
          <h1 className="serif mt-4 text-5xl font-bold md:text-6xl">What Our Clients Say</h1>
          <p className="mt-4 max-w-3xl text-white/68">
            Read real client experiences and share yours after your appointment.
          </p>
        </div>

        <div className="mt-12">
          <MovingReviewStrip reviews={data as any[]} />
        </div>

        <div className="container mt-12 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <ShareReviewLinkCard />
          <ReviewFormCard compact />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
