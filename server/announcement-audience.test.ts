import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const routers = read("server/routers.ts");
const db = read("server/db.ts");
const admin = read("client/src/pages/Admin.tsx");

describe("announcement audiences", () => {
  it("defaults to everyone on the database (owner's standing rule)", () => {
    expect(routers).toContain('audience: z.enum(["subscribers", "all_clients", "selected"]).default("all_clients")');
    expect(admin).toContain('audience: "all_clients" as "subscribers" | "all_clients" | "selected"');
  });

  it("can email only a specific list of people, without push or the full phone list", () => {
    expect(routers).toContain("selectedEmails: z.array(z.string().email()).max(200).optional()");
    expect(routers).toContain("input.channels.webPush && !isSelected");
    expect(routers).toContain("isSelected ? Promise.resolve([] as string[])");
    expect(admin).toContain('<option value="selected">Specific people (enter email addresses below)</option>');
  });

  it("covers every contact source and skips test-domain addresses", () => {
    expect(db).toContain("db.selectDistinct({ email: tryOnAccounts.email })");
    expect(db).toContain(String.raw`!/\.(test|example|invalid|localhost)$/.test(email)`);
  });
});
