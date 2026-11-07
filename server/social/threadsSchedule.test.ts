import { describe, expect, it } from "vitest";
import { BAIT_PHRASES, threadsHook, threadsTimeFor, threadsWindow } from "./threadsSchedule";
import { THREADS_TEXT_LIMIT } from "./threads";
import { EMAIL_SOCIALS, renderBrandedEmail, renderPlainText } from "../resendEmail";

describe("Threads peak times", () => {
  it("posts at Threads' own times: weekday mornings at 9, weekends at 9:30", () => {
    expect(["am", "md", "pm"].map((s) => threadsTimeFor("2026-11-09", s as any))).toEqual(["09:00", "12:30", "19:30"]); // Monday
    expect(["am", "md", "pm"].map((s) => threadsTimeFor("2026-11-07", s as any))).toEqual(["09:30", "12:30", "19:30"]); // Saturday
  });

  it("is due before its time, posts within 3 hours, and never fires a backlog", () => {
    expect(threadsWindow("2026-11-09", "am", 8 * 60 + 59)).toBe("due");
    expect(threadsWindow("2026-11-09", "am", 9 * 60)).toBe("now");
    expect(threadsWindow("2026-11-09", "am", 12 * 60)).toBe("now");
    expect(threadsWindow("2026-11-09", "am", 12 * 60 + 1)).toBe("late");
  });
});

describe("Threads text", () => {
  it("leads with the post's hook and ends with a real question when there is none", () => {
    const text = threadsHook("Kids knotless braids take 2.5 to 4 hours.\n\n#braids", { headline: "Guess how long kids knotless take", kind: "style", id: 4 });
    expect(text.split("\n")[0]).toBe("Guess how long kids knotless take");
    expect(text).not.toContain("#braids");
    expect(text.trim().endsWith("?")).toBe(true);
  });

  it("keeps a question the caption already asks instead of adding another", () => {
    const text = threadsHook("Which length do you go for?", { headline: null, kind: "style", id: 1 });
    expect(text.match(/\?/g)?.length).toBe(1);
  });

  it("removes engagement bait lines and stays within 500 characters with the question kept", () => {
    const long = `${"Braid care matters. ".repeat(40)}\nComment YES if you agree\nTag a friend who needs this`;
    const text = threadsHook(long, { headline: "Five braid-care habits", kind: "article", id: 2 });
    expect(text.length).toBeLessThanOrEqual(THREADS_TEXT_LIMIT);
    expect(text.trim().endsWith("?")).toBe(true);
    for (const re of BAIT_PHRASES) expect(re.test(text)).toBe(false);
  });
});

describe("Social icons in every branded email", () => {
  it("shows Instagram and Threads at the bottom, in HTML and plain text", () => {
    const email = { subject: "Hi", paragraphs: ["Hi there,", "News"] };
    const html = renderBrandedEmail(email);
    for (const s of EMAIL_SOCIALS) {
      expect(html).toContain(s.icon);
      expect(html).toContain(`href="${s.url}"`);
    }
    expect(renderPlainText(email)).toContain("Follow @ebysplace1 on Instagram and Threads");
  });
});
