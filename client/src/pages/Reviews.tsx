import { SiteFooter, SiteHeader } from "@/pages/Home";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Copy, Facebook, MessageCircle, Star } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

export default function Reviews() {
  const submitReview = trpc.public.submitReview.useMutation();
  const [customerName, setCustomerName] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const reviewUrl = typeof window !== "undefined" ? `${window.location.origin}/reviews` : "/reviews";
  const shareText = useMemo(() => "Leave a review for Eby's Place luxury pain-free braiding.", []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await submitReview.mutateAsync({ customerName, rating, reviewText });
    toast.success(result.customerNotification);
    setSubmitted(true);
    setCustomerName("");
    setRating(5);
    setReviewText("");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(reviewUrl);
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
              <p className="pill w-fit border-[#d8bd74]/70 bg-white text-[#5b3a12]">Customer review</p>
              <h1 className="serif mt-4 text-4xl font-bold leading-tight sm:text-5xl">Leave a Review</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#4a3014] sm:text-base">
                Share your Eby’s Place experience. Reviews are checked by admin before they appear in the homepage testimonials carousel.
              </p>
            </div>

            <div className="p-5 sm:p-8 md:p-10">
              {submitted ? (
                <div className="rounded-[1.5rem] border border-primary/30 bg-white/8 p-6 text-center sm:p-8">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
                  <h2 className="serif mt-4 text-3xl font-bold">Thank you for your review.</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-white/68">
                    Your review has been submitted for approval. Once approved, it may appear in the Eby’s Place homepage testimonials carousel.
                  </p>
                </div>
              ) : (
                <form className="grid gap-5" onSubmit={handleSubmit}>
                  <label className="grid gap-2 text-sm font-bold uppercase tracking-[.18em] text-primary">
                    Customer name
                    <input
                      className="min-h-12 rounded-2xl border border-primary/25 bg-white/10 px-4 py-3 text-base font-semibold normal-case tracking-normal text-white outline-none transition placeholder:text-white/35 focus:border-primary focus:ring-2 focus:ring-primary/25"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </label>

                  <fieldset className="grid gap-3">
                    <legend className="text-sm font-bold uppercase tracking-[.18em] text-primary">Star rating</legend>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Star rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${rating >= star ? "border-primary bg-primary text-[#24170d]" : "border-primary/25 bg-white/10 text-primary"}`}
                          aria-label={`${star} star${star === 1 ? "" : "s"}`}
                          aria-pressed={rating === star}
                          onClick={() => setRating(star)}
                        >
                          <Star className="h-5 w-5 fill-current" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="grid gap-2 text-sm font-bold uppercase tracking-[.18em] text-primary">
                    Review text
                    <textarea
                      className="min-h-40 rounded-2xl border border-primary/25 bg-white/10 px-4 py-3 text-base font-semibold normal-case leading-7 tracking-normal text-white outline-none transition placeholder:text-white/35 focus:border-primary focus:ring-2 focus:ring-primary/25"
                      value={reviewText}
                      onChange={(event) => setReviewText(event.target.value)}
                      placeholder="Tell us about your appointment, style, comfort, or care experience."
                      required
                    />
                  </label>

                  <button className="btn-gold w-full justify-center sm:w-fit" type="submit" disabled={submitReview.isPending}>
                    {submitReview.isPending ? "Submitting..." : "Submit review for approval"}
                  </button>
                </form>
              )}

              <div className="mt-8 rounded-[1.25rem] border border-primary/20 bg-black/15 p-4 sm:p-5">
                <h2 className="serif text-2xl font-bold">Share this review page</h2>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a className="btn-dark justify-center px-4 py-3 text-sm" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${reviewUrl}`)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </a>
                  <a className="btn-dark justify-center px-4 py-3 text-sm" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(reviewUrl)}`} target="_blank" rel="noopener noreferrer">
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
