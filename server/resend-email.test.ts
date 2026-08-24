import { afterEach, describe, expect, it, vi } from "vitest";
import { getResendConfig, isResendConfigured, renderBrandedEmail, renderPlainText, sendBrandedEmail } from "./resendEmail";

const ORIGINAL_KEY = process.env.RESEND_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
});

/** A fetch stub. Never patches the global, so sibling suites are unaffected. */
function stubFetch(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}

describe("Resend branded customer replies", () => {
  it("treats redacted placeholder keys as unconfigured rather than firing a doomed request", () => {
    for (const placeholder of ["", "[SENSITIVE]", "*******", "xxxxxxx"]) {
      process.env.RESEND_API_KEY = placeholder;
      expect(isResendConfigured(), `"${placeholder}" should not count as configured`).toBe(false);
    }
    process.env.RESEND_API_KEY = "re_realistic_looking_key_value";
    expect(isResendConfigured()).toBe(true);
  });

  it("refuses to send when the key is unusable, without performing a network call", async () => {
    process.env.RESEND_API_KEY = "[SENSITIVE]";
    const fetchStub = stubFetch(new Response("{}", { status: 200 }));
    const result = await sendBrandedEmail({ to: "someone@example.com", subject: "Hi", paragraphs: ["Hello"] }, fetchStub);
    expect(result.sent).toBe(false);
    expect(result.errorMessage).toContain("RESEND_API_KEY");
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("renders paragraphs into the branded shell, keeping the real logo and signature", () => {
    const html = renderBrandedEmail({
      subject: "Re: Your crochet style enquiry",
      paragraphs: ["Hi Tanya,", "Thank you for getting in touch."],
    });
    expect(html).toContain("top-header-logo");
    expect(html).toContain("Founder &amp; Service Lead");
    expect(html).toContain("Hi Tanya,");
    expect(html).toContain("Thank you for getting in touch.");
    expect(html).not.toContain("{{BODY_HTML}}");
    expect(html).not.toContain("{{SUBJECT}}");
  });

  it("keeps the email light-locked so client dark mode cannot re-theme the brand", () => {
    const html = renderBrandedEmail({ subject: "Subject", paragraphs: ["Body"] });
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("[data-ogsc]");
    expect(html).toContain('bgcolor="#FAF7F2"');
  });

  it("escapes customer-supplied copy so a reply cannot inject markup", () => {
    const html = renderBrandedEmail({
      subject: "A <script>alert(1)</script> subject",
      paragraphs: ["Hi <img src=x onerror=alert(1)>,"],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an optional gold call-to-action button", () => {
    const html = renderBrandedEmail({
      subject: "Subject",
      paragraphs: ["Body"],
      cta: { label: "Browse Styles & Book", url: "https://www.ebysplace.com/services" },
    });
    expect(html).toContain("https://www.ebysplace.com/services");
    expect(html).toContain("Browse Styles &amp; Book");
    expect(html).toContain("#C9A84C");
  });

  it("builds a plain-text alternative that carries the CTA url and sign-off", () => {
    const text = renderPlainText({
      paragraphs: ["Hi Tanya,", "Here are your options."],
      cta: { label: "Browse Styles", url: "https://www.ebysplace.com/services" },
    });
    expect(text).toContain("Hi Tanya,");
    expect(text).toContain("Browse Styles: https://www.ebysplace.com/services");
    expect(text).toContain("Eby's Place");
    expect(text).toContain("info@ebysplace.com");
  });

  it("sends from the verified ebysplace.com domain and never leaks the key to the caller", async () => {
    process.env.RESEND_API_KEY = "re_test_key_value";
    const fetchStub = stubFetch(
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    const result = await sendBrandedEmail({
      to: "tanya@example.com",
      cc: "info@ebysplace.com",
      subject: "Re: Your crochet style enquiry",
      paragraphs: ["Hi Tanya,"],
    }, fetchStub);

    expect(result).toEqual({ sent: true, messageId: "msg_123" });
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body.from).toContain("@ebysplace.com");
    expect(body.to).toEqual(["tanya@example.com"]);
    expect(body.cc).toEqual(["info@ebysplace.com"]);
    expect(body.reply_to).toBe("info@ebysplace.com");
    expect(JSON.stringify(result)).not.toContain("re_test_key_value");
  });

  it("surfaces a safe message when Resend rejects the send", async () => {
    process.env.RESEND_API_KEY = "re_test_key_value";
    const fetchStub = stubFetch(
      new Response(JSON.stringify({ message: "Domain is not verified" }), { status: 403, headers: { "content-type": "application/json" } }),
    );
    const result = await sendBrandedEmail({ to: "tanya@example.com", subject: "Subject", paragraphs: ["Body"] }, fetchStub);
    expect(result.sent).toBe(false);
    expect(result.errorMessage).toBe("Domain is not verified");
    expect(JSON.stringify(result)).not.toContain("re_test_key_value");
  });

  it("defaults the sender to the Eby's Place mailbox when RESEND_FROM is unset", () => {
    process.env.RESEND_API_KEY = "re_test_key_value";
    delete process.env.RESEND_FROM;
    expect(getResendConfig().from).toContain("info@ebysplace.com");
  });
});
