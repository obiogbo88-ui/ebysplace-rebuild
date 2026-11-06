import { beforeEach, describe, expect, it, vi } from "vitest";

const sendBrandedEmailMock = vi.hoisted(() => vi.fn());
vi.mock("./resendEmail", () => ({ sendBrandedEmail: sendBrandedEmailMock }));

import { sendBookingMovedEmailSafely, sendRebookRequestEmailSafely } from "./customerNotifications";

const booking = {
  clientName: "Fenton Richards",
  clientEmail: " fenton@example.com ",
  serviceName: "Cornrows",
  appointmentDate: "2026-11-07",
  appointmentTime: "10:00",
  depositStatus: "paid",
  serviceLocation: "studio",
};

describe("rebooking emails", () => {
  beforeEach(() => {
    sendBrandedEmailMock.mockReset().mockResolvedValue({ sent: true, messageId: "m1" });
  });

  it("apologises, keeps the deposit, offers a refund, and links to the customer's own page", async () => {
    expect(await sendRebookRequestEmailSafely({ booking, rebookUrl: "https://www.ebysplace.com/rebook/64/abc" })).toEqual({ sent: true });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(email.to).toBe("fenton@example.com");
    expect(email.subject).toBe("Your Saturday booking at Eby’s Place");
    expect(email.paragraphs[0]).toBe("Hi Fenton,");
    expect(email.paragraphs[1]).toContain("Saturday 7 November is now fully booked");
    expect(email.paragraphs[2]).toContain("£20 deposit is safe");
    expect(email.cta).toEqual({ label: "Choose a new date", url: "https://www.ebysplace.com/rebook/64/abc" });
    const closing = email.closing.join("\n");
    expect(closing).toContain("we’ll refund your deposit");
    expect(closing).toContain("https://www.ebysplace.com/newsletter");
    expect(closing).toContain("Add to Home Screen");
  });

  it("leaves out deposit and refund lines when no deposit was paid", async () => {
    await sendRebookRequestEmailSafely({ booking: { ...booking, depositStatus: "unpaid" }, rebookUrl: "https://x.test" });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(JSON.stringify(email)).not.toContain("deposit");
  });

  it("sends a shorter reminder with the same link", async () => {
    await sendRebookRequestEmailSafely({ booking, rebookUrl: "https://www.ebysplace.com/rebook/64/abc", reminder: true });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(email.subject).toBe("A quick reminder to choose your new date");
    expect(email.paragraphs[1]).toContain("Saturday 7 November");
    expect(email.cta.url).toBe("https://www.ebysplace.com/rebook/64/abc");
    expect(email.closing.join(" ")).toContain("refund your deposit");
  });

  it("confirms the new date", async () => {
    await sendBookingMovedEmailSafely({ booking: { ...booking, appointmentDate: "2026-11-10" } });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(email.subject).toBe("You’re booked in: Tuesday 10 November at 10:00");
    expect(email.paragraphs[1]).toContain("at the studio");
    expect(email.paragraphs[1]).toContain("deposit has moved with it");
  });

  it("refuses invalid addresses", async () => {
    expect(await sendRebookRequestEmailSafely({ booking: { ...booking, clientEmail: "nope" }, rebookUrl: "https://x.test" })).toEqual({ sent: false, reason: "invalid_address" });
    expect(sendBrandedEmailMock).not.toHaveBeenCalled();
  });
});

describe("sorry, once more (approved for Fenton 2026-11-06)", () => {
  beforeEach(() => {
    sendBrandedEmailMock.mockReset().mockResolvedValue({ sent: true, messageId: "m2" });
  });

  it("apologises for a second move, blames our system, gives Eby's number and never mentions a refund", async () => {
    const moved = { ...booking, appointmentDate: "2026-11-08", appointmentTime: "16:00" };
    expect(await sendRebookRequestEmailSafely({ booking: moved, rebookUrl: "https://www.ebysplace.com/rebook/64/new", onceMore: true })).toEqual({ sent: true });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect(email.subject).toBe("Sorry, Fenton: we need to move your booking once more");
    const text = [...email.paragraphs, ...email.closing].join("\n");
    expect(text).toContain("Sunday 8 November at 16:00");
    expect(text).toContain("Our technical team has now fixed it");
    expect(text).toContain("07864 585110");
    expect(text).toContain("£20 deposit is safe");
    expect(text.toLowerCase()).not.toContain("refund");
    expect(email.cta).toEqual({ label: "Choose a new date", url: "https://www.ebysplace.com/rebook/64/new" });
  });

  it("the ordinary rebooking email still has no phone number", async () => {
    await sendRebookRequestEmailSafely({ booking, rebookUrl: "https://x.test" });
    const email = sendBrandedEmailMock.mock.calls[0][0];
    expect([...email.paragraphs, ...email.closing].join("\n")).not.toContain("07864");
  });
});
