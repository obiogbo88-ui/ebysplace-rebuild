// @ts-nocheck
import type { Application, Request, Response } from "express";
import { ENV } from "./env";

function sendImageFallback(res: Response, key: string, status = 200) {
  const label = key
    .split("/")
    .pop()
    ?.replace(/[-_]/g, " ")
    .replace(/\.[a-z0-9]+$/i, "")
    .slice(0, 80) || "Eby’s Place";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="Eby’s Place image placeholder"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#251913"/><stop offset="0.55" stop-color="#0d0907"/><stop offset="1" stop-color="#8f6b2f"/></linearGradient><radialGradient id="r" cx="50%" cy="35%" r="60%"><stop offset="0" stop-color="#f5d98c" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="900" fill="url(#g)"/><rect width="1200" height="900" fill="url(#r)"/><circle cx="600" cy="380" r="145" fill="none" stroke="#d6b36a" stroke-width="10" opacity="0.72"/><path d="M520 405c40-98 130-98 170-2 17 40 10 84-19 116-35 38-107 38-142 0-29-32-36-74-9-114Z" fill="#d6b36a" opacity="0.32"/><text x="600" y="630" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#f5e6bd">Eby’s Place</text><text x="600" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#fff" opacity="0.68">${label}</text></svg>`;
  res.status(status);
  res.set("Content-Type", "image/svg+xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.send(svg);
}

export function registerStorageProxy(app: Application) {
  app.get("/manus-storage/*", async (req: Request, res: Response) => {
    const key = (req.params as { 0?: string })[0];
    if (!key) {
      sendImageFallback(res, "missing-image", 400);
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      console.warn("[StorageProxy] Storage proxy not configured; serving branded fallback image.");
      sendImageFallback(res, key);
      return;
    }

    let forgeUrl: URL;
    try {
      forgeUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
    } catch (err) {
      console.warn("[StorageProxy] Invalid Forge storage URL; serving branded fallback image.", err);
      sendImageFallback(res, key);
      return;
    }

    try {
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        sendImageFallback(res, key);
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        sendImageFallback(res, key);
        return;
      }

      res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed; serving branded fallback image:", err);
      sendImageFallback(res, key);
    }
  });
}
