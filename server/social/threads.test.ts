import { afterEach, describe, expect, it, vi } from "vitest";
import { publishThreadsPost, threadsText, THREADS_TEXT_LIMIT } from "./threads";

function stub(responses: Array<Record<string, unknown>>) {
  const calls: Array<{ url: string; body: string }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? String(init.body) : "" });
      const next = responses.shift() ?? { id: "x" };
      return new Response(JSON.stringify(next), { status: "error" in next ? 400 : 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("Threads text", () => {
  it("drops the hashtag block and keeps the message", () => {
    expect(threadsText("Fresh knotless today.\n\nBook: ebysplace.com\n\n#braids #knotless #bridgwater")).toBe("Fresh knotless today.\n\nBook: ebysplace.com");
  });

  it("fits in 500 characters, cut at a sentence", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about braids.`).join(" ");
    const out = threadsText(long);
    expect(out.length).toBeLessThanOrEqual(THREADS_TEXT_LIMIT);
    expect(out.endsWith(".")).toBe(true);
  });
});

describe("Threads posting", () => {
  const creds = { userId: "99", accessToken: "THtoken" };

  it("posts a Reel as a Threads video: container, wait, publish", async () => {
    const calls = stub([{ id: "c1" }, { status: "IN_PROGRESS" }, { status: "FINISHED" }, { id: "post1" }]);
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const p = publishThreadsPost(creds, { videoUrl: "https://v/reel.mp4", imageUrls: ["https://a/1.jpg"], caption: "Hi #braids" });
    await vi.runAllTimersAsync();
    expect(await p).toBe("post1");
    vi.useRealTimers();
    expect(calls[0].url).toBe("https://graph.threads.net/v1.0/99/threads");
    expect(calls[0].body).toContain("media_type=VIDEO");
    expect(calls[0].body).toContain("text=Hi");
    expect(calls[0].body).not.toContain("braids");
    expect(calls[3].url).toBe("https://graph.threads.net/v1.0/99/threads_publish");
    expect(calls[3].body).toContain("creation_id=c1");
  });

  it("posts several slides as a carousel", async () => {
    const calls = stub([{ id: "k1" }, { status: "FINISHED" }, { id: "k2" }, { status: "FINISHED" }, { id: "car" }, { status: "FINISHED" }, { id: "post2" }]);
    expect(await publishThreadsPost(creds, { imageUrls: ["https://a/1.jpg", "https://a/2.jpg"], caption: "Two looks" })).toBe("post2");
    expect(calls[0].body).toContain("is_carousel_item=true");
    expect(calls[4].body).toContain("media_type=CAROUSEL");
    expect(calls[4].body).toContain("children=k1%2Ck2");
  });

  it("reports a Threads processing error instead of publishing", async () => {
    stub([{ id: "c1" }, { status: "ERROR", error_message: "Unsupported video" }]);
    await expect(publishThreadsPost(creds, { videoUrl: "https://v/bad.mp4", imageUrls: [], caption: "x" })).rejects.toThrow(/Unsupported video/);
  });
});
