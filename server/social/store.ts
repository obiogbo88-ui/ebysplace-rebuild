import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { Slide } from "./renderer";

/**
 * Queue of Eby's Place Instagram/Facebook posts: one row per day per slot
 * (am 08:00, md 12:30, pm 20:00 UK; see SLOT_TIMES in content.ts). The prepare cron fills rows, the publish crons
 * post them. Each platform id is saved the moment it succeeds, so a retry
 * after a partial failure never posts the same thing twice.
 *
 * Tables are created at runtime (the repo's existing pattern, see
 * ensureOrderLocationColumns in db.ts) and mirrored in
 * drizzle/0016_social_posts.sql. RLS is switched on with no policies so the
 * public anon key can never read them (the server connects as postgres).
 */

export type SlotName = "am" | "md" | "pm";
export type PostKind = "motivation" | "style" | "inspiration" | "article";
export type PostStatus = "ready" | "publishing" | "posted" | "partial" | "failed";

export type SocialPost = {
  id: number;
  slotDate: string;
  slot: SlotName;
  kind: PostKind;
  sourceRef: string | null;
  isAiGenerated: boolean;
  slides: Slide[];
  caption: string;
  imageUrls: string[];
  storyUrl: string | null;
  /** Instagram Reel (slides + original melody); null on posts made before Reels. */
  reelUrl: string | null;
  musicSeed: number | null;
  musicFingerprint: string | null;
  status: PostStatus;
  igMediaId: string | null;
  igStoryId: string | null;
  fbPostId: string | null;
  fbStoryId: string | null;
  error: string | null;
  attempts: number;
};

let ensured = false;

/** `ensureTables: false` is for read-only paths (the preview endpoint), which must never create tables in production ahead of a merge. */
export async function requireDb(ensureTables = true) {
  const db = await getDb();
  if (!db) throw new Error("Social posting needs DATABASE_URL.");
  if (ensureTables && !ensured) {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "socialPosts" (
      "id" SERIAL PRIMARY KEY,
      "slotDate" VARCHAR(10) NOT NULL,
      "slot" VARCHAR(2) NOT NULL CHECK ("slot" IN ('am','md','pm')),
      "kind" VARCHAR(20) NOT NULL CHECK ("kind" IN ('motivation','style','inspiration','article')),
      "sourceRef" VARCHAR(160),
      "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
      "slides" JSONB NOT NULL,
      "caption" TEXT NOT NULL,
      "imageUrls" JSONB NOT NULL,
      "storyUrl" TEXT,
      "status" VARCHAR(20) NOT NULL DEFAULT 'ready',
      "igMediaId" VARCHAR(64),
      "igStoryId" VARCHAR(64),
      "fbPostId" VARCHAR(96),
      "fbStoryId" VARCHAR(96),
      "error" TEXT,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "postedAt" TIMESTAMPTZ,
      UNIQUE ("slotDate", "slot")
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "socialTokens" (
      "platform" VARCHAR(40) PRIMARY KEY,
      "token" TEXT NOT NULL,
      "refreshedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "expiresAt" TIMESTAMPTZ
    )`);
    // third daily slot (2026-11-03): widen the slot check on tables made with am/pm only
    await db.execute(sql`ALTER TABLE "socialPosts" DROP CONSTRAINT IF EXISTS "socialPosts_slot_check"`);
    await db.execute(sql`ALTER TABLE "socialPosts" ADD CONSTRAINT "socialPosts_slot_check" CHECK ("slot" IN ('am','md','pm'))`);
    await db.execute(sql`ALTER TABLE "socialPosts" ADD COLUMN IF NOT EXISTS "reelUrl" TEXT`);
    await db.execute(sql`ALTER TABLE "socialPosts" ADD COLUMN IF NOT EXISTS "musicSeed" BIGINT`);
    await db.execute(sql`ALTER TABLE "socialPosts" ADD COLUMN IF NOT EXISTS "musicFingerprint" VARCHAR(64)`);
    // the database itself refuses a tune that has been used before
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "socialPosts_musicFingerprint_key" ON "socialPosts" ("musicFingerprint")`);
    await db.execute(sql`ALTER TABLE "socialPosts" ENABLE ROW LEVEL SECURITY`);
    await db.execute(sql`ALTER TABLE "socialTokens" ENABLE ROW LEVEL SECURITY`);
    ensured = true;
  }
  return db;
}

function rowToPost(row: Record<string, any>): SocialPost {
  return { ...row, slides: row.slides ?? [], imageUrls: row.imageUrls ?? [], musicSeed: row.musicSeed == null ? null : Number(row.musicSeed) } as SocialPost;
}

export async function getPost(slotDate: string, slot: SlotName): Promise<SocialPost | null> {
  const db = await requireDb();
  const res = await db.execute(sql`SELECT * FROM "socialPosts" WHERE "slotDate" = ${slotDate} AND "slot" = ${slot} LIMIT 1`);
  return res.rows[0] ? rowToPost(res.rows[0]) : null;
}

export async function insertPost(post: Omit<SocialPost, "id" | "status" | "igMediaId" | "igStoryId" | "fbPostId" | "fbStoryId" | "error" | "attempts">): Promise<SocialPost | null> {
  const db = await requireDb();
  const res = await db.execute(sql`INSERT INTO "socialPosts"
    ("slotDate", "slot", "kind", "sourceRef", "isAiGenerated", "slides", "caption", "imageUrls", "storyUrl", "reelUrl", "musicSeed", "musicFingerprint")
    VALUES (${post.slotDate}, ${post.slot}, ${post.kind}, ${post.sourceRef}, ${post.isAiGenerated},
      ${JSON.stringify(post.slides)}::jsonb, ${post.caption}, ${JSON.stringify(post.imageUrls)}::jsonb, ${post.storyUrl},
      ${post.reelUrl}, ${post.musicSeed}, ${post.musicFingerprint})
    ON CONFLICT ("slotDate", "slot") DO NOTHING
    RETURNING *`);
  return res.rows[0] ? rowToPost(res.rows[0]) : null;
}

/** Atomically claims a post for publishing. A row stuck in 'publishing' for 10 minutes (a crashed run) can be reclaimed. */
export async function claimPost(id: number): Promise<SocialPost | null> {
  const db = await requireDb();
  const res = await db.execute(sql`UPDATE "socialPosts"
    SET "status" = 'publishing', "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" = ${id}
      AND ("status" IN ('ready', 'partial') OR ("status" = 'publishing' AND "updatedAt" < now() - interval '10 minutes'))
      AND "attempts" < 3
    RETURNING *`);
  return res.rows[0] ? rowToPost(res.rows[0]) : null;
}

export async function savePublishResult(id: number, fields: Pick<SocialPost, "status" | "igMediaId" | "igStoryId" | "fbPostId" | "fbStoryId" | "error">) {
  const db = await requireDb();
  await db.execute(sql`UPDATE "socialPosts" SET
    "status" = ${fields.status}, "igMediaId" = ${fields.igMediaId}, "igStoryId" = ${fields.igStoryId},
    "fbPostId" = ${fields.fbPostId}, "fbStoryId" = ${fields.fbStoryId}, "error" = ${fields.error},
    "updatedAt" = now(), "postedAt" = CASE WHEN ${fields.status} = 'posted' THEN now() ELSE "postedAt" END
    WHERE "id" = ${id}`);
}

/** sourceRefs (e.g. "gallery:14", "service:1641") used since `sinceDate`, so photos don't repeat within two weeks. */
export async function recentSourceRefs(sinceDate: string): Promise<Set<string>> {
  const db = await requireDb(false);
  const res = await orEmpty(() => db.execute(sql`SELECT "sourceRef" FROM "socialPosts" WHERE "slotDate" >= ${sinceDate} AND "sourceRef" IS NOT NULL`));
  return new Set(res.rows.map((r: any) => String(r.sourceRef)));
}

/** Before the first real run the table may not exist yet (preview); treat that as "no history". */
export async function orEmpty<T extends { rows: any[] }>(run: () => Promise<T>): Promise<{ rows: any[] }> {
  try {
    return await run();
  } catch (err: any) {
    if (err?.code === "42P01" || err?.cause?.code === "42P01") return { rows: [] };
    throw err;
  }
}

/** Recent headlines and captions, fed to the writer so it doesn't repeat itself. */
export async function recentWriting(limit = 24): Promise<string[]> {
  const db = await requireDb(false);
  const res = await orEmpty(() => db.execute(sql`SELECT "kind", "caption" FROM "socialPosts" ORDER BY "slotDate" DESC, "slot" DESC LIMIT ${limit}`));
  return res.rows.map((r: any) => `[${r.kind}] ${String(r.caption).split("\n")[0].slice(0, 160)}`);
}

/** True if this tune has ever been attached to a post. */
export async function isMusicUsed(fingerprint: string): Promise<boolean> {
  const db = await requireDb();
  const res = await db.execute(sql`SELECT 1 FROM "socialPosts" WHERE "musicFingerprint" = ${fingerprint} LIMIT 1`);
  return res.rows.length > 0;
}

export async function getToken(platform: string): Promise<{ token: string; refreshedAt: Date } | null> {
  const db = await requireDb();
  const res = await db.execute(sql`SELECT "token", "refreshedAt" FROM "socialTokens" WHERE "platform" = ${platform}`);
  const row: any = res.rows[0];
  return row ? { token: String(row.token), refreshedAt: new Date(row.refreshedAt) } : null;
}

export async function saveToken(platform: string, token: string, expiresInSeconds: number) {
  const db = await requireDb();
  await db.execute(sql`INSERT INTO "socialTokens" ("platform", "token", "refreshedAt", "expiresAt")
    VALUES (${platform}, ${token}, now(), now() + make_interval(secs => ${expiresInSeconds}))
    ON CONFLICT ("platform") DO UPDATE SET "token" = EXCLUDED."token", "refreshedAt" = now(), "expiresAt" = EXCLUDED."expiresAt"`);
}
