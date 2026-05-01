import { Link } from "wouter";
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
    <header className="sticky top-0 z-50 border-b border-[#d8bd74]/55 bg-[#f5ead7]/92 shadow-[0_10px_36px_rgba(66,42,18,.12)] backdrop-blur-xl">
      <div className="container flex h-24 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-3 py-1"
          aria-label="Eby’s Place home"
        >
          <img
            src={LOGO_SRC}
            alt="Eby’s Place"
            className="h-20 w-auto object-contain drop-shadow-[0_10px_24px_rgba(112,78,28,.22)] [filter:brightness(.55)_sepia(1)_saturate(1.35)] sm:h-24"
          />
          <span className="hidden text-xl font-extrabold uppercase tracking-[0.16em] text-[#2a1a0b] sm:inline-block">
            Eby’s Place
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
            className="rounded-full border border-[#c8a95a]/45 bg-[#2a1a0b]/90 p-3 text-[#f7e3a3]"
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
          className="border-t border-[#d8bd74]/45 bg-[#f5ead7]/98 px-5 py-5 shadow-[0_18px_45px_rgba(66,42,18,.14)] lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="container grid gap-3 p-0">
            {navLinks.map(item => (
              <Link
                key={item.href}
                className="rounded-2xl border border-[#d8bd74]/35 bg-white/45 px-4 py-3 text-sm font-semibold text-[#2a1a0b] transition hover:border-[#b9933e] hover:text-[#8a641e]"
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
    <footer className="border-t border-[#d8bd74]/45 bg-[#f5ead7] py-12 text-[#2a1a0b]">
      <div className="container grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-4">
            <img
              src={LOGO_SRC}
              alt="Eby’s Place"
              className="h-28 w-auto object-contain drop-shadow-[0_12px_26px_rgba(112,78,28,.22)] [filter:brightness(.55)_sepia(1)_saturate(1.35)] sm:h-32"
            />
            <span className="text-2xl font-extrabold uppercase tracking-[0.14em] text-[#2a1a0b]">
              Eby’s Place
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-[#4f3720]">
            Zero pain. Zero trauma. Just perfection. Luxury pain-free braiding
            in Somerset, UK.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-primary">Visit</h4>
          <p className="mt-3 text-sm font-medium text-[#4f3720]">
            Book protective styles, shop aftercare, try AI previews, and connect
            to the Kouvia braider platform.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-primary">Quick Links</h4>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-[#4f3720]">
            <Link href="/services">Services & Pricing</Link>
            <Link href="/booking">Book Appointment</Link>
            <Link href="/shop">Shop</Link>
            <Link href="/ai-try-on">AI Try-On</Link>
            <Link href="/braiders-near-me">Braiders Near Me</Link>
          </div>
        </div>
        <div>
          <h4 className="font-bold text-primary">Luxury Care Promise</h4>
          <p className="mt-3 text-sm font-medium text-[#4f3720]">
            Zero tension. Maximum longevity. Total comfort for clients who want
            beautiful braids without scalp trauma.
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
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,238,222,.72),rgba(247,238,222,.34)_45%,rgba(247,238,222,.08)),linear-gradient(180deg,rgba(247,238,222,.06),rgba(20,12,5,.72))]" />
            <div className="container relative z-10 py-20 md:py-28">
              <div className="max-w-3xl py-5 [text-shadow:0_3px_22px_rgba(0,0,0,.88)] sm:py-8 md:py-10">
                <span className="pill inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 leading-6 bg-[#26180a]/78 text-[#f7dda0] shadow-[0_12px_30px_rgba(0,0,0,.25)]">
                  <Crown className="h-4 w-4 shrink-0" /> <span>Zero pain. Zero trauma. Just perfection.</span>
                </span>
                <h1 className="serif mt-7 max-w-full break-words text-4xl font-bold leading-[1.02] min-[420px]:text-5xl sm:text-6xl md:text-7xl xl:text-8xl">
                  Luxury Pain-Free Braiding in <br className="sm:hidden" />
                  <span className="gold-text">Somerset, UK</span>
                </h1>
                <p className="mt-7 max-w-2xl text-base font-medium leading-8 text-white sm:text-lg">
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
                  <Link className="btn-dark bg-[#171009]/82 shadow-[0_16px_45px_rgba(0,0,0,.38)]" href="/ai-try-on">
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
                Professional structure
              </h2>
              <p className="mt-3 text-white/65">
                Clear service categories, booking deposits, delivery details,
                reviews, gallery images, and admin oversight support a scalable
                salon operation.
              </p>
            </div>
            <div className="lux-card">
              <Sparkles className="text-primary" />
              <h2 className="serif mt-4 text-4xl font-bold">
                Modern automation
              </h2>
              <p className="mt-3 text-white/65">
                AI hairstyle previews, live content systems, customer reviews,
                ecommerce, analytics, and Kouvia SaaS handoff are part of the
                platform.
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
                <ShoppingBag className="mr-2 inline h-4 w-4" /> Shop preview
              </p>
              <h2 className="serif mt-4 text-5xl font-bold">
                Aftercare with a premium finish.
              </h2>
              <p className="mt-4 text-white/65">
                Sell braid care, accessories, and hair products with stock
                badges, colour variants, cart capture, delivery details, and
                order management.
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
            <p className="pill w-fit">Live testimonials</p>
            <h2 className="serif mt-4 text-5xl font-bold">
              Customer confidence, moderated by admin.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {(reviews as any[]).slice(0, 3).map(r => (
                <blockquote className="lux-card" key={r.id ?? r.customerName}>
                  <div className="text-primary">★★★★★</div>
                  <p className="mt-4 text-white/70">“{r.reviewText}”</p>
                  <footer className="mt-5 font-bold">{r.customerName}</footer>
                </blockquote>
              ))}
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
                Get style openings, product drops, and premium braid care
                guidance.
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
