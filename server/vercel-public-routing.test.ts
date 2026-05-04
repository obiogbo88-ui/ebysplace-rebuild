import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("Vercel public frontend routing", () => {
  it("routes API requests to the backend and all non-API routes to the static React frontend shell", () => {
    const vercelConfig = JSON.parse(readProjectFile("vercel.json"));

    expect(vercelConfig.outputDirectory).toBe("public");
    expect(vercelConfig.buildCommand).toBe("pnpm run build:vercel");
    expect(vercelConfig.functions["api/index.js"].includeFiles).toBe("public/**");
    expect(vercelConfig.rewrites).toEqual([
      {
        source: "/api/:path*",
        destination: "/api/index",
      },
      {
        source: "/:path*",
        destination: "/index.html",
      },
    ]);
  });

  it("exposes a bundled Vercel API entry point without unresolved local server imports", () => {
    const apiEntrySource = readProjectFile("api/index.js");

    expect(apiEntrySource).toContain("// server/vercel.ts");
    expect(apiEntrySource).toContain("vercel_default as default");
    expect(apiEntrySource).not.toContain('from "../server/vercel"');
    expect(apiEntrySource).not.toContain("from '../server/vercel'");
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

  it("keeps JSON API error handling before the secondary public static fallback in the Vercel Express adapter", () => {
    const vercelSource = readProjectFile("server/vercel.ts");

    expect(vercelSource).toContain('import { serveStatic } from "./_core/vite";');
    expect(vercelSource).toContain('import { apiJsonErrorHandler, registerApiJsonNotFound } from "./apiErrorHandling";');
    expect(vercelSource).toContain("console.error(\"[tRPC] Vercel API request failed\"");
    expect(vercelSource.indexOf('app.use(\n  "/api/trpc"')).toBeLessThan(vercelSource.indexOf("registerApiJsonNotFound(app);"));
    expect(vercelSource.indexOf("registerApiJsonNotFound(app);")).toBeLessThan(vercelSource.indexOf("serveStatic(app);"));
    expect(vercelSource.indexOf("serveStatic(app);")).toBeLessThan(vercelSource.indexOf("app.use(apiJsonErrorHandler);"));
    expect(vercelSource.trim()).toMatch(/app\.use\(apiJsonErrorHandler\);\n\nexport default app;$/);
  });

  it("defines a reusable JSON response boundary for API 404s and API exceptions", () => {
    const errorBoundarySource = readProjectFile("server/apiErrorHandling.ts");

    expect(errorBoundarySource).toContain("export function registerApiJsonNotFound");
    expect(errorBoundarySource).toContain("res.status(404).json");
    expect(errorBoundarySource).toContain("export const apiJsonErrorHandler");
    expect(errorBoundarySource).toContain("console.error(\"[API] Request failed\"");
    expect(errorBoundarySource).toContain("res.status(status).json");
  });

  it("keeps server-level TypeScript config relaxed for Vercel server builds", () => {
    const serverTsconfig = JSON.parse(readProjectFile("server/tsconfig.json"));

    expect(serverTsconfig.extends).toBe("../tsconfig.json");
    expect(serverTsconfig.compilerOptions.skipLibCheck).toBe(true);
    expect(serverTsconfig.compilerOptions.strict).toBe(false);
    expect(serverTsconfig.compilerOptions.noImplicitAny).toBe(false);
    expect(serverTsconfig.compilerOptions.noEmitOnError).toBe(false);
  });

  it("does not leave unresolved analytics placeholders in the production HTML shell", () => {
    const html = readProjectFile("client/index.html");

    expect(html).not.toContain("%VITE_ANALYTICS_ENDPOINT%");
    expect(html).not.toContain("%VITE_ANALYTICS_WEBSITE_ID%");
    expect(html).not.toContain("/umami");
  });
});
