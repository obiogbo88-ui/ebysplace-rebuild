import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

  it("removes the hero write-up and places EBYSPLACE between the top logo and mobile Book button", () => {
    expect(homeSource).not.toContain('data-home-top-writeup="ebys-place"');
    expect(homeSource).not.toContain("Eby’s Place brings luxury pain-free braiding, protective styling,");
    expect(homeSource).toContain('data-header-center-wordmark="ebysplace"');
    expect(homeSource).toContain("EBYSPLACE");
    expect(homeSource.indexOf('data-header-center-wordmark="ebysplace"')).toBeGreaterThan(homeSource.indexOf('aria-label="Eby’s Place home"'));
    expect(homeSource.indexOf('data-header-center-wordmark="ebysplace"')).toBeLessThan(homeSource.indexOf('href="/booking"'));
  });

  it("uses enlarged clickable logo-only branding in the requested header and footer areas", () => {
    expect(homeSource).toContain('href="/"');
    expect(homeSource).toContain("h-28 w-auto");
    expect(homeSource).toContain("sm:h-32");
    expect(homeSource).toContain("lg:h-36");
    expect(homeSource).toContain("h-36 w-auto");
    expect(homeSource).toContain("sm:h-40");
    expect(homeSource).toContain("alt=\"Eby’s Place\"");
    expect(homeSource).not.toContain("text-base font-extrabold uppercase tracking-[0.14em]");
    expect(homeSource).not.toContain("mt-1 max-w-[13rem]");
    expect(homeSource).not.toContain("<span className=\"text-2xl font-extrabold uppercase tracking-[0.14em] text-[#2a1a0b]\">");
    expect(homeSource).toContain("[filter:brightness(.55)_sepia(1)_saturate(1.35)]");
  });

  it("applies a lighter landing treatment with readable navigation contrast", () => {
    expect(homeSource).toContain("bg-[#f5ead7]/92");
    expect(homeSource).toContain("rgba(247,238,222,.72)");
    expect(cssSource).toContain("text-[#2a1a0b]/82");
    expect(homeSource).toContain("text-white sm:text-lg");
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

  it("adds a backend-managed final About Us story section with a small side CEO portrait", () => {
    expect(homeSource).toContain("websiteSections.useQuery");
    expect(homeSource).toContain("about_us");
    expect(homeSource).toContain("From Passion to Power");
    expect(homeSource).toContain("Eby’s Place CEO portrait");
    expect(homeSource).toContain("lg:grid-cols-[minmax(0,1fr)_13rem]");
    expect(homeSource.indexOf("Join the Eby’s Place list.")).toBeLessThan(homeSource.lastIndexOf("From Passion to Power"));
    expect(homeSource).toContain("review-marquee-track");
    expect(adminSource).toContain("Upload About Us CEO image");
    expect(adminSource).toContain("uploadWebsiteSectionImage");
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
