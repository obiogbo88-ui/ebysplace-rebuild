import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const homeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8"
);
const adminSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Admin.tsx"),
  "utf8"
);
const appSource = readFileSync(
  resolve(process.cwd(), "client/src/App.tsx"),
  "utf8"
);
const policiesSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Policies.tsx"),
  "utf8"
);
const tryOnSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/TryOn.tsx"),
  "utf8"
);
const bookingSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Booking.tsx"),
  "utf8"
);
const shopSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Shop.tsx"),
  "utf8"
);
const reviewsSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Reviews.tsx"),
  "utf8"
);
const loginDialogSource = readFileSync(
  resolve(process.cwd(), "client/src/components/SecureDialog.tsx"),
  "utf8"
);
const dbSource = readFileSync(
  resolve(process.cwd(), "server/db.ts"),
  "utf8"
);
const indexSource = readFileSync(
  resolve(process.cwd(), "client/index.html"),
  "utf8"
);
const manifestSource = readFileSync(
  resolve(process.cwd(), "client/public/site.webmanifest"),
  "utf8"
);
const servicesSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Services.tsx"),
  "utf8"
);
const gallerySource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Gallery.tsx"),
  "utf8"
);
const chatAssistantSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ChatAssistant.tsx"),
  "utf8"
);

describe("Eby’s Place landing page visual refinements", () => {
  it("keeps the hero photo free of brand-card overlays and places the pain-free promise as a styled list", () => {
    expect(homeSource).not.toContain("Eby’s Place luxury pain-free braiding");
    expect(homeSource).not.toContain("rounded-[2rem] border border-[#f0d889]/55 bg-[#f7eede]/82");
    expect(homeSource).toContain("hero-slogan-list");
    expect(homeSource).toContain("data-placement=\"lower-left-side-away-from-model-face\"");
    expect(homeSource).toContain("<li>Zero pain.</li>");
    expect(homeSource).toContain("<li>Zero trauma.</li>");
    expect(homeSource).toContain("<li>Just perfection.</li>");
    expect(cssSource).toContain(".hero-slogan-list li:last-child");
  });

  it("removes the hero write-up and removes the written EBYSPLACE header wordmark", () => {
    expect(homeSource).not.toContain('data-home-top-writeup="ebys-place"');
    expect(homeSource).not.toContain("Eby’s Place brings luxury pain-free braiding, protective styling,");
    expect(homeSource).not.toContain('data-header-center-wordmark="ebysplace"');
    expect(homeSource).not.toContain(">\n            EBYSPLACE\n          </span>");
    expect(homeSource).toContain("HEADER_LOGO_SRC");
    expect(homeSource).toContain("https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/top-header-logo-1000220440-cropped-transparent_777ea202-de10edbcb7.png");
    expect(homeSource.indexOf("HEADER_LOGO_SRC")).toBeLessThan(homeSource.indexOf('navigateWithSmoothScroll("/booking", setLocation)'));
  });

  it("keeps admin access hidden from public navigation while preserving direct admin routes", () => {
    expect(homeSource).not.toContain('href="/admin"');
    expect(homeSource).not.toContain("Admin Dashboard");
    expect(appSource).toContain('<Route path="/admin" component={Admin} />');
    expect(appSource).toContain('<Route path="/admin/login" component={AdminLogin} />');
    expect(appSource).toContain("function BookingAliasRedirect()");
    expect(appSource).toContain('return <Redirect to={target} replace />;');
    expect(appSource).toContain('<Route path="/booking/" component={Booking} />');
    expect(appSource).toContain('<Route path="/book" component={Booking} />');
    expect(appSource).toContain('<Route path="/book-now" component={Booking} />');
    expect(appSource).toContain('<Route path="/bookings" component={Booking} />');
  });

  it("adds public search forms and routes navigation searches to filtered shop results", () => {
    expect(homeSource).toContain('role="search"');
    expect(homeSource).toContain('aria-label="Product search"');
    expect(homeSource).toContain('aria-label="Compact product search"');
    expect(homeSource).toContain('aria-label="Mobile product search"');
    expect(homeSource).toContain('placeholder="Search products"');
    expect(homeSource).toContain('`/shop?search=${encodeURIComponent(query)}`');
    expect(homeSource).toContain('navigateWithSmoothScroll(target, setLocation)');
    expect(homeSource).toContain('<HomepageLiveSearch />');
      expect(homeSource).toContain('Search services, styles, and shop products');
      expect(homeSource).toContain('placeholder="Search braids, twists, aftercare, or shop products..."');
      expect(homeSource).toContain('href: `/services?search=${encodeURIComponent(service.name)}`');
      expect(servicesSource).toContain('new URLSearchParams(window.location.search).get("search")');
      expect(servicesSource).toContain('Showing services matching');
      expect(servicesSource).toContain("visibleServices.map");
    expect(homeSource).toContain('-mt-10 pb-[3.75rem] md:-mt-12 md:pb-20');
    expect(shopSource).toContain('new URLSearchParams(window.location.search).get("search")');
    expect(shopSource).toContain('function productMatchesSearch(product: ShopProduct, query: string)');
    expect(shopSource).toContain('Showing {visibleProducts.length} result');
    expect(shopSource).toContain('No products found');
    expect(shopSource).toContain('navigateWithSmoothScroll("/shop")');
  });

  it("uses the supplied stretched top logo and a reduced, aligned footer logo", () => {
    expect(homeSource).toContain('href="/"');
    expect(homeSource).toContain("src={HEADER_LOGO_SRC}");
    expect(homeSource).toContain('fetchPriority="high"');
    expect(homeSource).toContain('decoding="async"');
    // Logo enlarged from the original size at the client's request for
    // readability, still the original mark/branding (HEADER_LOGO_SRC).
    expect(homeSource).toContain("h-16 w-[10.5rem] object-contain object-left mix-blend-multiply min-[380px]:h-[4.5rem] min-[380px]:w-[11.75rem] sm:h-24 sm:w-[16.5rem] lg:h-[5.75rem] lg:w-[18rem] xl:w-[19.5rem]");
    expect(homeSource).toContain('className="btn-gold min-h-10 shrink-0 whitespace-nowrap px-2.5 py-2 text-[0.62rem] uppercase tracking-[.12em] min-[390px]:px-3 min-[390px]:text-[0.67rem] sm:px-4 sm:py-2.5 sm:text-xs"');
    expect(homeSource).not.toContain('<div className="hidden sm:block">');
      expect(homeSource).toContain('navigateWithSmoothScroll("/shop", setLocation)');
      expect(homeSource).toContain("Shop Now");
      expect(homeSource).toContain('className="btn-gold px-3.5 py-2 text-[0.72rem] uppercase tracking-[.14em] 2xl:px-4 2xl:text-xs"');
      expect(homeSource).toContain('navigateWithSmoothScroll("/booking", setLocation)');
      expect(homeSource).toContain('navigateWithSmoothScroll("/shop", setLocation)');
      expect(homeSource).toContain("const desktopNavLinks = navLinks.filter(");
    expect(homeSource).not.toContain("h-24 w-[16rem] object-contain mix-blend-multiply sm:h-28 sm:w-[22rem] lg:h-24 lg:w-[18rem] xl:w-[20rem]");
    expect(homeSource).not.toContain("h-52 w-auto object-contain drop-shadow-[0_10px_24px_rgba(112,78,28,.22)]");
    expect(homeSource).not.toContain("h-36 w-auto object-contain mix-blend-multiply drop-shadow-[0_12px_26px_rgba(112,78,28,.22)] sm:h-40");
    expect(homeSource).not.toContain("sm:h-56 lg:h-60");
    expect(homeSource).not.toContain("translate-y-8");
    expect(homeSource).toContain("h-20 w-auto max-w-[12.5rem] object-contain object-left mix-blend-multiply drop-shadow-[0_8px_18px_rgba(112,78,28,.18)] sm:h-24 sm:max-w-[15rem]");
    expect(homeSource).toContain("src={HEADER_LOGO_SRC}");
    expect(homeSource).toContain("alt=\"Eby’s Place\"");
    expect(homeSource).not.toContain("text-base font-extrabold uppercase tracking-[0.14em]");
    expect(homeSource).not.toContain("mt-1 max-w-[13rem]");
    expect(homeSource).not.toContain("<span className=\"text-2xl font-extrabold uppercase tracking-[0.14em] text-[#2a1a0b]\">");
    expect(homeSource).not.toContain("[filter:brightness(.55)_sepia(1)_saturate(1.35)]");
    expect(homeSource).toContain('className="serif block border-b border-primary/10 py-3 text-4xl font-bold uppercase leading-tight tracking-tight text-[#F4EFE6] transition hover:text-primary sm:text-5xl"');
  });

  it("keeps storage-backed images on clean public Supabase URLs and decodes gallery images without blocking layout", () => {
    const combinedMediaSource = `${homeSource}\n${servicesSource}\n${gallerySource}`;
    expect(combinedMediaSource).toContain("https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/");
    const obsoleteStorageFolder = ["manus", "storage"].join("-");
    const removedCompatibilityFolder = ["legacy", "storage"].join("-");
    expect(combinedMediaSource).not.toContain(obsoleteStorageFolder);
    expect(combinedMediaSource).not.toContain(removedCompatibilityFolder);
    expect(homeSource).toContain("sizes={PRODUCT_THUMBNAIL_SIZES}");
    expect(homeSource).toContain('loading="lazy"');
    expect(homeSource).toContain('decoding="async"');
    expect(homeSource).toContain('alt="Eby’s Place story portrait"');
    expect(homeSource).toContain("ABOUT_PORTRAIT_FALLBACK_SRC");
    expect(homeSource).toContain("onError={event => {");
    expect(servicesSource).toContain('loading="lazy"\n                        decoding="async"');
    expect(gallerySource).toContain('loading="lazy" decoding="async"');
    expect(gallerySource).toContain('loading="eager" decoding="async"');
  });

  it("applies live-site brand typography and luxury palette tokens with readable navigation contrast", () => {
    expect(indexSource).toContain("family=Lexend");
    expect(indexSource).toContain("family=Playfair+Display");
    expect(cssSource).toContain("font-family: 'Lexend', 'Montserrat', system-ui, sans-serif");
    expect(cssSource).toContain("font-family: 'Playfair Display', Georgia, serif");
    expect(cssSource).toContain(".luxury-shell { min-height: 100vh; width: 100%; max-width: 100vw; background: var(--color-background); color: var(--color-foreground); }");
    expect(homeSource).toContain("bg-[#f5ead7]/92");
    expect(homeSource).toContain("rgba(247,238,222,.72)");
    expect(cssSource).toContain("text-[#2a1a0b]/82");
    expect(homeSource).toContain("text-white sm:text-lg");
    expect(cssSource).not.toContain(".section-pad .text-white\\/65");
    expect(cssSource).toContain(".lux-card .text-white\\/65");
  });

  it("renders the homepage Shop preview heading in the requested Signature menu format", () => {
    expect(homeSource).toContain('<ShoppingBag className="mr-2 inline h-4 w-4" /> Shop preview');
    expect(homeSource).toContain('className="order-1 w-full text-left md:order-2 md:w-auto md:text-right"');
    expect(homeSource).toContain('className="serif mt-4 text-4xl font-bold leading-tight md:text-5xl"');
    expect(homeSource).toContain("Premium braid care and accessories");
    expect(homeSource).toContain('className="mt-10 grid gap-5 md:grid-cols-3"');
  });

  it("uses the requested three homepage card write-ups without changing the card structure", () => {
    expect(homeSource).toContain("No pain. No pulling. Just flawless braids.");
    expect(homeSource).toContain("Premium braiding designed to protect your scalp, last");
    expect(homeSource).toContain("Professional from booking to finish.");
    expect(homeSource).toContain("Clear services, simple deposits, customer reviews,");
    expect(homeSource).toContain("The future of braiding is here.");
    expect(homeSource).toContain("AI hairstyle previews, ecommerce, live content,");
    expect(homeSource.match(/lux-card/g)?.length).toBeGreaterThanOrEqual(3);
    expect(homeSource).not.toContain("Professional structure");
    expect(homeSource).not.toContain("Modern automation");
  });

  it("removes the standalone floating WhatsApp button, offering WhatsApp only as an Eby chat fallback, and removes the duplicate green homepage logo", () => {
    expect(appSource).not.toContain("function FloatingWhatsAppButton()");
    expect(appSource).not.toContain("<FloatingWhatsAppButton />");
    expect(chatAssistantSource).toContain("https://wa.me/447864585110?text=Hi%20Eby%27s%20Place%2C%20I%20would%20like%20to%20make%20an%20enquiry.");
    expect(chatAssistantSource).toContain("Message us on WhatsApp");
    expect(chatAssistantSource).toContain("message.isFallback");
    expect(homeSource).not.toContain("bg-[#25D366]");
    expect(homeSource).not.toContain("Chat with Eby’s Place on WhatsApp");
    expect(homeSource).toContain("Beauty in every strand");
    expect(homeSource.lastIndexOf("Beauty in every strand")).toBeGreaterThan(homeSource.indexOf("export function SiteFooter"));
    // The cinematic redesign also features the tagline once, strategically, in
    // the hero eyebrow — so it now appears exactly twice (hero + footer),
    // not once.
    expect(homeSource.split("Beauty in every strand").length - 1).toBe(2);
  });

  it("adds a backend-managed final About Us story section with an admin-controlled round portrait", () => {
    expect(homeSource).toContain("websiteSections.useQuery");
    expect(homeSource).toContain("about_us");
    expect(homeSource).toContain("Our Story");
    expect(homeSource).toContain("From Passion to Power");
    expect(homeSource).toContain("Eby’s Place round story portrait");
    expect(homeSource).toContain("rounded-full");
    expect(homeSource).toContain("portraitImageUrl");
    expect(homeSource).toContain("Eberechi Ogbo | Founder & Service Lead");
    expect(homeSource).toContain("aboutSection.portraitDescription ||");
    expect(homeSource).toContain("Eberechi Ogbo | Founder & Service Lead");
    expect(homeSource).toContain("mx-auto mt-4 max-w-[13rem] text-sm font-bold leading-6 text-[#5b3a12]");
    expect(homeSource).toContain("object-[center_18%]");
    expect(homeSource).not.toContain("low-tension styling");
    expect(homeSource).not.toContain("clean salon finish");
    expect(homeSource).not.toContain("hairline-first care");
    expect(homeSource).not.toContain("A short Eby’s Place story note can be edited from the admin dashboard.");
    expect(homeSource.indexOf("Join the Eby’s Place list.")).toBeLessThan(homeSource.lastIndexOf("From Passion to Power"));
    expect(homeSource).toContain("review-marquee-track");
    expect(adminSource).toContain("Eby’s Place Admin Dashboard");
    expect(adminSource).toContain("About Us content");
    expect(adminSource).toContain("Upload About Us round image");
    expect(adminSource).toContain("Description beneath round image");
    expect(adminSource).toContain("Eberechi Ogbo | Founder & Service Lead");
    expect(adminSource).toContain("uploadWebsiteSectionImage");
  });

  it("keeps only live testimonials and removes the extra admin-confidence heading space", () => {
    expect(homeSource).toContain("Loved, strand by strand.");
    expect(homeSource).toContain("review-marquee-track");
    expect(homeSource).toContain("review-marquee mt-10");
    expect(homeSource).not.toContain("Customer confidence, moderated by admin.");
  });

  it("brings attached customer reviews live without including owner replies", () => {
    [
      "Obi",
      "Claudia Grenlus",
      "Lauren Groves",
      "amy martlin",
      "Rafiatu Yussif",
      "Nazanin Aflakian",
      "Finlay Pettitt",
      "yaali",
      "Maliha Berridge",
      "Miracle Igboanugo",
      "Ivy O",
      "Lynda Francis",
      "Chiamaka Udebbia",
      "ebirim salvy",
      "Logos HQ",
      "Onuoha Christiana",
      "Kelly",
      "Isaac Fortune",
      "elizabethz okeke",
      "Nombulelo Choto",
      "Chigozie Gloria",
    ].forEach((customerName) => {
      expect(dbSource).toContain(`customerName: "${customerName}"`);
    });
    const reviewSeedBlock = dbSource.slice(
      dbSource.indexOf("const seedReviews = ["),
      dbSource.indexOf("const seedWebsiteSections = [")
    );
    expect(reviewSeedBlock).toContain('source: "google"');
    expect(dbSource).toContain("async function ensureSeedReviews");
    expect(dbSource).toContain('await runSeedStep("reviews", () => ensureSeedReviews(db));');
    expect(reviewSeedBlock).not.toContain("Thank you love for this beautiful review.");
    expect(reviewSeedBlock).not.toContain("Thank you so much, and we hope to see you again.");
    expect(reviewSeedBlock).not.toContain("You are always welcome to visit again");
  });

  it("keeps customer-facing notification and sign-in copy Eby’s Place branded without third-party platform wording", () => {
    const customerNotificationSources = [bookingSource, shopSource, reviewsSource, tryOnSource, loginDialogSource].join("\n");
    expect(customerNotificationSources).toContain("Eby’s Place");
    expect(bookingSource).toContain("Opening Eby's Place secure payment");
    expect(bookingSource).toContain("booking.customerNotification");
    expect(shopSource).toContain("result.customerNotification");
    expect(reviewsSource).toContain("result.customerNotification");
    expect(tryOnSource).toContain("result.customerNotification");
    expect(loginDialogSource).toContain("Please sign in securely to continue with Eby’s Place");
    expect(loginDialogSource).toContain("Continue securely");
    expect(customerNotificationSources).not.toContain(["Login with ", "Man", "us"].join(""));
    expect(customerNotificationSources).not.toContain(["Please login with ", "Man", "us"].join(""));
  });

  it("uses the official Eby’s Place logo assets for favicon, mobile shortcuts, and link previews", () => {
    expect(indexSource).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />');
    expect(indexSource).toContain('href="/favicon-32x32.png"');
    expect(indexSource).toContain('href="/favicon-16x16.png"');
    expect(indexSource).toContain('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"');
    expect(indexSource).toContain('<link rel="manifest" href="/site.webmanifest" />');
    expect(indexSource).toContain('property="og:image" content="https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-link-preview_6583844d-256f347d13.png"');
    expect(indexSource).toContain('name="twitter:image" content="https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-link-preview_6583844d-256f347d13.png"');
    expect(indexSource).toContain('property="og:image:alt" content="Eby’s Place official logo');
    expect(indexSource).toContain('"image": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace-link-preview_6583844d-256f347d13.png"');
    expect(indexSource).not.toContain('/ebysplace-logo_433432b1.png');

    const manifest = JSON.parse(manifestSource) as {
      name: string;
      short_name: string;
      icons: Array<{ src: string; sizes: string; purpose: string }>;
    };
    expect(manifest.name).toBe("Eby’s Place");
    expect(manifest.short_name).toBe("Eby’s Place");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/android-chrome-192x192.png", sizes: "192x192", purpose: "any maskable" }),
        expect.objectContaining({ src: "/android-chrome-512x512.png", sizes: "512x512", purpose: "any maskable" }),
      ])
    );
    [
      "client/public/favicon.ico",
      "client/public/favicon-16x16.png",
      "client/public/favicon-32x32.png",
      "client/public/apple-touch-icon.png",
      "client/public/android-chrome-192x192.png",
      "client/public/android-chrome-512x512.png",
    ].forEach((assetPath) => {
      expect(existsSync(resolve(process.cwd(), assetPath))).toBe(true);
    });
  });

  it("keeps AI Try-On pop-up message text black without changing the global toaster", () => {
    expect(tryOnSource).toContain("const aiTryOnToastClassNames");
    expect(tryOnSource).toContain('title: "!text-black"');
    expect(tryOnSource).toContain('description: "!text-black"');
    expect(tryOnSource.match(/classNames: aiTryOnToastClassNames/g)?.length).toBe(5);
    expect(tryOnSource).toContain('toast.success("Photo prepared for AI Try-On"');
    expect(tryOnSource).toContain('toast.success("AI Try-On preview generated"');
    expect(tryOnSource).toContain('toast.error("Photo could not be prepared"');
    expect(tryOnSource).toContain('toast.error("AI Try-On failed"');
  });

  it("supports gallery upload, direct camera capture, and preview before AI Try-On submission", () => {
    expect(tryOnSource).toContain("Photo Gallery");
    expect(tryOnSource).toContain("Choose an image from your phone photo library.");
    expect(tryOnSource).toContain("Take Photo");
    expect(tryOnSource).toContain('capture="user"');
    expect(tryOnSource).toContain("Desktop File Upload");
    expect(tryOnSource).toContain("Choose an image file from your computer.");
    expect(tryOnSource).toContain("On mobile, this opens your phone camera directly.");
    expect(tryOnSource).toContain("Step 1: use phone camera, photo gallery, or desktop file upload. Step 2: preview it below. Step 3: generate your hairstyle preview when you are happy with the image.");
    expect(tryOnSource).toContain("Your selected portrait will appear here for preview before submission.");
  });

  it("keeps the mobile sticky booking CTA text visibly high-contrast", () => {
    expect(appSource).toContain('className="mobile-sticky-booking fixed inset-x-0 bottom-0 z-[70] px-4 py-3 md:hidden"');
    expect(appSource).toContain('className="sticky-booking-cta-button flex min-h-12 w-full flex-col items-center justify-center rounded-full px-5 py-3 text-center text-base font-extrabold tracking-wide shadow-[0_14px_30px_rgba(17,17,17,.26)] transition"');
    expect(appSource).toContain('className="sticky-booking-cta-label">Book Now</span>');
    expect(appSource).toContain('className="sticky-booking-cta-accent">Secure £20 Deposit</span>');
    expect(cssSource).toContain(".mobile-sticky-booking .sticky-booking-cta-button");
    expect(cssSource).toContain("color: #C9A84C !important;");
    expect(cssSource).toContain(".mobile-sticky-booking .sticky-booking-cta-accent { line-height: 1.25; }");
    expect(cssSource).toContain("visibility: visible !important;");
  });

  it("adds footer policy links and scrolls routed pages to the top", () => {
    expect(homeSource).toContain("/policies/shopping");
    expect(homeSource).toContain("Shopping Policy");
    expect(homeSource).toContain("/policies/returns");
    expect(homeSource).toContain("Returns Policy");
    expect(appSource).toContain('afterRouteScroll(`${location}${window.location.hash || ""}`, 40)');
    expect(appSource).toContain("afterRouteScroll,");
    expect(appSource).toContain("navigateWithSmoothScroll,");
    expect(appSource).toContain('from "@/lib/smoothScroll";');
    expect(appSource).toContain("/policies/privacy");
    expect(appSource).toContain("/policies/shopping");
    expect(appSource).toContain("/policies/returns");
    expect(appSource).toContain("/policies/terms");
    expect(policiesSource).not.toContain("This page is a practical website policy summary and not a substitute for independent legal advice.");
    expect(policiesSource).toContain("Payment details are handled securely by our payment provider");
    expect(policiesSource).not.toContain("Payment details are handled securely by Stripe");
  });
});
