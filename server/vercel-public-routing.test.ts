import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("Vercel public frontend routing", () => {
  it("routes every Vercel request into the Express serverless adapter", () => {
    const vercelConfig = JSON.parse(readProjectFile("vercel.json"));

    expect(vercelConfig.outputDirectory).toBe("public");
    expect(vercelConfig.functions["api/index.ts"].includeFiles).toBe("public/**");
    expect(vercelConfig.rewrites).toEqual([
      {
        source: "/(.*)",
        destination: "/api/index",
      },
    ]);
  });

  it("exposes a Vercel API entry point that delegates to the Express adapter", () => {
    const apiEntrySource = readProjectFile("api/index.ts").trim();

    expect(apiEntrySource).toBe('export { default } from "../server/vercel";');
  });

  it("serves production frontend assets from the root public build output before legacy locations", () => {
    const staticServerSource = readProjectFile("server/_core/vite.ts");

    expect(staticServerSource).toContain('path.resolve(process.cwd(), "public")');
    expect(staticServerSource.indexOf('path.resolve(process.cwd(), "public")')).toBeLessThan(
      staticServerSource.indexOf('path.resolve(import.meta.dirname, "public")')
    );
    expect(staticServerSource).toContain('fs.existsSync(path.resolve(candidate, "index.html"))');
  });

  it("keeps real API paths out of the SPA fallback while allowing Vercel's internal adapter path to serve the frontend", () => {
    const staticServerSource = readProjectFile("server/_core/vite.ts");

    expect(staticServerSource).toContain("function isBackendApiRequest(url: string)");
    expect(staticServerSource).toContain('pathname === "/api/index" || pathname === "/api/index/"');
    expect(staticServerSource).toContain("return false;");
    expect(staticServerSource).toContain('return pathname === "/api" || pathname.startsWith("/api/");');
    expect(staticServerSource).toContain('app.use("*", (req: Request, res: Response, next: NextFunction) => {');
    expect(staticServerSource).toContain("isBackendApiRequest(req.originalUrl || req.url)");
    expect(staticServerSource).toContain("return next();");
    expect(staticServerSource).toContain("res.status(200).sendFile(indexPath");
  });

  it("registers the same public static fallback in the Vercel Express adapter after API middleware", () => {
    const vercelSource = readProjectFile("server/vercel.ts");

    expect(vercelSource).toContain('import { serveStatic } from "./_core/vite";');
    expect(vercelSource.indexOf('app.use(\n  "/api/trpc"')).toBeLessThan(vercelSource.indexOf("serveStatic(app);"));
    expect(vercelSource.trim()).toMatch(/serveStatic\(app\);\n\nexport default app;$/);
  });

  it("does not leave unresolved analytics placeholders in the production HTML shell", () => {
    const html = readProjectFile("client/index.html");

    expect(html).not.toContain("%VITE_ANALYTICS_ENDPOINT%");
    expect(html).not.toContain("%VITE_ANALYTICS_WEBSITE_ID%");
    expect(html).not.toContain("/umami");
  });
});
