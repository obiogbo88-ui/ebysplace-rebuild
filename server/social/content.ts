import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { sql } from "drizzle-orm";
import { storagePut } from "../storage";
import { generateImage } from "../_core/imageGeneration";
import { renderSlide, renderStory, UnsupportedImageError, type Slide } from "./renderer";
import { insertPost, orEmpty, recentSourceRefs, recentWriting, requireDb, type PostKind, type SlotName, type SocialPost } from "./store";

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
- Captions: 2 to 4 short paragraphs, under 700 characters before the hashtags. Finish the last paragraph with the exact token {BOOKING} where the booking link belongs, e.g. "Book your appointment at {BOOKING}".
- Then a blank line and 4 to 7 hashtags: always #EbysPlace and #Bridgwater, plus a mix of #Somerset #SomersetBraider and style tags.
- Don't repeat ideas, quotes or openings from the recent posts you are shown.`;

const Motivation = z.object({
  eyebrow: z.string().describe("Small label, max 24 characters, e.g. 'Monday motivation'"),
  quote: z.string().describe("An original motivational line for women in business or anyone starting something, max 85 characters. Not a famous quote."),
  accent: z.string().describe("1 to 2 words copied exactly from the quote to highlight in gold italic"),
  supporting: z.string().describe("One or two sentences under 140 characters linking the idea to hair, self-care or Eby's own journey, without inventing facts"),
  caption: z.string(),
});
const Article = z.object({
  title: z.string().describe("Carousel title, max 50 characters, e.g. '5 ways to make your braids last longer'. Its number must equal the number of tips."),
  accent: z.string().describe("1 to 3 words copied exactly from the title to highlight"),
  tips: z
    .array(z.object({ title: z.string().describe("Max 32 characters"), body: z.string().describe("Max 190 characters, practical and safe") }))
    .describe("4 or 5 tips"),
  caption: z.string(),
});
const GalleryStyle = z.object({
  title: z.string().describe("Short style name for the card, max 26 characters, e.g. 'Boho Knotless Braids'"),
  eyebrow: z.string().describe("Small label, max 22 characters, e.g. 'Style of the week', 'Client favourite', 'Fresh install'"),
  caption: z.string(),
});
const ServiceStyle = z.object({
  eyebrow: z.string().describe("Small label, max 22 characters, e.g. 'Book this week'"),
  caption: z.string(),
});
const Inspiration = z.object({
  styleName: z.string().describe("Name of an on-trend protective style, max 26 characters, that a braider could recreate"),
  imagePrompt: z
    .string()
    .describe("Prompt for an AI image: a photorealistic portrait of a fictional model wearing this style, salon or studio light, head and shoulders, 4:5 portrait. No text, no logos, no watermarks, not a real or famous person."),
  caption: z.string().describe("Frame it as inspiration ('would you wear it?'), invite people to save it and bring it to a consultation. Do not claim Eby made it."),
});

function anthropic() {
  return new Anthropic();
}

async function write<T extends z.ZodType>(schema: T, task: string): Promise<z.infer<T>> {
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
  return response.parsed_output as z.infer<T>;
}

export function ensureBookingToken(caption: string) {
  const trimmed = caption.trim();
  if (trimmed.includes("{BOOKING}")) return trimmed;
  const parts = trimmed.split(/\n\s*\n/);
  const tags = parts.length > 1 && parts[parts.length - 1].trim().startsWith("#") ? parts.pop()! : "";
  return `${parts.join("\n\n")}\n\nBook at {BOOKING}${tags ? `\n\n${tags}` : ""}`;
}

/** {BOOKING} becomes "ebysplace.com (link in bio)" on Instagram, where captions can't hold links, and the real link on Facebook. */
export function captionFor(platform: "instagram" | "facebook", caption: string) {
  return caption.replaceAll("{BOOKING}", platform === "instagram" ? "ebysplace.com (link in bio)" : "https://www.ebysplace.com/booking");
}

// ------------------------------------------------------------------ builders

type Draft = { kind: PostKind; slides: Slide[]; caption: string; sourceRef: string | null; isAiGenerated: boolean };

async function draftMotivation(date: string, n: number): Promise<Draft> {
  const out = await write(Motivation, `Write today's ${DAY_NAMES[weekdayIndex(date)]} business-motivation card (post ${n}).`);
  return {
    kind: "motivation",
    sourceRef: null,
    isAiGenerated: false,
    caption: ensureBookingToken(out.caption),
    slides: [{ layout: "motivation", eyebrow: clip(out.eyebrow, 26), quote: clip(out.quote, 90), accent: out.accent, supporting: clip(out.supporting, 150), number: n }],
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
    caption: ensureBookingToken(out.caption),
    slides: [
      { layout: "article_cover", photoUrl: cover.imageUrl, title: clip(out.title, 56), accent: out.accent, total },
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
        caption: ensureBookingToken(out.caption),
        slides: [
          {
            layout: "photo",
            theme: "light",
            photoUrl: service.imageUrl,
            tag: "Book this look",
            eyebrow: clip(out.eyebrow, 24),
            title: clip(service.name, 30),
            meta: [service.duration, price ? `from ${price}` : null, "Bridgwater"].filter(Boolean).join(" · "),
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
    caption: ensureBookingToken(out.caption),
    slides: [
      { layout: "photo", theme: "light", photoUrl: photo.imageUrl, tag: "Done at Eby's Place", eyebrow: clip(out.eyebrow, 24), title: clip(out.title, 30), meta: `${photo.category} · Bridgwater, Somerset` },
    ],
  };
}

async function draftInspiration(): Promise<Draft> {
  const out = await write(Inspiration, "Pick one protective style to share as AI-generated style inspiration.");
  const image = await generateImage({ prompt: `${out.imagePrompt}\n\nPortrait orientation. Photorealistic. No text, lettering, logos or watermarks.` });
  if (!image.url) throw new Error("The AI image service returned no image.");
  return {
    kind: "inspiration",
    sourceRef: "ai",
    isAiGenerated: true,
    caption: ensureBookingToken(out.caption),
    slides: [
      { layout: "photo", theme: "dark", photoUrl: image.url, tag: "Style inspiration", eyebrow: "Would you wear it?", title: clip(out.styleName, 30), meta: "Save it, then show us at your consultation" },
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
export type PreparedPreview = Pick<SocialPost, "slotDate" | "slot" | "kind" | "sourceRef" | "isAiGenerated" | "slides" | "caption" | "imageUrls" | "storyUrl">;

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
      const row = { slotDate: date, slot, kind: d.kind, sourceRef: d.sourceRef, isAiGenerated: d.isAiGenerated, slides: d.slides, caption: d.caption, imageUrls, storyUrl };
      return persist ? insertPost(row) : row;
    } catch (err) {
      if (!(err instanceof UnsupportedImageError) || !d.sourceRef || d.sourceRef === "ai") throw err;
      console.warn(`[social] Skipping ${d.sourceRef}: ${err.message}`);
      used.add(d.sourceRef);
    }
  }
  throw new Error(`No usable photo found for the ${kind} post on ${date} ${slot}.`);
}
