import { useMemo, useState } from "react";
import { Search, MapPin, Star, CalendarCheck, ExternalLink, SlidersHorizontal, Navigation } from "lucide-react";
import { SiteFooter, SiteHeader } from "./Home";

const styles = ["All styles", "Knotless", "Box Braids", "Cornrows", "Twists", "Locs", "Kids Styles"];
const sortOptions = ["Recommended", "Nearest", "Highest rated", "Soonest available"];
const KOUVIA_BOOKING_URL = "https://kouviabooking.ebysplace.com/";

const demoBraiders = [
  {
    name: "Eby’s Place Studio",
    area: "Somerset, UK",
    distance: 0.8,
    rating: 5,
    reviews: 148,
    styles: ["Knotless", "Box Braids", "Cornrows", "Kids Styles"],
    availability: "Today from 4:30 PM",
    badge: "Verified Lead Braider",
    bio: "Pain-free protective styling, gentle tension control, and premium family-friendly appointments.",
  },
  {
    name: "Ada Luxe Braids",
    area: "Taunton",
    distance: 7.4,
    rating: 4.9,
    reviews: 62,
    styles: ["Knotless", "Twists", "Locs"],
    availability: "Tomorrow morning",
    badge: "Kouvia Demo Braider",
    bio: "Neat parting, soft finish, and appointment-ready protective styles for adults and teens.",
  },
  {
    name: "Mira Protective Styles",
    area: "Bridgwater",
    distance: 12.1,
    rating: 4.8,
    reviews: 39,
    styles: ["Cornrows", "Box Braids", "Kids Styles"],
    availability: "Friday afternoon",
    badge: "Mobile Friendly",
    bio: "Comfort-first cornrows, school-friendly children’s styling, and classic braid maintenance.",
  },
  {
    name: "Nia Twist & Loc Bar",
    area: "Yeovil",
    distance: 21.6,
    rating: 4.9,
    reviews: 51,
    styles: ["Twists", "Locs", "Knotless"],
    availability: "Next available Saturday",
    badge: "Loc Specialist",
    bio: "Starter locs, faux locs, Senegalese twists, and soft-texture protective styling.",
  },
];

function matchesStyle(braider: (typeof demoBraiders)[number], selectedStyle: string) {
  return selectedStyle === "All styles" || braider.styles.includes(selectedStyle);
}

export default function Braiders() {
  const [query, setQuery] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("All styles");
  const [sortBy, setSortBy] = useState("Recommended");
  const [locationEnabled, setLocationEnabled] = useState(false);

  const filteredBraiders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const base = demoBraiders.filter((braider) => {
      const haystack = `${braider.name} ${braider.area} ${braider.styles.join(" ")} ${braider.bio}`.toLowerCase();
      return (!normalizedQuery || haystack.includes(normalizedQuery)) && matchesStyle(braider, selectedStyle);
    });

    return [...base].sort((a, b) => {
      if (sortBy === "Nearest") return a.distance - b.distance;
      if (sortBy === "Highest rated") return b.rating - a.rating || b.reviews - a.reviews;
      if (sortBy === "Soonest available") return a.distance - b.distance;
      return b.rating - a.rating || a.distance - b.distance;
    });
  }, [query, selectedStyle, sortBy]);

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main>
        <section className="container section-pad grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div className="lux-card overflow-hidden">
            <p className="pill w-fit">Braiders Near Me</p>
            <h1 className="serif mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Find verified braiders powered by the Kouvia network.
            </h1>
            <p className="mt-5 max-w-3xl text-white/68">
              This live-ready directory preview gives Eby’s Place customers a useful way to search local braid professionals while the broader Kouvia platform continues to onboard registered braiders. Customers can compare specialisms, ratings, availability, and distance before booking.
            </p>
            <div className="mt-8 grid gap-3 rounded-[2rem] border border-white/10 bg-black/30 p-3 md:grid-cols-[1fr_170px_190px]">
              <label className="flex items-center gap-3 rounded-full bg-white/8 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10 focus-within:ring-[var(--gold)]">
                <Search className="h-4 w-4 text-[var(--gold)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by town, style, or name"
                  className="w-full bg-transparent text-white placeholder:text-white/40 outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-full bg-white/8 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
                <SlidersHorizontal className="h-4 w-4 text-[var(--gold)]" />
                <select value={selectedStyle} onChange={(event) => setSelectedStyle(event.target.value)} className="w-full bg-transparent text-white outline-none [&_option]:bg-[#15100d]">
                  {styles.map((style) => <option key={style} value={style}>{style}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-full bg-white/8 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
                <Star className="h-4 w-4 text-[var(--gold)]" />
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="w-full bg-transparent text-white outline-none [&_option]:bg-[#15100d]">
                  {sortOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/55">
              <button type="button" onClick={() => setLocationEnabled(true)} className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 transition hover:border-[var(--gold)] hover:text-white">
                <Navigation className="h-4 w-4" />
                {locationEnabled ? "Using Somerset demo distances" : "Use my location"}
              </button>
              <span>Distances are demo values until customers grant live geolocation and Kouvia publishes registered braider data.</span>
            </div>
          </div>

          <aside className="lux-card bg-black/35">
            <p className="pill w-fit">For professionals</p>
            <h2 className="serif mt-4 text-3xl font-bold">Join Kouvia as a braider.</h2>
            <p className="mt-4 text-white/65">Registered braiders will be able to manage services, availability, ratings, and subscription visibility through the Kouvia booking platform.</p>
            <div className="mt-6 grid gap-3 text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Profile visibility on Eby’s Place</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Booking and deposit-ready workflow</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Availability and customer review foundation</div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn-gold" href={KOUVIA_BOOKING_URL} target="_blank" rel="noreferrer">Register as a Braider <ExternalLink className="h-4 w-4" /></a>
              <a className="btn-dark" href={KOUVIA_BOOKING_URL} target="_blank" rel="noreferrer">Open Kouvia</a>
            </div>
            <div className="mt-6 rounded-[1.75rem] border border-white/12 bg-[#130d08] p-4 shadow-[0_20px_45px_rgba(0,0,0,.35)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]/80">Kouvia app preview</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-[#0d0906]">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[0.68rem] uppercase tracking-[0.16em] text-white/50">
                  <span>Live booking</span>
                  <span>Somerset, UK</span>
                </div>
                <div className="space-y-3 p-3">
                  <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                    <p className="text-sm font-semibold text-white">Knotless Braids • Medium</p>
                    <p className="mt-1 text-xs text-white/55">From £95 · 3h 15m</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                    <p className="text-sm font-semibold text-white">Cornrows • Feed-in</p>
                    <p className="mt-1 text-xs text-white/55">From £70 · 2h 20m</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                    <p className="text-sm font-semibold text-white">Next slots</p>
                    <p className="mt-1 text-xs text-white/55">Tue 10:00 • Wed 14:30 • Fri 16:00</p>
                  </div>
                </div>
              </div>
              <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold)] transition hover:text-white" href={KOUVIA_BOOKING_URL} target="_blank" rel="noreferrer">
                Open Kouvia preview
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </aside>
        </section>

        <section className="container pb-20">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="pill w-fit">Directory preview</p>
              <h2 className="serif mt-3 text-3xl font-bold sm:text-4xl">Available braiders</h2>
            </div>
            <p className="text-sm text-white/55">Showing {filteredBraiders.length} of {demoBraiders.length} demo braiders</p>
          </div>
          {filteredBraiders.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {filteredBraiders.map((braider) => (
                <article key={braider.name} className="lux-card bg-black/28 transition hover:-translate-y-1 hover:border-[var(--gold)]/40">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="pill w-fit">{braider.badge}</p>
                      <h3 className="serif mt-3 text-2xl font-bold">{braider.name}</h3>
                      <p className="mt-2 flex items-center gap-2 text-sm text-white/60"><MapPin className="h-4 w-4 text-[var(--gold)]" /> {braider.area} · {braider.distance.toFixed(1)} miles</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--gold)] px-3 py-2 text-sm font-bold text-black">{braider.rating.toFixed(1)} ★</div>
                  </div>
                  <p className="mt-5 text-white/65">{braider.bio}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {braider.styles.map((style) => <span key={style} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">{style}</span>)}
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm text-white/65">
                    <span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-[var(--gold)]" /> {braider.availability}</span>
                    <span>{braider.reviews} reviews</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="lux-card text-center text-white/65">No demo braiders match those filters yet. Try “All styles” or clear the search.</div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
