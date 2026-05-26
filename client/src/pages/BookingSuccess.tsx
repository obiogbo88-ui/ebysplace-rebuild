import { Link } from "wouter";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { getActivitySessionId, getCurrentPageUrl } from "@/lib/activityTracking";
import { SiteFooter, SiteHeader } from "./Home";

export default function BookingSuccess() {
  const searchParams = new URLSearchParams(window.location.search);
  const bookingId = searchParams.get("booking");
  const logActivity = trpc.public.logActivity.useMutation();

  useEffect(() => {
    logActivity.mutate({
      sessionId: getActivitySessionId(),
      activityType: "payment_successful",
      activityCategory: "payment",
      description: `Booking payment returned successfully${bookingId ? ` for booking #${bookingId}` : ""}`,
      pageUrl: getCurrentPageUrl(),
      status: "success",
      relatedEntityType: "booking",
      relatedEntityId: bookingId || undefined,
    });
  }, [bookingId]);

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <div className="lux-card max-w-4xl overflow-hidden">
          <p className="pill w-fit">Payment confirmation</p>
          <h1 className="serif mt-5 max-w-3xl text-5xl font-bold leading-[0.95] md:text-7xl">
            Your Eby’s Place deposit is being confirmed.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">
            Thank you for booking Eby’s Place. If secure payment completed successfully, your £20 non-refundable deposit has been submitted and the salon owner is notified automatically. The booking dashboard will update once payment is verified.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-primary/25 bg-black/25 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Booking reference</p>
              <p className="mt-3 text-2xl font-bold text-white">{bookingId ? `#${bookingId}` : "Pending"}</p>
            </div>
            <div className="rounded-3xl border border-primary/25 bg-black/25 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Deposit</p>
              <p className="mt-3 text-2xl font-bold text-white">£20 GBP</p>
            </div>
            <div className="rounded-3xl border border-primary/25 bg-black/25 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Next step</p>
              <p className="mt-3 text-base font-semibold text-white">Salon confirmation follow-up</p>
            </div>
          </div>

          <blockquote className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white/75">
            Please keep this page or your payment receipt for reference. If you closed checkout before paying, return to the booking page and start the deposit step again.
          </blockquote>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-gold" href="/services">Explore services</Link>
            <Link className="btn-dark" href="/booking">Start another booking</Link>
            <Link className="btn-dark" href="/">Return home</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
