import { beforeEach, describe, expect, it, vi } from "vitest";

const sendBrandedEmailMock = vi.hoisted(() => vi.fn());
vi.mock("./resendEmail", () => ({ sendBrandedEmail: sendBrandedEmailMock }));

import { GOOGLE_REVIEW_URL, sendNewsletterWelcomeEmailSafely, sendReviewRequestEmailSafely } from "./customerNotifications";

describe("review request and newsletter welcome emails", () => {
  beforeEach(() => {
    sendBrandedEmailMock.mockReset();
    sendBrandedEmailMock.mockResolvedValue({ sent: true, messageId: "msg_1" });
  });

  it("sends the review request through branded Resend with the Google review link and an absolute website link", async () => {
    const result = await sendReviewRequestEmailSafely({ to: " client@example.com ", customerName: "Ada", bookingId: 42, serviceName: "Knotless Braids" });
    expect(result).toEqual({ sent: true });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(email.to).toBe("client@example.com");
    expect(email.paragraphs[0]).toBe("Hi Ada,");
    expect(email.paragraphs.join("\n")).toContain(GOOGLE_REVIEW_URL);
    expect(email.paragraphs.join("\n")).toContain("https://www.ebysplace.com/reviews?booking=42");
    expect(email.cta).toBeUndefined();
    expect(GOOGLE_REVIEW_URL).toContain("#lrd=0x4872056909763369:0x24f90dbf5e290238,3");
  });

  it("reports failure instead of pretending the review request was sent", async () => {
    sendBrandedEmailMock.mockResolvedValue({ sent: false, errorMessage: "RESEND_API_KEY is not configured in this environment." });
    expect(await sendReviewRequestEmailSafely({ to: "client@example.com" })).toEqual({ sent: false, reason: "RESEND_API_KEY is not configured in this environment." });
    expect(await sendReviewRequestEmailSafely({ to: "not-an-email" })).toEqual({ sent: false, reason: "invalid_address" });
  });

  it("sends the newsletter welcome through branded Resend with an unsubscribe header", async () => {
    await sendNewsletterWelcomeEmailSafely({ to: "fan@example.com", productAlerts: true });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(email.subject).toBe("Welcome to Eby’s Place updates");
    expect(email.headers["List-Unsubscribe"]).toContain("mailto:info@ebysplace.com");
    expect(email.paragraphs.join("\n")).toContain("https://www.ebysplace.com/booking");
  });
});
