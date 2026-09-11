import { useMemo, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { navigateWithSmoothScroll, smoothScrollToElement } from "@/lib/smoothScroll";
import { createServiceImageErrorHandler, getServiceImageSrc } from "@/lib/serviceImageFallback";
import { Reveal } from "@/lib/motion";
import { SiteFooter, SiteHeader } from "./Home";

const tabs = ["All", "Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"] as const;

type ServiceCategory = (typeof tabs)[number];

const categoryIntro: Record<ServiceCategory, string> = {
  All:
    "Browse every published Eby’s Place service in one place, then narrow by category when you already know the style family you want.",
  Braids:
    "Knotless, box, goddess, Fulani, cornrows, stitch, lemonade, boho knotless, and tribal braids created with Eby’s Place pain-free philosophy.",
  Twists:
    "Soft rope and passion twist services designed for lightweight movement, protection, and comfort.",
  Locs: "Loc-inspired protective options, from faux and butterfly locs through to starter loc support.",
  "Kids Styles":
    "Gentle children’s braid, cornrow, and twist appointments for boys and girls of all ages and all backgrounds — comfort, patience, and neat finishing at the centre. Lower pricing for our youngest clients.",
  "Men Styles":
    "Cornrows, box braids, twists, Fulani braids, and locs for men — clean, precise, and bookable through the same simple flow.",
  "Add-ons":
    "Preparation, finishing, accessories, edge styling, and takedown services to complete the appointment journey.",
};

export default function Services() {
  const [category, setCategory] = useState<ServiceCategory>("All");
  const serviceQueryInput = useMemo(() => (category === "All" ? {} : { category }), [category]);
  const initialSearchTerm = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("search")?.trim() || "";
  }, []);
  const { data = [], isLoading } = trpc.public.services.useQuery(serviceQueryInput);
  const visibleServices = useMemo(() => {
    if (!initialSearchTerm) return data as any[];
    const term = initialSearchTerm.toLowerCase();
    return (data as any[]).filter((service) => [service.name, service.category, service.description, service.badge].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [data, initialSearchTerm]);

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <Reveal>
          <p className="pill w-fit">Services & pricing</p>
          <div className="mt-4 max-w-4xl">
            <h1 className="serif text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
              Full Eby’s Place{" "}
              <span className="gold-text">braiding catalogue.</span>
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/68">
              Choose from the full Somerset, UK service catalogue. Every booking
              clearly presents the £20 non-refundable deposit before
              checkout, and every style is framed around comfort, longevity, and
              scalp respect.
            </p>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#5a3d1e]">
              Prices are listed as starting prices because length, size, hair
              density, and add-ons may affect the final appointment quote.
            </p>
          </div>
        </Reveal>

        <div
          className="mt-10 flex flex-wrap gap-3"
          role="tablist"
          aria-label="Service categories"
        >
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setCategory(tab);
                smoothScrollToElement("services-section", 40);
              }}
              className={
                category === tab ? "btn-gold" : "btn-dark"
              }
              aria-pressed={category === tab}
            >
              {tab}
            </button>
          ))}
        </div>

        <section id="services-section" className="mt-10 rounded-[2rem] border border-primary/25 bg-white/[0.045] p-6 md:p-8 scroll-mt-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.24em] text-primary">
                {category}
              </p>
              <h2 className="serif mt-2 text-4xl font-bold">{category === "All" ? "Full service catalogue" : `${category} services`}</h2>
              <p className="mt-3 max-w-3xl text-white/65">
                {initialSearchTerm ? `Showing services matching “${initialSearchTerm}”. Clear the search from your browser address bar to view the full catalogue again.` : categoryIntro[category]}
              </p>
            </div>
            <button type="button" className="btn-gold" onClick={() => navigateWithSmoothScroll("/booking")}>
              <CalendarDays className="mr-2 h-5 w-5" /> Start booking
            </button>
          </div>

          {isLoading ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:gap-7">
              {[1, 2, 3].map(item => (
                <div
                  key={item}
                  className="lux-card min-h-64 animate-pulse bg-white/5"
                />
              ))}
            </div>
          ) : visibleServices.length === 0 ? (
            <div className="lux-card mt-10 text-white/70">
              {initialSearchTerm ? `No services currently match “${initialSearchTerm}”.` : "No services are currently published in this category."}
            </div>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:gap-7">
              {visibleServices.map((service, index) => {
                const isBookable = service.isBookable !== "false";
                const serviceImageSrc = getServiceImageSrc(service);
                return (
                <Reveal
                  delay={Math.min(index, 4) * 0.06}
                  className="lux-card flex flex-col overflow-hidden p-0"
                  key={service.id ?? service.slug}
                >
                  {serviceImageSrc ? (
                    <div className="media-portrait media-service overflow-hidden rounded-t-[1.6rem] bg-[#171009]">
                      <img
                        src={serviceImageSrc}
                        alt={`${service.name} hairstyle by Eby’s Place`}
                        loading="lazy"
                        decoding="async"
                        onError={createServiceImageErrorHandler(service)}
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
                      <button
                        type="button"
                        onClick={() => navigateWithSmoothScroll(`/booking?service=${encodeURIComponent(service.name)}`)}
                        className="btn-gold mt-5 w-full"
                      >
                        Book This Style
                      </button>
                    ) : (
                      <button className="btn-dark mt-5 w-full cursor-not-allowed opacity-70" type="button" disabled>
                        Currently unavailable
                      </button>
                    )}
                  </div>
                </Reveal>
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
