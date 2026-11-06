import { Link } from "wouter";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getExistingPushSubscription, isPushSupported, pushSubscriptionToInput, subscribeToPush } from "@/lib/webPush";
import { getActivitySessionId, getCurrentPageUrl } from "@/lib/activityTracking";
import { SiteFooter, SiteHeader } from "./Home";

const isIphoneBrowserTab = () =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);

/** "Turn on notifications" after paying. Linked to the booking so the Command Centre can show it on that client. */
function NotificationsOptIn({ bookingId }: { bookingId: number | null }) {
  const subscribePush = trpc.public.subscribePush.useMutation();
  const [state, setState] = useState<"idle" | "on" | "unsupported" | "denied">("idle");
  const turnOn = async () => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    try {
      const subscription = (await getExistingPushSubscription()) || (await subscribeToPush());
      if (!subscription) {
        setState(typeof Notification !== "undefined" && Notification.permission === "denied" ? "denied" : "unsupported");
        return;
      }
      await subscribePush.mutateAsync({ ...pushSubscriptionToInput(subscription), ...(bookingId ? { bookingId } : {}) });
      setState("on");
    } catch {
      setState("unsupported");
    }
  };
  const iphoneTab = isIphoneBrowserTab();
  return (
    <section className="mt-8 grid gap-3 rounded-3xl border border-primary/50 bg-primary/10 p-6" aria-labelledby="notify-heading">
      <h2 id="notify-heading" className="serif text-2xl font-bold text-white">Hear first when dates open up</h2>
      <p className="max-w-2xl text-white/75">Turn on notifications and we&rsquo;ll tell you the moment a free slot or offer comes up. You can turn them off any time.</p>
      {state === "on" ? (
        <p className="font-semibold text-emerald-300" role="status">Notifications are on. Thank you!</p>
      ) : state === "denied" ? (
        <p className="text-white/75" role="status">Notifications are switched off for this site in your browser settings. You can turn them back on there.</p>
      ) : state === "unsupported" || iphoneTab ? (
        <p className="text-white/75" role="status">On an iPhone: tap Share, then Add to Home Screen. Open Eby&rsquo;s Place from your home screen and tap Allow when it asks.</p>
      ) : (
        <div>
          <button type="button" className="btn-gold inline-flex items-center gap-2" onClick={turnOn} disabled={subscribePush.isPending}>
            <BellRing className="h-4 w-4" aria-hidden="true" /> {subscribePush.isPending ? "Turning on…" : "Turn on notifications"}
          </button>
        </div>
      )}
    </section>
  );
}

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

          <NotificationsOptIn bookingId={bookingId && /^\d+$/.test(bookingId) ? Number(bookingId) : null} />

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
