import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("website loading performance safeguards", () => {
  it("keeps public pages route-lazy so non-current pages do not inflate the startup bundle", () => {
    const app = readProjectFile("client/src/App.tsx");

    expect(app).toContain('import { lazy, Suspense, useEffect } from "react"');
    expect(app).toContain("<Suspense fallback={<RouteLoading />}> ".trim());

    const routeModules = [
      "Home",
      "Services",
      "Booking",
      "Shop",
      "TryOn",
      "Braiders",
      "Gallery",
      "Reviews",
      "BookingSuccess",
      "Admin",
    ];

    for (const moduleName of routeModules) {
      expect(app).toContain(`const ${moduleName} = lazy(() => import(`);
      expect(app).not.toMatch(new RegExp(`import\\s+${moduleName}\\s+from\\s+[\"']\\./pages/${moduleName}[\"']`));
    }
  });

  it("keeps production-only metadata out of shipped React markup and preserves on-demand HEIC loading", () => {
    const viteConfig = readProjectFile("vite.config.ts");

    expect(viteConfig).toContain('const isProductionBuild = process.env.NODE_ENV === "production"');
    expect(viteConfig).toContain('...(isProductionBuild ? [] : [jsxLocPlugin() as PluginOption])');
    expect(viteConfig).toContain('if (id.includes("heic2any")) return "heic2any"');
    expect(viteConfig).toContain("manualChunks(id)");
  });
});
