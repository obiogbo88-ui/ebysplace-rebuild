import { Link, useLocation } from "wouter";
import { blogPosts } from "@/lib/blogContent";
import { trpc } from "@/lib/trpc";
import {
  navigateWithSmoothScroll,
  smoothScrollToTop,
} from "@/lib/smoothScroll";
import {
  getActivitySessionId,
  getBrowserInfo,
  getCurrentPageUrl,
} from "@/lib/activityTracking";
import {
  getServiceImageFallback,
  getServiceImageSrc,
} from "@/lib/serviceImageFallback";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

const LOGO_SRC =
  "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-logo-gold-cropped_721223da-1f2b66b044.png";
const HEADER_LOGO_SRC =
  "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/top-header-logo-1000220440-cropped-transparent_777ea202-de10edbcb7.png";
const LANDING_HERO_IMAGE_SRC =
  "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_7dbbea62-45d4296622.png";
const ABOUT_PORTRAIT_FALLBACK_SRC =
  "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-about-story-portrait.png";
const PRODUCT_THUMBNAIL_SIZES =
  "(max-width: 767px) calc(100vw - 2rem), (max-width: 1023px) calc((100vw - 4rem) / 2), (max-width: 1279px) calc((100vw - 5rem) / 4), 18rem";
const PRODUCT_IMAGE_FALLBACK_SRC =
  "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/booking", label: "Book" },
  { href: "/shop", label: "Shop" },
  { href: "/ai-try-on", label: "AI Try-On" },
  { href: "/braiders-near-me", label: "Braiders Near Me" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/reviews", label: "Reviews" },
];

const desktopNavLinks = navLinks.filter(
  item => item.href !== "/booking" && item.href !== "/shop"
);

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [, setLocation] = useLocation();
  const track = trpc.public.track.useMutation();

  const trackBraidersClick = () => {
    const browserInfo = getBrowserInfo();
    track.mutate({
      eventName: "braiders_near_me_click",
      pagePath: getCurrentPageUrl(),
      sessionId: getActivitySessionId(),
      activityType: "braiders_near_me_clicked",
      activityCategory: "kouvia",
      description: "User clicked Braiders Near Me from website navigation",
      status: "info",
      metadata: {
        browser: browserInfo.browser,
        deviceType: browserInfo.deviceType,
      },
      relatedEntityType: "feature",
      relatedEntityId: "braiders_near_me",
      sourceApp: "ebysplace",
    });
  };

  const handleProductSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = productSearch.trim();
    const target = query
      ? `/shop?search=${encodeURIComponent(query)}`
      : "/shop";
    setMenuOpen(false);
    navigateWithSmoothScroll(target, setLocation);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#d8bd74]/55 bg-[#f5ead7]/92 shadow-[0_10px_36px_rgba(66,42,18,.12)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8 xl:px-10">
        <Link
          href="/"
          className="flex shrink-0 items-center py-1"
          aria-label="Eby’s Place home"
        >
          <img
            src={HEADER_LOGO_SRC}
            alt="Eby’s Place"
            className="h-12 w-[8.25rem] object-contain object-left mix-blend-multiply min-[380px]:h-14 min-[380px]:w-[9.5rem] sm:h-20 sm:w-[14rem] lg:h-[4.5rem] lg:w-[15rem] xl:w-[16.5rem]"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end xl:flex">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 2xl:gap-x-4">
            <nav
              className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-2 xl:gap-x-3"
              aria-label="Main navigation"
            >
              {desktopNavLinks.map(item => (
                <Link
                  key={item.href}
                  className="nav-link whitespace-nowrap text-[0.66rem] tracking-[.1em] 2xl:text-[0.72rem] 2xl:tracking-[.12em]"
                  href={item.href}
                  onClick={() => {
                    if (item.href === "/braiders-near-me") trackBraidersClick();
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="btn-gold px-3.5 py-2 text-[0.72rem] uppercase tracking-[.14em] 2xl:px-4 2xl:text-xs"
                onClick={() =>
                  navigateWithSmoothScroll("/booking", setLocation)
                }
              >
                Book Now
              </button>
              <button
                type="button"
                className="btn-gold px-3.5 py-2 text-[0.72rem] uppercase tracking-[.14em] 2xl:px-4 2xl:text-xs"
                onClick={() => navigateWithSmoothScroll("/shop", setLocation)}
              >
                Shop Now
              </button>
            </div>
            <form
              className="relative w-full min-w-[11rem] max-w-[17rem] xl:w-[clamp(11rem,15vw,16rem)] 2xl:w-[clamp(12rem,17vw,18rem)]"
              role="search"
              aria-label="Product search"
              onSubmit={handleProductSearch}
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a641e]"
                aria-hidden="true"
              />
              <input
                className="h-11 w-full rounded-full border border-[#d8bd74]/55 bg-white/55 py-2 pl-9 pr-4 text-sm font-semibold text-[#2a1a0b] placeholder:text-[#6f4b16]/60 focus:border-[#b9933e] focus:outline-none focus:ring-2 focus:ring-[#d8bd74]/35"
                type="search"
                value={productSearch}
                onChange={event => setProductSearch(event.target.value)}
                placeholder="Search products"
                aria-label="Search Eby’s Place products"
              />
            </form>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 min-[390px]:gap-2 sm:gap-3 xl:hidden">
          <form
            className="relative hidden w-40 lg:block lg:w-52"
            role="search"
            aria-label="Compact product search"
            onSubmit={handleProductSearch}
          >
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a641e]"
              aria-hidden="true"
            />
            <input
              className="h-11 w-full rounded-full border border-[#d8bd74]/55 bg-white/55 py-2 pl-9 pr-4 text-sm font-semibold text-[#2a1a0b] placeholder:text-[#6f4b16]/60 focus:border-[#b9933e] focus:outline-none focus:ring-2 focus:ring-[#d8bd74]/35"
              type="search"
              value={productSearch}
              onChange={event => setProductSearch(event.target.value)}
              placeholder="Search products"
            />
          </form>
          <button
            type="button"
            className="btn-gold min-h-10 shrink-0 whitespace-nowrap px-2.5 py-2 text-[0.62rem] uppercase tracking-[.12em] min-[390px]:px-3 min-[390px]:text-[0.67rem] sm:px-4 sm:py-2.5 sm:text-xs"
            onClick={() => navigateWithSmoothScroll("/shop", setLocation)}
          >
            Shop Now
          </button>
          <button
            type="button"
            className="rounded-full border border-primary/45 bg-[#111111] p-2.5 text-primary shadow-[0_12px_28px_rgba(17,17,17,.28)] ring-1 ring-primary/25 transition hover:bg-primary hover:text-[#111111] hover:ring-primary/45 sm:p-3"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(value => !value)}
          >
            {menuOpen ? (
              <X className="h-5 w-5 [stroke-width:2.6]" />
            ) : (
              <Menu className="h-5 w-5 [stroke-width:2.6]" />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          className="border-t border-[#d8bd74]/45 bg-[#f5ead7]/98 px-5 py-5 shadow-[0_18px_45px_rgba(66,42,18,.14)] 2xl:hidden"
          aria-label="Mobile navigation"
        >
          <div className="container grid gap-3 p-0">
            <form
              className="relative"
              role="search"
              aria-label="Mobile product search"
              onSubmit={handleProductSearch}
            >
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a641e]"
                aria-hidden="true"
              />
              <input
                className="h-12 w-full rounded-2xl border border-[#d8bd74]/45 bg-white/60 py-3 pl-11 pr-4 text-sm font-semibold text-[#2a1a0b] placeholder:text-[#6f4b16]/60 focus:border-[#b9933e] focus:outline-none focus:ring-2 focus:ring-[#d8bd74]/35"
                type="search"
                value={productSearch}
                onChange={event => setProductSearch(event.target.value)}
                placeholder="Search products"
                aria-label="Search Eby’s Place products"
              />
            </form>
            {navLinks.map(item => (
              <Link
                key={item.href}
                className="rounded-2xl border border-[#d8bd74]/35 bg-white/45 px-4 py-3 text-sm font-semibold text-[#2a1a0b] transition hover:border-[#b9933e] hover:bg-white/70 hover:text-[#8a641e]"
                href={item.href}
                onClick={() => {
                  if (item.href === "/braiders-near-me") trackBraidersClick();
                  setMenuOpen(false);
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const [, setLocation] = useLocation();
  return (
    <footer id="site-footer" className="border-t border-primary/25 bg-[#f5ead7] pb-10 pt-16 text-[#2a1a0b]">
      <div className="container grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr] md:gap-8">
        <div>
          <img
            src={HEADER_LOGO_SRC}
            alt="Eby’s Place"
            className="h-16 w-auto max-w-[10rem] object-contain object-left mix-blend-multiply drop-shadow-[0_8px_18px_rgba(112,78,28,.18)] sm:h-20 sm:max-w-[12rem]"
            loading="lazy"
            decoding="async"
          />
          <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-[#4f3720]">
            Luxury pain-free braiding in Somerset, UK.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[.16em] text-primary">
            Visit
          </h4>
          <p className="mt-4 text-sm leading-relaxed text-[#4f3720]">
            Book protective styles, shop aftercare, try AI previews, and connect
            to the Kouvia braider platform.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[.16em] text-primary">
            Quick Links
          </h4>
          <div className="mt-4 grid gap-3 text-sm font-medium text-[#4f3720]">
            <Link className="w-fit transition hover:text-[#8a641e]" href="/services">Services & Pricing</Link>
            <button
              type="button"
              className="w-fit text-left transition hover:text-[#8a641e]"
              onClick={() => navigateWithSmoothScroll("/booking", setLocation)}
            >
              Book Appointment
            </button>
            <button
              type="button"
              className="w-fit text-left transition hover:text-[#8a641e]"
              onClick={() => navigateWithSmoothScroll("/shop", setLocation)}
            >
              Shop
            </button>
            <Link className="w-fit transition hover:text-[#8a641e]" href="/ai-try-on">AI Try-On</Link>
            <Link className="w-fit transition hover:text-[#8a641e]" href="/braiders-near-me">Braiders Near Me</Link>
            <Link className="w-fit transition hover:text-[#8a641e]" href="/blog">Blog</Link>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[.16em] text-primary">
            Policies
          </h4>
          <div className="mt-4 grid gap-3 text-sm font-medium text-[#4f3720]">
            <Link className="w-fit transition hover:text-[#8a641e]" href="/policies/privacy">Privacy Policy</Link>
            <Link className="w-fit transition hover:text-[#8a641e]" href="/policies/shopping">Shopping Policy</Link>
            <Link className="w-fit transition hover:text-[#8a641e]" href="/policies/returns">Returns Policy</Link>
            <Link className="w-fit transition hover:text-[#8a641e]" href="/policies/terms">Terms of Use</Link>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[.16em] text-primary">
            Contact
          </h4>
          <p className="mt-4 text-sm font-semibold">
            <a
              className="underline decoration-primary/60 underline-offset-4 transition hover:text-[#8a641e]"
              href="mailto:info@ebysplace.com"
            >
              info@ebysplace.com
            </a>
          </p>
          <h4 className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-primary">
            Luxury Care Promise
          </h4>
          <p className="mt-4 text-sm leading-relaxed text-[#4f3720]">
            Zero tension. Maximum longevity. Total comfort for clients who want
            beautiful braids without scalp trauma.
          </p>
        </div>
      </div>
      <div className="container mt-14 border-t border-primary/20 pt-10">
        <p className="serif max-w-5xl text-5xl font-bold uppercase leading-[0.92] tracking-[-0.05em] text-[#24170d] sm:text-7xl md:text-8xl">
          Beauty in every strand
        </p>
        <div className="mt-8 flex flex-col gap-3 border-t border-primary/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium tracking-[0.03em] text-[#4f3720]/60">
            © {new Date().getFullYear()} Eby’s Place. All rights reserved.
          </p>
          <a
            href="https://veyadigital.tech"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.05em] text-[#4f3720]/60 transition hover:text-[#8a641e]"
          >
            Built by
            <span className="inline-flex items-center gap-[3px]">
              <span
                aria-hidden="true"
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: "#d8ff36" }}
              >
                <img src="/veya-mark.svg" alt="" className="h-[62%] w-[62%]" />
              </span>
              <img src="/veya-wordmark.png" alt="Veya Digital" className="h-4 w-auto" />
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}

function HomepageLiveSearch() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { data: services = [] } = trpc.public.services.useQuery({});
  const { data: products = [] } = trpc.public.products.useQuery();
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    const serviceResults = (services as any[])
      .filter(service =>
        [service.name, service.category, service.description, service.badge]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 4)
      .map(service => ({
        type: "Service",
        title: service.name,
        detail: `${service.category} · from £${service.priceFrom}`,
        href: `/services?search=${encodeURIComponent(service.name)}`,
      }));
    const productResults = (products as any[])
      .filter(product =>
        [product.name, product.category, product.description, product.badge]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 4)
      .map(product => ({
        type: "Product",
        title: product.name,
        detail: `${product.category} · £${product.price}`,
        href: `/shop?search=${encodeURIComponent(product.name)}`,
      }));
    return [...serviceResults, ...productResults].slice(0, 6);
  }, [query, services, products]);
  return (
    <section className="container relative z-20 -mt-10 pb-[3.75rem] md:-mt-12 md:pb-20">
      <div className="rounded-[2rem] border border-primary/25 bg-white p-5 shadow-[0_24px_80px_rgba(26,26,26,.12)] sm:p-7 md:p-8">
        <label className="block text-sm font-bold uppercase tracking-[0.24em] text-primary">
          Search services, styles, and shop products
        </label>
        <input
          className="mt-3 w-full rounded-2xl border border-primary/20 bg-white px-4 py-3 text-base text-[#2e1b10] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 sm:text-lg"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search braids, twists, aftercare, or shop products..."
          aria-label="Search services, styles, and shop products"
        />
        {query.trim().length >= 2 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {results.length ? (
              results.map(result => (
                <button
                  key={`${result.type}-${result.title}`}
                  type="button"
                  onClick={() =>
                    navigateWithSmoothScroll(result.href, setLocation)
                  }
                  className="rounded-2xl border border-white/10 bg-[#FAF7F2] p-4 text-left transition hover:border-primary/50 hover:bg-[#fff8df]"
                >
                  <span className="pill text-[0.65rem]">{result.type}</span>
                  <b className="mt-2 block text-primary">{result.title}</b>
                  <small className="mt-1 block text-[#4A4A4A]">
                    {result.detail}
                  </small>
                </button>
              ))
            ) : (
              <p className="rounded-2xl border border-primary/20 bg-[#FAF7F2] p-4 text-sm text-[#4A4A4A] sm:col-span-2 lg:col-span-3">
                No matching services, styles, or shop products yet. Try
                “braids”, “twists”, or “aftercare”.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-[#4A4A4A]">
            Start typing to search services, styles, and shop products
            instantly.
          </p>
        )}
      </div>
    </section>
  );
}

function HomepageGalleryPreview() {
  const { data: galleryItems = [] } = trpc.public.gallery.useQuery({
    category: "All",
  });
  const [selected, setSelected] = useState<any | null>(null);
  const preview = (galleryItems as any[]).slice(0, 6);
  if (preview.length === 0) return null;
  return (
    <>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {preview.map((image: any, index: number) => (
          <button
            type="button"
            className="lux-card overflow-hidden p-0 text-left"
            key={`${image.id ?? image.title ?? "gallery"}-${index}`}
            onClick={() => setSelected(image)}
          >
            <div className="media-portrait media-gallery overflow-hidden rounded-t-[1.6rem] bg-[#171009]">
              <img
                src={image.imageUrl}
                alt={image.altText || image.title}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="p-4">
              <span className="pill inline-block text-xs">{image.category}</span>
              <p className="mt-2 font-bold text-[#24170d]">{image.title}</p>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[92vh] max-w-4xl overflow-auto rounded-[2rem] border border-primary/30 bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              className="max-h-[70vh] w-full rounded-2xl object-contain"
              src={selected.imageUrl}
              alt={selected.altText || selected.title}
              loading="eager"
              decoding="async"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="pill w-fit text-xs">{selected.category}</p>
                <h2 className="serif mt-2 text-3xl font-bold text-primary">{selected.title}</h2>
              </div>
              <button className="btn-gold" onClick={() => setSelected(null)}>
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: styles = [] } = trpc.public.featuredServices.useQuery();
  const { data: products = [] } = trpc.public.products.useQuery();
  const { data: sections = [] } = trpc.public.websiteSections.useQuery();
  const { data: reviews = [] } = trpc.public.reviews.useQuery();
  const newsletter = trpc.public.newsletter.useMutation({
    onSuccess: () => smoothScrollToTop(40),
  });
  const logActivity = trpc.public.logActivity.useMutation();
  const [email, setEmail] = useState("");
  const aboutSection = (sections as any[]).find(
    section => section.sectionKey === "about_us"
  ) || {
    eyebrow: "Our Story",
    title: "From Passion to Power",
    body: "Eby’s Place was born from a love for braiding and a belief that beautiful hair should never come with pain, pulling, or damage. What began as a passion for helping women and families feel confident has grown into a premium braid-care experience built on gentle hands, neat finishing, protective styling, and genuine customer care.",
    ctaLabel: "Read our services",
    ctaHref: "/services",
    imageUrl: "",
    portraitImageUrl: "",
    portraitDescription: "Eberechi Ogbo | Founder & Service Lead",
  };
  const featuredShopProducts = (
    (products as any[]).filter(
      product => product.isFeatured === "true" || product.isFeatured === true
    ).length
      ? (products as any[]).filter(
          product =>
            product.isFeatured === "true" || product.isFeatured === true
        )
      : (products as any[])
  ).slice(0, 4);
  const featuredBlogPosts = blogPosts.filter(post => post.featured).slice(0, 3);

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden">
          <div className="hero-video-reference relative flex items-center lg:items-start">
            <img
              className="absolute inset-0 h-full w-full object-cover object-[center_10%] md:object-[center_12%] lg:object-[center_14%]"
              src={LANDING_HERO_IMAGE_SRC}
              alt="Eby’s Place pain-free braiding hero style"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,238,222,.72),rgba(247,238,222,.38)_45%,rgba(247,238,222,.1)),linear-gradient(180deg,rgba(247,238,222,.08),rgba(20,12,5,.76))]" />
            <div className="container relative z-10 py-24 md:py-32 lg:pb-28 lg:pt-40">
              <p className="pill w-fit border-primary/50 bg-white/70 text-[0.65rem] tracking-[.18em] [text-shadow:none] sm:text-xs">
                Somerset, UK &middot; Est. braid studio
              </p>
              <div className="mt-6 max-w-3xl [text-shadow:0_3px_22px_rgba(0,0,0,.88)]">
                <ul
                  className="hero-slogan-list max-w-[20rem] list-none space-y-0 p-0 lg:max-w-[30rem]"
                  aria-label="Eby’s Place pain-free promise"
                  data-placement="lower-left-side-away-from-model-face"
                >
                  <li>Zero pain.</li>
                  <li>Zero trauma.</li>
                  <li>Just perfection.</li>
                </ul>
                <h1 className="serif mt-8 max-w-full break-words text-4xl font-bold leading-[1.02] min-[420px]:text-5xl sm:text-6xl md:text-7xl xl:text-8xl">
                  Luxury Pain-Free Braiding in <br className="sm:hidden" />
                  <span className="gold-text">Somerset, UK</span>
                </h1>
                <p className="mt-7 max-w-2xl text-base font-medium leading-8 text-white sm:text-lg">
                  You do not fear bad braids. You fear the pain after: the
                  headaches, the tight edges, the thinning hairlines, and the
                  uncomfortable first nights. Eby’s Place is built for clients
                  who want beautiful, long-lasting protective styling without
                  sacrificing comfort, confidence, or scalp health.
                </p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <button
                    type="button"
                    className="btn-gold"
                    onClick={() =>
                      navigateWithSmoothScroll("/booking", setLocation)
                    }
                  >
                    <CalendarDays className="mr-2 h-5 w-5" /> Book with £20
                    deposit
                  </button>
                  <Link
                    className="btn-dark bg-[#171009]/82 shadow-[0_16px_45px_rgba(0,0,0,.38)]"
                    href="/ai-try-on"
                  >
                    <Wand2 className="mr-2 h-5 w-5" /> Try a braid style
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HomepageLiveSearch />

        <section className="section-pad bg-white/[0.045]">
          <div className="container grid gap-6 md:grid-cols-3">
            <div className="lux-card">
              <Heart className="text-primary" />
              <h2 className="serif mt-4 text-4xl font-bold">
                No pain. No pulling. Just flawless braids.
              </h2>
              <p className="mt-3 text-white/65">
                Premium braiding designed to protect your scalp, last
                beautifully, and keep you comfortable from start to finish.
              </p>
            </div>
            <div className="lux-card">
              <ShieldCheck className="text-primary" />
              <h2 className="serif mt-4 text-4xl font-bold">
                Professional from booking to finish.
              </h2>
              <p className="mt-3 text-white/65">
                Clear services, simple deposits, customer reviews, gallery
                updates, delivery details, and full admin oversight — all built
                for a smooth salon experience.
              </p>
            </div>
            <div className="lux-card">
              <Sparkles className="text-primary" />
              <h2 className="serif mt-4 text-4xl font-bold">
                The future of braiding is here.
              </h2>
              <p className="mt-3 text-white/65">
                AI hairstyle previews, ecommerce, live content, customer
                reviews, analytics, and SaaS integration — all inside one
                powerful Eby’s Place platform.
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
                  Signature braid catalogue
                </h2>
              </div>
              <Link className="btn-dark" href="/services">
                View all pricing
              </Link>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {(styles as any[]).map((s, index) => (
                <article
                  className="lux-card flex flex-col overflow-hidden p-0"
                  key={`${s.id ?? s.slug ?? s.name}-${index}`}
                >
                  {getServiceImageSrc(s) ? (
                    <div className="media-portrait overflow-hidden rounded-t-[1.6rem] bg-[#171009]">
                      <img
                        src={getServiceImageSrc(s)!}
                        alt={`${s.name} hairstyle by Eby’s Place`}
                        sizes={PRODUCT_THUMBNAIL_SIZES}
                        loading="lazy"
                        decoding="async"
                        onError={event => {
                          const fallback = getServiceImageFallback(s);
                          if (fallback && event.currentTarget.src !== fallback)
                            event.currentTarget.src = fallback;
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-6">
                    <span className="text-xs font-bold uppercase tracking-[.22em] text-primary">
                      {s.badge}
                    </span>
                    <h3 className="serif mt-4 text-3xl font-bold">{s.name}</h3>
                    <p className="mt-3 flex-1 text-sm text-white/66">
                      {s.description}
                    </p>
                    <div className="mt-5 flex justify-between text-sm">
                      <span>{s.duration}</span>
                      <b className="text-primary">From £{s.priceFrom}</b>
                    </div>
                    <button
                      type="button"
                      className="btn-gold mt-5 w-full"
                      onClick={() =>
                        navigateWithSmoothScroll(
                          `/booking?service=${encodeURIComponent(s.name)}`,
                          setLocation
                        )
                      }
                    >
                      Book This Style
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad bg-white/[0.04]">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <button
                type="button"
                className="btn-gold order-2 md:order-1"
                onClick={() => navigateWithSmoothScroll("/shop", setLocation)}
              >
                Shop products
              </button>
              <div className="order-1 w-full text-left md:order-2 md:w-auto md:text-right">
                <p className="pill w-fit md:ml-auto">
                  <ShoppingBag className="mr-2 inline h-4 w-4" /> Shop preview
                </p>
                <h2 className="serif mt-4 text-4xl font-bold leading-tight md:text-5xl">
                  Shop
                </h2>
                <p className="mt-3 text-base font-semibold text-white/72">
                  Premium braid care and accessories
                </p>
              </div>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {featuredShopProducts.map((product, index) => (
                <button
                  type="button"
                  className="lux-card group block w-full min-w-0 overflow-hidden p-0 text-left transition hover:-translate-y-1 hover:border-primary/55 hover:shadow-[0_22px_55px_rgba(189,140,52,.24)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() =>
                    navigateWithSmoothScroll(
                      product.slug
                        ? `/shop/${product.slug}`
                        : `/shop?search=${encodeURIComponent(product.name)}`,
                      setLocation
                    )
                  }
                  key={`${product.id ?? product.slug ?? product.name}-${index}`}
                  aria-label={`View ${product.name} product page`}
                >
                  <div className="relative min-h-[210px] overflow-hidden rounded-t-[1.75rem] border-b border-primary/20 bg-[#130c07]">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        sizes={PRODUCT_THUMBNAIL_SIZES}
                        loading="lazy"
                        decoding="async"
                        onError={event => {
                          if (
                            event.currentTarget.src !==
                            PRODUCT_IMAGE_FALLBACK_SRC
                          )
                            event.currentTarget.src =
                              PRODUCT_IMAGE_FALLBACK_SRC;
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                        No product image
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.58))]" />
                    <span className="pill absolute left-4 top-4 bg-black/60 text-xs text-primary">
                      {product.badge || "Featured"}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="serif text-2xl font-bold text-[#2a1a0b] transition group-hover:text-primary">
                      {product.name}
                    </h3>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <b className="text-2xl text-primary">£{product.price}</b>
                      <span className="text-sm font-bold text-[#4a3014]">
                        View product
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="pill w-fit">Blog</p>
                <h2 className="serif mt-4 text-4xl font-bold leading-tight md:text-5xl">
                  Latest from the braid journal
                </h2>
                <p className="mt-3 max-w-2xl text-white/65">
                  Original, professionally written braid guidance with visual
                  inspiration and practical care advice.
                </p>
              </div>
              <Link className="btn-dark" href="/blog">
                Browse all posts
              </Link>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {featuredBlogPosts.map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="lux-card group block overflow-hidden p-0 text-left transition hover:-translate-y-1 hover:border-primary/55 hover:shadow-[0_22px_55px_rgba(189,140,52,.24)]"
                >
                  <div className="media-portrait overflow-hidden rounded-t-[1.75rem] bg-[#171009]">
                    <img
                      src={post.imageUrl}
                      alt={post.imageAlt}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                      onError={event => {
                        if (
                          event.currentTarget.src !== PRODUCT_IMAGE_FALLBACK_SRC
                        )
                          event.currentTarget.src = PRODUCT_IMAGE_FALLBACK_SRC;
                      }}
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-primary/85">
                      <span className="pill text-[0.65rem]">
                        {post.category}
                      </span>
                      <span>{post.publishDate}</span>
                    </div>
                    <h3 className="serif mt-4 text-3xl font-bold text-[#2a1a0b] transition group-hover:text-primary">
                      {post.title}
                    </h3>
                    <p className="mt-3 text-sm font-medium leading-7 text-[#4a3014]">
                      {post.excerpt}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                      Read article <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="pill w-fit">Gallery</p>
                <h2 className="serif mt-4 text-4xl font-bold leading-tight md:text-5xl">
                  Style inspiration
                </h2>
                <p className="mt-3 max-w-2xl text-white/65">
                  A diverse gallery of braiding styles for women, men, and
                  children of all backgrounds.
                </p>
              </div>
              <Link className="btn-dark" href="/gallery">
                View full gallery
              </Link>
            </div>
            <HomepageGalleryPreview />
          </div>
        </section>

        <section className="py-8 overflow-hidden bg-[#efe0c7]/78 text-[#24170d] md:py-10">
          <div className="container">
            <button
              type="button"
              className="btn-gold w-fit px-5 py-3 text-sm"
              onClick={() => navigateWithSmoothScroll("/reviews", setLocation)}
              aria-label="Leave a review for Eby’s Place"
            >
              <span className="sr-only">Live testimonials </span>Leave a Review
            </button>
          </div>
          <div
            className="review-marquee mt-5"
            aria-label="Moving Eby’s Place customer reviews"
          >
            <div className="review-marquee-track">
              {[
                ...(reviews as any[]).slice(0, 6),
                ...(reviews as any[]).slice(0, 6),
              ].map((r, index) => (
                <blockquote
                  className="lux-card review-marquee-card"
                  key={`${r.id ?? r.customerName}-${index}`}
                >
                  <div className="text-primary">★★★★★</div>
                  <p className="mt-4 text-sm font-semibold leading-7 text-[#3a2615]">
                    “{r.reviewText}”
                  </p>
                  <footer className="mt-5 font-black text-[#24170d]">
                    {r.customerName}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section className="container pb-14 md:pb-18">
          <div className="lux-card grid items-center gap-5 rounded-[1.5rem] px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:py-6">
            <div>
              <h2 className="serif text-2xl font-bold leading-tight md:text-3xl">
                Join the Eby’s Place list.
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/62 md:text-[0.95rem]">
                Get style openings, product drops, and premium braid care
                guidance.
              </p>
            </div>
            <form
              className="flex w-full flex-col gap-2 sm:flex-row md:w-auto"
              onSubmit={e => {
                e.preventDefault();
                newsletter.mutate({ email, productAlerts: true });
                logActivity.mutate({
                  sessionId: getActivitySessionId(),
                  activityType: "newsletter_signup",
                  activityCategory: "newsletter",
                  description: "Newsletter signup submitted",
                  pageUrl: getCurrentPageUrl(),
                  userEmail: email,
                  status: "success",
                  sourceApp: "ebysplace",
                });
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
              <button className="btn-gold px-5 py-3 text-sm" type="submit">
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
                  <p className="pill w-fit border-[#d8bd74]/70 bg-white text-[#5b3a12]">
                    {aboutSection.eyebrow || "About Eby’s Place"}
                  </p>
                  <h2 className="serif mt-5 text-4xl font-bold leading-tight text-[#24170d] md:text-6xl">
                    {aboutSection.title || "From Passion to Power"}
                  </h2>
                  <div className="mt-5 h-1 w-24 rounded-full bg-[#b88b2d]" />
                  <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[#3a2615] md:text-lg">
                    {aboutSection.body}
                  </p>
                  {aboutSection.ctaHref && (
                    <Link className="btn-gold mt-8" href={aboutSection.ctaHref}>
                      {aboutSection.ctaLabel || "Explore Eby’s Place"}
                    </Link>
                  )}
                </div>
                <aside
                  className="justify-self-start text-center lg:justify-self-end"
                  aria-label="Eby’s Place round story portrait"
                >
                  <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border border-[#d8bd74]/75 bg-[#efe0c7] p-2 shadow-[0_18px_48px_rgba(74,48,20,.2)] sm:h-36 sm:w-36 lg:h-48 lg:w-48">
                    <img
                      className="h-full w-full rounded-full object-cover object-[center_18%]"
                      src={
                        aboutSection.portraitImageUrl ||
                        aboutSection.imageUrl ||
                        ABOUT_PORTRAIT_FALLBACK_SRC
                      }
                      alt="Eby’s Place story portrait"
                      loading="lazy"
                      decoding="async"
                      onError={event => {
                        if (
                          event.currentTarget.src !==
                          ABOUT_PORTRAIT_FALLBACK_SRC
                        )
                          event.currentTarget.src = ABOUT_PORTRAIT_FALLBACK_SRC;
                      }}
                    />
                  </div>
                  <p className="mx-auto mt-4 max-w-[13rem] text-sm font-bold leading-6 text-[#5b3a12]">
                    {aboutSection.portraitDescription ||
                      "Eberechi Ogbo | Founder & Service Lead"}
                  </p>
                </aside>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
