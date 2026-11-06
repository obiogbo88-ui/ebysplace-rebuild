import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-rebook-links-0123456789"; });

const notifyOwnerMock = vi.hoisted(() => vi.fn());
const sendRebookRequestEmailSafelyMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/notification", () => ({ notifyOwner: notifyOwnerMock }));
vi.mock("./customerNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./customerNotifications")>()),
  sendRebookRequestEmailSafely: sendRebookRequestEmailSafelyMock,
}));

import { appRouter } from "./routers";
import * as db from "./db";
import { runRebookFollowUps } from "./rebookFollowUps";
import { allows } from "../shared/adminRoles";
import type { TrpcContext } from "./_core/context";

function ownerCtx(): TrpcContext {
  return {
    user: { id: 1, role: "admin", adminRole: "owner", name: "Eby", email: "info@ebysplace.com" } as unknown as TrpcContext["user"],
    req: { protocol: "https", headers: { origin: "https://www.ebysplace.com" }, ip: "10.1.1.1" } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

const fenton = { id: 64, clientName: "Fenton Richards", clientEmail: "fenton@example.com", clientPhone: "07000000000", serviceName: "Cornrows", appointmentDate: "2026-11-07", appointmentTime: "10:00", status: "pending", depositStatus: "paid", serviceLocation: "studio" } as any;
const other = { ...fenton, id: 70, clientName: "Ada Obi", clientEmail: "ada@example.com", appointmentTime: "14:00" };

describe("blocking a day emails the customers on it", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendRebookRequestEmailSafelyMock.mockReset().mockResolvedValue({ sent: true });
    notifyOwnerMock.mockReset().mockResolvedValue(true);
    vi.spyOn(db, "blockBookingSlot").mockResolvedValue({ success: true } as any);
    vi.spyOn(db, "logActivity").mockResolvedValue(undefined as any);
    vi.spyOn(db, "listLiveBookingsOnDate").mockResolvedValue([fenton, other]);
  });

  it("previews who is booked, without emails or phone numbers", async () => {
    const rows = await appRouter.createCaller(ownerCtx()).admin.bookingsOnDate({ date: "2026-11-07" });
    expect(rows.map((r) => r.clientName)).toEqual(["Fenton Richards", "Ada Obi"]);
    expect(JSON.stringify(rows)).not.toContain("example.com");
    expect(JSON.stringify(rows)).not.toContain("07000000000");
  });

  it("blocks and emails each customer their own link, and records it for the follow-up", async () => {
    const mark = vi.spyOn(db, "markRebookRequested").mockResolvedValue(undefined);
    const result = await appRouter.createCaller(ownerCtx()).admin.blockAvailabilitySlot({ date: "2026-11-07", reason: "Fully booked", emailAffected: true });
    expect(db.blockBookingSlot).toHaveBeenCalledWith({ date: "2026-11-07", reason: "Fully booked" });
    expect(result.emailed).toEqual(["Fenton Richards", "Ada Obi"]);
    const urls = sendRebookRequestEmailSafelyMock.mock.calls.map((call) => call[0].rebookUrl);
    expect(urls[0]).toMatch(/\/rebook\/64\//);
    expect(urls[1]).toMatch(/\/rebook\/70\//);
    expect(mark).toHaveBeenCalledTimes(2);
  });

  it("only emails the blocked time when a single time is blocked", async () => {
    vi.spyOn(db, "markRebookRequested").mockResolvedValue(undefined);
    const result = await appRouter.createCaller(ownerCtx()).admin.blockAvailabilitySlot({ date: "2026-11-07", time: "14:00", emailAffected: true });
    expect(result.emailed).toEqual(["Ada Obi"]);
  });

  it("reports customers whose email didn't send, and doesn't chase them", async () => {
    const mark = vi.spyOn(db, "markRebookRequested").mockResolvedValue(undefined);
    sendRebookRequestEmailSafelyMock.mockResolvedValueOnce({ sent: false, reason: "invalid_address" });
    const result = await appRouter.createCaller(ownerCtx()).admin.blockAvailabilitySlot({ date: "2026-11-07", emailAffected: true });
    expect(result.failed).toEqual(["Fenton Richards (invalid_address)"]);
    expect(result.emailed).toEqual(["Ada Obi"]);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when the box is unticked", async () => {
    await appRouter.createCaller(ownerCtx()).admin.blockAvailabilitySlot({ date: "2026-11-07", emailAffected: false });
    expect(sendRebookRequestEmailSafelyMock).not.toHaveBeenCalled();
  });

  it("lets the Bookings role use the rebooking tools", () => {
    for (const path of ["admin.sendRebookLink", "admin.moveBooking", "admin.blockAvailabilitySlot"]) expect(allows("bookings", path, "mutation")).toBe(true);
    expect(allows("viewer", "admin.moveBooking", "mutation")).toBe(false);
  });
});

describe("rebooking follow-ups", () => {
  const now = new Date("2026-11-06T09:00:00Z"); // Friday
  beforeEach(() => {
    vi.restoreAllMocks();
    sendRebookRequestEmailSafelyMock.mockReset().mockResolvedValue({ sent: true });
    notifyOwnerMock.mockReset().mockResolvedValue(true);
    vi.spyOn(db, "markRebookReminderSent").mockResolvedValue(undefined);
    vi.spyOn(db, "markRebookOwnerAlerted").mockResolvedValue(undefined);
  });

  it("sends one reminder after 24 hours", async () => {
    vi.spyOn(db, "listPendingRebooks").mockResolvedValue([{ ...fenton, appointmentDate: "2026-11-12", rebookRequestedAt: new Date("2026-11-05T08:00:00Z") }]);
    const result = await runRebookFollowUps(now);
    expect(result.reminded).toBe(1);
    expect(sendRebookRequestEmailSafelyMock.mock.calls[0][0].reminder).toBe(true);
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("waits until 24 hours have passed", async () => {
    vi.spyOn(db, "listPendingRebooks").mockResolvedValue([{ ...fenton, appointmentDate: "2026-11-12", rebookRequestedAt: new Date("2026-11-05T22:00:00Z") }]);
    expect((await runRebookFollowUps(now)).reminded).toBe(0);
  });

  it("never reminds twice", async () => {
    vi.spyOn(db, "listPendingRebooks").mockResolvedValue([{ ...fenton, appointmentDate: "2026-11-12", rebookRequestedAt: new Date("2026-11-03T08:00:00Z"), rebookReminderSentAt: new Date("2026-11-04T09:00:00Z") }]);
    expect((await runRebookFollowUps(now)).reminded).toBe(0);
  });

  it("alerts the owner once, the day before the old appointment, with the phone number", async () => {
    vi.spyOn(db, "listPendingRebooks").mockResolvedValue([{ ...fenton, rebookRequestedAt: new Date("2026-11-05T22:00:00Z") }]);
    const result = await runRebookFollowUps(now);
    expect(result.ownerAlerts).toBe(1);
    expect(notifyOwnerMock.mock.calls[0][0].content).toContain("Fenton Richards (07000000000)");
    expect(notifyOwnerMock.mock.calls[0][0].content).toContain("Saturday 7 November at 10:00");
  });

  it("doesn't alert again once alerted", async () => {
    vi.spyOn(db, "listPendingRebooks").mockResolvedValue([{ ...fenton, rebookRequestedAt: new Date("2026-11-05T08:00:00Z"), rebookOwnerAlertedAt: new Date("2026-11-06T08:00:00Z"), rebookReminderSentAt: new Date() }]);
    const result = await runRebookFollowUps(now);
    expect(result.ownerAlerts).toBe(0);
    expect(result.reminded).toBe(0);
  });
});
