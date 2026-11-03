import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server/storage", () => ({ storagePut: vi.fn(async (key: string) => ({ url: `https://cdn.test/${key}` })) }));

import { generateImage, pickImageModel } from "./imageGeneration";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const retired = () =>
  new Response(JSON.stringify({ error: { message: "The model 'gpt-image-1' does not exist.", type: "image_generation_user_error", param: "model", code: "invalid_value" } }), { status: 400 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("pickImageModel", () => {
  it("prefers the newest full-size gpt-image model, alias over dated snapshot", () => {
    expect(pickImageModel(["gpt-4o", "gpt-image-1", "gpt-image-1.5", "gpt-image-1.5-2025-12-16", "gpt-image-1-mini", "dall-e-3"])).toBe("gpt-image-1.5");
    expect(pickImageModel(["gpt-image-2-mini", "gpt-image-2", "gpt-image-1.5"])).toBe("gpt-image-2");
    expect(pickImageModel(["gpt-image-1-mini"])).toBe("gpt-image-1-mini");
    expect(pickImageModel(["gpt-4o", "dall-e-3"])).toBeNull();
  });
});

describe("generateImage (text only, social posts)", () => {
  it("looks up a current model when the pinned one is retired, then succeeds", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-1");
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/v1/models")) return ok({ data: [{ id: "gpt-image-1.5" }, { id: "gpt-image-1-mini" }] });
        bodies.push(String(init?.body));
        return bodies.length === 1 ? retired() : ok({ data: [{ b64_json: Buffer.from("png").toString("base64") }] });
      }),
    );
    const out = await generateImage({ prompt: "Knotless braids, portrait" });
    expect(out.url).toMatch(/^https:\/\/cdn\.test\/try-on\/generated\//);
    expect(JSON.parse(bodies[0]).model).toBe("gpt-image-1");
    expect(JSON.parse(bodies[1]).model).toBe("gpt-image-1.5");
  });

  it("falls back to FLUX text-to-image when OpenAI cannot make the image", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("BFL_API_KEY", "bfl-test");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "");
    let fluxBody: any = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/v1/models")) return ok({ data: [{ id: "gpt-image-1.5" }] });
        if (url.includes("api.openai.com")) return new Response("server error", { status: 500 });
        if (url.startsWith("https://api.bfl.ai/v1/")) {
          fluxBody = JSON.parse(String(init?.body));
          return ok({ id: "1", polling_url: "https://api.bfl.ai/poll/1" });
        }
        if (url === "https://api.bfl.ai/poll/1") return ok({ status: "Ready", result: { sample: "https://bfl.test/sample.png" } });
        if (url === "https://bfl.test/sample.png") return new Response(Buffer.from("png"), { status: 200 });
        throw new Error(`unexpected fetch ${url}`);
      }),
    );
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0 as any;
    }) as any);
    const out = await generateImage({ prompt: "Boho knotless, portrait" });
    expect(out.url).toMatch(/^https:\/\/cdn\.test\//);
    expect(fluxBody.input_image).toBeUndefined();
    expect(fluxBody.aspect_ratio).toBe("3:4");
  });
});
