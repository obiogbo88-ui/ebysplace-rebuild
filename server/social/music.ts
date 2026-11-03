import { createHash } from "node:crypto";

/**
 * Original background music for every Eby's Place Reel (user request
 * 2026-11-03: "sweet melodies", never the same twice).
 *
 * A seeded composer: the seed picks key, tempo, chord progression, rhythms,
 * melody contour and piano brightness, so every seed is a different tune.
 * Soft electric piano over a warm pad with a light echo. The fingerprint is a
 * hash of the actual notes, and the database refuses a fingerprint it has
 * seen before (see store.ts), so no two posts can ever share a tune.
 * Everything is synthesised here, so there are no licensing questions.
 */

export const SAMPLE_RATE = 44100;

/** mulberry32: small, fast, deterministic. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PROGRESSIONS = [
  [0, 5, 3, 4],
  [0, 3, 4, 4],
  [0, 4, 5, 3],
  [5, 3, 0, 4],
  [0, 2, 3, 4],
  [0, 5, 1, 4],
  [3, 4, 0, 0],
  [0, 3, 5, 4],
];
const RHYTHMS = [
  [1, 1, 2],
  [2, 1, 1],
  [1.5, 0.5, 2],
  [2, 2],
  [1, 1, 1, 1],
  [3, 1],
  [0.5, 0.5, 1, 2],
];

export type Melody = { pcm: Float32Array; fingerprint: string; description: string };

function addTone(out: Float32Array, start: number, f: number, dur: number, gain: number, bright: number) {
  const s0 = Math.floor(start * SAMPLE_RATE);
  const n = Math.min(Math.floor(dur * SAMPLE_RATE), out.length - s0);
  const release = dur * 0.55;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(1, t / 0.008) * Math.exp(-t / release);
    const w = 2 * Math.PI * f * t;
    const tone = Math.sin(w) + bright * 0.35 * Math.sin(2 * w) + bright * 0.12 * Math.sin(3 * w);
    out[s0 + i] += tone * (1 + 0.04 * Math.sin(2 * Math.PI * 5 * t)) * env * gain;
  }
}

function addPad(out: Float32Array, start: number, freqs: number[], dur: number, gain: number) {
  const s0 = Math.floor(start * SAMPLE_RATE);
  const n = Math.min(Math.floor(dur * SAMPLE_RATE), out.length - s0);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const fade = Math.max(0, Math.min(1, t / 0.8, (dur - t) / 0.8));
    let v = 0;
    for (const f of freqs) v += Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t);
    out[s0 + i] += (v / freqs.length) * fade * gain;
  }
}

export function composeMelody(seed: number, seconds: number): Melody {
  const r = rng(seed);
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)];
  const root = 55 + Math.floor(r() * 10); // G3..E4
  const bpm = 66 + r() * 22;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const progression = pick(PROGRESSIONS);
  const bright = 0.3 + r() * 0.7;
  const out = new Float32Array(Math.ceil((seconds + 2) * SAMPLE_RATE));
  const notes: number[] = [];
  let degree = 2 + Math.floor(r() * 3);
  for (let barIndex = 0, t0 = 0; t0 < seconds; barIndex++, t0 += bar) {
    const chordDegree = progression[barIndex % progression.length];
    const chord = [0, 2, 4].map((k) => root - 12 + MAJOR[(chordDegree + k) % 7] + 12 * Math.floor((chordDegree + k) / 7));
    addPad(out, t0, chord.map(freq), bar + 0.6, 0.18);
    let t = t0;
    for (const beats of pick(RHYTHMS)) {
      degree = Math.max(0, Math.min(9, degree + pick([-2, -1, -1, 0, 1, 1, 2])));
      if (r() < 0.35) degree = chordDegree + pick([0, 2, 4]);
      const midi = root + MAJOR[degree % 7] + 12 * Math.floor(degree / 7);
      const dur = beats * beat;
      if (r() > 0.12) {
        addTone(out, t, freq(midi), dur + 0.8, 0.32, bright);
        notes.push(midi, Math.round(t * 100));
      }
      t += dur;
    }
  }
  // soft echo for space
  const d = Math.floor(beat * 0.75 * SAMPLE_RATE);
  for (let i = out.length - 1; i >= d; i--) out[i] += out[i - d] * 0.28 + (i >= 2 * d ? out[i - 2 * d] * 0.12 : 0);
  const pcm = out.subarray(0, Math.floor(seconds * SAMPLE_RATE));
  let peak = 1e-9;
  for (let i = 0; i < pcm.length; i++) {
    const fade = Math.min(1, i / SAMPLE_RATE, (pcm.length - i) / (2.5 * SAMPLE_RATE));
    pcm[i] *= fade;
    peak = Math.max(peak, Math.abs(pcm[i]));
  }
  for (let i = 0; i < pcm.length; i++) pcm[i] = (pcm[i] / peak) * 0.8;
  const fingerprint = createHash("sha256").update(`${root}|${bpm.toFixed(2)}|${progression.join(",")}|${notes.join(",")}`).digest("hex").slice(0, 32);
  return { pcm: Float32Array.from(pcm), fingerprint, description: `key ${root}, ${bpm.toFixed(0)} bpm, chords ${progression.join("-")}` };
}

/** 16-bit stereo WAV. */
export function toWav(pcm: Float32Array): Buffer {
  const frames = pcm.length;
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + frames * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i])) * 32767;
    buf.writeInt16LE(v | 0, 44 + i * 4);
    buf.writeInt16LE(v | 0, 46 + i * 4);
  }
  return buf;
}
