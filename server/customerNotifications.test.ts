import { afterEach, describe, expect, it, vi } from "vitest";
import { getNotificationDiagnostics, sendCustomerSms, sendCustomerSmsSafely, sendCustomerWhatsApp } from "./customerNotifications";

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

  it("removes accidental whitespace from copied Twilio account credentials", async () => {
    process.env.TWILIO_ACCOUNT_SID = " AC123 \n 456\t789 ";
    process.env.TWILIO_AUTH_TOKEN = " token \n with\tspaces ";
    process.env.TWILIO_SMS_FROM = "+15551234567";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    const result = await sendCustomerSms({ to: "+447700900123", body: "Booking confirmed" });

    expect(result).toEqual({ sent: true });
    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(request?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("AC123456789:tokenwithspaces").toString("base64")}`,
    });
  });

  it("accepts either full WhatsApp sender format or a bare E.164 WhatsApp sender", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    const result = await sendCustomerWhatsApp({ to: "07700 900123", body: "Booking confirmed" });

    expect(result).toEqual({ sent: true });
    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(String(request?.body)).toContain("To=whatsapp%3A%2B447700900123");
    expect(String(request?.body)).toContain("From=whatsapp%3A%2B14155238886");
  });

  it("reports safe notification diagnostics without exposing credential values", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_SMS_FROM = "+15551234567";
    process.env.TWILIO_WHATSAPP_FROM = "bad-whatsapp-sender";
    process.env.EBYSPLACE_OWNER_PHONE_E164 = "07700 900123";

    const diagnostics = getNotificationDiagnostics();

    expect(diagnostics.twilio.sms.configured).toBe(true);
    expect(diagnostics.twilio.whatsapp.configured).toBe(false);
    expect(diagnostics.twilio.whatsapp.hasSender).toBe(true);
    expect(diagnostics.twilio.whatsapp.hasValidSender).toBe(false);
    expect(diagnostics.twilio.ownerPhoneConfigured).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain("secret");
    expect(JSON.stringify(diagnostics)).not.toContain("+15551234567");
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
