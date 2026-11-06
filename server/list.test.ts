import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ left: new Set<string>(), prefs: [] as Array<[string, string, boolean]> }));
const dbCalls = vi.hoisted(() => ({ joined: [] as string[], removed: [] as string[], subscribed: [] as string[], alreadyOn: new Set<string>() }));

vi.mock("./crm/store", () => ({
  clientsSwitchedOff: async () => store.left,
  setClientPref: async (key: string, automation: string, enabled: boolean) => {
    store.prefs.push([key, automation, enabled]);
  },
}));
vi.mock("./db", () => ({
  joinListFromBooking: async (email: string) => {
    if (dbCalls.alreadyOn.has(email)) return { joined: false };
    dbCalls.joined.push(email);
    return { joined: true };
  },
  removeNewsletterSubscriber: async (email: string) => {
    dbCalls.removed.push(email);
  },
  subscribeNewsletter: async (email: string) => {
    dbCalls.subscribed.push(email);
    return { success: true };
  },
}));

import { confirmationSaysOnList, joinListAfterPayment, joinListAgain, leaveList, withoutPeopleWhoLeft } from "./list";
import { bookingListLines, CONFIRMATION_NOTIFICATIONS_LINE } from "./smtpEmailNotifications";
import { renderBrandedEmail, renderPlainText, withLeaveLink } from "./resendEmail";
import { listStanding } from "./crm/clients";

beforeEach(() => {
  store.left = new Set();
  store.prefs = [];
  dbCalls.joined = [];
  dbCalls.removed = [];
  dbCalls.subscribed = [];
  dbCalls.alreadyOn = new Set();
});

describe("joining the list when the deposit is paid", () => {
  it("adds a customer who left the box unticked", async () => {
    expect(await joinListAfterPayment({ clientEmail: " Jo@Example.com ", joinList: true })).toBe("joined");
    expect(dbCalls.joined).toEqual(["jo@example.com"]);
  });

  it("never adds someone who ticked Don't add me, or an older booking with no choice", async () => {
    expect(await joinListAfterPayment({ clientEmail: "a@b.co", joinList: false })).toBe("said_no");
    expect(await joinListAfterPayment({ clientEmail: "a@b.co", joinList: null })).toBe("no_choice");
    expect(await joinListAfterPayment({ clientEmail: "a@b.co" })).toBe("no_choice");
    expect(dbCalls.joined).toEqual([]);
  });

  it("keeps someone who left off the list, even when they book again", async () => {
    store.left = new Set(["e:gone@b.co"]);
    expect(await joinListAfterPayment({ clientEmail: "Gone@b.co", joinList: true })).toBe("left_before");
    expect(dbCalls.joined).toEqual([]);
  });

  it("says 'already on' for someone already signed up, and the email still mentions the list", async () => {
    dbCalls.alreadyOn.add("on@b.co");
    const outcome = await joinListAfterPayment({ clientEmail: "on@b.co", joinList: true });
    expect(outcome).toBe("already_on");
    expect(confirmationSaysOnList(outcome)).toBe(true);
    expect(confirmationSaysOnList("said_no")).toBe(false);
  });
});

describe("leaving and joining again", () => {
  it("leaving switches marketing off and removes the sign-up row", async () => {
    await leaveList("e:jo@example.com");
    expect(store.prefs).toEqual([["e:jo@example.com", "marketing", false]]);
    expect(dbCalls.removed).toEqual(["jo@example.com"]);
  });

  it("joining again switches it back on and re-adds them", async () => {
    await joinListAgain("e:jo@example.com");
    expect(store.prefs).toEqual([["e:jo@example.com", "marketing", true]]);
    expect(dbCalls.subscribed).toEqual(["jo@example.com"]);
  });

  it("announcements skip everyone who left, whatever the case of their address", async () => {
    store.left = new Set(["e:gone@b.co", "p:7700900000"]);
    expect(await withoutPeopleWhoLeft(["stay@b.co", "GONE@b.co", "not-an-email"])).toEqual(["stay@b.co"]);
  });
});

describe("the confirmation email", () => {
  it("tells someone on the list how to leave, and asks everyone to turn on notifications", () => {
    const on = bookingListLines({ onList: true, leaveUrl: "https://www.ebysplace.com/api/crm/unsubscribe?c=x&s=y" });
    expect(on[0]).toContain("You're now on the Eby's Place list");
    expect(on[0]).toContain("Leave the list: https://www.ebysplace.com/api/crm/unsubscribe?c=x&s=y");
    expect(on[1]).toBe(CONFIRMATION_NOTIFICATIONS_LINE);
    expect(bookingListLines({ onList: false, leaveUrl: "https://x" })).toEqual([CONFIRMATION_NOTIFICATIONS_LINE]);
    expect(bookingListLines(undefined)).toEqual([]);
  });
});

describe("the Leave the list footer on list emails", () => {
  it("adds a link, plain-text copy and the one-click headers", () => {
    const email = withLeaveLink({ to: "a@b.co", subject: "Hi", paragraphs: ["Hi there,", "News"] }, "https://www.ebysplace.com/api/crm/unsubscribe?c=1&s=2");
    expect(email.headers).toMatchObject({ "List-Unsubscribe": "<https://www.ebysplace.com/api/crm/unsubscribe?c=1&s=2>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    expect(renderPlainText(email)).toContain("Leave the list: https://www.ebysplace.com/api/crm/unsubscribe?c=1&amp;s=2".replace("&amp;", "&"));
    expect(renderBrandedEmail(email)).toContain('href="https://www.ebysplace.com/api/crm/unsubscribe?c=1&amp;s=2"');
    expect(renderBrandedEmail(email)).toContain("Leave the list</a>");
  });
});

describe("list standing in the Command Centre", () => {
  const booking = (joinList: boolean | null, createdAt: string) => ({ joinList, createdAt }) as never;

  it("shows how and when someone joined", () => {
    expect(listStanding({ subs: [{ id: 1, email: "a@b.co", productAlerts: "false", source: "booking", createdAt: "2026-11-14T10:00:00Z" }], bookings: [] }, false)).toEqual({ status: "on", via: "booking", since: "2026-11-14" });
    expect(listStanding({ subs: [{ id: 1, email: "a@b.co", productAlerts: "false", source: null, createdAt: "2026-10-01T10:00:00Z" }], bookings: [] }, false).via).toBe("website");
  });

  it("leaving wins over everything, and the latest booking choice decides 'said no'", () => {
    expect(listStanding({ subs: [{ id: 1, email: "a@b.co", productAlerts: "false", createdAt: "2026-10-01" }], bookings: [] }, true).status).toBe("left");
    expect(listStanding({ subs: [], bookings: [booking(true, "2026-10-01"), booking(false, "2026-11-01")] }, false).status).toBe("said_no");
    expect(listStanding({ subs: [], bookings: [booking(null, "2026-10-01")] }, false).status).toBe("not_on");
  });
});
