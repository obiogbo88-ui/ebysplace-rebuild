import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadPasswordResetHelper() {
  vi.resetModules();
  return import("./supabaseAuth");
}

describe("admin password reset", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      EBYSPLACE_ADMIN_EMAIL: "admin@example.com",
      SUPABASE_URL: "https://project.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("sends Supabase recovery mail only for the configured admin email", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const { requestAdminPasswordReset } = await loadPasswordResetHelper();

    const result = await requestAdminPasswordReset("ADMIN@example.com", "https://ebysplace.vercel.app/some/path");

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchMock).mock.calls[0];
    expect(String(url)).toBe("https://project.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Febysplace.vercel.app%2Fadmin%2Freset-password");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ email: "admin@example.com" });
  });

  it("returns the same generic success response for non-admin emails without calling Supabase", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const { requestAdminPasswordReset } = await loadPasswordResetHelper();

    const result = await requestAdminPasswordReset("customer@example.com", "https://ebysplace.vercel.app");

    expect(result).toEqual({
      success: true,
      message: "If this email is the configured Eby’s Place administrator, a password reset link has been sent.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to generated Supabase recovery links sent through SMTP when Supabase mail delivery fails", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASS = "smtp-password";
    process.env.SMTP_FROM = "Eby's Place <mailer@example.com>";

    const sendMailMock = vi.fn(async () => ({ messageId: "smtp-message-id" }));
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
      },
    }));

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith("/auth/v1/recover?redirect_to=https%3A%2F%2Febysplace.vercel.app%2Fadmin%2Freset-password")) {
        return new Response(JSON.stringify({ msg: "Error sending recovery email" }), { status: 500 });
      }
      if (String(url).endsWith("/auth/v1/admin/generate_link")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          type: "recovery",
          email: "admin@example.com",
          options: { redirect_to: "https://ebysplace.vercel.app/admin/reset-password" },
        });
        return new Response(JSON.stringify({ action_link: "https://project.supabase.co/auth/v1/verify?token=abc&type=recovery" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const { requestAdminPasswordReset } = await loadPasswordResetHelper();

    const result = await requestAdminPasswordReset("ADMIN@example.com", "https://ebysplace.vercel.app/account");

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@example.com",
      subject: "Reset your Eby’s Place admin password",
      text: expect.stringContaining("https://project.supabase.co/auth/v1/verify?token=abc&type=recovery"),
    }));
  });
});
