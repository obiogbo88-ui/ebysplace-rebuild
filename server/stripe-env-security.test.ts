import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const projectRoot = join(__dirname, "..");
const forbiddenStripeSecretPatterns = [
  /sk_live_[A-Za-z0-9]+/,
  /pk_live_[A-Za-z0-9]+/,
  /whsec_[A-Za-z0-9]+/,
];

const allowedFiles = new Set([
  "server/stripe-env-security.test.ts",
  "todo.md",
]);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", ".manus-logs", "coverage"].includes(entry)) continue;
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|json|md|html|css|env)$/.test(entry)) {
      files.push(absolutePath);
    }
  }
  return files;
}

describe("Stripe environment security", () => {
  it("does not hard-code live Stripe keys or webhook secrets in website source files", () => {
    const offenders = collectSourceFiles(projectRoot)
      .filter((filePath) => !allowedFiles.has(relative(projectRoot, filePath)))
      .filter((filePath) => {
        const content = readFileSync(filePath, "utf8");
        return forbiddenStripeSecretPatterns.some((pattern) => pattern.test(content));
      })
      .map((filePath) => relative(projectRoot, filePath));

    expect(offenders).toEqual([]);
  });
});
