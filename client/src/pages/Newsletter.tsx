import { SiteFooter, SiteHeader } from "@/pages/Home";
import { canonicalUrl } from "@/lib/canonicalUrl";
import { trpc } from "@/lib/trpc";
import { getActivitySessionId } from "@/lib/activityTracking";
import { smoothScrollToTop } from "@/lib/smoothScroll";
import { CheckCircle2, Copy, Facebook, MessageCircle } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Newsletter() {
  const newsletter = trpc.public.newsletter.useMutation();
  const logActivity = trpc.public.logActivity.useMutation();
  const [email, setEmail] = useState("");
  const [productAlerts, setProductAlerts] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const newsletterUrl = canonicalUrl("/newsletter");
  const shareText = useMemo(() => "Join the Eby's Place list for style openings, product drops, and braid care tips.", []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await newsletter.mutateAsync({ email, productAlerts });
      logActivity.mutate({
        sessionId: getActivitySessionId(),
        activityType: "newsletter_signup",
        activityCategory: "newsletter",
        description: "Newsletter signup submitted from /newsletter",
        pageUrl: window.location.href,
        userEmail: email,
        status: "success",
        sourceApp: "ebysplace",
      });
      toast.success(result.customerNotification);
      setSubmitted(true);
      smoothScrollToTop(40);
      setEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you up. Please try again.");
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(newsletterUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="section-pad">
        <section className="container max-w-3xl">
          <div className="lux-card overflow-hidden p-0">
            <div className="bg-[#efe0c7] px-5 py-8 text-[#24170d] sm:px-8 md:px-10">
              <p className="pill w-fit border-[#d8bd74]/70 bg-white text-[#5b3a12]">Newsletter</p>
              <h1 className="serif mt-4 text-4xl font-bold leading-tight sm:text-5xl">Join the Eby’s Place list</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#4a3014] sm:text-base">
                Get style openings, product drops, and premium braid care guidance straight to your inbox.
              </p>
            </div>

            <div className="p-5 sm:p-8 md:p-10">
              {submitted ? (
                <div className="rounded-[1.5rem] border border-primary/30 bg-white/8 p-6 text-center sm:p-8">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
                  <h2 className="serif mt-4 text-3xl font-bold">You’re on the list.</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-[#1A1A1A]/68">
                    Thank you for subscribing. Look out for a welcome email from Eby’s Place.
                  </p>
                </div>
              ) : (
                <form className="grid gap-5" onSubmit={handleSubmit}>
                  <label className="grid gap-2 text-sm font-bold uppercase tracking-[.18em] text-primary">
                    Email address
                    <input
                      className="min-h-12 rounded-2xl border border-primary/25 bg-white/10 px-4 py-3 text-base font-semibold normal-case tracking-normal text-[#1A1A1A] outline-none transition placeholder:text-[#1A1A1A]/35 focus:border-primary focus:ring-2 focus:ring-primary/25"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className="flex items-start gap-3 text-sm font-semibold leading-6 text-[#1A1A1A]/75">
                    <input
                      className="mt-1 h-4 w-4 accent-[#c9a24a]"
                      type="checkbox"
                      checked={productAlerts}
                      onChange={(event) => setProductAlerts(event.target.checked)}
                    />
                    Also tell me about new products and shop drops.
                  </label>

                  <button className="btn-gold w-full justify-center sm:w-fit" type="submit" disabled={newsletter.isPending}>
                    {newsletter.isPending ? "Signing up..." : "Sign up"}
                  </button>

                  <p className="text-xs font-medium text-[#1A1A1A]/55">
                    By signing up, you agree to our{" "}
                    <Link className="underline underline-offset-4" href="/policies/privacy">
                      Privacy Policy
                    </Link>
                    . You can unsubscribe at any time.
                  </p>
                </form>
              )}

              <div className="mt-8 rounded-[1.25rem] border border-primary/20 bg-black/20 p-4 sm:p-5">
                <h2 className="serif text-2xl font-bold">Share this sign-up page</h2>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a className="btn-dark justify-center px-4 py-3 text-sm" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${newsletterUrl}`)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </a>
                  <a className="btn-dark justify-center px-4 py-3 text-sm" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(newsletterUrl)}`} target="_blank" rel="noopener noreferrer">
                    <Facebook className="mr-2 h-4 w-4" /> Facebook
                  </a>
                  <button className="btn-dark justify-center px-4 py-3 text-sm" type="button" onClick={copyLink}>
                    <Copy className="mr-2 h-4 w-4" /> {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
