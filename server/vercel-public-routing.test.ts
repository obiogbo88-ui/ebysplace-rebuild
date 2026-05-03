import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("Vercel public frontend routing", () => {
  it("serves production frontend assets from the root public build output before legacy locations", () => {
    const staticServerSource = readProjectFile("server/_core/vite.ts");

    expect(staticServerSource).toContain('path.resolve(process.cwd(), "public")');
    expect(staticServerSource.indexOf('path.resolve(process.cwd(), "public")')).toBeLessThan(
      staticServerSource.indexOf('path.resolve(import.meta.dirname, "public")')
    );
    expect(staticServerSource).toContain('fs.existsSync(path.resolve(candidate, "index.html"))');
  });

  it("keeps API paths out of the SPA fallback so protected middleware remains authoritative", () => {
    const staticServerSource = readProjectFile("server/_core/vite.ts");

    expect(staticServerSource).toContain('app.use("*", (req, res, next) => {');
    expect(staticServerSource).toContain('req.originalUrl.startsWith("/api/")');
    expect(staticServerSource).toContain("return next();");
    expect(staticServerSource).toContain('res.sendFile(path.resolve(distPath, "index.html")');
  });

  it("registers the same public static fallback in the Vercel Express adapter after API middleware", () => {
    const vercelSource = readProjectFile("server/vercel.ts");

    expect(vercelSource).toContain('import { serveStatic } from "./_core/vite";');
    expect(vercelSource.indexOf('app.use(\n  "/api/trpc"')).toBeLessThan(vercelSource.indexOf("serveStatic(app);"));
    expect(vercelSource.trim()).toMatch(/serveStatic\(app\);\n\nexport default app;$/);
  });
});
