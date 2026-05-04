import fs from "node:fs/promises";
import path from "node:path";

const roots = ["client", "server", "api", "scripts", "vercel.json", "package.json"];
const excludedDirs = new Set(["node_modules", ".git", "dist", ".manus-logs"]);
const excludedFiles = new Set(["scripts/scan-production-readiness.mjs"]);
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css", ".py"]);
const proprietary = [/forge\.manus\.ai/i, /manus-storage/i, /ManusDialog/i, /BUILT_IN_FORGE/i, /VITE_FRONTEND_FORGE/i, /forgeApi/i, /Manus/];
const mediaUrlPattern = /https:\/\/jcyoipbiplzrocrrhwkp\.supabase\.co\/storage\/v1\/object\/public\/ebysplace-media\/[^\s"')\]}<>]+/g;

async function collect(entry) {
  const out = [];
  const stat = await fs.stat(entry).catch(() => null);
  if (!stat) return out;
  async function visit(file) {
    const st = await fs.stat(file);
    if (st.isDirectory()) {
      if (excludedDirs.has(path.basename(file))) return;
      for (const item of await fs.readdir(file)) await visit(path.join(file, item));
      return;
    }
    const rel = path.relative(process.cwd(), file);
    if (excludedFiles.has(rel)) return;
    if (exts.has(path.extname(file))) out.push(rel);
  }
  await visit(entry);
  return out;
}

const files = (await Promise.all(roots.map(collect))).flat();
const findings = [];
const mediaUrls = new Set();
for (const file of files) {
  const text = await fs.readFile(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    for (const pattern of proprietary) {
      if (pattern.test(lines[i])) findings.push({ file, line: i + 1, pattern: pattern.source, text: lines[i].trim().slice(0, 240) });
    }
  }
  for (const match of text.matchAll(mediaUrlPattern)) mediaUrls.add(match[0]);
}

console.log(JSON.stringify({ findings, mediaUrlCount: mediaUrls.size, sampleMediaUrls: [...mediaUrls].sort().slice(0, 30) }, null, 2));
