import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import { BRAND, LOGO_ASPECT, loadFonts, logoDataUri, type SatoriFont } from "./kit";

/**
 * Renders the approved post designs (Design canvas 8qEtm6herDoyhmAYE2WBqD)
 * to JPEG. Instagram's Content Publishing API only accepts JPEG for photos,
 * so every slide goes satori (layout to SVG) -> resvg (SVG to pixels) ->
 * jpeg-js. The designs were drawn at 540x675; everything here is that
 * layout at 2x (1080x1350 feed, 1080x1920 story).
 */

export const FEED = { width: 1080, height: 1350 } as const;
export const STORY = { width: 1080, height: 1920 } as const;

/** `hook` is the gold pill at the top ("Read this before you scroll"); older rows only have `eyebrow`. */
export type MotivationSlide = { layout: "motivation"; eyebrow: string; hook?: string; quote: string; accent?: string; supporting: string; number?: number };
export type PhotoSlide = {
  layout: "photo";
  theme: "light" | "dark";
  photoUrl: string;
  tag: string; // "Done at Eby's Place" | "Style inspiration"
  eyebrow: string;
  title: string;
  meta: string;
};
/** Full-bleed photo with a question headline over it (board 6, "Guess how long this took?"). */
export type PhotoHookSlide = {
  layout: "photo_hook";
  photoUrl: string;
  tag: string; // "Done at Eby's Place" | "Book this look"
  headline: string;
  accent?: string;
  cta: string; // e.g. "Answer in the caption"
  meta?: string;
};
/** Two AI inspiration images side by side, numbered 1 and 2 (board 7). */
export type ThisOrThatSlide = { layout: "this_or_that"; photoUrls: [string, string]; labels: [string, string]; headline: string; accent?: string };
export type ArticleCoverSlide = { layout: "article_cover"; photoUrl: string; title: string; accent?: string; tag?: string; total: number };
export type ArticleTipSlide = { layout: "article_tip"; index: number; total: number; title: string; body: string };
export type Slide = MotivationSlide | PhotoSlide | PhotoHookSlide | ThisOrThatSlide | ArticleCoverSlide | ArticleTipSlide;

/** Every card carries this (user request 2026-11-03: "follow us for more" on every post). */
export const FOLLOW_LINE = `Follow ${BRAND.instagramHandle} for more`;

type El = { type: string; props: Record<string, unknown> };
type Child = El | string | null | undefined | false;

function h(type: string, style: Record<string, unknown>, ...children: Child[]): El {
  const kids = children.filter((c): c is El | string => Boolean(c));
  return { type, props: { style, children: kids.length === 1 ? kids[0] : kids } };
}

function img(src: string, style: Record<string, unknown>): El {
  return { type: "img", props: { src, style } };
}

/**
 * satori sizes a padded root as content-box, so padding pushed content past
 * the right/bottom edge. Every card is a fixed-size root with an absolutely
 * inset content column instead.
 */
function frame(size: { width: number; height: number }, background: string, inset: [number, number, number, number], content: Record<string, unknown>, ...children: Child[]): El {
  const [top, right, bottom, left] = inset;
  return h(
    "div",
    { width: size.width, height: size.height, display: "flex", position: "relative", background, fontFamily: "Inter" },
    h("div", { position: "absolute", top, right, bottom, left, display: "flex", flexDirection: "column", ...content }, ...children),
  );
}

const S = 2; // design px -> output px
const px = (n: number) => n * S;

const LABEL = (color: string, size = 11, spacing = 3) => ({
  fontFamily: "Lexend",
  fontSize: px(size),
  letterSpacing: px(spacing),
  textTransform: "uppercase" as const,
  color,
});

/** Splits `text` around the first case-insensitive occurrence of `accent`. */
export function splitAccent(text: string, accent?: string): [string, string, string] {
  if (!accent) return [text, "", ""];
  const at = text.toLowerCase().indexOf(accent.toLowerCase());
  if (at < 0) return [text, "", ""];
  return [text.slice(0, at), text.slice(at, at + accent.length), text.slice(at + accent.length)];
}

function headline(text: string, accent: string | undefined, base: Record<string, unknown>, accentColor: string): El {
  const [before, mid, after] = splitAccent(text, accent);
  // satori lays inline runs out as flex-wrap rows; one span per word keeps wrapping natural.
  const words = (s: string, style: Record<string, unknown>) =>
    s.split(/(\s+)/).filter((w) => w.length > 0 && !/^\s+$/.test(w)).map((w) => h("span", { ...style, marginRight: "0.25em" }, w));
  return {
    type: "div",
    props: {
      style: { display: "flex", flexWrap: "wrap", ...base },
      children: [
        ...words(before, {}),
        ...words(mid, { fontStyle: "italic", fontWeight: 500, color: accentColor }),
        ...words(after, {}),
      ],
    },
  };
}

function icon(d: string, color: string, size = 20, extra: El[] = []): El {
  return {
    type: "svg",
    props: {
      width: px(size),
      height: px(size),
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [...extra, { type: "path", props: { d } }],
    },
  };
}

const bookmarkIcon = (color: string, size = 20) => icon("M6 3h12v18l-6-4-6 4z", color, size);
const followIcon = (color: string, size = 20) => icon("M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6", color, size, [{ type: "circle", props: { cx: 9, cy: 8, r: 4 } }]);

function iconLine(iconEl: El, text: string, color: string, size = 15): El {
  return h("div", { display: "flex", alignItems: "center", gap: px(10), fontSize: px(size), fontWeight: 600, color }, iconEl, text);
}

function pill(text: string, background: string, color: string, size = 12): El {
  return h("span", { display: "flex", background, padding: `${px(9)}px ${px(14)}px`, borderRadius: px(999), ...LABEL(color, size, 2) }, text);
}

/** Board 5: pill hook, big quote, save + follow footer. */
function motivation(slide: MotivationSlide, logoLight: string): El {
  const n = slide.quote.length;
  const quoteSize = n > 70 ? 44 : n > 50 ? 52 : 62;
  return frame(
    FEED,
    BRAND.night,
    [px(44), px(40), px(34), px(40)],
    { justifyContent: "space-between", color: BRAND.paper },
    h("div", { display: "flex" }, pill(slide.hook || slide.eyebrow, BRAND.gold, BRAND.night)),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: px(20) },
      headline(slide.quote, slide.accent, { fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(quoteSize), lineHeight: 1.04 }, BRAND.gold),
      h("span", { fontSize: px(18), lineHeight: 1.5, color: BRAND.mutedOnDark, maxWidth: px(420) }, slide.supporting),
    ),
    h(
      "div",
      { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `${px(1)}px solid #3A362F`, paddingTop: px(18) },
      h(
        "div",
        { display: "flex", flexDirection: "column", gap: px(10) },
        iconLine(bookmarkIcon(BRAND.gold), "Save this for the day you need it", BRAND.paper),
        iconLine(followIcon(BRAND.gold), FOLLOW_LINE, BRAND.gold),
      ),
      img(logoLight, { height: px(40), width: px(40) * LOGO_ASPECT }),
    ),
  );
}

/**
 * Board 6: question headline in its own black band, photo below, "answer in the caption" + follow pills.
 * Text never sits on the photo: service photos have the logo baked into the top-left corner.
 */
function photoHook(slide: PhotoHookSlide, photo: string): El {
  const size = slide.headline.length > 30 ? 38 : 44;
  return frame(
    FEED,
    BRAND.night,
    [0, 0, 0, 0],
    { color: BRAND.paper },
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: px(8), padding: `${px(30)}px ${px(32)}px ${px(22)}px` },
      h("span", LABEL(BRAND.gold, 12, 3), slide.tag),
      headline(slide.headline, slide.accent, { fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(size), lineHeight: 1.04 }, BRAND.gold),
      slide.meta ? h("span", { fontSize: px(15), color: BRAND.mutedOnDark }, slide.meta) : null,
    ),
    h(
      "div",
      { display: "flex", position: "relative", flexGrow: 1, margin: `0 ${px(20)}px`, borderRadius: px(14), overflow: "hidden" },
      img(photo, { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }),
    ),
    h(
      "div",
      { display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${px(18)}px ${px(24)}px ${px(22)}px` },
      h(
        "div",
        { display: "flex", alignItems: "center", gap: px(8), background: BRAND.paper, color: BRAND.night, fontSize: px(15), fontWeight: 600, padding: `${px(11)}px ${px(16)}px`, borderRadius: px(999) },
        slide.cta,
        icon("M12 5v14M6 13l6 6 6-6", BRAND.night, 16),
      ),
      h(
        "div",
        { display: "flex", alignItems: "center", gap: px(8), background: BRAND.gold, color: BRAND.night, fontSize: px(14), fontWeight: 600, padding: `${px(11)}px ${px(14)}px`, borderRadius: px(999) },
        followIcon(BRAND.night, 16),
        "Follow for more",
      ),
    ),
  );
}

/** Board 7: two numbered AI images, "Which one are you booking next?". Style names sit under the images, not on them. */
function thisOrThat(slide: ThisOrThatSlide, photos: [string, string], logoLight: string): El {
  const tile = (photo: string, n: string, badgeColor: string, label: string) =>
    h(
      "div",
      { display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0, gap: px(8) },
      h(
        "div",
        { position: "relative", display: "flex", flexGrow: 1, borderRadius: px(12), overflow: "hidden" },
        img(photo, { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }),
        h(
          "div",
          { position: "absolute", top: px(12), left: px(12), width: px(44), height: px(44), borderRadius: px(22), background: badgeColor, color: BRAND.night, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(24) },
          n,
        ),
      ),
      h("span", { display: "flex", justifyContent: "center", fontSize: px(14), fontWeight: 600, color: BRAND.paper }, label),
    );
  return frame(
    FEED,
    BRAND.night,
    [px(28), px(20), px(22), px(20)],
    { color: BRAND.paper, gap: px(16) },
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: px(6), padding: `0 ${px(8)}px` },
      h("span", LABEL(BRAND.gold, 12, 3), "This or that? · AI inspiration"),
      headline(slide.headline, slide.accent, { fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(slide.headline.length > 34 ? 34 : 40), lineHeight: 1.05 }, BRAND.gold),
    ),
    h("div", { display: "flex", flexGrow: 1, gap: px(10) }, tile(photos[0], "1", BRAND.gold, slide.labels[0]), tile(photos[1], "2", BRAND.paper, slide.labels[1])),
    h(
      "div",
      { display: "flex", justifyContent: "space-between", alignItems: "center", padding: `0 ${px(8)}px` },
      h(
        "div",
        { display: "flex", flexDirection: "column", gap: px(6) },
        h("span", { fontSize: px(15), fontWeight: 600 }, "Tell us 1 or 2 in the comments"),
        iconLine(followIcon(BRAND.gold, 16), `${FOLLOW_LINE} styles`, BRAND.gold, 14),
      ),
      img(logoLight, { height: px(36), width: px(36) * LOGO_ASPECT }),
    ),
  );
}

function photoPost(slide: PhotoSlide, photo: string, logo: string): El {
  const dark = slide.theme === "dark";
  const fg = dark ? BRAND.paper : BRAND.ink;
  const sub = dark ? BRAND.mutedOnDark : BRAND.muted;
  const titleSize = slide.title.length > 26 ? 28 : 34;
  return frame(
    FEED,
    dark ? BRAND.night : BRAND.paper,
    [px(20), px(20), px(20), px(20)],
    { color: fg, gap: px(16) },
    h(
      "div",
      { display: "flex", position: "relative", flexGrow: 1, borderRadius: px(14), overflow: "hidden" },
      img(photo, { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }),
      h(
        "span",
        { position: "absolute", bottom: px(14), left: px(14), background: dark ? BRAND.paper : BRAND.night, color: dark ? BRAND.ink : BRAND.gold, padding: `${px(8)}px ${px(12)}px`, borderRadius: px(999), ...LABEL(dark ? BRAND.ink : BRAND.gold, 11, 2) },
        slide.tag,
      ),
    ),
    h(
      "div",
      { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: px(16), padding: `0 ${px(6)}px ${px(4)}px` },
      h(
        "div",
        { display: "flex", flexDirection: "column", gap: px(6), maxWidth: px(360) },
        h("span", LABEL(dark ? BRAND.gold : BRAND.deepGold, 11, 3), slide.eyebrow),
        h("span", { fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(titleSize), lineHeight: 1.05 }, slide.title),
        h("span", { fontSize: px(14), color: sub }, slide.meta),
      ),
      h(
        "div",
        { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: px(8) },
        img(logo, { height: px(40), width: px(40) * LOGO_ASPECT }),
        h("span", LABEL(dark ? BRAND.faintOnDark : BRAND.muted, 11, 1), BRAND.instagramHandle),
      ),
    ),
  );
}

function arrow(color: string): El {
  return {
    type: "svg",
    props: {
      width: px(18),
      height: px(18),
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: { type: "path", props: { d: "M5 12h14M13 6l6 6-6 6" } },
    },
  };
}

/** Board 8: photo, red hook pill, mistakes-style title, save + follow + swipe. */
function articleCover(slide: ArticleCoverSlide, photo: string): El {
  return frame(
    FEED,
    BRAND.paper,
    [0, 0, 0, 0],
    { color: BRAND.ink },
    h(
      "div",
      { display: "flex", position: "relative", flexGrow: 1, overflow: "hidden" },
      img(photo, { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }),
      h("div", { position: "absolute", top: px(20), left: px(20), display: "flex" }, slide.tag ? pill(slide.tag, BRAND.alert, "#FFFFFF") : pill("Hair care · Swipe", BRAND.paper, BRAND.ink)),
    ),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: px(12), padding: `${px(24)}px ${px(30)}px ${px(22)}px`, borderTop: `${px(4)}px solid ${BRAND.gold}` },
      headline(slide.title, slide.accent, { fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(slide.title.length > 44 ? 32 : 38), lineHeight: 1.05 }, BRAND.deepGold),
      h(
        "div",
        { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
        h(
          "div",
          { display: "flex", flexDirection: "column", gap: px(4) },
          h("span", { fontSize: px(15), fontWeight: 600, color: BRAND.ink }, "Save this before wash day"),
          iconLine(followIcon(BRAND.deepGold, 16), `${FOLLOW_LINE} tips`, BRAND.deepGold, 14),
        ),
        h("div", { display: "flex", alignItems: "center", gap: px(6), ...LABEL(BRAND.ink, 12, 1) }, `Swipe · 1 / ${slide.total}`, arrow(BRAND.ink)),
      ),
    ),
  );
}

function articleTip(slide: ArticleTipSlide, logoDark: string): El {
  return frame(
    FEED,
    BRAND.paper,
    [px(44), px(40), px(32), px(40)],
    { justifyContent: "space-between", color: BRAND.ink },
    h(
      "div",
      { display: "flex", justifyContent: "space-between", alignItems: "center" },
      h("span", LABEL(BRAND.deepGold, 11, 3), "Hair care"),
      h("span", LABEL(BRAND.muted, 12, 1), `${slide.index + 1} / ${slide.total}`),
    ),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: px(20) },
      h("span", { fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(120), lineHeight: 0.8, color: BRAND.gold }, String(slide.index).padStart(2, "0")),
      h("span", { fontFamily: "Playfair Display", fontWeight: 700, fontSize: px(slide.title.length > 30 ? 34 : 40), lineHeight: 1.1 }, slide.title),
      h("span", { fontSize: px(18), lineHeight: 1.55, color: "#3A362F", maxWidth: px(430) }, slide.body),
    ),
    h(
      "div",
      { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `${px(1)}px solid ${BRAND.rule}`, paddingTop: px(18) },
      img(logoDark, { height: px(34), width: px(34) * LOGO_ASPECT }),
      h("span", LABEL(BRAND.muted, 11, 1), slide.index === slide.total - 1 ? "Save + follow for more" : "Save this for later"),
    ),
  );
}

/** Story = the feed slide, framed on the black ground with the booking line. */
function story(feedJpegDataUri: string, logoLight: string): El {
  const cardW = 920;
  const cardH = Math.round((cardW * FEED.height) / FEED.width);
  return frame(
    STORY,
    BRAND.night,
    [150, 80, 170, 80],
    { alignItems: "center", justifyContent: "space-between", color: BRAND.paper },
    img(logoLight, { height: 96, width: 96 * LOGO_ASPECT }),
    img(feedJpegDataUri, { width: cardW, height: cardH, borderRadius: 28 }),
    h("div", { display: "flex", alignItems: "center", justifyContent: "center", height: 104, width: 760, borderRadius: 999, background: BRAND.gold, ...LABEL(BRAND.night, 13, 1) }, `Book at ${BRAND.site}`),
  );
}

let fontsPromise: Promise<SatoriFont[]> | null = null;
function fonts() {
  fontsPromise ??= loadFonts();
  return fontsPromise;
}

export class UnsupportedImageError extends Error {}

/** satori/resvg decode JPEG and PNG only; anything else (WebP, HEIC) is rejected so the caller picks another photo. */
export async function fetchImageDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new UnsupportedImageError(`Image ${url} returned ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isJpeg && !isPng) throw new UnsupportedImageError(`Image ${url} is not JPEG or PNG.`);
  return `data:${isJpeg ? "image/jpeg" : "image/png"};base64,${bytes.toString("base64")}`;
}

async function toJpeg(element: El, size: { width: number; height: number }): Promise<Buffer> {
  const svg = await satori(element as never, { width: size.width, height: size.height, fonts: await fonts() });
  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: size.width } }).render();
  const encoded = jpeg.encode({ data: rendered.pixels, width: rendered.width, height: rendered.height }, 90);
  return Buffer.from(encoded.data);
}

export async function renderSlide(slide: Slide): Promise<Buffer> {
  switch (slide.layout) {
    case "motivation":
      return toJpeg(motivation(slide, await logoDataUri("light")), FEED);
    case "photo":
      return toJpeg(photoPost(slide, await fetchImageDataUri(slide.photoUrl), await logoDataUri(slide.theme === "dark" ? "light" : "dark")), FEED);
    case "photo_hook":
      return toJpeg(photoHook(slide, await fetchImageDataUri(slide.photoUrl)), FEED);
    case "this_or_that": {
      const photos: [string, string] = [await fetchImageDataUri(slide.photoUrls[0]), await fetchImageDataUri(slide.photoUrls[1])];
      return toJpeg(thisOrThat(slide, photos, await logoDataUri("light")), FEED);
    }
    case "article_cover":
      return toJpeg(articleCover(slide, await fetchImageDataUri(slide.photoUrl)), FEED);
    case "article_tip":
      return toJpeg(articleTip(slide, await logoDataUri("dark")), FEED);
  }
}

export async function renderStory(firstSlideJpeg: Buffer): Promise<Buffer> {
  return toJpeg(story(`data:image/jpeg;base64,${firstSlideJpeg.toString("base64")}`, await logoDataUri("light")), STORY);
}

/** 9:16 end card every Reel finishes on: the white logo on the black ground (standing rule). */
export async function renderEndCard(): Promise<Buffer> {
  const logo = await logoDataUri("light");
  const w = 760;
  return toJpeg(
    frame(
      STORY,
      BRAND.night,
      [0, 0, 0, 0],
      { alignItems: "center", justifyContent: "center", gap: 48, color: BRAND.paper },
      img(logo, { width: w, height: w / LOGO_ASPECT }),
      h("span", LABEL(BRAND.gold, 13, 3), `${BRAND.instagramHandle} · ${BRAND.site}`),
    ),
    STORY,
  );
}
