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

describe("day-before appointment reminder email", () => {
  beforeEach(() => {
    sendBrandedEmailMock.mockReset();
    sendBrandedEmailMock.mockResolvedValue({ sent: true });
  });

  it("sends through branded Resend with a readable date, time and location note", async () => {
    const { sendAppointmentReminderEmailSafely } = await import("./customerNotifications");
    const result = await sendAppointmentReminderEmailSafely({ to: "client@example.com", customerName: "Ada", serviceName: "Knotless Braids", appointmentDate: "2026-10-20", appointmentTime: "10:00", serviceLocation: "studio" });
    expect(result).toEqual({ sent: true });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(email.subject).toBe("Your Eby’s Place appointment is tomorrow");
    const text = email.paragraphs.join("\n");
    expect(text).toContain("Tuesday 20 October at 10:00");
    expect(text).toContain("The studio address is in your booking confirmation.");
    expect(text).toContain("07864 585110");
  });

  it("is what the daily reminder job uses (not the unconfigured SendGrid path)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(`${process.cwd()}/server/appointmentReminders.ts`, "utf8");
    expect(source).toContain("sendAppointmentReminderEmailSafely(");
    expect(source).not.toContain("sendCustomerEmailSafely");
  });
});
