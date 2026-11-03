import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { sql } from "drizzle-orm";
import { storagePut } from "../storage";
import { generateImage } from "../_core/imageGeneration";
import { renderEndCard, renderSlide, renderStory, UnsupportedImageError, type Slide } from "./renderer";
import { buildReel, freshMelody, reelTimings } from "./reel";
import { BRAND } from "./kit";
import { insertPost, isMusicUsed, orEmpty, recentSourceRefs, recentWriting, requireDb, type PostKind, type SlotName, type SocialPost } from "./store";

// ------------------------------------------------------------------ calendar

/** YYYY-MM-DD in Europe/London. */
export function londonDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * The approved weekly plan (Design canvas board "Weekly plan · 2 posts a day"):
 * 10:00 motivation / hair article / weekend style, 19:00 real work / AI inspiration.
 */
const ROTATION: Record<SlotName, PostKind[]> = {
  am: ["motivation", "article", "motivation", "article", "style", "motivation", "article"],
  pm: ["style", "inspiration", "style", "inspiration", "style", "style", "inspiration"],
};

export function kindFor(date: string, slot: SlotName): PostKind {
  return ROTATION[slot][weekdayIndex(date)];
}

/** Friday's two style slots show a bookable service with its live price; every other style slot is Eby's own gallery work. */
export function styleSourceFor(date: string): "gallery" | "service" {
  return weekdayIndex(date) === 4 ? "service" : "gallery";
}

// -------------------------------------------------------------------- photos

type GalleryPhoto = { ref: string; title: string; category: string; imageUrl: string };
type ServicePhoto = { ref: string; name: string; duration: string; priceFrom: string; description: string; category: string; imageUrl: string };

async function galleryPhotos(): Promise<GalleryPhoto[]> {
  const db = await requireDb(false);
  const res = await db.execute(sql`SELECT "id", "title", "category", "imageUrl" FROM "galleryImages" WHERE "isPublished" = 'true' ORDER BY "sortOrder", "id"`);
  return res.rows.map((r: any) => ({ ref: `gallery:${r.id}`, title: String(r.title), category: String(r.category), imageUrl: String(r.imageUrl) }));
}

async function servicePhotos(): Promise<ServicePhoto[]> {
  const db = await requireDb(false);
  const res = await db.execute(sql`SELECT "id", "name", "duration", "priceFrom", "description", "category", "imageUrl" FROM "services"
    WHERE "isBookable" = 'true' AND "imageUrl" IS NOT NULL AND "imageUrl" <> '' ORDER BY "isFeatured" DESC, "sortOrder", "id"`);
  return res.rows.map((r: any) => ({
    ref: `service:${r.id}`,
    name: String(r.name),
    duration: String(r.duration),
    priceFrom: String(r.priceFrom),
    description: String(r.description),
    category: String(r.category),
    imageUrl: absoluteUrl(String(r.imageUrl)),
  }));
}

function absoluteUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://www.ebysplace.com/${url.replace(/^\/+/, "")}`;
}

/** Least-recently-used first: anything not posted in the last 14 days, else the whole pool. */
function freshFirst<T extends { ref: string }>(pool: T[], used: Set<string>, seed: string): T[] {
  const fresh = pool.filter((p) => !used.has(p.ref));
  const list = fresh.length > 0 ? fresh : pool;
  // deterministic shuffle by date so reruns pick the same photo
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [...list].sort((a, b) => ((hash(a.ref) ^ h) >>> 0) - ((hash(b.ref) ^ h) >>> 0));
}

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export function formatPrice(priceFrom: string) {
  const n = Number(priceFrom);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

/** Cuts at a word boundary so the card never shows half a word. */
export function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : clean.slice(0, max)).replace(/[,;:.\-–]+$/, "")}…`;
}

// -------------------------------------------------------------------- writer

const SYSTEM = `You write Instagram and Facebook posts for Eby's Place, a braiding and hair studio in Bridgwater, Somerset (UK), run by its founder Eberechi ("Eby").

Audience: people in Somerset who wear braids, twists, locs, crochet and weaves (mostly women, also men and kids), and women building their own small business.

Voice: warm, confident and classy. Plain British English (colour, favourite, appointment). Talk to one person.

Hard rules:
- Use only facts given to you. Never invent prices, timings, discounts, offers, availability, reviews, client names, awards or statistics.
- No health or medical claims (nothing about curing hair loss, growing hair or treating the scalp). Hair-care tips must be widely accepted, safe, everyday advice.
- No emoji in card text. Captions may use at most two tasteful emoji.
- Captions: short paragraphs (one or two sentences each), under 800 characters before the hashtags. The last paragraph before the hashtags holds the exact token {BOOKING} where the booking link belongs, e.g. "Book your appointment at {BOOKING}".
- Then a blank line and 4 to 7 hashtags: always #EbysPlace and #Bridgwater, plus a mix of #Somerset #SomersetBraider and style tags.
- Don't repeat ideas, quotes or openings from the recent posts you are shown.

Scroll-stopping (the goal is new followers and real engagement):
- Card headlines and the FIRST line of every caption are hooks: a curiosity gap, a direct question, a bold but true statement, or "stop doing this" / "read this if..." framing. The first line is all people see before "more", so it must make them tap. Never open with "Happy Monday", "Here at Eby's Place" or a description of the photo.
- Every caption, in this order: hook line; 1 to 2 short paragraphs of value (the answer to the hook, the tip, the story); a save or share nudge ("Save this for wash day", "Send this to the friend who needs a refresh"); one genuine question people can answer in a word or two; a line starting with the exact token {FOLLOW} (e.g. "{FOLLOW} for more styles and braid care tips"); then the {BOOKING} line; then hashtags.
- Allowed: curiosity, questions, this-or-that, "guess", "save this", "share with a friend". Banned, because Meta shows these posts to fewer people: "comment YES", "like if", "tag 3 friends", "share to win", "type AMEN", any giveaway or contest you were not told about.
- Hooks must still be true. No fake urgency or scarcity ("only 2 slots left", "last chance", "ends tonight"), no invented numbers ("90% of people..."), no shock claims about hair damage.`;

const CAPTION_RULES =
  "The FULL Instagram caption, 250 to 800 characters before the hashtags, written out in full (never a placeholder): hook line, value, save/share nudge, a genuine question, the {FOLLOW} line, the {BOOKING} line, then hashtags.";
const caption = (extra = "") => z.string().describe(extra ? `${CAPTION_RULES} ${extra}` : CAPTION_RULES);

const Motivation = z.object({
  hook: z.string().describe("Pill at the top that stops the scroll, max 30 characters, e.g. 'Read this before you scroll', 'For the one scared to start', 'If you needed a sign'"),
  quote: z.string().describe("An original, punchy motivational line for women in business or anyone starting something, max 70 characters, e.g. 'Stop waiting to feel ready.' Not a famous quote."),
  accent: z.string().describe("1 to 2 words copied exactly from the quote to highlight in gold italic"),
  supporting: z.string().describe("One or two sentences under 140 characters linking the idea to hair, self-care or Eby's own journey, without inventing facts"),
  caption: caption(),
});
const Article = z.object({
  tag: z.string().describe("Red pill on the cover, max 18 characters, e.g. 'Stop doing this', 'Save this', 'Wash day rules'"),
  title: z
    .string()
    .describe("Hook title for the carousel, max 50 characters, e.g. '3 habits that make your braids frizz in week one' or '4 things your braider wishes you knew'. Its number must equal the number of tips."),
  accent: z.string().describe("1 to 4 words copied exactly from the title to highlight"),
  tips: z
    .array(z.object({ title: z.string().describe("Max 32 characters"), body: z.string().describe("Max 190 characters, practical and safe") }))
    .describe("4 or 5 tips"),
  caption: caption(),
});
const HOOK_HEADLINE =
  "Question or curiosity headline over the photo, max 34 characters, whose answer is in the caption. Only ask what the facts you were given can answer truthfully.";
const GalleryStyle = z.object({
  headline: z.string().describe(`${HOOK_HEADLINE} E.g. 'Would you try this colour?', 'Rate this install out of 10', 'The secret is in the parting'`),
  accent: z.string().describe("1 to 3 words copied exactly from the headline to highlight in gold"),
  cta: z.string().describe("Pill under the photo, max 24 characters, e.g. 'Answer in the caption', 'Tell us below'"),
  caption: caption(),
});
const ServiceStyle = z.object({
  headline: z.string().describe(`${HOOK_HEADLINE} E.g. 'Guess how long this took?' (the duration is in the facts), 'Guess the price?'`),
  accent: z.string().describe("1 to 3 words copied exactly from the headline to highlight in gold"),
  cta: z.string().describe("Pill under the photo, max 24 characters, e.g. 'Answer in the caption'"),
  caption: caption("The first paragraph answers the headline with the real fact."),
});
const InspoStyle = z.object({
  styleName: z.string().describe("Name of an on-trend protective style, max 24 characters, that a braider could recreate"),
  imagePrompt: z
    .string()
    .describe("Prompt for an AI image: a photorealistic portrait of a fictional model wearing this style, salon or studio light, head and shoulders, portrait. No text, no logos, no watermarks, not a real or famous person."),
});
const Inspiration = z.object({
  headline: z.string().describe("This-or-that question, max 36 characters, e.g. 'Which one are you booking next?'"),
  accent: z.string().describe("1 to 3 words copied exactly from the headline to highlight in gold"),
  options: z.array(InspoStyle).describe("Exactly 2 clearly different styles (e.g. different length, colour or technique)"),
  caption: z
    .string()
    .describe(`${CAPTION_RULES} ` + "Frame it as AI-made inspiration: ask which they'd pick, 1 or 2, invite them to save it and bring it to a consultation. Do not claim Eby made either look."),
});

function anthropic() {
  return new Anthropic();
}

class CaptionError extends Error {}

/** 2026-11-03 the first live post went out with the caption "x"; never publish a placeholder again. */
export function captionProblem(caption: string): string | null {
  const body = caption.split(/\n\s*\n/).filter((p) => !p.trim().startsWith("#") && !p.includes("{BOOKING}") && !p.includes("{FOLLOW}")).join(" ").trim();
  if (body.length < 120) return `caption too short (${body.length} characters of copy)`;
  if (/lorem ipsum|\[caption\]|placeholder/i.test(body)) return "caption contains placeholder text";
  return null;
}

/** Asks the writer up to twice; a second bad caption fails the run so nothing half-written is posted. */
async function write<T extends z.ZodType>(schema: T, task: string): Promise<z.infer<T>> {
  try {
    return await writeOnce(schema, task);
  } catch (err) {
    if (!(err instanceof CaptionError)) throw err;
    console.warn(`[social] Rewriting: ${err.message}`);
    return writeOnce(schema, `${task}\n\nYour previous caption was rejected (${err.message}). Write the complete caption in full.`);
  }
}

async function writeOnce<T extends z.ZodType>(schema: T, task: string): Promise<z.infer<T>> {
  const recent = await recentWriting();
  const response = await anthropic().beta.messages.parse({
    model: String(process.env.SOCIAL_CLAUDE_MODEL || "").trim() || "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${task}\n\nRecent posts (do not repeat these):\n${recent.length ? recent.map((r) => `- ${r}`).join("\n") : "- none yet"}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The writer declined this post.");
  if (!response.parsed_output) throw new Error(`The writer returned no usable post (stop_reason ${response.stop_reason}).`);
  const out = response.parsed_output as z.infer<T>;
  const problem = captionProblem(String((out as { caption?: unknown }).caption ?? ""));
  if (problem) throw new CaptionError(problem);
  return out;
}

export function ensureBookingToken(caption: string) {
  const trimmed = caption.trim();
  if (trimmed.includes("{BOOKING}")) return trimmed;
  const parts = trimmed.split(/\n\s*\n/);
  const tags = parts.length > 1 && parts[parts.length - 1].trim().startsWith("#") ? parts.pop()! : "";
  return `${parts.join("\n\n")}\n\nBook at {BOOKING}${tags ? `\n\n${tags}` : ""}`;
}

/** Puts a {FOLLOW} line just before the booking line if the writer forgot it. */
export function ensureFollowLine(caption: string) {
  if (caption.includes("{FOLLOW}")) return caption;
  const parts = caption.split(/\n\s*\n/);
  const at = parts.findIndex((p) => p.includes("{BOOKING}"));
  parts.splice(at < 0 ? parts.length : at, 0, "{FOLLOW} for more styles and braid care tips.");
  return parts.join("\n\n");
}

function finishCaption(caption: string) {
  return ensureFollowLine(ensureBookingToken(caption));
}

/**
 * {BOOKING} becomes "ebysplace.com (link in bio)" on Instagram, where captions can't hold links, and the real link on Facebook.
 * {FOLLOW} becomes "Follow @ebysplace1" on Instagram and "Follow Eby's Place" on Facebook.
 */
export function captionFor(platform: "instagram" | "facebook", caption: string) {
  return caption
    .replaceAll("{BOOKING}", platform === "instagram" ? "ebysplace.com (link in bio)" : "https://www.ebysplace.com/booking")
    .replaceAll("{FOLLOW}", platform === "instagram" ? `Follow ${BRAND.instagramHandle}` : "Follow Eby's Place");
}

// ------------------------------------------------------------------ builders

type Draft = { kind: PostKind; slides: Slide[]; caption: string; sourceRef: string | null; isAiGenerated: boolean };

async function draftMotivation(date: string, n: number): Promise<Draft> {
  const out = await write(Motivation, `Write today's ${DAY_NAMES[weekdayIndex(date)]} business-motivation card (post ${n}).`);
  return {
    kind: "motivation",
    sourceRef: null,
    isAiGenerated: false,
    caption: finishCaption(out.caption),
    slides: [{ layout: "motivation", eyebrow: "Motivation", hook: clip(out.hook, 32), quote: clip(out.quote, 80), accent: out.accent, supporting: clip(out.supporting, 150), number: n }],
  };
}

async function draftArticle(date: string, used: Set<string>): Promise<Draft> {
  const cover = freshFirst(await galleryPhotos(), used, date)[0];
  if (!cover) throw new Error("No gallery photo available for the article cover.");
  const out = await write(Article, "Write a hair-care carousel article (cover title plus 4 or 5 tips) for people who wear protective styles.");
  const tips = out.tips.slice(0, 5);
  const total = tips.length + 1;
  return {
    kind: "article",
    sourceRef: cover.ref,
    isAiGenerated: false,
    caption: finishCaption(out.caption),
    slides: [
      { layout: "article_cover", photoUrl: cover.imageUrl, title: clip(out.title, 56), accent: out.accent, tag: clip(out.tag, 20), total },
      ...tips.map((t, i): Slide => ({ layout: "article_tip", index: i + 1, total, title: clip(t.title, 36), body: clip(t.body, 200) })),
    ],
  };
}

async function draftStyle(date: string, seed: string, used: Set<string>): Promise<Draft> {
  if (styleSourceFor(date) === "service") {
    const service = freshFirst(await servicePhotos(), used, seed)[0];
    if (service) {
      const price = formatPrice(service.priceFrom);
      const out = await write(
        ServiceStyle,
        `Write a post for this bookable service. Facts (use only these):\nName: ${service.name}\nCategory: ${service.category}\nDuration: ${service.duration}\nPrice: ${price ? `from ${price}` : "not shown"}\nDescription: ${service.description}`,
      );
      return {
        kind: "style",
        sourceRef: service.ref,
        isAiGenerated: false,
        caption: finishCaption(out.caption),
        slides: [
          {
            layout: "photo_hook",
            photoUrl: service.imageUrl,
            tag: `Book this look · ${clip(service.name, 30)}`,
            headline: clip(out.headline, 38),
            accent: out.accent,
            cta: clip(out.cta, 26),
          },
        ],
      };
    }
  }
  const photo = freshFirst(await galleryPhotos(), used, seed)[0];
  if (!photo) throw new Error("No gallery photo available for a style post.");
  const out = await write(GalleryStyle, `Write a post showing this real client style done at Eby's Place. Gallery title: "${photo.title}". Category: ${photo.category}.`);
  return {
    kind: "style",
    sourceRef: photo.ref,
    isAiGenerated: false,
    caption: finishCaption(out.caption),
    slides: [
      { layout: "photo_hook", photoUrl: photo.imageUrl, tag: "Done at Eby's Place", headline: clip(out.headline, 38), accent: out.accent, cta: clip(out.cta, 26) },
    ],
  };
}

async function draftInspiration(): Promise<Draft> {
  const out = await write(Inspiration, "Pick two clearly different protective styles to share as an AI-generated this-or-that.");
  const [a, b] = out.options;
  if (!a || !b) throw new Error("The writer returned fewer than two inspiration styles.");
  const urls: string[] = [];
  for (const option of [a, b]) {
    const image = await generateImage({ prompt: `${option.imagePrompt}

Portrait orientation. Photorealistic. No text, lettering, logos or watermarks.` });
    if (!image.url) throw new Error("The AI image service returned no image.");
    urls.push(image.url);
  }
  return {
    kind: "inspiration",
    sourceRef: "ai",
    isAiGenerated: true,
    caption: finishCaption(out.caption),
    slides: [
      { layout: "this_or_that", photoUrls: [urls[0], urls[1]], labels: [clip(a.styleName, 24), clip(b.styleName, 24)], headline: clip(out.headline, 40), accent: out.accent },
    ],
  };
}

async function draft(date: string, slot: SlotName, kind: PostKind, used: Set<string>): Promise<Draft> {
  switch (kind) {
    case "motivation":
      return draftMotivation(date, await motivationNumber());
    case "article":
      return draftArticle(date, used);
    case "style":
      return draftStyle(date, `${date}-${slot}`, used);
    case "inspiration":
      return draftInspiration();
  }
}

/** Motivation cards are numbered "No. 01, 02 ..." in posting order. */
async function motivationNumber() {
  const db = await requireDb(false);
  const res = await orEmpty(() => db.execute(sql`SELECT count(*)::int AS n FROM "socialPosts" WHERE "kind" = 'motivation'`));
  return Number((res.rows[0] as any)?.n ?? 0) + 1;
}

/**
 * Writes, renders and queues the post for one slot. Photo problems
 * (WebP/HEIC sources, a dead link) fall through to the next photo; any other
 * failure is thrown so the cron reports it.
 */
export type PreparedPreview = Pick<
  SocialPost,
  "slotDate" | "slot" | "kind" | "sourceRef" | "isAiGenerated" | "slides" | "caption" | "imageUrls" | "storyUrl" | "reelUrl" | "musicSeed" | "musicFingerprint"
>;

export async function preparePost(date: string, slot: SlotName, options: { persist?: boolean } = {}): Promise<SocialPost | PreparedPreview | null> {
  const persist = options.persist !== false;
  const kind = kindFor(date, slot);
  const used = await recentSourceRefs(addDays(date, -14));
  for (let attempt = 0; attempt < 4; attempt++) {
    const d = await draft(date, slot, kind, used);
    if (d.sourceRef && d.sourceRef !== "ai") used.add(d.sourceRef);
    try {
      const jpegs: Buffer[] = [];
      for (const slide of d.slides) jpegs.push(await renderSlide(slide));
      const imageUrls: string[] = [];
      for (let i = 0; i < jpegs.length; i++) imageUrls.push((await storagePut(`social/${date}-${slot}-${i + 1}.jpg`, jpegs[i], "image/jpeg")).url);
      const storyUrl = (await storagePut(`social/${date}-${slot}-story.jpg`, await renderStory(jpegs[0]), "image/jpeg")).url;
      // Every post is also a Reel with its own, never-repeated melody.
      const { seed, melody } = await freshMelody(reelTimings(jpegs.length).total, isMusicUsed);
      const reel = await buildReel(jpegs, await renderEndCard(), melody);
      const reelUrl = (await storagePut(`social/${date}-${slot}-reel.mp4`, reel, "video/mp4")).url;
      console.log(`[social] ${date} ${slot}: reel ${Math.round(reel.length / 1024)} KB, music ${melody.description}`);
      const row = {
        slotDate: date,
        slot,
        kind: d.kind,
        sourceRef: d.sourceRef,
        isAiGenerated: d.isAiGenerated,
        slides: d.slides,
        caption: d.caption,
        imageUrls,
        storyUrl,
        reelUrl,
        musicSeed: seed,
        musicFingerprint: melody.fingerprint,
      };
      return persist ? insertPost(row) : row;
    } catch (err) {
      if (!(err instanceof UnsupportedImageError) || !d.sourceRef || d.sourceRef === "ai") throw err;
      console.warn(`[social] Skipping ${d.sourceRef}: ${err.message}`);
      used.add(d.sourceRef);
    }
  }
  throw new Error(`No usable photo found for the ${kind} post on ${date} ${slot}.`);
}
