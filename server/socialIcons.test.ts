import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SOCIAL_ICONS } from "../shared/socialIcons";

describe("official social logos", () => {
  it("has the official mark for every network the site links to", () => {
    for (const k of ["instagram", "facebook", "threads", "tiktok", "whatsapp"] as const) expect(SOCIAL_ICONS[k].path.length).toBeGreaterThan(200);
  });
  it("no page uses a made-up letter chip or a generic icon for a social network any more", () => {
    const social = readFileSync("client/src/pages/crm/SocialPage.tsx", "utf8");
    expect(social).not.toMatch(/logo: "(IG|@|f|♪)"/);
    const home = readFileSync("client/src/pages/Home.tsx", "utf8");
    expect(home).not.toContain("AtSign");
    for (const f of ["client/src/pages/Newsletter.tsx", "client/src/pages/Reviews.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toContain("<Facebook ");
      expect(src).toContain('<SocialIcon brand="whatsapp"');
    }
  });
});
