import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * Admins added from the Command Centre (Website › Who can sign in). The
 * owner emails set in Vercel env vars always have access and can't be
 * removed here; everyone in this table can sign in too, until removed.
 */
export type AddedAdmin = { email: string; name: string | null; addedBy: string | null; addedAt: string; invitedAt: string | null };

let ensured = false;
let cache: { at: number; emails: Set<string> } | null = null;
const CACHE_MS = 30_000;

async function accessDb() {
  const db = await getDb();
  if (!db) return null;
  if (!ensured) {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "adminAccess" (
      "email" VARCHAR(320) PRIMARY KEY,
      "name" TEXT,
      "addedBy" VARCHAR(320),
      "addedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "invitedAt" TIMESTAMPTZ
    )`);
    await db.execute(sql.raw(`ALTER TABLE "adminAccess" ENABLE ROW LEVEL SECURITY`));
    ensured = true;
  }
  return db;
}

function rowsOf<T>(result: unknown): T[] {
  const r = result as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

export async function listAddedAdmins(): Promise<AddedAdmin[]> {
  const db = await accessDb();
  if (!db) return [];
  const res = await db.execute(sql`SELECT "email", "name", "addedBy", "addedAt", "invitedAt" FROM "adminAccess" ORDER BY "addedAt"`);
  return rowsOf<AddedAdmin>(res);
}

/** True when this email was added from the Command Centre (cached for 30 seconds). */
export async function isAddedAdmin(email: string | null | undefined): Promise<boolean> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    try {
      const list = await listAddedAdmins();
      cache = { at: Date.now(), emails: new Set(list.map((a) => a.email.toLowerCase())) };
    } catch (error) {
      console.error("[AdminAccess] Could not read added admins", error);
      return false;
    }
  }
  return cache.emails.has(e);
}

export async function addAdmin(input: { email: string; name: string | null; addedBy: string }) {
  const db = await accessDb();
  if (!db) throw new Error("The database isn't available.");
  const email = input.email.trim().toLowerCase();
  await db.execute(sql`INSERT INTO "adminAccess" ("email", "name", "addedBy") VALUES (${email}, ${input.name}, ${input.addedBy})
    ON CONFLICT ("email") DO UPDATE SET "name" = COALESCE(EXCLUDED."name", "adminAccess"."name")`);
  cache = null;
}

export async function removeAdmin(email: string) {
  const db = await accessDb();
  if (!db) throw new Error("The database isn't available.");
  await db.execute(sql`DELETE FROM "adminAccess" WHERE "email" = ${email.trim().toLowerCase()}`);
  cache = null;
}

export async function markInvited(email: string) {
  const db = await accessDb();
  if (!db) return;
  await db.execute(sql`UPDATE "adminAccess" SET "invitedAt" = now() WHERE "email" = ${email.trim().toLowerCase()}`);
}
