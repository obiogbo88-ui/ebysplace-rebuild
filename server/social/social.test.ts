import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("./store", () => ({
  savePublishResult: vi.fn(async () => undefined),
  requireDb: vi.fn(),
  getPost: vi.fn(),
  claimPost: vi.fn(),
  getToken: vi.fn(),
  saveToken: vi.fn(),
  insertPost: vi.fn(),
  recentSourceRefs: vi.fn(),
  recentWriting: vi.fn(),
}));

import jpegJs from "jpeg-js";
import { addDays, captionFor, captionProblem, clip, ensureBookingToken, ensureFollowLine, formatPrice, kindFor, londonDate, styleSourceFor, weekdayIndex } from "./content";
import { splitAccent, renderSlide } from "./renderer";
import { publishFacebookFeed, publishInstagramFeed } from "./graph";
import { publishPost } from "./cron";
import type { SocialPost } from "./store";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("weekly plan", () => {
  it("follows the approved rotation", () => {
    // 2026-11-02 is a Monday
    expect(weekdayIndex("2026-11-02")).toBe(0);
    const week = Array.from({ length: 7 }, (_, i) => addDays("2026-11-02", i));
    expect(week.map((d) => kindFor(d, "am"))).toEqual(["motivation", "article", "motivation", "article", "style", "motivation", "article"]);
    expect(week.map((d) => kindFor(d, "pm"))).toEqual(["style", "inspiration", "style", "inspiration", "style", "style", "inspiration"]);
  });

  it("only Friday's style posts use a priced service; the rest use Eby's gallery", () => {
    expect(styleSourceFor("2026-11-06")).toBe("service");
    expect(styleSourceFor("2026-11-02")).toBe("gallery");
    expect(styleSourceFor("2026-11-07")).toBe("gallery");
  });

  it("uses the UK date, including around the clock change", () => {
    expect(londonDate(new Date("2026-11-02T23:30:00Z"))).toBe("2026-11-02");
    expect(londonDate(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("card text", () => {
  it("clips at a word boundary", () => {
    expect(clip("Short line", 40)).toBe("Short line");
    expect(clip("Five ways to make your braids last much longer than before", 30)).toBe("Five ways to make your braids…");
  });

  it("highlights the accent words wherever they sit", () => {
    expect(splitAccent("Start before you feel ready. Confidence grows on the way.", "confidence")).toEqual(["Start before you feel ready. ", "Confidence", " grows on the way."]);
    expect(splitAccent("No accent here", "missing")).toEqual(["No accent here", "", ""]);
  });

  it("formats live prices without inventing any", () => {
    expect(formatPrice("80.00")).toBe("£80");
    expect(formatPrice("62.50")).toBe("£62.50");
    expect(formatPrice("0")).toBeNull();
  });
});

describe("captions", () => {
  it("adds the booking line before the hashtags if the writer forgot it", () => {
    expect(ensureBookingToken("Lovely braids.\n\n#EbysPlace #Bridgwater")).toBe("Lovely braids.\n\nBook at {BOOKING}\n\n#EbysPlace #Bridgwater");
    expect(ensureBookingToken("Book at {BOOKING}")).toBe("Book at {BOOKING}");
  });

  it("uses 'link in bio' on Instagram and the real link on Facebook", () => {
    expect(captionFor("instagram", "Book at {BOOKING}")).toBe("Book at ebysplace.com (link in bio)");
    expect(captionFor("facebook", "Book at {BOOKING}")).toBe("Book at https://www.ebysplace.com/booking");
  });

  it("rejects placeholder captions like the 'x' that went out on 2026-11-03", () => {
    expect(captionProblem("x\n\n{FOLLOW} for more styles and braid care tips.\n\nBook at {BOOKING}")).toMatch(/too short/);
    const real =
      "Your braids can last weeks longer with five small habits.\n\nSatin at night, light oil on the scalp, and hands off the edges. Save this for wash day.\n\nWhich one do you skip?\n\n{FOLLOW} for more.\n\nBook at {BOOKING}\n\n#EbysPlace #Bridgwater";
    expect(captionProblem(real)).toBeNull();
  });

  it("always carries a follow line, before the booking line", () => {
    expect(ensureFollowLine("Hook.\n\nBook at {BOOKING}\n\n#EbysPlace")).toBe("Hook.\n\n{FOLLOW} for more styles and braid care tips.\n\nBook at {BOOKING}\n\n#EbysPlace");
    expect(ensureFollowLine("{FOLLOW} for more.\n\nBook at {BOOKING}")).toBe("{FOLLOW} for more.\n\nBook at {BOOKING}");
    expect(captionFor("instagram", "{FOLLOW} for more")).toBe("Follow @ebysplace1 for more");
    expect(captionFor("facebook", "{FOLLOW} for more")).toBe("Follow Eby's Place for more");
  });
});

describe("renderer", () => {
  it("renders a motivation card to a 1080x1350 JPEG", async () => {
    const jpg = await renderSlide({ layout: "motivation", eyebrow: "Monday motivation", quote: "Start before you feel ready.", accent: "ready", supporting: "Your next chapter can start today.", number: 1 });
    expect(jpg[0]).toBe(0xff);
    expect(jpg[1]).toBe(0xd8);
    // SOF0 marker holds height then width
    const sof = jpg.indexOf(Buffer.from([0xff, 0xc0]));
    expect(jpg.readUInt16BE(sof + 5)).toBe(1350);
    expect(jpg.readUInt16BE(sof + 7)).toBe(1080);
  }, 30_000);

  it("renders the scroll-stopper layouts (photo hook, this-or-that, article cover)", async () => {
    const photo = Buffer.from(jpegJs.encode({ data: Buffer.alloc(40 * 50 * 4, 128), width: 40, height: 50 }, 80).data);
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => (String(url).startsWith("https://img.test/") ? new Response(photo) : realFetch(url, init))));
    const slides = [
      { layout: "photo_hook", photoUrl: "https://img.test/a.jpg", tag: "Done at Eby's Place", headline: "Guess how long this took?", accent: "this took?", cta: "Answer in the caption" },
      { layout: "this_or_that", photoUrls: ["https://img.test/1.jpg", "https://img.test/2.jpg"], labels: ["Boho knotless", "Goddess locs"], headline: "Which one are you booking next?", accent: "booking next?" },
      { layout: "article_cover", photoUrl: "https://img.test/c.jpg", title: "3 habits that make your braids frizz in week one", accent: "frizz in week one", tag: "Stop doing this", total: 4 },
    ] as const;
    for (const slide of slides) {
      const jpg = await renderSlide(slide as any);
      const sof = jpg.indexOf(Buffer.from([0xff, 0xc0]));
      expect(jpg.readUInt16BE(sof + 5)).toBe(1350);
      expect(jpg.readUInt16BE(sof + 7)).toBe(1080);
    }
  }, 60_000);
});

function graphStub(responses: Array<Record<string, unknown>>) {
  const calls: Array<{ url: string; body: string }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? String(init.body) : "" });
      const next = responses.shift() ?? { id: "x" };
      return new Response(JSON.stringify(next), { status: "error" in next ? 400 : 200 });
    }),
  );
  return calls;
}

describe("Instagram client", () => {
  it("publishes a carousel: one child per slide, then the carousel, then publish", async () => {
    const calls = graphStub([{ id: "c1" }, { status_code: "FINISHED" }, { id: "c2" }, { status_code: "FINISHED" }, { id: "car" }, { status_code: "FINISHED" }, { id: "media1" }]);
    const id = await publishInstagramFeed({ userId: "42", accessToken: "t" }, ["https://a/1.jpg", "https://a/2.jpg"], "Hello", false);
    expect(id).toBe("media1");
    expect(calls[0].body).toContain("is_carousel_item=true");
    expect(calls[4].body).toContain("media_type=CAROUSEL");
    expect(calls[4].body).toContain("children=c1%2Cc2");
    expect(calls[6].url).toContain("/42/media_publish");
  });

  it("retries without the AI flag if Instagram rejects it on a photo", async () => {
    const calls = graphStub([{ error: { message: "Invalid parameter is_ai_generated", code: 100 } }, { id: "c1" }, { status_code: "FINISHED" }, { id: "m" }]);
    await publishInstagramFeed({ userId: "42", accessToken: "t" }, ["https://a/1.jpg"], "Hi", true);
    expect(calls[0].body).toContain("is_ai_generated=true");
    expect(calls[1].body).not.toContain("is_ai_generated");
  });
});

describe("Instagram host", () => {
  it("sends Unified-login (EAA) tokens to graph.facebook.com and Instagram-login (IGAA) tokens to graph.instagram.com", async () => {
    let calls = graphStub([{ id: "c1" }, { status_code: "FINISHED" }, { id: "m" }]);
    await publishInstagramFeed({ userId: "42", accessToken: "EAANtest" }, ["https://a/1.jpg"], "Hi", false);
    expect(calls.every((c) => c.url.startsWith("https://graph.facebook.com/"))).toBe(true);
    vi.unstubAllGlobals();
    calls = graphStub([{ id: "c1" }, { status_code: "FINISHED" }, { id: "m" }]);
    await publishInstagramFeed({ userId: "42", accessToken: "IGAAtest" }, ["https://a/1.jpg"], "Hi", false);
    expect(calls.every((c) => c.url.startsWith("https://graph.instagram.com/"))).toBe(true);
  });
});

describe("Facebook client", () => {
  it("attaches every carousel slide to one Page post", async () => {
    const calls = graphStub([{ id: "p1" }, { id: "p2" }, { id: "post9" }]);
    const id = await publishFacebookFeed({ pageId: "77", pageAccessToken: "t" }, ["https://a/1.jpg", "https://a/2.jpg"], "Hi");
    expect(id).toBe("post9");
    expect(calls[0].body).toContain("published=false");
    expect(decodeURIComponent(calls[2].body)).toContain('attached_media[1]={"media_fbid":"p2"}');
  });
});

describe("publishPost", () => {
  const base: SocialPost = {
    id: 1, slotDate: "2026-11-03", slot: "am", kind: "motivation", sourceRef: null, isAiGenerated: false,
    slides: [], caption: "Book at {BOOKING}", imageUrls: ["https://a/1.jpg"], storyUrl: null, status: "publishing",
    igMediaId: null, igStoryId: null, fbPostId: null, fbStoryId: null, error: null, attempts: 1,
  };

  it("never re-posts a platform that already succeeded", async () => {
    const calls = graphStub([{ id: "fbpost" }]);
    const result = await publishPost({ ...base, igMediaId: "already" }, { userId: "42", accessToken: "t" }, { pageId: "77", pageAccessToken: "t" });
    expect(result.igMediaId).toBe("already");
    expect(result.fbPostId).toBe("fbpost");
    expect(result.status).toBe("posted");
    expect(calls.every((c) => !c.url.includes("graph.instagram.com"))).toBe(true);
  });

  it("posts a Reel (video with music) when the post has one", async () => {
    const calls = graphStub([{ id: "reel1" }, { status_code: "FINISHED" }, { id: "media9" }]);
    const result = await publishPost({ ...base, reelUrl: "https://a/reel.mp4" } as SocialPost, { userId: "42", accessToken: "t" }, null);
    expect(result.igMediaId).toBe("media9");
    expect(calls[0].body).toContain("media_type=REELS");
    expect(calls[0].body).toContain("video_url=https%3A%2F%2Fa%2Freel.mp4");
    expect(calls[0].body).toContain("share_to_feed=true");
  });

  it("marks a half-finished post partial so the next run finishes it", async () => {
    graphStub([{ error: { message: "Session has expired", code: 190 } }, { id: "fbpost" }]);
    const result = await publishPost(base, { userId: "42", accessToken: "t" }, { pageId: "77", pageAccessToken: "t" });
    expect(result.status).toBe("partial");
    expect(result.error).toContain("Instagram post");
  });
});

describe("wiring", () => {
  it("schedules prepare and both publish runs", () => {
    const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons.map((c: { path: string }) => c.path);
    expect(crons).toEqual(expect.arrayContaining(["/api/cron/social-prepare", "/api/cron/social-publish-am", "/api/cron/social-publish-pm"]));
  });
});
