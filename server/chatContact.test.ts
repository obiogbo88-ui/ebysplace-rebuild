import { describe, expect, it } from "vitest";
import { cleanEmail, cleanName, cleanPhone, extractContactFromMessages, summariseTranscript } from "./chatContact";

describe("chat contact helpers", () => {
  it("validates emails", () => {
    expect(cleanEmail("  Kajisilva27@Gmail.com ")).toBe("kajisilva27@gmail.com");
    expect(cleanEmail("not-an-email")).toBeNull();
    expect(cleanEmail("")).toBeNull();
    expect(cleanEmail(undefined)).toBeNull();
  });

  it("validates phone numbers", () => {
    expect(cleanPhone("07864 585110")).toBe("07864 585110");
    expect(cleanPhone("+44 7864 585110")).toBe("+44 7864 585110");
    expect(cleanPhone("12345")).toBeNull();
    expect(cleanPhone("call me maybe 0786")).toBeNull();
    expect(cleanPhone("1".repeat(20))).toBeNull();
  });

  it("trims and caps names", () => {
    expect(cleanName("  Amara   Okafor ")).toBe("Amara Okafor");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(500))?.length).toBe(120);
  });

  it("finds an email the visitor typed mid-chat", () => {
    const found = extractContactFromMessages([
      { role: "user", content: "20 pounds" },
      { role: "assistant", content: "Great, contact us at info@ebysplace.com" },
      { role: "user", content: "Kajisilva27@gmail.com" },
    ]);
    expect(found.email).toBe("kajisilva27@gmail.com");
    expect(found.phone).toBeNull();
  });

  it("finds a phone number and ignores digits inside prices or emails", () => {
    const found = extractContactFromMessages([
      { role: "user", content: "is it £140 or 85 for starter locs?" },
      { role: "user", content: "my number is 07911 123456 thanks" },
    ]);
    expect(found.phone).toBe("07911 123456");

    const emailOnly = extractContactFromMessages([{ role: "user", content: "reach me at person12345678@example.com" }]);
    expect(emailOnly.phone).toBeNull();
    expect(emailOnly.email).toBe("person12345678@example.com");
  });

  it("never treats assistant text as visitor contact details", () => {
    const found = extractContactFromMessages([{ role: "assistant", content: "Ring 07864 585110 or email info@ebysplace.com" }]);
    expect(found).toEqual({ email: null, phone: null });
  });

  it("summarises only the most recent messages", () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? ("assistant" as const) : ("user" as const), content: `m${index}` }));
    const summary = summariseTranscript(messages, 3);
    expect(summary.split("\n")).toEqual(["Assistant: m7".replace("Assistant", "Eby"), "Visitor: m8", "Eby: m9"]);
  });
});
