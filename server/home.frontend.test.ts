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
  resolve(process.cwd(), "client/src/components/ManusDialog.tsx"),
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
    expect(homeSource).toContain("/manus-storage/top-header-logo-1000220440-cropped-transparent_777ea202.png");
    expect(homeSource.indexOf("HEADER_LOGO_SRC")).toBeLessThan(homeSource.indexOf('href="/booking"'));
  });

  it("uses the supplied stretched and blended clickable top logo while matching the lower logo colour", () => {
    expect(homeSource).toContain('href="/"');
    expect(homeSource).toContain("src={HEADER_LOGO_SRC}");
    expect(homeSource).toContain("h-20 w-[14rem] object-contain mix-blend-multiply sm:h-24 sm:w-[19rem] lg:h-20 lg:w-[16rem] xl:w-[18rem]");
    expect(homeSource).not.toContain("h-24 w-[16rem] object-contain mix-blend-multiply sm:h-28 sm:w-[22rem] lg:h-24 lg:w-[18rem] xl:w-[20rem]");
    expect(homeSource).not.toContain("h-52 w-auto object-contain drop-shadow-[0_10px_24px_rgba(112,78,28,.22)]");
    expect(homeSource).not.toContain("h-36 w-auto object-contain mix-blend-multiply drop-shadow-[0_12px_26px_rgba(112,78,28,.22)] sm:h-40");
    expect(homeSource).not.toContain("sm:h-56 lg:h-60");
    expect(homeSource).not.toContain("translate-y-8");
    expect(homeSource).toContain("h-[7.5rem] w-auto object-contain mix-blend-multiply drop-shadow-[0_12px_26px_rgba(112,78,28,.22)] sm:h-[8.5rem]");
    expect(homeSource).toContain("src={HEADER_LOGO_SRC}");
    expect(homeSource).toContain("alt=\"Eby’s Place\"");
    expect(homeSource).not.toContain("text-base font-extrabold uppercase tracking-[0.14em]");
    expect(homeSource).not.toContain("mt-1 max-w-[13rem]");
    expect(homeSource).not.toContain("<span className=\"text-2xl font-extrabold uppercase tracking-[0.14em] text-[#2a1a0b]\">");
    expect(homeSource).not.toContain("[filter:brightness(.55)_sepia(1)_saturate(1.35)]");
  });

  it("applies a lighter landing treatment with readable navigation contrast", () => {
    expect(homeSource).toContain("bg-[#f5ead7]/92");
    expect(homeSource).toContain("rgba(247,238,222,.72)");
    expect(cssSource).toContain("text-[#2a1a0b]/82");
    expect(homeSource).toContain("text-white sm:text-lg");
  });

  it("uses the requested three homepage card write-ups without changing the card structure", () => {
    expect(homeSource).toContain("No pain. No pulling. Just flawless braids.");
    expect(homeSource).toContain("Premium braiding designed to protect your scalp, last beautifully,");
    expect(homeSource).toContain("Professional from booking to finish.");
    expect(homeSource).toContain("Clear services, simple deposits, customer reviews, gallery updates,");
    expect(homeSource).toContain("The future of braiding is here.");
    expect(homeSource).toContain("AI hairstyle previews, ecommerce, live content, customer reviews,");
    expect(homeSource.match(/className=\"lux-card\"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(homeSource).not.toContain("Professional structure");
    expect(homeSource).not.toContain("Modern automation");
  });

  it("adds the requested WhatsApp shortcut and moves the beauty slogan to the footer", () => {
    expect(homeSource).toContain('href="https://wa.me/447864585110"');
    expect(homeSource).toContain("Chat with Eby’s Place on WhatsApp");
    expect(homeSource).toContain("MessageCircle");
    expect(homeSource).toContain("bg-[#25D366]");
    expect(homeSource).toContain("Beauty in every strand");
    expect(homeSource.lastIndexOf("Beauty in every strand")).toBeGreaterThan(homeSource.indexOf("export function SiteFooter"));
    expect(homeSource.indexOf("Beauty in every strand")).toBe(homeSource.lastIndexOf("Beauty in every strand"));
  });

  it("adds a backend-managed final About Us story section with an admin-controlled round portrait", () => {
    expect(homeSource).toContain("websiteSections.useQuery");
    expect(homeSource).toContain("about_us");
    expect(homeSource).toContain("Our Story");
    expect(homeSource).toContain("From Passion to Power");
    expect(homeSource).toContain("Eby’s Place round story portrait");
    expect(homeSource).toContain("rounded-full");
    expect(homeSource).toContain("portraitImageUrl");
    expect(homeSource).toContain("portraitDescription");
    expect(homeSource.indexOf("Join the Eby’s Place list.")).toBeLessThan(homeSource.lastIndexOf("From Passion to Power"));
    expect(homeSource).toContain("review-marquee-track");
    expect(adminSource).toContain("Eby’s Place Admin Dashboard");
    expect(adminSource).toContain("About Us content");
    expect(adminSource).toContain("Upload About Us round image");
    expect(adminSource).toContain("Description beneath round image");
    expect(adminSource).toContain("uploadWebsiteSectionImage");
  });

  it("keeps only live testimonials and removes the extra admin-confidence heading space", () => {
    expect(homeSource).toContain("Live testimonials");
    expect(homeSource).toContain("review-marquee-track");
    expect(homeSource).toContain("review-marquee mt-5");
    expect(homeSource).toContain("py-8 overflow-hidden bg-[#efe0c7]/78 text-[#24170d] md:py-10");
    expect(homeSource).not.toContain("Customer confidence, moderated by admin.");
    expect(homeSource).not.toContain("review-marquee mt-10");
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
    expect(dbSource).toContain("await ensureSeedReviews(db);");
    expect(reviewSeedBlock).not.toContain("Thank you love for this beautiful review.");
    expect(reviewSeedBlock).not.toContain("Thank you so much, and we hope to see you again.");
    expect(reviewSeedBlock).not.toContain("You are always welcome to visit again");
  });

  it("keeps customer-facing notification and sign-in copy Eby’s Place branded without Manus wording", () => {
    const customerNotificationSources = [bookingSource, shopSource, reviewsSource, tryOnSource, loginDialogSource].join("\n");
    expect(customerNotificationSources).toContain("Eby’s Place");
    expect(bookingSource).toContain("Opening Eby’s Place secure checkout");
    expect(bookingSource).toContain("booking.customerNotification");
    expect(shopSource).toContain("result.customerNotification");
    expect(reviewsSource).toContain("result.customerNotification");
    expect(tryOnSource).toContain("result.customerNotification");
    expect(loginDialogSource).toContain("Please sign in securely to continue with Eby’s Place");
    expect(loginDialogSource).toContain("Continue securely");
    expect(customerNotificationSources).not.toContain("Login with Manus");
    expect(customerNotificationSources).not.toContain("Please login with Manus");
  });

  it("uses the official Eby’s Place logo assets for favicon, mobile shortcuts, and link previews", () => {
    expect(indexSource).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />');
    expect(indexSource).toContain('href="/favicon-32x32.png"');
    expect(indexSource).toContain('href="/favicon-16x16.png"');
    expect(indexSource).toContain('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"');
    expect(indexSource).toContain('<link rel="manifest" href="/site.webmanifest" />');
    expect(indexSource).toContain('property="og:image" content="/manus-storage/ebysplace-link-preview_6583844d.png"');
    expect(indexSource).toContain('name="twitter:image" content="/manus-storage/ebysplace-link-preview_6583844d.png"');
    expect(indexSource).toContain('property="og:image:alt" content="Eby’s Place official logo');
    expect(indexSource).toContain('"image": "/manus-storage/ebysplace-link-preview_6583844d.png"');
    expect(indexSource).not.toContain('/manus-storage/ebysplace-logo_433432b1.png');

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
    expect(tryOnSource.match(/classNames: aiTryOnToastClassNames/g)?.length).toBe(4);
    expect(tryOnSource).toContain('toast.success("Photo prepared for AI Try-On"');
    expect(tryOnSource).toContain('toast.success("AI Try-On preview generated"');
    expect(tryOnSource).toContain('toast.error("Photo could not be prepared"');
    expect(tryOnSource).toContain('toast.error("AI Try-On failed"');
  });

  it("adds footer policy links and scrolls routed pages to the top", () => {
    expect(homeSource).toContain("/policies/shopping");
    expect(homeSource).toContain("Shopping Policy");
    expect(homeSource).toContain("/policies/returns");
    expect(homeSource).toContain("Returns Policy");
    expect(appSource).toContain("window.scrollTo({ top: 0, left: 0, behavior: \"auto\" })");
    expect(appSource).toContain("/policies/privacy");
    expect(appSource).toContain("/policies/shopping");
    expect(appSource).toContain("/policies/returns");
    expect(appSource).toContain("/policies/terms");
    expect(policiesSource).not.toContain("This page is a practical website policy summary and not a substitute for independent legal advice.");
    expect(policiesSource).toContain("Payment details are handled securely by Stripe");
  });
});
