import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getStoredConsent, saveConsent } from "@/lib/cookieConsent";
import { getActivitySessionId, getCurrentPageUrl } from "@/lib/activityTracking";

export default function CookieConsentBanner() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const [dismissed, setDismissed] = useState(() => Boolean(getStoredConsent()));
  const [manageOpen, setManageOpen] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const logConsent = trpc.public.logCookieConsent.useMutation();

  if (isAdmin || dismissed) return null;

  const submit = (analytics: boolean, marketing: boolean) => {
    saveConsent({ analytics, marketing });
    logConsent.mutate({
      sessionId: getActivitySessionId(),
      analytics,
      marketing,
      pagePath: getCurrentPageUrl(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined,
    });
    setDismissed(true);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[95] px-4 pb-4 md:px-6"
      role="region"
      aria-label="Cookie consent"
    >
      <div className="lux-card mx-auto max-w-3xl p-5 shadow-[0_-12px_40px_rgba(0,0,0,.35)] sm:p-6">
        <p className="text-sm font-medium leading-6 text-white/78">
          We use cookies to keep the site working properly and, if you agree, to understand how visitors use it. See our{" "}
          <a className="underline decoration-white/30 underline-offset-4 hover:text-white" href="/policies/privacy">
            Privacy Policy
          </a>{" "}
          for details.
        </p>

        {manageOpen ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
            <label className="flex items-start gap-2 text-sm text-white/70">
              <input type="checkbox" checked disabled className="mt-0.5 h-auto w-auto" />
              Necessary — always on (booking, checkout, security)
            </label>
            <label className="flex items-start gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                className="mt-0.5 h-auto w-auto"
                checked={analyticsChecked}
                onChange={(event) => setAnalyticsChecked(event.target.checked)}
              />
              Analytics — helps us see which pages and styles get the most interest
            </label>
            <label className="flex items-start gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                className="mt-0.5 h-auto w-auto"
                checked={marketingChecked}
                onChange={(event) => setMarketingChecked(event.target.checked)}
              />
              Marketing — lets us tailor offers and promotions
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {manageOpen ? (
            <button type="button" className="btn-gold px-5 py-2 text-sm" onClick={() => submit(analyticsChecked, marketingChecked)}>
              Save preferences
            </button>
          ) : (
            <>
              <button type="button" className="btn-gold px-5 py-2 text-sm" onClick={() => submit(true, true)}>
                Accept all
              </button>
              <button type="button" className="btn-dark px-5 py-2 text-sm" onClick={() => submit(false, false)}>
                Reject non-essential
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm font-semibold text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white"
                onClick={() => setManageOpen(true)}
              >
                Manage preferences
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
