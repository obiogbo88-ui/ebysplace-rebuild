import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  CalendarDays,
  Crown,
  Heart,
  Menu,
  Play,
  ShieldCheck,
  Sparkles,
  Wand2,
  MessageCircle,
  X,
} from "lucide-react";
import { useState } from "react";

const LOGO_SRC = "/manus-storage/ebysplace-logo-gold-cropped_721223da.png";
const HEADER_LOGO_SRC = "/manus-storage/top-header-logo-1000220440-cropped-transparent_777ea202.png";
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
      <div className="container flex h-28 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex flex-1 items-center py-1 lg:flex-none"
          aria-label="Eby’s Place home"
        >
          <img
            src={HEADER_LOGO_SRC}
            alt="Eby’s Place"
            className="h-20 w-[14rem] object-contain mix-blend-multiply sm:h-24 sm:w-[19rem] lg:h-20 lg:w-[16rem] xl:w-[18rem]"
          />
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
      <div className="container grid gap-8 md:grid-cols-5">
        <div>
          <div className="flex items-center gap-4">
            <img
              src={HEADER_LOGO_SRC}
              alt="Eby’s Place"
              className="h-[7.5rem] w-auto object-contain mix-blend-multiply drop-shadow-[0_12px_26px_rgba(112,78,28,.22)] sm:h-[8.5rem]"
            />
          </div>
          <p className="mt-3 text-sm font-medium text-[#4f3720]">
            Luxury pain-free braiding in Somerset, UK.
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
          <h4 className="font-bold text-primary">Policies</h4>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-[#4f3720]">
            <Link href="/policies/privacy">Privacy Policy</Link>
            <Link href="/policies/shopping">Shopping Policy</Link>
            <Link href="/policies/returns">Returns Policy</Link>
            <Link href="/policies/terms">Terms of Use</Link>
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
      <div className="container mt-12 border-t border-[#d8bd74]/40 pt-8">
        <p className="serif max-w-5xl text-5xl font-bold uppercase leading-none tracking-[-0.05em] text-[#24170d] sm:text-7xl md:text-8xl">
          Beauty in every strand
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  const { data: styles = [] } = trpc.public.featuredServices.useQuery();
  const { data: products = [] } = trpc.public.products.useQuery();
  const { data: sections = [] } = trpc.public.websiteSections.useQuery();
  const { data: reviews = [] } = trpc.public.reviews.useQuery();
  const newsletter = trpc.public.newsletter.useMutation();
  const [email, setEmail] = useState("");
  const aboutSection = (sections as any[]).find((section) => section.sectionKey === "about_us") || {
    eyebrow: "About Eby’s Place",
    title: "From Passion to Power",
    body: "Eby’s Place began with a simple passion for helping women and families feel confident in protective styles that look refined without pain, pressure, or hairline trauma. That passion has grown into a power-led salon experience: structured consultations, gentle hands, premium finishing, and a commitment to braids that protect your confidence as much as your hair.",
    ctaLabel: "Read our services",
    ctaHref: "/services",
    imageUrl: "",
  };

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
                <ul className="hero-slogan-list max-w-[20rem] list-none space-y-0 p-0 lg:max-w-[30rem]" aria-label="Eby’s Place pain-free promise" data-placement="lower-left-side-away-from-model-face">
                  <li>Zero pain.</li>
                  <li>Zero trauma.</li>
                  <li>Just perfection.</li>
                </ul>
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
                <h2 className="serif mt-4 text-4xl font-bold leading-tight md:text-5xl">
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
          <div className="container">
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

        <section className="py-8 overflow-hidden bg-[#efe0c7]/78 text-[#24170d] md:py-10">
          <div className="container">
            <p className="pill w-fit border-[#d8bd74]/70 bg-white text-[#5b3a12]">Live testimonials</p>
          </div>
          <div className="review-marquee mt-5" aria-label="Moving Eby’s Place customer reviews">
            <div className="review-marquee-track">
              {[...(reviews as any[]).slice(0, 6), ...(reviews as any[]).slice(0, 6)].map((r, index) => (
                <blockquote className="lux-card review-marquee-card" key={`${r.id ?? r.customerName}-${index}`}>
                  <div className="text-primary">★★★★★</div>
                  <p className="mt-4 text-sm font-semibold leading-7 text-[#3a2615]">“{r.reviewText}”</p>
                  <footer className="mt-5 font-black text-[#24170d]">{r.customerName}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section className="container pb-24">
          <div className="lux-card grid gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <h2 className="serif text-4xl font-bold leading-tight md:text-5xl">
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

        <section className="section-pad bg-[#f3e7d2] text-[#24170d]">
          <div className="container">
            <div className="rounded-[2rem] border border-[#d2b164]/55 bg-[#fbf2e3]/94 p-5 shadow-[0_24px_70px_rgba(74,48,20,.16)] sm:p-7 lg:p-9">
              <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_13rem]">
                <div className="min-w-0">
                  <p className="pill w-fit border-[#d8bd74]/70 bg-white text-[#5b3a12]">{aboutSection.eyebrow || "About Eby’s Place"}</p>
                  <h2 className="serif mt-5 text-4xl font-bold leading-tight text-[#24170d] md:text-6xl">{aboutSection.title || "From Passion to Power"}</h2>
                  <div className="mt-5 h-1 w-24 rounded-full bg-[#b88b2d]" />
                  <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[#3a2615] md:text-lg">{aboutSection.body}</p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[["Gentle", "low-tension styling"], ["Premium", "clean salon finish"], ["Protected", "hairline-first care"]].map(([label, detail]) => (
                      <div className="rounded-2xl border border-[#d8bd74]/55 bg-white/86 p-4 shadow-sm" key={label}>
                        <b className="serif text-2xl text-[#7d571b]">{label}</b>
                        <p className="mt-1 text-sm font-semibold text-[#442d18]">{detail}</p>
                      </div>
                    ))}
                  </div>
                  {aboutSection.ctaHref && <Link className="btn-gold mt-8" href={aboutSection.ctaHref}>{aboutSection.ctaLabel || "Explore Eby’s Place"}</Link>}
                </div>
                <aside className="justify-self-start lg:justify-self-end" aria-label="Eby’s Place CEO portrait">
                  <div className="relative w-36 overflow-hidden rounded-[1.5rem] border border-[#d8bd74]/70 bg-[#efe0c7] p-2 shadow-[0_18px_48px_rgba(74,48,20,.2)] sm:w-44 lg:w-52">
                    {aboutSection.imageUrl ? (
                      <img className="aspect-[4/5] w-full rounded-[1.15rem] object-cover" src={aboutSection.imageUrl} alt="Founder or CEO of Eby’s Place" />
                    ) : (
                      <div className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-[1.15rem] border border-dashed border-[#b88b2d]/75 bg-[#f7eddc] p-4 text-center">
                        <Crown className="h-8 w-8 text-[#8a641e]" />
                        <p className="mt-3 text-[0.68rem] font-black uppercase tracking-[.22em] text-[#6f4b16]">CEO portrait</p>
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-[#3a2615]">Upload from admin.</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 max-w-44 text-xs font-bold uppercase tracking-[.2em] text-[#6f4b16]">Luxury braid care</p>
                </aside>
              </div>
            </div>
          </div>
        </section>
      </main>
      <a
        href="https://wa.me/447864585110"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_38px_rgba(37,211,102,.36)] transition hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(37,211,102,.48)] focus:outline-none focus:ring-4 focus:ring-[#25D366]/35"
        aria-label="Chat with Eby’s Place on WhatsApp"
      >
        <MessageCircle className="h-7 w-7" aria-hidden="true" />
      </a>
      <SiteFooter />
    </div>
  );
}
