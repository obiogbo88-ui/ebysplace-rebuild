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
  it("keeps the hero photo free of the duplicated logo overlay", () => {
    expect(homeSource).not.toContain("Eby’s Place luxury pain-free braiding");
    expect(homeSource).toContain("Zero pain. Zero trauma. Just perfection.");
  });

  it("uses broader readable logo treatments in the header and footer", () => {
    expect(homeSource).toContain("sm:h-20");
    expect(homeSource).toContain("sm:h-32");
    expect(homeSource).toContain("Eby’s Place");
    expect(homeSource).toContain("mt-1 max-w-[13rem]");
    expect(homeSource).toContain("[filter:brightness(.55)_sepia(1)_saturate(1.35)]");
  });

  it("applies a lighter landing treatment with readable navigation contrast", () => {
    expect(homeSource).toContain("bg-[#f5ead7]/92");
    expect(homeSource).toContain("rgba(247,238,222,.72)");
    expect(cssSource).toContain("text-[#2a1a0b]/82");
    expect(homeSource).toContain("text-white sm:text-lg");
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
    expect(policiesSource).toContain("This page is a practical website policy summary and not a substitute for independent legal advice.");
    expect(policiesSource).toContain("Payment details are handled securely by Stripe");
  });
});
