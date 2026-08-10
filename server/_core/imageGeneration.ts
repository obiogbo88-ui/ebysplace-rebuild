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

async function fetchImageAsFile(
  image: NonNullable<GenerateImageOptions["originalImages"]>[number],
  index: number,
) {
  const mimeType = image.mimeType?.startsWith("image/") ? image.mimeType : "image/png";

  if (image.b64Json) {
    const buffer = Buffer.from(image.b64Json, "base64");
    const ext = mimeType.split("/")[1] || "png";
    return new File([buffer], `source-${index}.${ext}`, { type: mimeType });
  }

  if (!image.url) throw new Error("AI Try-On needs a readable source image URL.");
  const response = await fetch(image.url);
  if (!response.ok) {
    throw new Error(`AI Try-On could not retrieve the uploaded photo (${response.status}). Please upload the photo again.`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0] || mimeType;
  const ext = contentType.split("/")[1] || "png";
  const bytes = await response.arrayBuffer();
  return new File([bytes], `source-${index}.${ext}`, { type: contentType });
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const apiKey = normalizeSecretKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("AI Try-On is not configured for this deployment. Add OPENAI_API_KEY in Vercel, then redeploy.");
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
    // input_fidelity="high" is the documented fix for edits drifting away from the
    // source photo's face/identity — only supported on gpt-image-1 (not 1.5+).
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
