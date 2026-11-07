/**
 * Threads (threads.net) publishing for Eby's Place, added 2026-11-06.
 *
 * Uses the Threads API on graph.threads.net with a token made by logging in
 * as the Eby's Place Threads profile (threads_basic + threads_content_publish).
 * Posting is two steps, like Instagram: create a container, wait until Threads
 * has processed it, then publish it. Every Reel also goes up as a Threads video;
 * photo posts go up as one image or a carousel.
 */

import { GraphApiError, graphFetch } from "./graph";

const THREADS_BASE = "https://graph.threads.net/v1.0";

/** Threads allows 500 characters per post. */
export const THREADS_TEXT_LIMIT = 500;

export type ThreadsCredentials = { userId: string; accessToken: string };

async function threadsPost<T>(url: string, params: Record<string, string>): Promise<T> {
  return graphFetch<T>(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
}

/**
 * The Instagram caption reshaped for Threads: no hashtag block (Threads uses
 * at most one topic tag and the rest just look like spam), and cut at a
 * sentence or line break so it fits in 500 characters.
 */
export function threadsText(caption: string, limit = THREADS_TEXT_LIMIT): string {
  const lines = caption
    .split(/\r?\n/)
    .map((l) => l.replace(/(^|\s)#[A-Za-z0-9_]+/g, "").replace(/\s{2,}/g, " ").trimEnd())
    .filter((l, i, all) => l.trim() || (i > 0 && all[i - 1].trim()));
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const stop = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  text = stop > limit * 0.5 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
  return text.trim();
}

async function createContainer(creds: ThreadsCredentials, params: Record<string, string>): Promise<string> {
  const res = await threadsPost<{ id: string }>(`${THREADS_BASE}/${creds.userId}/threads`, { ...params, access_token: creds.accessToken });
  return res.id;
}

/** Threads asks callers to wait for FINISHED before publishing (videos can take a minute or two). */
async function waitForContainer(creds: ThreadsCredentials, containerId: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await graphFetch<{ status?: string; error_message?: string }>(
      `${THREADS_BASE}/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(creds.accessToken)}`,
    );
    if (res.status === "FINISHED" || res.status === "PUBLISHED") return;
    if (res.status === "ERROR" || res.status === "EXPIRED") throw new GraphApiError(`Threads could not process the post: ${res.error_message || res.status}.`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new GraphApiError(`Timed out waiting for Threads to process container ${containerId}.`);
}

async function publish(creds: ThreadsCredentials, containerId: string, timeoutMs: number): Promise<string> {
  await waitForContainer(creds, containerId, timeoutMs);
  const res = await threadsPost<{ id: string }>(`${THREADS_BASE}/${creds.userId}/threads_publish`, { creation_id: containerId, access_token: creds.accessToken });
  return res.id;
}

/** One Threads post: the Reel video when there is one, otherwise the slides as an image or carousel. */
export async function publishThreadsPost(creds: ThreadsCredentials, input: { videoUrl?: string | null; imageUrls: string[]; caption: string }): Promise<string> {
  const text = threadsText(input.caption);
  if (input.videoUrl) {
    return publish(creds, await createContainer(creds, { media_type: "VIDEO", video_url: input.videoUrl, text }), 240_000);
  }
  const images = input.imageUrls.slice(0, 20);
  if (images.length === 0) return publish(creds, await createContainer(creds, { media_type: "TEXT", text }), 30_000);
  if (images.length === 1) return publish(creds, await createContainer(creds, { media_type: "IMAGE", image_url: images[0], text }), 60_000);
  const children: string[] = [];
  for (const url of images) {
    const child = await createContainer(creds, { media_type: "IMAGE", image_url: url, is_carousel_item: "true" });
    await waitForContainer(creds, child, 60_000);
    children.push(child);
  }
  return publish(creds, await createContainer(creds, { media_type: "CAROUSEL", children: children.join(","), text }), 60_000);
}

/** Threads tokens last 60 days; refreshing one that is at least a day old gives another 60. */
export async function refreshThreadsToken(accessToken: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const res = await graphFetch<{ access_token: string; expires_in: number }>(
    `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(accessToken)}`,
  );
  return { accessToken: res.access_token, expiresInSeconds: res.expires_in };
}
