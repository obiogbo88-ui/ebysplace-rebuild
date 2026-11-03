import { storagePut } from "server/storage";
import { normalizeSecretKey, trimEnvValue } from "./envSecrets";
import { pickOpenAIImageSize, probeImageSize } from "./imageDimensions";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchImageBytes(image: NonNullable<GenerateImageOptions["originalImages"]>[number]) {
  const mimeType = image.mimeType?.startsWith("image/") ? image.mimeType : "image/png";

  if (image.b64Json) {
    return { bytes: Buffer.from(image.b64Json, "base64"), mimeType };
  }

  if (!image.url) throw new Error("AI Try-On needs a readable source image URL.");
  const response = await fetch(image.url);
  if (!response.ok) {
    throw new Error(`AI Try-On could not retrieve the uploaded photo (${response.status}). Please upload the photo again.`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0] || mimeType;
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mimeType: contentType };
}

function bytesToFile(bytes: Buffer, mimeType: string, index: number) {
  const ext = mimeType.split("/")[1] || "png";
  return new File([new Uint8Array(bytes)], `source-${index}.${ext}`, { type: mimeType });
}

/**
 * OpenAI retires image models (gpt-image-1 started returning "does not
 * exist" on 2026-11-03), so unless OPENAI_IMAGE_MODEL pins one we ask the
 * account which gpt-image models it has and use the newest full-size one.
 */
export function pickImageModel(ids: string[]): string | null {
  const candidates = ids.filter((id) => /^gpt-image-/.test(id));
  if (!candidates.length) return null;
  const version = (id: string) => (id.match(/^gpt-image-(\d+(?:\.\d+)?)/)?.[1] ?? "0").split(".").map(Number);
  const dated = (id: string) => /-\d{4}-\d{2}-\d{2}$/.test(id);
  return [...candidates].sort((a, b) => {
    const [a1 = 0, a2 = 0] = version(a);
    const [b1 = 0, b2 = 0] = version(b);
    if (a1 !== b1) return b1 - a1;
    if (a2 !== b2) return b2 - a2;
    const am = a.includes("mini") ? 1 : 0;
    const bm = b.includes("mini") ? 1 : 0;
    if (am !== bm) return am - bm; // full-size before mini
    if (dated(a) !== dated(b)) return dated(a) ? 1 : -1; // alias before dated snapshot
    return a.localeCompare(b);
  })[0];
}

const FALLBACK_IMAGE_MODEL = "gpt-image-1.5";
let discoveredImageModel: string | null = null;

async function resolveImageModel(apiKey: string, refresh = false): Promise<string> {
  const pinned = trimEnvValue(process.env.OPENAI_IMAGE_MODEL);
  if (pinned && !refresh) return pinned;
  if (discoveredImageModel && !refresh) return discoveredImageModel;
  try {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ id?: string }> };
      const picked = pickImageModel((body.data ?? []).map((m) => String(m.id ?? "")));
      if (picked) {
        discoveredImageModel = picked;
        return picked;
      }
    }
  } catch (err) {
    console.warn("[AI image] Could not list OpenAI models", err);
  }
  return FALLBACK_IMAGE_MODEL;
}

function isRetiredModelError(status: number, detail: string) {
  return status === 400 || status === 404 ? /does not exist|model_not_found|invalid_value[\s\S]*"param":\s*"model"/.test(detail) : false;
}

async function generateImageWithOpenAI(options: GenerateImageOptions, refreshModel = false): Promise<GenerateImageResponse> {
  const apiKey = normalizeSecretKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("AI Try-On (OpenAI) is not configured for this deployment. Add OPENAI_API_KEY in Vercel, then redeploy.");
  }

  const originals = options.originalImages || [];
  const model = await resolveImageModel(apiKey, refreshModel);
  const endpoint = originals.length > 0 ? "https://api.openai.com/v1/images/edits" : "https://api.openai.com/v1/images/generations";

  // Fetch bytes once, both to build the upload and to read the source
  // photo's own dimensions — matching the output canvas to the customer's
  // photo shape (portrait selfie, square, landscape, …) instead of always
  // forcing a square keeps the model from having to zoom in or reframe the
  // shot to make a tall/narrow selfie fit a 1:1 canvas.
  const fetched = originals.length > 0 ? await Promise.all(originals.map((image) => fetchImageBytes(image))) : [];

  const form = new FormData();
  form.set("model", model);
  form.set("prompt", options.prompt);
  const sizeOverride = trimEnvValue(process.env.OPENAI_IMAGE_SIZE);
  form.set("size", sizeOverride || pickOpenAIImageSize(fetched[0] ? probeImageSize(fetched[0].bytes) : null));
  form.set("quality", trimEnvValue(process.env.OPENAI_IMAGE_QUALITY) || "high");

  if (fetched.length > 0) {
    fetched.forEach(({ bytes, mimeType }, index) => form.append("image", bytesToFile(bytes, mimeType, index)));
    // input_fidelity="high" is OpenAI's documented fix for edits drifting away from
    // the source photo's face/identity — only supported on gpt-image-1 (not 1.5+).
    if (model === "gpt-image-1") {
      form.set("input_fidelity", trimEnvValue(process.env.OPENAI_IMAGE_INPUT_FIDELITY) || "high");
    }
  }

  // /images/generations only accepts JSON now (400 unsupported_content_type on
  // multipart, seen 2026-11-03); /images/edits still takes the file upload.
  const response =
    fetched.length > 0
      ? await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form })
      : await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: options.prompt, size: form.get("size"), quality: form.get("quality") }),
        });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (!refreshModel && isRetiredModelError(response.status, detail)) {
      console.warn(`[AI image] ${model} is no longer available; looking up the current model`);
      discoveredImageModel = null;
      return generateImageWithOpenAI(options, true);
    }
    throw new Error(`OpenAI image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const image = result.data?.[0];
  if (!image) throw new Error("OpenAI image generation returned no image data.");
  if (image.url) return { url: image.url };
  if (!image.b64_json) throw new Error("OpenAI image generation returned an unsupported response.");

  const buffer = Buffer.from(image.b64_json, "base64");
  const { url } = await storagePut(`try-on/generated/${Date.now()}.png`, buffer, "image/png");
  return { url };
}

const FLUX_POLL_TIMEOUT_MS = 45_000;
const FLUX_POLL_INTERVAL_MS = 1_500;

async function generateImageWithFluxKontext(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const apiKey = normalizeSecretKey(process.env.BFL_API_KEY);
  if (!apiKey) {
    throw new Error("AI Try-On (FLUX) is not configured for this deployment. Add BFL_API_KEY in Vercel, then redeploy.");
  }

  // With a source photo this edits it (Try-On); without one it is plain
  // text-to-image, used as the back-up for social inspiration images.
  const original = options.originalImages?.[0];
  const inputImage = original ? (await fetchImageBytes(original)).bytes.toString("base64") : undefined;
  const model = trimEnvValue(process.env.BFL_MODEL) || "flux-kontext-pro";

  const submitResponse = await fetch(`https://api.bfl.ai/v1/${model}`, {
    method: "POST",
    headers: { "x-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      ...(inputImage ? { input_image: inputImage } : { aspect_ratio: "3:4" }),
      output_format: "png",
    }),
  });

  if (!submitResponse.ok) {
    const detail = await submitResponse.text().catch(() => "");
    throw new Error(`FLUX Kontext request failed (${submitResponse.status} ${submitResponse.statusText})${detail ? `: ${detail}` : ""}`);
  }

  const submitted = (await submitResponse.json()) as { id?: string; polling_url?: string };
  if (!submitted.polling_url) throw new Error("FLUX Kontext did not return a polling URL.");

  const deadline = Date.now() + FLUX_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(FLUX_POLL_INTERVAL_MS);
    const pollResponse = await fetch(submitted.polling_url, { headers: { "x-key": apiKey } });
    if (!pollResponse.ok) {
      throw new Error(`FLUX Kontext polling failed (${pollResponse.status} ${pollResponse.statusText})`);
    }
    const poll = (await pollResponse.json()) as { status?: string; result?: { sample?: string } };
    if (poll.status === "Ready") {
      if (!poll.result?.sample) throw new Error("FLUX Kontext reported ready but returned no image.");
      const imageResponse = await fetch(poll.result.sample);
      if (!imageResponse.ok) throw new Error("FLUX Kontext result image could not be retrieved.");
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const { url } = await storagePut(`try-on/generated/${Date.now()}.png`, buffer, "image/png");
      return { url };
    }
    if (poll.status === "Error" || poll.status === "Failed" || poll.status === "Content Moderated" || poll.status === "Request Moderated") {
      throw new Error(`FLUX Kontext generation did not complete (status: ${poll.status}).`);
    }
  }

  throw new Error("FLUX Kontext generation timed out.");
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!options.originalImages?.length) {
    // Text-only (social posts): OpenAI first, FLUX as the back-up.
    try {
      return await generateImageWithOpenAI(options);
    } catch (openAiError) {
      console.warn("[AI image] OpenAI generation failed, trying FLUX", openAiError);
      return generateImageWithFluxKontext(options);
    }
  }
  try {
    return await generateImageWithFluxKontext(options);
  } catch (fluxError) {
    console.warn("[AI Try-On] FLUX Kontext generation failed, falling back to OpenAI", fluxError);
    return generateImageWithOpenAI(options);
  }
}
