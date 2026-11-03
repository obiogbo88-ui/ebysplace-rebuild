/**
 * Meta Graph API clients for Eby's Place, adapted from CareVeya's working
 * pipeline (lib/social/*-graph-client.ts in CareFlow360).
 *
 * Instagram uses a token made by logging in as @ebysplace1 directly, so it
 * does NOT need the Facebook Page to be linked. The host depends on the token
 * type (see igBase below). Facebook uses the Page's own access token
 * (pages_manage_posts) on graph.facebook.com. A user or system-user token is
 * swapped for the Page token first, because Meta only lets a Page post as
 * itself (the "publish_actions is deprecated" error that broke CareVeya's
 * Facebook posting came from posting with the wrong kind of token).
 */

const GRAPH_VERSION = "v21.0";

/**
 * Instagram-login tokens (IGAA…) live on graph.instagram.com. Tokens from
 * "API setup with Unified login" (EAA…, a never-expiring system-user token,
 * the only option Meta gives new apps) live on graph.facebook.com. The
 * content-publishing endpoints are the same on both.
 */
export function isInstagramLoginToken(accessToken: string) {
  return accessToken.startsWith("IG");
}

function igBase(accessToken: string) {
  return isInstagramLoginToken(accessToken) ? `https://graph.instagram.com/${GRAPH_VERSION}` : `https://graph.facebook.com/${GRAPH_VERSION}`;
}
const FB_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type GraphError = { error?: { message?: string; code?: number } };

export class GraphApiError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

/** A 5xx or network failure is retried twice; a 4xx never is (it would just fail the same way). */
export async function graphFetch<T>(url: string, init?: RequestInit, attempt = 1): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (attempt >= 3) throw new GraphApiError(`Graph API network error: ${err instanceof Error ? err.message : String(err)}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return graphFetch<T>(url, init, attempt + 1);
  }
  const text = await res.text();
  let body: (T & GraphError) | undefined;
  try {
    body = JSON.parse(text) as T & GraphError;
  } catch {
    // non-JSON body, reported below
  }
  if (!res.ok || body?.error) {
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return graphFetch<T>(url, init, attempt + 1);
    }
    const detail = body?.error?.message ?? (text.trim().slice(0, 300) || res.statusText || "(empty response)");
    throw new GraphApiError(`Graph API error: ${detail} (code ${body?.error?.code ?? res.status})`, body?.error?.code ?? res.status);
  }
  return body as T;
}

const post = (url: string, params: Record<string, string>) => graphFetch<Record<string, any>>(url, { method: "POST", body: new URLSearchParams(params) });

// ---------------------------------------------------------------- Instagram

export type InstagramCredentials = { userId: string; accessToken: string };

async function createContainer(creds: InstagramCredentials, params: Record<string, string>, aiGenerated: boolean): Promise<string> {
  const url = `${igBase(creds.accessToken)}/${creds.userId}/media`;
  const base = { ...params, access_token: creds.accessToken };
  if (aiGenerated) {
    try {
      return (await post(url, { ...base, is_ai_generated: "true" })).id;
    } catch (err) {
      // Meta documents the AI label for Reels; if this photo endpoint rejects the
      // flag, post without it rather than lose the post (and log it, so the
      // label can be added by hand in the app).
      if (!(err instanceof GraphApiError) || !/is_ai_generated|param/i.test(err.message)) throw err;
      console.warn("[social] Instagram refused is_ai_generated on a photo container; posting without the label", err.message);
    }
  }
  return (await post(url, base)).id;
}

async function waitUntilReady(creds: InstagramCredentials, containerId: string, timeoutMs = 40_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await graphFetch<{ status_code?: string }>(`${igBase(creds.accessToken)}/${containerId}?fields=status_code&access_token=${encodeURIComponent(creds.accessToken)}`);
    if (res.status_code === "FINISHED") return;
    if (res.status_code === "ERROR") throw new GraphApiError(`Instagram could not process media container ${containerId}.`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new GraphApiError(`Timed out waiting for Instagram to process container ${containerId}.`);
}

async function publishContainer(creds: InstagramCredentials, containerId: string): Promise<string> {
  await waitUntilReady(creds, containerId);
  return (await post(`${igBase(creds.accessToken)}/${creds.userId}/media_publish`, { creation_id: containerId, access_token: creds.accessToken })).id;
}

/** One image = a photo post; 2-10 images = a carousel. Returns the published media id. */
export async function publishInstagramFeed(creds: InstagramCredentials, imageUrls: string[], caption: string, aiGenerated: boolean): Promise<string> {
  if (imageUrls.length === 1) {
    return publishContainer(creds, await createContainer(creds, { image_url: imageUrls[0], caption }, aiGenerated));
  }
  const children: string[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    const child = await createContainer(creds, { image_url: url, is_carousel_item: "true" }, aiGenerated);
    await waitUntilReady(creds, child);
    children.push(child);
  }
  const carousel = await createContainer(creds, { media_type: "CAROUSEL", children: children.join(","), caption }, aiGenerated);
  return publishContainer(creds, carousel);
}

export async function publishInstagramStory(creds: InstagramCredentials, imageUrl: string, aiGenerated: boolean): Promise<string> {
  return publishContainer(creds, await createContainer(creds, { image_url: imageUrl, media_type: "STORIES" }, aiGenerated));
}

/** Instagram-login tokens last 60 days; refreshing (allowed once a token is 24h old) gives another 60. */
export async function refreshInstagramToken(accessToken: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const res = await graphFetch<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`,
  );
  return { accessToken: res.access_token, expiresInSeconds: res.expires_in };
}

// ----------------------------------------------------------------- Facebook

export type FacebookCredentials = { pageId: string; pageAccessToken: string };

export async function resolvePageToken(creds: FacebookCredentials): Promise<FacebookCredentials> {
  try {
    const res = await graphFetch<{ access_token?: string }>(`${FB_BASE}/${creds.pageId}?fields=access_token&access_token=${encodeURIComponent(creds.pageAccessToken)}`);
    return res.access_token ? { ...creds, pageAccessToken: res.access_token } : creds;
  } catch (err) {
    console.warn("[social] Facebook Page token lookup failed; using the configured token", err instanceof Error ? err.message : err);
    return creds;
  }
}

/** One image = a Page photo post; several = one feed post with all photos attached. Returns the post id. */
export async function publishFacebookFeed(creds: FacebookCredentials, imageUrls: string[], message: string): Promise<string> {
  if (imageUrls.length === 1) {
    const res = await post(`${FB_BASE}/${creds.pageId}/photos`, { url: imageUrls[0], caption: message, access_token: creds.pageAccessToken });
    return res.post_id ?? res.id;
  }
  const params: Record<string, string> = { message, access_token: creds.pageAccessToken };
  const urls = imageUrls.slice(0, 10);
  for (let i = 0; i < urls.length; i++) {
    const photo = await post(`${FB_BASE}/${creds.pageId}/photos`, { url: urls[i], published: "false", access_token: creds.pageAccessToken });
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: photo.id });
  }
  return (await post(`${FB_BASE}/${creds.pageId}/feed`, params)).id;
}

/** Page Stories: upload the photo unpublished, then promote it to a story. */
export async function publishFacebookStory(creds: FacebookCredentials, imageUrl: string): Promise<string> {
  const photo = await post(`${FB_BASE}/${creds.pageId}/photos`, { url: imageUrl, published: "false", access_token: creds.pageAccessToken });
  const story = await post(`${FB_BASE}/${creds.pageId}/photo_stories`, { photo_id: photo.id, access_token: creds.pageAccessToken });
  return story.post_id ?? story.id;
}
