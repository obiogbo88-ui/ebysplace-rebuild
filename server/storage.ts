// Supabase Storage helpers for Eby’s Place production media.

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jcyoipbiplzrocrrhwkp.supabase.co").replace(/\/+$/, "");
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "ebysplace-media";

function getSupabaseConfig() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
