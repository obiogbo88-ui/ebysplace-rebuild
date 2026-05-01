import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export type ReviewItem = {
  id?: number | string;
  customerName: string;
  rating: number;
  reviewText: string;
};

export function MovingReviewStrip({ reviews }: { reviews: ReviewItem[] }) {
  const stripReviews = useMemo(() => {
    const visibleReviews = reviews.length ? reviews : [];
    return [...visibleReviews, ...visibleReviews];
  }, [reviews]);

  if (!stripReviews.length) {
    return null;
  }

  return (
    <div className="review-marquee mt-10" aria-label="Client reviews moving across the screen">
      <div className="review-marquee-track">
        {stripReviews.map((review, index) => (
          <blockquote className="review-marquee-card" key={`${review.id ?? review.customerName}-${index}`}>
            <div className="text-primary" aria-label={`${review.rating} star review`}>
              {"★".repeat(review.rating)}
            </div>
            <p className="mt-3">“{review.reviewText}”</p>
            <footer className="mt-4 font-bold uppercase tracking-[.18em] text-primary">
              — {review.customerName}
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

export function ReviewFormCard({ compact = false }: { compact?: boolean }) {
  const submit = trpc.public.submitReview.useMutation();
  const [form, setForm] = useState({ customerName: "", rating: 5, reviewText: "" });

  return (
    <form
      className="lux-card grid h-fit gap-4"
      onSubmit={async event => {
        event.preventDefault();
        await submit.mutateAsync(form);
        setForm({ customerName: "", rating: 5, reviewText: "" });
      }}
    >
      <div>
        <h2 className="serif text-3xl font-bold">Leave a review</h2>
        <p className="mt-2 text-sm text-white/62">
          Share your Eby’s Place experience. Reviews are checked before they appear on the site.
        </p>
      </div>
      <input
        required
        placeholder="Your name"
        value={form.customerName}
        onChange={event => setForm({ ...form, customerName: event.target.value })}
      />
      <select
        value={form.rating}
        onChange={event => setForm({ ...form, rating: Number(event.target.value) })}
      >
        <option value={5}>5 stars</option>
        <option value={4}>4 stars</option>
        <option value={3}>3 stars</option>
        <option value={2}>2 stars</option>
        <option value={1}>1 star</option>
      </select>
      <textarea
        required
        minLength={10}
        rows={compact ? 4 : 6}
        placeholder="Tell us about your experience…"
        value={form.reviewText}
        onChange={event => setForm({ ...form, reviewText: event.target.value })}
      />
      <button className="btn-gold" disabled={submit.isPending}>
        {submit.isPending ? "Submitting…" : "Submit Review"}
      </button>
      {submit.isSuccess ? (
        <p className="text-primary">Thank you. Your review is pending approval.</p>
      ) : null}
      {submit.isError ? (
        <p className="text-sm text-red-700">Please check the form and try again.</p>
      ) : null}
    </form>
  );
}

export function ShareReviewLinkCard() {
  const [copied, setCopied] = useState(false);
  const reviewUrl = typeof window === "undefined" ? "/leave-review" : `${window.location.origin}/leave-review`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="lux-card">
      <p className="pill w-fit">Shareable review link</p>
      <h2 className="serif mt-4 text-3xl font-bold">Send clients straight to the review form.</h2>
      <p className="mt-3 text-sm text-white/62">
        Use this link in WhatsApp, SMS, email, or your booking follow-up message.
      </p>
      <div className="mt-5 rounded-2xl border border-primary/20 bg-[#fff8e8]/70 p-4 text-sm font-semibold text-[#24180d]">
        {reviewUrl}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn-gold" type="button" onClick={copyLink}>
          {copied ? "Copied" : "Copy review link"}
        </button>
        <Link className="btn-dark" href="/leave-review">
          Open form
        </Link>
      </div>
    </div>
  );
}
