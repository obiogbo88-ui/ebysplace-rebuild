import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { composeMelody, toWav, type Melody } from "./music";

/**
 * Turns a post's slides into a 9:16 Instagram Reel with its own melody:
 * each slide fades in and out, then the Eby's Place logo end card
 * (standing rule: every video ends on the logo card). Audio is
 * loudness-normalised to -14 LUFS, Instagram's level (2026-11-03 the user
 * found the first samples too quiet).
 */

export const SECONDS_PER_SLIDE = 3.5;
export const SECONDS_SINGLE_SLIDE = 7;
export const END_CARD_SECONDS = 3;

export function reelTimings(slideCount: number) {
  const perSlide = slideCount === 1 ? SECONDS_SINGLE_SLIDE : SECONDS_PER_SLIDE;
  return { perSlide, total: perSlide * slideCount + END_CARD_SECONDS };
}

function ffmpegPath(): string {
  const configured = String(process.env.FFMPEG_PATH || "").trim();
  if (configured && existsSync(configured)) return configured;
  const require = createRequire(import.meta.url);
  return (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err = (err + String(d)).slice(-2000)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err}`))));
  });
}

export async function buildReel(slideJpegs: Buffer[], endCardJpeg: Buffer, melody: Melody): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  try {
    const { perSlide } = reelTimings(slideJpegs.length);
    const inputs: string[] = [];
    const chains: string[] = [];
    const parts = [...slideJpegs.map((jpg) => ({ jpg, secs: perSlide, end: false })), { jpg: endCardJpeg, secs: END_CARD_SECONDS, end: true }];
    for (let i = 0; i < parts.length; i++) {
      const file = path.join(dir, `s${i}.jpg`);
      await writeFile(file, parts[i].jpg);
      inputs.push("-loop", "1", "-t", String(parts[i].secs), "-i", file);
      const fit = parts[i].end ? "scale=1080:1920" : "scale=1080:1350,pad=1080:1920:0:285:color=0x121212";
      const fadeOut = parts[i].end ? "" : `,fade=t=out:st=${(parts[i].secs - 0.35).toFixed(2)}:d=0.35`;
      chains.push(`[${i}:v]${fit},setsar=1,fps=30,format=yuv420p,fade=t=in:st=0:d=0.35${fadeOut}[v${i}]`);
    }
    const audio = path.join(dir, "music.wav");
    await writeFile(audio, toWav(melody.pcm));
    const filter = `${chains.join(";")};${parts.map((_, i) => `[v${i}]`).join("")}concat=n=${parts.length}:v=1:a=0[v];[${parts.length}:a]loudnorm=I=-14:TP=-1.0:LRA=9[a]`;
    const out = path.join(dir, "reel.mp4");
    await run(ffmpegPath(), [
      "-y", "-loglevel", "error",
      ...inputs,
      "-i", audio,
      "-filter_complex", filter,
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-crf", "21", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
      "-shortest", "-movflags", "+faststart",
      out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Picks the first seed whose tune has never been used. */
export async function freshMelody(seconds: number, isUsed: (fingerprint: string) => Promise<boolean>, startSeed = Date.now()): Promise<{ seed: number; melody: Melody }> {
  for (let i = 0; i < 20; i++) {
    const seed = (startSeed + i * 7919) >>> 0;
    const melody = composeMelody(seed, seconds);
    if (!(await isUsed(melody.fingerprint))) return { seed, melody };
  }
  throw new Error("Could not find an unused melody after 20 tries.");
}
