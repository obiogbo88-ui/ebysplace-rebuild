// @ts-nocheck
import express, { type Application, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { getSharePreviewMeta, injectSharePreview } from "./sharePreview";

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

export function serveStatic(app: Application) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "..", "dist", "public")
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
  app.use("*", (req: Request, res: Response, next: NextFunction) => {
    if (isBackendApiRequest(req.originalUrl || req.url)) {
      return next();
    }

    const shareKind = typeof req.query?.__share === "string" ? req.query.__share : "";
    const shareSlug = typeof req.query?.__slug === "string" ? req.query.__slug : "";
    if (shareKind && shareSlug) {
      // Shared service/product link: same page, but with that item's own
      // link-preview photo and title (see sharePreview.ts).
      getSharePreviewMeta(shareKind, shareSlug)
        .then((meta) => {
          if (!meta) return res.status(200).sendFile(indexPath, error => { if (error) next(error); });
          const html = injectSharePreview(fs.readFileSync(indexPath, "utf8"), meta);
          res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
          res.status(200).type("html").send(html);
        })
        .catch((error) => {
          console.warn("[SharePreview] Falling back to generic page", error);
          res.status(200).sendFile(indexPath, sendError => { if (sendError) next(sendError); });
        });
      return;
    }

    res.status(200).sendFile(indexPath, error => {
      if (error) next(error);
    });
  });
}
