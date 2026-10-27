import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatReviewRequestDate, reviewRequestBlockReason } from "../shared/reviewRequest";

describe("review request is sent once per booking", () => {
  it("allows the first send", () => {
    expect(reviewRequestBlockReason(null, false)).toBeNull();
    expect(reviewRequestBlockReason(undefined, false)).toBeNull();
  });

  it("blocks a second send unless the admin chooses Send again", () => {
    const sentAt = new Date("2026-10-27T10:00:00Z");
    expect(reviewRequestBlockReason(sentAt, false)).toBe("A review request was already sent on 27 Oct 2026.");
    expect(reviewRequestBlockReason(sentAt, true)).toBeNull();
  });

  it("shows the date in UK time", () => {
    expect(formatReviewRequestDate("2026-10-27T23:30:00Z")).toBe("27 Oct 2026");
    expect(formatReviewRequestDate("2026-07-31T23:30:00Z")).toBe("1 Aug 2026");
  });

  it("records the send only after the email actually went out", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const route = router.slice(router.indexOf("sendReviewRequest:"), router.indexOf("resendEmailNotification:"));
    expect(route.indexOf("reviewRequestBlockReason")).toBeLessThan(route.indexOf("sendReviewRequestEmailSafely"));
    expect(route.indexOf("if (!result.sent)")).toBeLessThan(route.indexOf("markReviewRequestSent"));
  });
});
