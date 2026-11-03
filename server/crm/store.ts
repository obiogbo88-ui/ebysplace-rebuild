import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * CRM-only tables: what Eby adds by hand (notes, tags), per-client and
 * studio-wide automation switches, and a log of what each automation sent so
 * nobody ever gets the same nudge twice.
 *
 * Created at runtime like the social tables (see server/social/store.ts) and
 * mirrored in drizzle/0017_crm.sql. RLS on with no policies: only the server
 * (connecting as postgres) can read them, never the public anon key.
 */

let ensured = false;

export async function crmDb() {
  const db = await getDb();
  if (!db) throw new Error("The CRM needs DATABASE_URL.");
  if (!ensured) {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "crmClientNotes" (
      "clientKey" VARCHAR(340) PRIMARY KEY,
      "body" TEXT NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "crmClientTags" (
      "clientKey" VARCHAR(340) NOT NULL,
      "tag" VARCHAR(60) NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("clientKey", "tag")
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "crmClientPrefs" (
      "clientKey" VARCHAR(340) NOT NULL,
      "automation" VARCHAR(40) NOT NULL,
      "enabled" BOOLEAN NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("clientKey", "automation")
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "crmAutomationSettings" (
      "key" VARCHAR(40) PRIMARY KEY,
      "enabled" BOOLEAN NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "crmAutomationSends" (
      "id" SERIAL PRIMARY KEY,
      "automation" VARCHAR(40) NOT NULL,
      "clientKey" VARCHAR(340) NOT NULL,
      "refId" VARCHAR(120) NOT NULL,
      "channel" VARCHAR(20) NOT NULL,
      "sentAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE ("automation", "refId")
    )`);
    for (const t of ["crmClientNotes", "crmClientTags", "crmClientPrefs", "crmAutomationSettings", "crmAutomationSends"]) {
      await db.execute(sql.raw(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`));
    }
    ensured = true;
  }
  return db;
}

export async function loadExtras() {
  const db = await crmDb();
  const [tags, notes, prefs] = await Promise.all([
    db.execute(sql`SELECT "clientKey", "tag" FROM "crmClientTags" ORDER BY "createdAt"`),
    db.execute(sql`SELECT "clientKey", "body", "updatedAt" FROM "crmClientNotes"`),
    db.execute(sql`SELECT "clientKey" FROM "crmClientPrefs" WHERE "automation" = 'marketing' AND "enabled" = false`),
  ]);
  const tagMap = new Map<string, string[]>();
  for (const r of tags.rows as Array<{ clientKey: string; tag: string }>) tagMap.set(r.clientKey, [...(tagMap.get(r.clientKey) ?? []), r.tag]);
  const noteMap = new Map<string, { body: string; updatedAt: string }>();
  for (const r of notes.rows as Array<{ clientKey: string; body: string; updatedAt: string }>) noteMap.set(r.clientKey, { body: r.body, updatedAt: r.updatedAt });
  const optedOut = new Set((prefs.rows as Array<{ clientKey: string }>).map((r) => r.clientKey));
  return { tags: tagMap, notes: noteMap, optedOut };
}

export async function saveNote(clientKey: string, body: string) {
  const db = await crmDb();
  if (!body.trim()) {
    await db.execute(sql`DELETE FROM "crmClientNotes" WHERE "clientKey" = ${clientKey}`);
    return;
  }
  await db.execute(sql`INSERT INTO "crmClientNotes" ("clientKey", "body") VALUES (${clientKey}, ${body})
    ON CONFLICT ("clientKey") DO UPDATE SET "body" = EXCLUDED."body", "updatedAt" = now()`);
}

export async function addTag(clientKey: string, tag: string) {
  const db = await crmDb();
  await db.execute(sql`INSERT INTO "crmClientTags" ("clientKey", "tag") VALUES (${clientKey}, ${tag}) ON CONFLICT DO NOTHING`);
}

export async function removeTag(clientKey: string, tag: string) {
  const db = await crmDb();
  await db.execute(sql`DELETE FROM "crmClientTags" WHERE "clientKey" = ${clientKey} AND "tag" = ${tag}`);
}

export async function clientPrefs(clientKey: string): Promise<Record<string, boolean>> {
  const db = await crmDb();
  const res = await db.execute(sql`SELECT "automation", "enabled" FROM "crmClientPrefs" WHERE "clientKey" = ${clientKey}`);
  return Object.fromEntries((res.rows as Array<{ automation: string; enabled: boolean }>).map((r) => [r.automation, r.enabled]));
}

export async function setClientPref(clientKey: string, automation: string, enabled: boolean) {
  const db = await crmDb();
  await db.execute(sql`INSERT INTO "crmClientPrefs" ("clientKey", "automation", "enabled") VALUES (${clientKey}, ${automation}, ${enabled})
    ON CONFLICT ("clientKey", "automation") DO UPDATE SET "enabled" = EXCLUDED."enabled", "updatedAt" = now()`);
}

/** Every client switched off for one automation (or for all marketing). */
export async function clientsSwitchedOff(automation: string): Promise<Set<string>> {
  const db = await crmDb();
  const res = await db.execute(sql`SELECT "clientKey" FROM "crmClientPrefs" WHERE "enabled" = false AND "automation" IN (${automation}, 'marketing')`);
  return new Set((res.rows as Array<{ clientKey: string }>).map((r) => r.clientKey));
}

export async function automationSettings(): Promise<Record<string, boolean>> {
  const db = await crmDb();
  const res = await db.execute(sql`SELECT "key", "enabled" FROM "crmAutomationSettings"`);
  return Object.fromEntries((res.rows as Array<{ key: string; enabled: boolean }>).map((r) => [r.key, r.enabled]));
}

export async function setAutomationSetting(key: string, enabled: boolean) {
  const db = await crmDb();
  await db.execute(sql`INSERT INTO "crmAutomationSettings" ("key", "enabled") VALUES (${key}, ${enabled})
    ON CONFLICT ("key") DO UPDATE SET "enabled" = EXCLUDED."enabled", "updatedAt" = now()`);
}

/**
 * Claims a send before it happens. Returns false if this automation already
 * went out for this ref (e.g. one booking), so retries and overlapping cron
 * runs can never double-send.
 */
export async function claimSend(automation: string, clientKey: string, refId: string, channel: string) {
  const db = await crmDb();
  const res = await db.execute(sql`INSERT INTO "crmAutomationSends" ("automation", "clientKey", "refId", "channel")
    VALUES (${automation}, ${clientKey}, ${refId}, ${channel}) ON CONFLICT ("automation", "refId") DO NOTHING RETURNING "id"`);
  return res.rows.length > 0;
}

export async function releaseSend(automation: string, refId: string) {
  const db = await crmDb();
  await db.execute(sql`DELETE FROM "crmAutomationSends" WHERE "automation" = ${automation} AND "refId" = ${refId}`);
}

export async function sendsFor(clientKey: string) {
  const db = await crmDb();
  const res = await db.execute(sql`SELECT "automation", "channel", "sentAt" FROM "crmAutomationSends" WHERE "clientKey" = ${clientKey} ORDER BY "sentAt" DESC LIMIT 50`);
  return res.rows as Array<{ automation: string; channel: string; sentAt: string }>;
}

export async function recentSends(limit = 20) {
  const db = await crmDb();
  const res = await db.execute(sql`SELECT "automation", "clientKey", "channel", "sentAt" FROM "crmAutomationSends" ORDER BY "sentAt" DESC LIMIT ${limit}`);
  return res.rows as Array<{ automation: string; clientKey: string; channel: string; sentAt: string }>;
}

export async function lastSendOf(automation: string, clientKey: string) {
  const db = await crmDb();
  const res = await db.execute(sql`SELECT max("sentAt") AS "at" FROM "crmAutomationSends" WHERE "automation" = ${automation} AND "clientKey" = ${clientKey}`);
  return ((res.rows[0] as any)?.at as string | null) ?? null;
}
