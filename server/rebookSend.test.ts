import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-rebook-links-0123456789"; });
const sendMock = vi.hoisted(() => vi.fn());
vi.mock("./customerNotifications", () => ({ sendRebookRequestEmailSafely: sendMock }));

import * as db from "./db";
import { resendEmailNotificationLog } from "./smtpEmailNotifications";
import { sendRecordedRebookEmail } from "./rebookSend";

const booking = { id: 64, clientName: "Fenton Richards", clientEmail: " fenton@example.com ", serviceName: "Cornrows", appointmentDate: "2026-11-08", appointmentTime: "16:00", depositStatus: "paid", status: "confirmed", serviceLocation: "studio" } as any;

describe("recording rebooking emails", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("records a sent email against the booking", async () => {
    sendMock.mockResolvedValue({ sent: true, subject: "Your Sunday booking", messageId: "m1" });
    const log = vi.spyOn(db, "createEmailNotificationLog").mockResolvedValue({ id: 1 } as any);
    await sendRecordedRebookEmail(booking);
    expect(log.mock.calls[0][0]).toMatchObject({ entityType: "booking", entityId: 64, audience: "customer", recipientEmail: "fenton@example.com", subject: "Your Sunday booking", status: "sent", provider: "resend", messageId: "m1" });
  });

  it("records a failed email with the reason", async () => {
    sendMock.mockResolvedValue({ sent: false, subject: "Your Sunday booking", reason: "provider down" });
    const log = vi.spyOn(db, "createEmailNotificationLog").mockResolvedValue({ id: 1 } as any);
    expect((await sendRecordedRebookEmail(booking)).sent).toBe(false);
    expect(log.mock.calls[0][0]).toMatchObject({ status: "failed", errorMessage: "provider down" });
  });

  it("still returns the result if recording fails", async () => {
    sendMock.mockResolvedValue({ sent: true, subject: "s" });
    vi.spyOn(db, "createEmailNotificationLog").mockRejectedValue(new Error("db down"));
    expect((await sendRecordedRebookEmail(booking)).sent).toBe(true);
  });

  it("never resends a rebooking row as a booking confirmation", async () => {
    vi.spyOn(db, "getEmailNotificationLogById").mockResolvedValue({ id: 1, provider: "resend", entityType: "booking", entityId: 64 } as any);
    await expect(resendEmailNotificationLog(1)).rejects.toThrow("Send rebooking link");
  });
});
