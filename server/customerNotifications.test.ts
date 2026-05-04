import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCustomerSms, sendCustomerSmsSafely } from "./customerNotifications";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("customer SMS notifications", () => {
  it("skips delivery without throwing when Twilio configuration is missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_SMS_FROM;

    const result = await sendCustomerSms({ to: "+447700900123", body: "Hello" });

    expect(result).toEqual({ sent: false, reason: "sms_not_configured_or_invalid_number" });
  });

  it("normalises UK local mobile numbers before posting to Twilio", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_SMS_FROM = "+15551234567";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    const result = await sendCustomerSms({ to: "07700 900123", body: "Booking confirmed" });

    expect(result).toEqual({ sent: true });
    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(String(request?.body)).toContain("To=%2B447700900123");
    expect(String(request?.body)).toContain("Body=Booking+confirmed");
  });

  it("keeps business flows non-blocking when Twilio throws", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_SMS_FROM = "+15551234567";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));

    const result = await sendCustomerSmsSafely({ to: "+447700900123", body: "Order paid" });

    expect(result).toEqual({ sent: false, reason: "exception" });
  });
});
