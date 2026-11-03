import { describe, expect, it } from "vitest";
import jpegJs from "jpeg-js";
import { readFileSync } from "node:fs";
import { KOUVIA_CAPTIONS, KOUVIA_VARIANTS } from "./kouviaDesigns";
import { captionFor, captionProblem, kindFor } from "./content";
import { renderSlide } from "./renderer";
import { reelTimings } from "./reel";

describe("Kouvia Booking posts", () => {
  it("go out once a week, Wednesday at 20:00", () => {
    const week = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 10, 2 + i, 12)).toISOString().slice(0, 10));
    const slots = week.flatMap((d) => (["am", "md", "pm"] as const).map((s) => `${d} ${s} ${kindFor(d, s)}`)).filter((x) => x.endsWith("kouvia"));
    expect(slots).toEqual(["2026-11-04 pm kouvia"]);
  });

  it("captions say Kouvia is powered by Eby's Place, carry the follow line and pass the caption guard", () => {
    for (const v of KOUVIA_VARIANTS) {
      const c = KOUVIA_CAPTIONS[v];
      expect(c).toContain("Kouvia Booking is powered by Eby's Place.");
      expect(captionProblem(c)).toBeNull();
      const ig = captionFor("instagram", c);
      expect(ig).toContain("Follow @ebysplace1 for more tips for braiders.");
      expect(ig).not.toMatch(/\{(FOLLOW|BOOKING)\}/);
      expect(c).toMatch(/kouviabooking\.ebysplace\.com/);
      // facts stay as on the Kouvia site: never promise anything beyond these
      expect(c).not.toMatch(/forever|guarantee|unlimited/i);
    }
  });

  it("renders the four feed cards at 1080x1350 and the story card at 1080x1920", async () => {
    for (const variant of KOUVIA_VARIANTS) {
      const img = jpegJs.decode(await renderSlide({ layout: "kouvia", variant }));
      expect([img.width, img.height]).toEqual([1080, 1350]);
    }
    const story = jpegJs.decode(await renderSlide({ layout: "kouvia_story" }));
    expect([story.width, story.height]).toEqual([1080, 1920]);
  }, 60_000);

  it("Reels show the story card before the logo end card", () => {
    expect(reelTimings(1, 1).total).toBe(7 + 3.5 + 3);
    const reel = readFileSync("server/social/reel.ts", "utf8");
    expect(reel).toMatch(/fullCards\.map[\s\S]*endCardJpeg, secs: END_CARD_SECONDS/);
  });

  it("lets the database accept the new kind", () => {
    const store = readFileSync("server/social/store.ts", "utf8");
    expect(store).toContain("('motivation','style','inspiration','article','kouvia')");
  });
});
