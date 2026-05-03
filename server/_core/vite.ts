import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

function resolveProductionStaticPath() {
  const candidates = [
    path.resolve(process.cwd(), "public"),
    path.resolve(import.meta.dirname, "..", "public"),
    path.resolve(import.meta.dirname, "../..", "public"),
    path.resolve(import.meta.dirname, "public"),
    path.resolve(import.meta.dirname, "../..", "dist", "public"),
  ];

  return candidates.find(candidate => fs.existsSync(path.resolve(candidate, "index.html"))) ?? candidates[0];
}

function isBackendApiRequest(url: string) {
  const pathname = url.split("?")[0] ?? "/";

  // `/api/index` is the Vercel serverless adapter entry point. When Vercel
  // rewrites public frontend routes into that adapter, Express may see this
  // internal path rather than the visitor-facing route. Treat it as frontend
  // traffic so the SPA fallback still returns public/index.html instead of
  // passing through to a platform-level 403/404.
  if (pathname === "/api/index" || pathname === "/api/index/") {
    return false;
  }

  return pathname === "/api" || pathname.startsWith("/api/");
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : resolveProductionStaticPath();
  const indexPath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(indexPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath, { fallthrough: true, index: false }));

  // Fall through to public/index.html for every frontend route. Only real API
  // requests are excluded; the Vercel adapter path itself is intentionally not
  // treated as a backend API route, so public pages are never blocked here.
  app.use("*", (req, res, next) => {
    if (isBackendApiRequest(req.originalUrl || req.url)) {
      return next();
    }

    res.status(200).sendFile(indexPath, error => {
      if (error) next(error);
    });
  });
}
