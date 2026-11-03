import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jpegJs from "jpeg-js";
import { composeMelody } from "./music";
import { buildReel, freshMelody, reelTimings } from "./reel";

describe("melodies", () => {
  it("are repeatable for one seed and different across seeds", () => {
    const a = composeMelody(101, 10);
    expect(composeMelody(101, 10).fingerprint).toBe(a.fingerprint);
    const prints = new Set(Array.from({ length: 60 }, (_, i) => composeMelody(1000 + i * 7919, 10).fingerprint));
    expect(prints.size).toBe(60);
  });

  it("never hands out a tune that was already used", async () => {
    const used = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { melody } = await freshMelody(8, async (fp) => used.has(fp), 42); // same start seed every time
      expect(used.has(melody.fingerprint)).toBe(false);
      used.add(melody.fingerprint);
    }
    expect(used.size).toBe(5);
  });

  it("times a carousel at 3.5s a slide and a single post at 7s, plus the 3s end card", () => {
    expect(reelTimings(6).total).toBe(24);
    expect(reelTimings(1).total).toBe(10);
  });
});

describe("reel video", () => {
  it("builds a 1080x1920 MP4 with a sound track", async () => {
    const jpg = (shade: number, w: number, h: number) => Buffer.from(jpegJs.encode({ data: Buffer.alloc(w * h * 4, shade), width: w, height: h }, 80).data);
    const { total } = reelTimings(2);
    const mp4 = await buildReel([jpg(90, 1080, 1350), jpg(160, 1080, 1350)], jpg(20, 1080, 1920), composeMelody(7, total));
    const file = path.join(mkdtempSync(path.join(tmpdir(), "reeltest-")), "r.mp4");
    writeFileSync(file, mp4);
    const ffmpeg = (createRequire(import.meta.url)("@ffmpeg-installer/ffmpeg") as { path: string }).path;
    let info = "";
    try {
      execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" });
    } catch (err: any) {
      info = String(err.stderr); // ffmpeg -i with no output always exits 1 after printing stream info
    }
    expect(info).toMatch(/Video: h264.*1080x1920/);
    expect(info).toMatch(/Audio: aac/);
    expect(info).toMatch(/Duration: 00:00:1[01]/);
  }, 120_000);

  it("adds full-screen cards (Kouvia story card) before the logo end card", async () => {
    const jpg = (shade: number, w: number, h: number) => Buffer.from(jpegJs.encode({ data: Buffer.alloc(w * h * 4, shade), width: w, height: h }, 80).data);
    const { total } = reelTimings(1, 1); // 7 + 3.5 + 3 = 13.5s
    const mp4 = await buildReel([jpg(90, 1080, 1350)], jpg(20, 1080, 1920), composeMelody(11, total), [jpg(200, 1080, 1920)]);
    const file = path.join(mkdtempSync(path.join(tmpdir(), "reeltest-")), "k.mp4");
    writeFileSync(file, mp4);
    const ffmpeg = (createRequire(import.meta.url)("@ffmpeg-installer/ffmpeg") as { path: string }).path;
    let info = "";
    try {
      execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" });
    } catch (err: any) {
      info = String(err.stderr);
    }
    expect(info).toMatch(/Video: h264.*1080x1920/);
    expect(info).toMatch(/Duration: 00:00:1[34]/);
  }, 120_000);
});
