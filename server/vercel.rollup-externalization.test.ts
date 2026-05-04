import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel API Rollup externalization", () => {
  it("keeps Vite and Rollup build tooling out of the Vercel runtime entrypoint", () => {
    const vercelEntrypoint = readFileSync("server/vercel.ts", "utf8");

    expect(vercelEntrypoint).toContain('from "./static"');
    expect(vercelEntrypoint).not.toContain('from "./_core/vite"');
  });

  it("explicitly externalizes Rollup-native build dependencies in the API bundling script", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const buildApi = packageJson.scripts["build:api"] as string;

    expect(buildApi).toContain("--external:rollup");
    expect(buildApi).toContain("--external:@rollup/*");
    expect(buildApi).toContain("--external:vite");
  });
});
