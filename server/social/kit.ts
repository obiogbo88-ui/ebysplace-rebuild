import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Brand kit for the Instagram/Facebook post renderer: colours from
 * client/src/index.css, the real Eby's Place logo (dark = original black
 * mark, light = the same PNG colour-inverted for black cards) and the
 * Google Fonts the site uses (Playfair Display, Inter, Lexend; SIL OFL).
 *
 * The files live in client/public/social-kit, which the client build copies
 * to public/social-kit, and vercel.json bundles public/** with the function.
 * If the filesystem copy can't be found the live site copy is fetched, so a
 * packaging change can never silently break posting.
 */
export const BRAND = {
  ink: "#1A1A1A",
  night: "#121212",
  paper: "#FAF7F2",
  gold: "#C9A84C",
  deepGold: "#8a641e",
  muted: "#4A453D",
  mutedOnDark: "#D9D3C7",
  faintOnDark: "#BDB6A8",
  rule: "#E4DDD0",
  alert: "#B3261E",
  instagramHandle: "@ebysplace1",
  site: "ebysplace.com",
} as const;

export function siteUrl() {
  const configured = String(process.env.EBYSPLACE_PUBLIC_URL || "").trim().replace(/\/+$/, "");
  return configured || "https://www.ebysplace.com";
}

const cache = new Map<string, Buffer>();

export async function loadKitFile(name: string): Promise<Buffer> {
  const hit = cache.get(name);
  if (hit) return hit;
  const candidates = [
    path.join(process.cwd(), "public", "social-kit", name),
    path.join(process.cwd(), "client", "public", "social-kit", name),
  ];
  for (const candidate of candidates) {
    try {
      const bytes = await readFile(candidate);
      cache.set(name, bytes);
      return bytes;
    } catch {
      // try the next location
    }
  }
  const response = await fetch(`${siteUrl()}/social-kit/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Social kit file ${name} could not be loaded (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  cache.set(name, bytes);
  return bytes;
}

export type SatoriFont = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" | "italic" };

export async function loadFonts(): Promise<SatoriFont[]> {
  const specs: Array<[string, string, SatoriFont["weight"], SatoriFont["style"]]> = [
    ["Playfair Display", "playfair-display-700-normal.woff", 700, "normal"],
    ["Playfair Display", "playfair-display-500-italic.woff", 500, "italic"],
    ["Inter", "inter-400-normal.woff", 400, "normal"],
    ["Inter", "inter-500-normal.woff", 500, "normal"],
    ["Inter", "inter-600-normal.woff", 600, "normal"],
    ["Lexend", "lexend-500-normal.woff", 500, "normal"],
  ];
  return Promise.all(specs.map(async ([name, file, weight, style]) => ({ name, data: await loadKitFile(file), weight, style })));
}

export async function logoDataUri(variant: "dark" | "light") {
  const bytes = await loadKitFile(variant === "dark" ? "logo-dark.png" : "logo-light.png");
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/** The logo PNG is 834x448. */
export const LOGO_ASPECT = 834 / 448;
