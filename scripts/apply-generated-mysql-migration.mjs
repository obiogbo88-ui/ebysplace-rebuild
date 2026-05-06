import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing; cannot apply generated MySQL migration.");
}

const migrationPath = resolve(process.cwd(), "drizzle/0004_closed_vengeance.sql");
const rawSql = readFileSync(migrationPath, "utf8");
const statements = rawSql
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const pool = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 1,
  ssl: { rejectUnauthorized: true },
});

try {
  for (const statement of statements) {
    try {
      await pool.query(statement);
      console.log(`[migration] applied: ${statement.slice(0, 110)}`);
    } catch (error) {
      const code = error?.code ?? "";
      const message = String(error?.message ?? error);
      const isDuplicateColumn = code === "ER_DUP_FIELDNAME" || /Duplicate column name/i.test(message);
      const isAlreadyCompatible = /Check for change column is the same/i.test(message);
      if (isDuplicateColumn || isAlreadyCompatible) {
        console.log(`[migration] skipped already-applied change: ${statement.slice(0, 110)}`);
        continue;
      }
      throw error;
    }
  }
} finally {
  await pool.end();
}
