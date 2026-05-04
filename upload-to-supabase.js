#!/usr/bin/env node
/*
 * Eby’s Place Manus Storage → Supabase Storage media migration.
 *
 * This script reads /manus-storage image references from all-media-urls.txt,
 * downloads each image from a configured source origin, uploads the files to
 * the Supabase Storage bucket `ebysplace-media`, writes deterministic mapping
 * files, and can optionally replace code references with Supabase public URLs.
 *
 * Required:
 *   SUPABASE_SERVICE_ROLE_KEY=... node upload-to-supabase.js
 *
 * Optional:
 *   SUPABASE_URL=https://jcyoipbiplzrocrrhwkp.supabase.co
 *   SUPABASE_BUCKET=ebysplace-media
 *   MANUS_SOURCE_ORIGIN=http://localhost:3000
 *   node upload-to-supabase.js --replace-code
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = __dirname;
const INVENTORY_PATH = path.join(PROJECT_ROOT, "all-media-urls.txt");
const DOWNLOAD_DIR = path.join(PROJECT_ROOT, "migration-downloads", "manus-storage-images");
const MAPPING_JSON = path.join(PROJECT_ROOT, "supabase-media-url-map.json");
const MAPPING_TXT = path.join(PROJECT_ROOT, "supabase-media-url-map.txt");
const REPORT_PATH = path.join(PROJECT_ROOT, "supabase-media-migration-report.txt");

const SUPABASE_URL = stripTrailingSlash(process.env.SUPABASE_URL || "https://jcyoipbiplzrocrrhwkp.supabase.co");
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "ebysplace-media";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_ORIGIN = stripTrailingSlash(process.env.MANUS_SOURCE_ORIGIN || process.env.SITE_ORIGIN || "http://localhost:3000");
const SHOULD_REPLACE_CODE = process.argv.includes("--replace-code");
const DRY_RUN = process.argv.includes("--dry-run");
const DOWNLOAD_ONLY = process.argv.includes("--download-only");

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|avif|svg|ico)(\?.*)?$/i;
const MANUS_STORAGE_PATTERN = /\/manus-storage\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g;
const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".html",
  ".css",
  ".md",
]);
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".vercel",
  ".manus-logs",
  "migration-downloads",
]);
const EXCLUDED_FILES = new Set([
  path.basename(MAPPING_JSON),
  path.basename(MAPPING_TXT),
  path.basename(REPORT_PATH),
]);

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sanitizeObjectName(manusPath) {
  const parsed = path.posix.basename(manusPath.split("?")[0]);
  const extension = path.posix.extname(parsed).toLowerCase();
  const stem = parsed.slice(0, parsed.length - extension.length);
  const safeStem = stem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const shortHash = crypto.createHash("sha256").update(manusPath).digest("hex").slice(0, 10);
  return `manus-storage/${safeStem || "media"}-${shortHash}${extension || ".bin"}`;
}

function contentTypeFor(fileName, fallback = "application/octet-stream") {
  const extension = path.posix.extname(fileName).toLowerCase();
  const types = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  return types[extension] || fallback;
}

function publicSupabaseUrl(objectKey) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURI(objectKey).replace(/%2F/g, "/")}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new Error(`Network request failed for ${url}: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function readManusImagePaths() {
  const inventory = await fs.readFile(INVENTORY_PATH, "utf8");
  const matches = inventory.match(MANUS_STORAGE_PATTERN) || [];
  const cleaned = matches
    .map((match) => match.trim().replace(/[.,;:)\]]+$/, ""))
    .filter((match) => IMAGE_EXTENSION_PATTERN.test(match))
    .filter((match) => !match.includes("*") && !match.includes(":"));
  return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
}

async function validateSupabaseAccess() {
  if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === "YOUR_SERVICE_ROLE_KEY") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing or still set to the placeholder YOUR_SERVICE_ROLE_KEY. " +
        "Set the real service role key in the environment before running uploads."
    );
  }

  const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/bucket/${SUPABASE_BUCKET}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (response.status === 404) {
    const createResponse = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: true }),
    });
    if (!createResponse.ok) {
      const body = await createResponse.text();
      throw new Error(`Unable to create Supabase bucket ${SUPABASE_BUCKET}: ${createResponse.status} ${body}`);
    }
    return;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to access Supabase bucket ${SUPABASE_BUCKET}: ${response.status} ${body}`);
  }
}

async function readCachedImage(manusPath, sourceUrl, destination, downloadError) {
  const fileName = path.posix.basename(manusPath);
  try {
    const bytes = await fs.readFile(destination);
    return {
      sourceUrl,
      destination,
      bytes,
      contentType: contentTypeFor(fileName),
      note: `Used cached download after source fetch failed: ${downloadError}`,
    };
  } catch {
    throw new Error(downloadError);
  }
}

async function downloadImage(manusPath) {
  const sourceUrl = `${SOURCE_ORIGIN}${manusPath}`;
  const fileName = path.posix.basename(manusPath);
  const destination = path.join(DOWNLOAD_DIR, fileName);
  let response;

  try {
    response = await fetchWithTimeout(sourceUrl, {}, 45000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return readCachedImage(manusPath, sourceUrl, destination, message);
  }

  if (!response.ok) {
    return readCachedImage(manusPath, sourceUrl, destination, `Download failed for ${sourceUrl}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || contentTypeFor(fileName);
  if (!contentType.toLowerCase().startsWith("image/")) {
    return readCachedImage(manusPath, sourceUrl, destination, `Downloaded content is not an image for ${sourceUrl}: ${contentType}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
  return { sourceUrl, destination, bytes, contentType };
}

async function uploadImage(objectKey, bytes, contentType) {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${encodeURI(objectKey).replace(/%2F/g, "/")}`;
  const response = await fetchWithTimeout(
    uploadUrl,
    {
      method: "PUT",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "Cache-Control": "31536000, immutable",
        "x-upsert": "true",
      },
      body: bytes,
    },
    60000
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upload failed for ${objectKey}: HTTP ${response.status} ${body}`);
  }
}

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name)) && !EXCLUDED_FILES.has(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function replaceCodeReferences(mapping) {
  const replacementPairs = mapping
    .filter((entry) => entry.status === "uploaded" && entry.supabasePublicUrl)
    .map((entry) => [entry.manusPath, entry.supabasePublicUrl]);

  if (replacementPairs.length === 0) {
    throw new Error("No uploaded mapping entries are available for code replacement.");
  }

  const files = await walkFiles(PROJECT_ROOT);
  const changedFiles = [];
  for (const filePath of files) {
    let content = await fs.readFile(filePath, "utf8");
    const original = content;
    for (const [oldUrl, newUrl] of replacementPairs) {
      content = content.split(oldUrl).join(newUrl);
    }
    if (content !== original) {
      await fs.writeFile(filePath, content);
      changedFiles.push(path.relative(PROJECT_ROOT, filePath));
    }
  }
  return changedFiles;
}

async function writeMapping(mapping, changedFiles = []) {
  const summary = {
    generatedAt: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    supabaseBucket: SUPABASE_BUCKET,
    sourceOrigin: SOURCE_ORIGIN,
    total: mapping.length,
    uploaded: mapping.filter((entry) => entry.status === "uploaded").length,
    downloaded: mapping.filter((entry) => entry.status === "downloaded").length,
    failed: mapping.filter((entry) => entry.status === "failed").length,
    changedFiles,
    mapping,
  };

  await fs.writeFile(MAPPING_JSON, `${JSON.stringify(summary, null, 2)}\n`);

  const txtLines = [
    "Eby’s Place Supabase Media URL Map",
    `Generated: ${summary.generatedAt}`,
    `Supabase URL: ${SUPABASE_URL}`,
    `Bucket: ${SUPABASE_BUCKET}`,
    `Source origin: ${SOURCE_ORIGIN}`,
    `Total: ${summary.total}`,
    `Uploaded: ${summary.uploaded}`,
    `Downloaded only: ${summary.downloaded}`,
    `Failed: ${summary.failed}`,
    "",
  ];

  for (const entry of mapping) {
    txtLines.push(`${entry.status.toUpperCase()}: ${entry.manusPath}`);
    if (entry.sourceUrl) txtLines.push(`  Source: ${entry.sourceUrl}`);
    if (entry.objectKey) txtLines.push(`  Object key: ${entry.objectKey}`);
    if (entry.supabasePublicUrl) txtLines.push(`  Supabase: ${entry.supabasePublicUrl}`);
    if (entry.error) txtLines.push(`  Error: ${entry.error}`);
    txtLines.push("");
  }

  if (changedFiles.length > 0) {
    txtLines.push("Changed files:");
    for (const file of changedFiles) txtLines.push(`  - ${file}`);
    txtLines.push("");
  }

  await fs.writeFile(MAPPING_TXT, `${txtLines.join("\n")}\n`);
  await fs.writeFile(
    REPORT_PATH,
    `Supabase media migration ${summary.failed === 0 ? "completed" : "completed with failures"}.\n` +
      `Uploaded ${summary.uploaded} of ${summary.total} Manus storage image references.\n` +
      `Downloaded only ${summary.downloaded} of ${summary.total} Manus storage image references.\n` +
      `Mapping JSON: ${path.relative(PROJECT_ROOT, MAPPING_JSON)}\n` +
      `Mapping text: ${path.relative(PROJECT_ROOT, MAPPING_TXT)}\n` +
      `Changed files: ${changedFiles.length}\n`
  );
}

async function main() {
  console.log("Reading media inventory...");
  const manusPaths = await readManusImagePaths();
  console.log(`Found ${manusPaths.length} unique Manus storage image paths.`);

  if (manusPaths.length === 0) {
    throw new Error("No /manus-storage image paths were found in all-media-urls.txt.");
  }

  if (!DRY_RUN && !DOWNLOAD_ONLY) {
    console.log(`Validating Supabase bucket ${SUPABASE_BUCKET} at ${SUPABASE_URL}...`);
    await validateSupabaseAccess();
  }

  const mapping = [];
  for (const manusPath of manusPaths) {
    const objectKey = sanitizeObjectName(manusPath);
    const supabasePublicUrl = publicSupabaseUrl(objectKey);
    try {
      if (DRY_RUN) {
        mapping.push({ status: "dry-run", manusPath, sourceUrl: `${SOURCE_ORIGIN}${manusPath}`, objectKey, supabasePublicUrl });
        continue;
      }

      console.log(`Downloading ${manusPath}...`);
      const downloaded = await downloadImage(manusPath);
      if (DOWNLOAD_ONLY) {
        mapping.push({
          status: "downloaded", 
          manusPath,
          sourceUrl: downloaded.sourceUrl,
          localPath: path.relative(PROJECT_ROOT, downloaded.destination),
          bytes: downloaded.bytes.length,
          contentType: downloaded.contentType,
          objectKey,
          supabasePublicUrl,
        });
        continue;
      }

      console.log(`Uploading ${objectKey}...`);
      await uploadImage(objectKey, downloaded.bytes, downloaded.contentType);
      mapping.push({
        status: "uploaded",
        manusPath,
        sourceUrl: downloaded.sourceUrl,
        localPath: path.relative(PROJECT_ROOT, downloaded.destination),
        bytes: downloaded.bytes.length,
        contentType: downloaded.contentType,
        objectKey,
        supabasePublicUrl,
        note: downloaded.note,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${manusPath}: ${message}`);
      mapping.push({ status: "failed", manusPath, sourceUrl: `${SOURCE_ORIGIN}${manusPath}`, objectKey, supabasePublicUrl, error: message });
    }
  }

  const failed = mapping.filter((entry) => entry.status === "failed");
  let changedFiles = [];
  if (SHOULD_REPLACE_CODE && !DRY_RUN) {
    if (failed.length > 0) {
      console.warn("Replacing verified uploaded references only; failed entries will remain unchanged for manual review.");
    } else {
      console.log("Replacing code references with Supabase public URLs...");
    }
    changedFiles = await replaceCodeReferences(mapping);
    console.log(`Updated ${changedFiles.length} files.`);
  }

  await writeMapping(mapping, changedFiles);

  if (failed.length > 0) {
    process.exitCode = 1;
    console.error(`Migration finished with ${failed.length} failure(s). See ${path.relative(PROJECT_ROOT, MAPPING_TXT)}.`);
  } else {
    console.log(`Migration finished successfully. See ${path.relative(PROJECT_ROOT, MAPPING_TXT)}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
