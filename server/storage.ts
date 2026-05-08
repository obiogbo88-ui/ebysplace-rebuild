// Supabase Storage helpers for Eby’s Place production media.
import { normalizeEnvUrl, normalizeSecretKey, trimEnvValue } from "./_core/envSecrets";

const SUPABASE_URL = normalizeEnvUrl(process.env.SUPABASE_URL) || "https://jcyoipbiplzrocrrhwkp.supabase.co";
const SUPABASE_BUCKET = trimEnvValue(process.env.SUPABASE_STORAGE_BUCKET) || "ebysplace-media";

function getSupabaseConfig() {
  const serviceRoleKey = normalizeSecretKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    throw new Error("Storage is unavailable: configure SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.");
  }
  return { supabaseUrl: SUPABASE_URL, serviceRoleKey, bucket: SUPABASE_BUCKET };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^supabase:/, "").replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const cleanKey = normalizeKey(relKey);
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = cleanKey.lastIndexOf(".");
  if (lastDot === -1) return `${cleanKey}_${hash}`;
  return `${cleanKey.slice(0, lastDot)}_${hash}${cleanKey.slice(lastDot)}`;
}

function encodeObjectKey(key: string) {
  return normalizeKey(key).split("/").map((part) => encodeURIComponent(part)).join("/");
}

function publicUrlForKey(key: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${encodeObjectKey(key)}`;
}

export function storageKeyFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const prefix = `/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/`;
    if (parsed.origin !== SUPABASE_URL || !parsed.pathname.startsWith(prefix)) return null;
    return `supabase:${decodeURIComponent(parsed.pathname.slice(prefix.length))}`;
  } catch {
    return null;
  }
}

function toUploadBody(data: Buffer | Uint8Array | string, contentType: string) {
  if (typeof data === "string") return new Blob([data], { type: contentType });
  return new Blob([data as any], { type: contentType });
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseConfig();
  const key = appendHashSuffix(relKey);
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectKey(key)}`;

  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: toUploadBody(data, contentType),
  });

  if (!uploadResp.ok) {
    const msg = await uploadResp.text().catch(() => uploadResp.statusText);
    throw new Error(`Supabase storage upload failed (${uploadResp.status}): ${msg}`);
  }

  return { key: `supabase:${key}`, url: publicUrlForKey(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key: `supabase:${key}`, url: publicUrlForKey(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return (await storageGet(relKey)).url;
}

export async function storageRemove(relKeyOrUrl: string) {
  const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseConfig();
  const key = relKeyOrUrl.startsWith("http") ? storageKeyFromPublicUrl(relKeyOrUrl) : relKeyOrUrl;
  if (!key) return { deleted: false };
  const normalizedKey = normalizeKey(key);
  const deleteUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectKey(normalizedKey)}`;
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
  if (!response.ok && response.status !== 404) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`Supabase storage delete failed (${response.status}): ${msg}`);
  }
  return { deleted: response.ok || response.status === 404, key: `supabase:${normalizedKey}` };
}
