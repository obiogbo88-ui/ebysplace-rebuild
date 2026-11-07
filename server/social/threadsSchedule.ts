/**
 * Threads posts at Threads' own peak times (approved 2026-11-07, mockup
 * https://claude.ai/artifact/LWkZmn7WKtFegSWSgNNAGs): the same three posts a
 * day as Instagram, but weekday mornings are Threads' strongest window, so
 * the times differ. Instagram keeps 08:00 / 12:30 / 20:00.
 *
 * Sources: Buffer's 2.5M-post Threads study (weekday mornings, Thu 9am best),
 * Social Champ, Edgar. Re-check against @ebysplace1 Threads insights after
 * two weeks of posting.
 */

import { weekdayIndex } from "./content";
import type { SlotName } from "./store";
import { threadsText, THREADS_TEXT_LIMIT } from "./threads";

const WEEKDAY: Record<SlotName, string> = { am: "09:00", md: "12:30", pm: "19:30" };
const WEEKEND: Record<SlotName, string> = { am: "09:30", md: "12:30", pm: "19:30" };

/** Threads stops trying a post this long after its Threads time, so a late token never fires a backlog. */
export const THREADS_LATE_LIMIT_MINUTES = 180;

export function threadsTimeFor(date: string, slot: SlotName): string {
  return (weekdayIndex(date) >= 5 ? WEEKEND : WEEKDAY)[slot];
}

/** Minutes since midnight in London. */
export function londonMinutes(at: Date = new Date()): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(at)
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** "due" before the Threads time, "now" inside the window, "late" after it. */
export function threadsWindow(date: string, slot: SlotName, nowMinutes: number): "due" | "now" | "late" {
  const start = toMinutes(threadsTimeFor(date, slot));
  if (nowMinutes < start) return "due";
  return nowMinutes - start <= THREADS_LATE_LIMIT_MINUTES ? "now" : "late";
}

/**
 * Replies are Threads' strongest ranking signal, so a post without a question
 * ends with one real, answerable question. Fixed, approved lines only: never
 * invented facts, and never engagement bait.
 */
const QUESTIONS: Record<string, string[]> = {
  motivation: ["What's one small step you're taking this week?", "Which part of this hits home for you?"],
  article: ["Which of these do you already do?", "What's your go-to braid-care tip?"],
  style: ["Would you wear this? Shoulder length or longer?", "What colour would you go for?"],
  inspiration: ["Which look would you book first?", "Short and sharp, or long and boho?"],
  kouvia: ["Braiders: how do you take bookings today?"],
};
const FALLBACK_QUESTION = "What would you like to see from Eby's Place next?";

/** Phrases Meta pushes down as engagement bait. The Threads text must never contain them. */
export const BAIT_PHRASES = [/comment\s+["']?yes/i, /like if/i, /tag\s+(a|\d+|your)\s+friend/i, /share if/i, /last chance/i, /only today/i];

export function threadsHook(text: string, opts: { headline?: string | null; kind: string; id: number }): string {
  const headline = (opts.headline || "").trim();
  let body = text.trim();
  if (headline && !body.toLowerCase().startsWith(headline.toLowerCase().slice(0, 30))) body = `${headline}\n\n${body}`;
  body = body
    .split("\n")
    .filter((line) => !BAIT_PHRASES.some((re) => re.test(line)))
    .join("\n")
    .trim();
  body = threadsText(body);
  if (body.includes("?")) return body;
  const list = QUESTIONS[opts.kind] ?? [];
  const q = list.length ? list[opts.id % list.length] : FALLBACK_QUESTION;
  // Make room for the question so it always survives the 500-character cut.
  return `${threadsText(body, THREADS_TEXT_LIMIT - q.length - 2)}\n\n${q}`;
}
