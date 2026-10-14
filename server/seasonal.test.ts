import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { easterSunday, isSnowActive, resolveSeasonalTheme, winterKey } from "../shared/seasonal";
import { detectFirstSnowInEngland, SNOW_THRESHOLD_CM } from "./seasonalTheme";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("seasonal theme calendar (England)", () => {
  it("computes Western Easter Sunday", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2028)).toBe("2028-04-16");
  });

  it("shows autumn leaves from 1 Sep and nothing in spring/summer", () => {
    expect(resolveSeasonalTheme("2026-08-31", null)).toBe("none");
    expect(resolveSeasonalTheme("2026-09-01", null)).toBe("autumn");
    expect(resolveSeasonalTheme("2026-11-30", null)).toBe("autumn");
    expect(resolveSeasonalTheme("2027-06-15", null)).toBe("none");
  });

  it("starts snow on the first real snow day in England, replacing the leaves", () => {
    expect(resolveSeasonalTheme("2026-11-17", "2026-11-18")).toBe("autumn");
    expect(resolveSeasonalTheme("2026-11-18", "2026-11-18")).toBe("winter");
    expect(resolveSeasonalTheme("2026-11-29", "2026-11-18")).toBe("winter");
  });

  it("keeps Christmas all December, with snow only once it has snowed (or from 27 Dec)", () => {
    expect(resolveSeasonalTheme("2026-12-05", null)).toBe("christmas");
    expect(resolveSeasonalTheme("2026-12-05", "2026-12-03")).toBe("christmassnow");
    expect(resolveSeasonalTheme("2026-12-26", null)).toBe("christmas");
    expect(resolveSeasonalTheme("2026-12-27", null)).toBe("christmassnow");
    expect(resolveSeasonalTheme("2026-12-31", null)).toBe("christmassnow");
  });

  it("keeps snow alone through January and February, ending 1 Mar", () => {
    expect(resolveSeasonalTheme("2027-01-10", null)).toBe("winter");
    expect(resolveSeasonalTheme("2027-02-07", null)).toBe("winter");
    expect(resolveSeasonalTheme("2027-03-15", null)).toBe("none");
    expect(isSnowActive("2027-03-01", null)).toBe(false);
  });

  it("shows festival designs with nothing falling, overriding the season", () => {
    expect(resolveSeasonalTheme("2027-02-08", null)).toBe("ramadan");
    expect(resolveSeasonalTheme("2027-03-08", null)).toBe("ramadan");
    expect(resolveSeasonalTheme("2027-03-09", null)).toBe("eid");
    expect(resolveSeasonalTheme("2027-03-11", null)).toBe("eid");
    expect(resolveSeasonalTheme("2027-03-12", null)).toBe("none");
    expect(resolveSeasonalTheme("2027-03-26", null)).toBe("easter");
    expect(resolveSeasonalTheme("2027-03-29", null)).toBe("easter");
    expect(resolveSeasonalTheme("2027-03-30", null)).toBe("none");
    expect(resolveSeasonalTheme("2027-05-16", null)).toBe("eid");
  });

  it("groups Oct–Feb into one winter", () => {
    expect(winterKey("2026-10-01")).toBe(2026);
    expect(winterKey("2027-02-28")).toBe(2026);
    expect(winterKey("2027-03-01")).toBeNull();
  });
});

describe("first snow detection across England", () => {
  const fakeFetch = (places: { time: string[]; snowfall_sum: number[] }[]) =>
    (async () => ({ ok: true, status: 200, json: async () => places.map((daily) => ({ daily })) })) as unknown as typeof fetch;

  it("returns the earliest day at any location at or above the threshold", async () => {
    const first = await detectFirstSnowInEngland(2026, fakeFetch([
      { time: ["2026-09-30", "2026-10-20", "2026-10-21"], snowfall_sum: [3, 0, 1.4] },
      { time: ["2026-10-20", "2026-10-21"], snowfall_sum: [0.6, 0] },
    ]), "2026-10-25");
    expect(first).toBe("2026-10-20");
  });

  it("ignores trace amounts and snow before 1 Oct", async () => {
    const first = await detectFirstSnowInEngland(2026, fakeFetch([
      { time: ["2026-09-28", "2026-10-05"], snowfall_sum: [5, SNOW_THRESHOLD_CM / 2] },
    ]), "2026-10-25");
    expect(first).toBeNull();
  });
});

describe("seasonal designs wiring", () => {
  const home = readSource("client/src/pages/Home.tsx");
  const effects = readSource("client/src/components/SeasonalEffects.tsx");
  const css = readSource("client/src/index.css");

  it("puts the falling layer, tint, lanterns and greeting in the hero and the logo touch in the header", () => {
    expect(home).toContain("<SeasonalFall theme={seasonalTheme} />");
    expect(home).toContain("<SeasonalTint theme={seasonalTheme} />");
    expect(home).toContain("<SeasonalLanterns theme={seasonalTheme} />");
    expect(home).toContain("<SeasonalLogoDecoration theme={seasonalTheme} />");
    expect(home).toContain("seasonalGreeting(seasonalTheme) ??");
  });

  it("only lets leaves or snow fall, never on other festivals", () => {
    expect(effects).toContain('theme === "autumn" ? "leaves" : theme === "winter" || theme === "christmassnow" ? "snow" : null');
  });

  it("never blocks taps and pauses for reduced motion", () => {
    expect(css).toMatch(/\.seasonal-fall \{[^}]*pointer-events: none/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .seasonal-particle, .seasonal-sway, .seasonal-lantern { animation-play-state: paused; } }");
  });
});
