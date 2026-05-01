import { Link } from "wouter";
import { MovingReviewStrip } from "@/components/ReviewWidgets";
import { trpc } from "@/lib/trpc";
import {
  CalendarDays,
  Crown,
  Heart,
  Menu,
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";

const LOGO_SRC = "/manus-storage/ebysplace-logo-gold-transparent_bde2c104.png";
const LANDING_VIDEO_SRC = "/manus-storage/ebysplace_header_video_64d5fea4.mp4";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/booking", label: "Book" },
  { href: "/shop", label: "Shop" },
  { href: "/ai-try-on", label: "AI Try-On" },
  { href: "/braiders-near-me", label: "Braiders Near Me" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reviews", label: "Reviews" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-primary/20 bg-[#fbf6ea]/90 shadow-[0_12px_36px_rgba(74,45,18,.08)] backdrop-blur-md">
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Eby’s Place home"
        >
          <img
            src={LOGO_SRC}
            alt="Eby’s Place"
            className="h-16 w-auto object-contain mix-blend-screen drop-shadow-[0_0_22px_rgba(246,224,178,.62)] contrast-125 saturate-125 sm:h-20"
          />
          <span className="serif hidden text-2xl font-black leading-none tracking-wide text-primary drop-shadow-[0_0_14px_rgba(246,224,178,.45)] min-[420px]:block sm:text-3xl">
            EBY’S PLACE
          </span>
        </Link>

        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label="Main navigation"
        >
          {navLinks.map(item => (
            <Link key={item.href} className="nav-link" href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className="btn-gold py-2.5" href="/admin">
            Admin
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:hidden">
          <Link className="btn-gold px-3 py-2.5 text-sm sm:px-4" href="/booking">
            Book
          </Link>
          <button
            type="button"
            className="rounded-full border border-primary/25 bg-[#fff8e8]/80 p-3 text-primary shadow-sm"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(value => !value)}
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          className="border-t border-primary/18 bg-[#fbf6ea]/96 px-5 py-5 lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="container grid gap-3 p-0">
            {navLinks.map(item => (
              <Link
                key={item.href}
                className="rounded-2xl border border-primary/15 bg-[#fff8e8]/70 px-4 py-3 text-sm font-semibold text-[#24180d]/85 transition hover:border-primary/50 hover:text-primary"
                href={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              className="btn-dark justify-center"
              href="/admin"
              onClick={() => setMenuOpen(false)}
            >
              Admin Dashboard
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-primary/20 bg-[#fbf6ea]/92 py-12">
      <div className="container grid gap-8 md:grid-cols-4">
        <div>
          <img
            src={LOGO_SRC}
            alt="Eby’s Place"
            className="h-20 w-auto object-contain mix-blend-screen drop-shadow-[0_0_26px_rgba(245,221,156,.68)] contrast-125 saturate-125"
          />
          <p className="mt-3 text-sm text-[#24180d]/70">
            Zero pain. Zero trauma. Just perfection. Luxury pain-free braiding
            in Somerset, UK.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-primary">Visit</h4>
          <p className="mt-3 text-sm text-[#24180d]/70">
            Book your pain-free appointment, browse styles, and shop products
            between visits.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-primary">Quick Links</h4>
          <div className="mt-3 grid gap-2 text-sm text-[#24180d]/75">
            <Link href="/services">Services & Pricing</Link>
            <Link href="/booking">Book Appointment</Link>
            <Link href="/shop">Shop</Link>
            <Link href="/ai-try-on">AI Try-On</Link>
            <Link href="/braiders-near-me">Braiders Near Me</Link>
          </div>
        </div>
        <div>
          <h4 className="font-bold text-primary">Pain-Free Guarantee</h4>
          <p className="mt-3 text-sm text-[#24180d]/70">
            If your braids feel excessively tight within 48 hours, Eby’s Place
            will fix it with care.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  const { data: styles = [] } = trpc.public.featuredServices.useQuery();
  const { data: products = [] } = trpc.public.products.useQuery();
  const { data: reviews = [] } = trpc.public.reviews.useQuery();
  const newsletter = trpc.public.newsletter.useMutation();
  const [email, setEmail] = useState("");

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden">
          <div className="hero-video-reference relative flex items-center">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={LANDING_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              poster="/manus-storage/ebysplace_service_knotless_braids_7dbbea62.png"
              aria-label="Eby’s Place landing video"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,13,8,.86),rgba(18,13,8,.54)_48%,rgba(18,13,8,.2)),linear-gradient(180deg,rgba(18,13,8,.18),rgba(18,13,8,.78))]" />
            <div className="container relative z-10 py-20 md:py-28">
              <div className="max-w-3xl p-0">
                <div className="mb-6 inline-flex p-0">
                  <img
                    src={LOGO_SRC}
                    alt="Eby’s Place luxury pain-free braiding"
                    className="h-32 w-auto object-contain mix-blend-screen drop-shadow-[0_0_42px_rgba(245,221,156,.88)] contrast-125 saturate-125 sm:h-40"
                  />
                </div>
                <span className="pill inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 leading-6">
                  <Crown className="h-4 w-4 shrink-0" /> <span>Zero pain. Zero trauma. Just perfection.</span>
                </span>
                <h1 className="serif mt-7 max-w-full break-words text-4xl font-bold leading-[1.02] min-[420px]:text-5xl sm:text-6xl md:text-7xl xl:text-8xl">
                  Luxury Pain-Free Braiding in <br className="sm:hidden" />
                  <span className="gold-text">Somerset, UK</span>
                </h1>
                <p className="mt-7 max-w-2xl text-base leading-8 text-white/82 sm:text-lg">
                  You do not fear bad braids. You fear the pain after: the
                  headaches, the tight edges, the thinning hairlines, and the
                  uncomfortable first nights. Eby’s Place is built for clients who
                  want beautiful, long-lasting protective styling without
                  sacrificing comfort, confidence, or scalp health.
                </p>
                <div className="mt-9 flex flex-wrap gap-4">
                  <Link className="btn-gold" href="/booking">
                    <CalendarDays className="mr-2 h-5 w-5" /> Book with £20 deposit
                  </Link>
                  <Link className="btn-dark bg-[#171009]/40" href="/ai-try-on">
                    <Wand2 className="mr-2 h-5 w-5" /> Try a braid style
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-pad bg-white/[0.045]">
          <div className="container grid gap-6 md:grid-cols-3">
            <div className="lux-card">
              <Heart className="text-primary" />
              <h2 className="serif mt-4 text-4xl font-bold">
                Zero tension. Maximum longevity. Total comfort.
              </h2>
              <p className="mt-3 text-white/65">
                The Eby’s Place philosophy is simple: braids should look refined
                and last beautifully without pulling, pressure, or avoidable
                scalp trauma.
              </p>
            </div>
            <div className="lux-card">
              <ShieldCheck className="text-primary" />
              <h2 className="serif mt-4 text-4xl font-bold">
                Structured scheduling
              </h2>
              <p className="mt-3 text-white/65">
                No delays. No guesswork. Your appointment time is respected
                from booking through finish.
              </p>
            </div>
            <div className="lux-card">
              <Sparkles className="text-primary" />
              <h2 className="serif mt-4 text-4xl font-bold">
                Style preview
              </h2>
              <p className="mt-3 text-white/65">
                Try braid inspiration before booking, then choose the service
                that feels right for you.
              </p>
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="pill w-fit">Popular styles</p>
                <h2 className="serif mt-4 text-5xl font-bold">
                  Signature braid menu
                </h2>
              </div>
              <Link className="btn-dark" href="/services">
                View all pricing
              </Link>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {(styles as any[]).map(s => (
                <article className="lux-card flex flex-col overflow-hidden p-0" key={s.id ?? s.slug}>
                  {s.imageUrl ? (
                    <div className="media-portrait overflow-hidden rounded-t-[1.6rem] bg-[#171009]">
                      <img
                        src={s.imageUrl}
                        alt={`${s.name} hairstyle by Eby’s Place`}
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-6">
                    <span className="text-xs font-bold uppercase tracking-[.22em] text-primary">
                      {s.badge}
                    </span>
                    <h3 className="serif mt-4 text-3xl font-bold">{s.name}</h3>
                    <p className="mt-3 flex-1 text-sm text-white/66">{s.description}</p>
                    <div className="mt-5 flex justify-between text-sm">
                      <span>{s.duration}</span>
                      <b className="text-primary">From £{s.priceFrom}</b>
                    </div>
                    <Link className="btn-gold mt-5 w-full" href="/booking">
                      Book This Style
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad bg-white/[0.04]">
          <div className="container grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="pill w-fit">
                <ShoppingBag className="mr-2 inline h-4 w-4" /> The Collection
              </p>
              <h2 className="serif mt-4 text-5xl font-bold">
                What you use between appointments matters more.
              </h2>
              <p className="mt-4 text-white/65">
                Selected braid care, accessories, and hair products shipped
                directly to your door.
              </p>
              <Link className="btn-gold mt-7" href="/shop">
                Shop products
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {(products as any[]).slice(0, 3).map(p => (
                <div className="lux-card" key={p.id ?? p.slug}>
                  <span className="pill text-xs">{p.badge}</span>
                  <h3 className="serif mt-4 text-2xl font-bold">{p.name}</h3>
                  <p className="mt-2 text-sm text-white/60">{p.description}</p>
                  <b className="mt-5 block text-2xl text-primary">£{p.price}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="container">
            <p className="pill w-fit">The Inner Circle</p>
            <h2 className="serif mt-4 text-5xl font-bold">
              What Our Clients Say
            </h2>
            <MovingReviewStrip reviews={reviews as any[]} />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-gold" href="/leave-review">
                Leave a review
              </Link>
              <Link className="btn-dark" href="/reviews">
                Read reviews
              </Link>
            </div>
          </div>
        </section>

        <section className="container pb-24">
          <div className="lux-card grid gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <h2 className="serif text-5xl font-bold">
                Join the Eby’s Place list.
              </h2>
              <p className="mt-3 text-white/65">
                Get appointment openings and product updates from Eby’s Place.
              </p>
            </div>
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={e => {
                e.preventDefault();
                newsletter.mutate({ email, productAlerts: true });
                setEmail("");
              }}
            >
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                required
              />
              <button className="btn-gold" type="submit">
                Sign up
              </button>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
