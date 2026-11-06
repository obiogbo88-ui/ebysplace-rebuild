import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-rebook-links-0123456789"; });

const sendRebookRequestEmailSafelyMock = vi.hoisted(() => vi.fn());
vi.mock("./customerNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./customerNotifications")>()),
  sendRebookRequestEmailSafely: sendRebookRequestEmailSafelyMock,
}));

import { appRouter } from "./routers";
import * as db from "./db";
import { formatRebookMoment, formatShortSlot, rebookResendBlockReason, rebookStatus } from "../shared/rebookStatus";
import type { TrpcContext } from "./_core/context";

const now = new Date("2026-11-06T12:00:00Z");
const base = { status: "pending" };

describe("rebooking status on a booking", () => {
  it("shows nothing for an ordinary booking", () => {
    expect(rebookStatus(base)).toBeNull();
  });

  it("shows waiting, with when the reminder is due", () => {
    const state = rebookStatus({ ...base, rebookRequestedAt: "2026-11-06T10:31:10Z" });
    expect(state?.kind).toBe("waiting");
    if (state?.kind !== "waiting") return;
    expect(formatRebookMoment(state.sentAt, now)).toBe("today at 10:31");
    expect(formatRebookMoment(state.reminderDueAt, now)).toBe("tomorrow at 10:31");
  });

  it("shows call the customer once you've been alerted", () => {
    expect(rebookStatus({ ...base, rebookRequestedAt: "2026-11-05T10:00:00Z", rebookOwnerAlertedAt: "2026-11-06T09:00:00Z" })?.kind).toBe("call");
  });

  it("shows who moved it and the old date", () => {
    const state = rebookStatus({ status: "confirmed", rebookMovedAt: "2026-11-06T18:10:00Z", rebookMovedBy: "customer", rebookPreviousDate: "2026-11-07", rebookPreviousTime: "10:00" });
    expect(state).toMatchObject({ kind: "moved", by: "customer", previousDate: "2026-11-07" });
    expect(formatShortSlot("2026-11-07", "10:00")).toBe("Sat 7 Nov 10:00");
  });

  it("a new link after a move counts as waiting again", () => {
    expect(rebookStatus({ ...base, rebookMovedAt: "2026-11-01T10:00:00Z", rebookRequestedAt: "2026-11-06T10:00:00Z" })?.kind).toBe("waiting");
  });

  it("hides it on cancelled and completed bookings", () => {
    expect(rebookStatus({ status: "cancelled", rebookRequestedAt: "2026-11-06T10:00:00Z" })).toBeNull();
    expect(rebookStatus({ status: "completed", rebookMovedAt: "2026-11-06T10:00:00Z" })).toBeNull();
  });

  it("uses London time and short dates for older moments", () => {
    expect(formatRebookMoment("2026-11-02T09:05:00Z", now)).toBe("Mon 2 Nov, 09:05");
    expect(formatRebookMoment("2026-07-02T09:05:00Z", new Date("2026-07-02T20:00:00Z"))).toBe("today at 10:05");
  });
});

describe("sending a second rebooking link", () => {
  const ctx = (): TrpcContext => ({
    user: { id: 1, role: "admin", adminRole: "owner", name: "Eby", email: "info@ebysplace.com" } as unknown as TrpcContext["user"],
    req: { protocol: "https", headers: { origin: "https://www.ebysplace.com" }, ip: "10.1.1.1" } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  });
  const fenton = { id: 64, clientName: "Fenton Richards", clientEmail: "fenton@example.com", serviceName: "Cornrows", appointmentDate: "2099-11-07", appointmentTime: "10:00", status: "pending", depositStatus: "paid", serviceLocation: "studio", rebookRequestedAt: new Date("2026-11-06T10:31:00Z") } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    sendRebookRequestEmailSafelyMock.mockReset().mockResolvedValue({ sent: true });
    vi.spyOn(db, "getBookingById").mockResolvedValue(fenton);
    vi.spyOn(db, "markRebookRequested").mockResolvedValue(undefined);
    vi.spyOn(db, "logActivity").mockResolvedValue(undefined as any);
  });

  it("refuses without confirmation, saying when the first went", async () => {
    expect(rebookResendBlockReason(fenton.rebookRequestedAt, false, now)).toBe("A rebooking link was already sent today at 10:31.");
    await expect(appRouter.createCaller(ctx()).admin.sendRebookLink({ bookingId: 64 })).rejects.toThrow(/already sent/);
    expect(sendRebookRequestEmailSafelyMock).not.toHaveBeenCalled();
  });

  it("sends when you confirm Send again", async () => {
    await appRouter.createCaller(ctx()).admin.sendRebookLink({ bookingId: 64, sendAgain: true });
    expect(sendRebookRequestEmailSafelyMock).toHaveBeenCalledTimes(1);
  });
});
