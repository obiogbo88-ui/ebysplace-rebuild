import { createHash } from "node:crypto";
import type { Application, Request, Response } from "express";
import { addDays, captionFor, londonDate, preparePost } from "./content";
import {
  publishFacebookFeed,
  publishFacebookStory,
  publishInstagramFeed,
  publishInstagramStory,
  refreshInstagramToken,
  resolvePageToken,
  type FacebookCredentials,
  type InstagramCredentials,
} from "./graph";
import { claimPost, getPost, getToken, requireDb, savePublishResult, saveToken, type SlotName, type SocialPost } from "./store";
import { sql } from "drizzle-orm";

/**
 * Eby's Place automatic Instagram + Facebook posting. Fully automatic by
 * the owner's choice (2026-11-02): there is no review step.
 *
 *   /api/cron/social-prepare     06:00 UTC daily: writes + renders the next posts
 *   /api/cron/social-publish-am  10:05 UTC daily: posts today's 10:00 slot
 *   /api/cron/social-publish-pm  19:05 UTC daily: posts today's 19:00 slot
 *   /api/cron/social-preview     on demand: renders a post without queueing it
 *
 * All need the CRON_SECRET bearer token Vercel sends with cron calls.
 * SOCIAL_AUTOPOST_PAUSED=true stops publishing without a deploy.
 */

function authorized(req: Request) {
  const expected = String(process.env.CRON_SECRET || "").trim();
  if (!expected) return false;
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() === expected;
}

const env = (name: string) => String(process.env[name] || "").trim();

function paused() {
  return /^(1|true|yes)$/i.test(env("SOCIAL_AUTOPOST_PAUSED"));
}

function tokenKey(envToken: string) {
  return `instagram:${createHash("sha256").update(envToken).digest("hex").slice(0, 12)}`;
}

/**
 * The Instagram token from Vercel, or its refreshed copy from the database.
 * The copy is keyed by a hash of the Vercel value, so pasting a new token
 * into Vercel always wins over an old refreshed one.
 */
export async function instagramCredentials(): Promise<InstagramCredentials | null> {
  const userId = env("INSTAGRAM_USER_ID") || env("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  const envToken = env("INSTAGRAM_ACCESS_TOKEN");
  if (!userId || !envToken) return null;
  const stored = await getToken(tokenKey(envToken));
  return { userId, accessToken: stored?.token || envToken };
}

/** Refreshes the Instagram token once a week so it never reaches its 60-day expiry. Best-effort. */
async function keepInstagramTokenFresh() {
  const envToken = env("INSTAGRAM_ACCESS_TOKEN");
  if (!envToken) return "not configured";
  const key = tokenKey(envToken);
  const stored = await getToken(key);
  if (stored && Date.now() - stored.refreshedAt.getTime() < 7 * 86400000) return "fresh";
  try {
    const refreshed = await refreshInstagramToken(stored?.token || envToken);
    await saveToken(key, refreshed.accessToken, refreshed.expiresInSeconds);
    return "refreshed";
  } catch (err) {
    console.warn("[social] Instagram token refresh failed", err instanceof Error ? err.message : err);
    return "refresh failed";
  }
}

async function facebookCredentials(): Promise<FacebookCredentials | null> {
  const pageId = env("FACEBOOK_PAGE_ID");
  const pageAccessToken = env("FACEBOOK_PAGE_ACCESS_TOKEN");
  if (!pageId || !pageAccessToken) return null;
  return resolvePageToken({ pageId, pageAccessToken });
}

/** Posts one queued row to every connected platform, saving each id as soon as it exists. */
export async function publishPost(post: SocialPost, ig: InstagramCredentials | null, fb: FacebookCredentials | null) {
  const result = { status: post.status, igMediaId: post.igMediaId, igStoryId: post.igStoryId, fbPostId: post.fbPostId, fbStoryId: post.fbStoryId, error: null as string | null };
  const errors: string[] = [];
  const step = async (label: string, done: string | null, run: () => Promise<string>) => {
    if (done) return done;
    try {
      return await run();
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };
  if (ig) {
    result.igMediaId = await step("Instagram post", result.igMediaId, () => publishInstagramFeed(ig, post.imageUrls, captionFor("instagram", post.caption), post.isAiGenerated));
    if (post.storyUrl) result.igStoryId = await step("Instagram story", result.igStoryId, () => publishInstagramStory(ig, post.storyUrl!, post.isAiGenerated));
  }
  if (fb) {
    result.fbPostId = await step("Facebook post", result.fbPostId, () => publishFacebookFeed(fb, post.imageUrls, captionFor("facebook", post.caption)));
    if (post.storyUrl) result.fbStoryId = await step("Facebook story", result.fbStoryId, () => publishFacebookStory(fb, post.storyUrl!));
  }
  const feedDone = (!ig || result.igMediaId) && (!fb || result.fbPostId);
  result.status = errors.length === 0 ? "posted" : feedDone || result.igMediaId || result.fbPostId ? "partial" : post.attempts >= 3 ? "failed" : "ready";
  result.error = errors.length ? errors.join(" | ").slice(0, 2000) : null;
  await savePublishResult(post.id, result);
  return result;
}

async function runPublish(slot: SlotName) {
  if (paused()) return { skipped: "paused (SOCIAL_AUTOPOST_PAUSED)" };
  const ig = await instagramCredentials();
  const fb = await facebookCredentials();
  if (!ig && !fb) return { skipped: "no Instagram or Facebook credentials configured yet" };

  const today = londonDate();
  let post = await getPost(today, slot);
  if (!post) {
    // The prepare run missed this slot: write it now rather than skip it.
    const made = await preparePost(today, slot);
    post = made && "id" in made ? made : await getPost(today, slot);
  }
  const outcomes: unknown[] = [];
  if (post) {
    const claimed = await claimPost(post.id);
    outcomes.push(claimed ? { id: post.id, kind: post.kind, ...(await publishPost(claimed, ig, fb)) } : { id: post.id, skipped: `status ${post.status}` });
  }
  // Retry anything from the last two days that only half went out.
  const db = await requireDb();
  const partials = await db.execute(sql`SELECT "id" FROM "socialPosts" WHERE "status" = 'partial' AND "slotDate" >= ${addDays(today, -2)} AND "id" <> ${post?.id ?? 0}`);
  for (const row of partials.rows as Array<{ id: number }>) {
    const claimed = await claimPost(row.id);
    if (claimed) outcomes.push({ id: row.id, retry: true, ...(await publishPost(claimed, ig, fb)) });
  }
  return { today, slot, outcomes };
}

async function runPrepare(startedAt: number) {
  const today = londonDate();
  const londonHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date()));
  const wanted: Array<[string, SlotName]> = [];
  if (londonHour < 10) wanted.push([today, "am"]);
  if (londonHour < 19) wanted.push([today, "pm"]);
  wanted.push([addDays(today, 1), "am"], [addDays(today, 1), "pm"]);

  const made: string[] = [];
  const errors: string[] = [];
  for (const [date, slot] of wanted) {
    if (made.length >= 2 || Date.now() - startedAt > 45_000) break; // stay inside the 90s function limit
    if (await getPost(date, slot)) continue;
    try {
      await preparePost(date, slot);
      made.push(`${date} ${slot}`);
    } catch (err) {
      errors.push(`${date} ${slot}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const token = await keepInstagramTokenFresh();
  return { made, errors, instagramToken: token };
}

function guard(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    if (!authorized(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const body = await handler(req);
      res.json({ success: true, ...(body as object) });
    } catch (err) {
      console.error("[social] cron failed", err);
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  };
}

export function registerSocialCrons(app: Application) {
  app.get("/api/cron/social-prepare", guard(async () => runPrepare(Date.now())));
  app.get("/api/cron/social-publish-am", guard(async () => runPublish("am")));
  app.get("/api/cron/social-publish-pm", guard(async () => runPublish("pm")));
  app.get(
    "/api/cron/social-preview",
    guard(async (req) => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? String(req.query.date) : londonDate();
      const slot: SlotName = req.query.slot === "am" ? "am" : "pm";
      return { preview: await preparePost(date, slot, { persist: false }) };
    }),
  );
}
