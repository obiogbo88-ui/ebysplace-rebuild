import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

const tabs = ["All", "Braids", "Twists", "Locs", "Kids Styles", "Add-ons"] as const;

type ServiceCategory = (typeof tabs)[number];

const categoryIntro: Record<ServiceCategory, string> = {
  All:
    "Browse every published Eby’s Place service in one place, then narrow by category when you already know the style family you want.",
  Braids:
    "Knotless, box, goddess, Fulani, cornrows, stitch, lemonade, boho, and tribal braids created with Eby’s Place pain-free philosophy.",
  Twists:
    "Soft rope and passion twist services designed for lightweight movement, protection, and comfort.",
  Locs: "Loc-inspired protective options, from faux and butterfly locs through to starter loc support.",
  "Kids Styles":
    "Gentle children’s braid and cornrow appointments with patience, comfort, and neat finishing at the centre.",
  "Add-ons":
    "Preparation, finishing, accessories, edge styling, and takedown services to complete the appointment journey.",
};

export default function Services() {
  const [category, setCategory] = useState<ServiceCategory>("All");
  const serviceQueryInput = useMemo(() => (category === "All" ? {} : { category }), [category]);
  const { data = [], isLoading } = trpc.public.services.useQuery(serviceQueryInput);

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">Services & pricing</p>
        <div className="mt-4 max-w-4xl">
          <h1 className="serif text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
            Full Eby’s Place{" "}
            <span className="gold-text">braiding catalogue.</span>
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/68">
            Choose from the full Somerset, UK service menu. Every booking
            clearly presents the £20 non-refundable Stripe deposit before
            checkout, and every style is framed around comfort, longevity, and
            scalp respect.
          </p>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#5a3d1e]">
            Prices are listed as starting prices because length, size, hair
            density, and add-ons may affect the final appointment quote.
          </p>
        </div>

        <div
          className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          role="tablist"
          aria-label="Service categories"
        >
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategory(tab)}
              className={
                category === tab ? "btn-gold w-full" : "btn-dark w-full"
              }
              aria-pressed={category === tab}
            >
              {tab}
            </button>
          ))}
        </div>

        <section className="mt-10 rounded-[2rem] border border-primary/25 bg-white/[0.045] p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.24em] text-primary">
                {category}
              </p>
              <h2 className="serif mt-2 text-4xl font-bold">{category === "All" ? "Full service menu" : `${category} menu`}</h2>
              <p className="mt-3 max-w-3xl text-white/65">
                {categoryIntro[category]}
              </p>
            </div>
            <Link className="btn-gold" href="/booking">
              <CalendarDays className="mr-2 h-5 w-5" /> Start booking
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(item => (
                <div
                  key={item}
                  className="lux-card min-h-64 animate-pulse bg-white/5"
                />
              ))}
            </div>
          ) : (data as any[]).length === 0 ? (
            <div className="lux-card mt-10 text-white/70">
              No services are currently published in this category.
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {(data as any[]).map(service => {
                const isBookable = service.isBookable !== "false";
                return (
                <article
                  className="lux-card flex flex-col overflow-hidden p-0"
                  key={service.id ?? service.slug}
                >
                  {service.imageUrl ? (
                    <div className="media-portrait overflow-hidden rounded-t-[1.6rem] bg-[#171009]">
                      <img
                        src={service.imageUrl}
                        alt={`${service.name} hairstyle by Eby’s Place`}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-6">
                    <span className="pill w-fit text-xs">
                      {service.badge || service.category}
                    </span>
                    <h3 className="serif mt-4 text-3xl font-bold">
                      {service.name}
                    </h3>
                    <p className="mt-3 flex-1 text-white/68">
                    {service.description}
                  </p>
                  <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Clock className="h-4 w-4 text-primary" />{" "}
                      {service.duration}
                    </div>
                    <b className="text-right text-2xl text-primary sm:text-left md:text-right">
                      From £{service.priceFrom}
                    </b>
                  </div>
                    {isBookable ? (
                      <Link
                        href={`/booking?service=${encodeURIComponent(service.name)}`}
                        className="btn-gold mt-5 w-full"
                      >
                        Book This Style
                      </Link>
                    ) : (
                      <button className="btn-dark mt-5 w-full cursor-not-allowed opacity-70" type="button" disabled>
                        Currently unavailable
                      </button>
                    )}
                  </div>
                </article>
              );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
