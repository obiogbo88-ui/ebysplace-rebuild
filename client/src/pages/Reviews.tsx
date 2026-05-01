import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

export default function Reviews() {
  const { data = [] } = trpc.public.reviews.useQuery();
  const submit = trpc.public.submitReview.useMutation();
  const [form, setForm] = useState({ customerName: "", rating: 5, reviewText: "" });

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">The Inner Circle</p>
        <h1 className="serif mt-4 text-5xl font-bold md:text-6xl">
          What Our Clients Say
        </h1>
        <p className="mt-4 max-w-3xl text-white/68">
          Read real client experiences and share yours after your appointment.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_.8fr]">
          <div className="grid gap-5">
            {(data as any[]).map(review => (
              <blockquote className="lux-card" key={review.id}>
                <div className="text-primary">{"★".repeat(review.rating)}</div>
                <p className="mt-3 text-white/72">“{review.reviewText}”</p>
                <b className="mt-4 block uppercase tracking-[.18em] text-primary">
                  — {review.customerName}
                </b>
              </blockquote>
            ))}
          </div>

          <form
            className="lux-card grid h-fit gap-4"
            onSubmit={async event => {
              event.preventDefault();
              await submit.mutateAsync(form);
              setForm({ customerName: "", rating: 5, reviewText: "" });
            }}
          >
            <h2 className="serif text-3xl font-bold">Leave a review</h2>
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
              placeholder="Tell us about your experience…"
              value={form.reviewText}
              onChange={event => setForm({ ...form, reviewText: event.target.value })}
            />
            <button className="btn-gold">Submit Review</button>
            {submit.isSuccess ? (
              <p className="text-primary">Thank you. Your review is pending approval.</p>
            ) : null}
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
