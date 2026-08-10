import { storagePut } from "server/storage";
import { normalizeSecretKey, trimEnvValue } from "./envSecrets";

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

async function fetchImageAsFile(
  image: NonNullable<GenerateImageOptions["originalImages"]>[number],
  index: number,
) {
  const { bytes, mimeType } = await fetchImageBytes(image);
  const ext = mimeType.split("/")[1] || "png";
  return new File([bytes], `source-${index}.${ext}`, { type: mimeType });
}

async function generateImageWithOpenAI(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const apiKey = normalizeSecretKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("AI Try-On (OpenAI) is not configured for this deployment. Add OPENAI_API_KEY in Vercel, then redeploy.");
  }

  const originals = options.originalImages || [];
  const model = trimEnvValue(process.env.OPENAI_IMAGE_MODEL) || "gpt-image-1";
  const endpoint = originals.length > 0 ? "https://api.openai.com/v1/images/edits" : "https://api.openai.com/v1/images/generations";
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", options.prompt);
  form.set("size", trimEnvValue(process.env.OPENAI_IMAGE_SIZE) || "1024x1024");
  form.set("quality", trimEnvValue(process.env.OPENAI_IMAGE_QUALITY) || "high");

  if (originals.length > 0) {
    const files = await Promise.all(originals.map((image, index) => fetchImageAsFile(image, index)));
    for (const file of files) form.append("image", file);
    // input_fidelity="high" is OpenAI's documented fix for edits drifting away from
    // the source photo's face/identity — only supported on gpt-image-1 (not 1.5+).
    if (model === "gpt-image-1") {
      form.set("input_fidelity", trimEnvValue(process.env.OPENAI_IMAGE_INPUT_FIDELITY) || "high");
    }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
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

  const original = options.originalImages?.[0];
  if (!original) throw new Error("FLUX Kontext requires a source photo for editing.");

  const { bytes } = await fetchImageBytes(original);
  const inputImage = bytes.toString("base64");
  const model = trimEnvValue(process.env.BFL_MODEL) || "flux-kontext-pro";

  const submitResponse = await fetch(`https://api.bfl.ai/v1/${model}`, {
    method: "POST",
    headers: { "x-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      input_image: inputImage,
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
  try {
    return await generateImageWithFluxKontext(options);
  } catch (fluxError) {
    console.warn("[AI Try-On] FLUX Kontext generation failed, falling back to OpenAI", fluxError);
    return generateImageWithOpenAI(options);
  }
}
