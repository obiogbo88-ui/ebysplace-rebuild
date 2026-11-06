import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-rebook-links-0123456789"; });

const sendRebookRequestEmailSafelyMock = vi.hoisted(() => vi.fn());
vi.mock("./customerNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./customerNotifications")>()),
  sendRebookRequestEmailSafely: sendRebookRequestEmailSafelyMock,
}));

import { appRouter } from "./routers";
import * as db from "./db";
import { allows } from "../shared/adminRoles";
import type { TrpcContext } from "./_core/context";

const ctx = (): TrpcContext => ({
  user: { id: 1, role: "admin", adminRole: "owner", name: "Eby", email: "info@ebysplace.com" } as unknown as TrpcContext["user"],
  req: { protocol: "https", headers: { origin: "https://www.ebysplace.com" }, ip: "10.1.1.1" } as TrpcContext["req"],
  res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
});
const booking = (id: number, date: string, time: string, name: string) =>
  ({ id, clientName: name, clientEmail: `${id}@example.com`, clientPhone: "07000000000", serviceName: "Cornrows", appointmentDate: date, appointmentTime: time, status: "confirmed", depositStatus: "paid", serviceLocation: "studio" }) as any;

describe("blocking several days at once", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendRebookRequestEmailSafelyMock.mockReset().mockResolvedValue({ sent: true });
    vi.spyOn(db, "logActivity").mockResolvedValue(undefined as any);
    vi.spyOn(db, "markRebookRequested").mockResolvedValue(undefined);
    vi.spyOn(db, "listLiveBookingsOnDate").mockImplementation(async (date: string) =>
      date === "2026-11-20" ? [booking(1, date, "09:30", "Ada Obi"), booking(2, date, "14:00", "Tolu B")] : date === "2026-11-13" ? [booking(3, date, "10:00", "Cynthia Kizza")] : []);
  });

  it("saves every chosen day in one write, without duplicates", async () => {
    const save = vi.spyOn(db, "blockBookingSlots").mockResolvedValue(undefined as any);
    const result = await appRouter.createCaller(ctx()).admin.blockAvailabilityDays({ dates: ["2026-11-18", "2026-11-17", "2026-11-18"], reason: "Holiday" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual([
      { date: "2026-11-17", time: undefined, reason: "Holiday" },
      { date: "2026-11-18", time: undefined, reason: "Holiday" },
    ]);
    expect(result).toMatchObject({ blocked: 2, emailed: [] });
    expect(sendRebookRequestEmailSafelyMock).not.toHaveBeenCalled();
  });

  it("lists who is booked across the days, without contact details", async () => {
    const rows = await appRouter.createCaller(ctx()).admin.bookingsOnDates({ dates: ["2026-11-20", "2026-11-13", "2026-11-21"] });
    expect(rows.map((r) => r.clientName)).toEqual(["Cynthia Kizza", "Ada Obi", "Tolu B"]);
    expect(JSON.stringify(rows)).not.toContain("example.com");
    expect(JSON.stringify(rows)).not.toContain("07000000000");
  });

  it("emails everyone booked on the chosen days their own link", async () => {
    vi.spyOn(db, "blockBookingSlots").mockResolvedValue(undefined as any);
    const result = await appRouter.createCaller(ctx()).admin.blockAvailabilityDays({ dates: ["2026-11-13", "2026-11-20"], emailAffected: true });
    expect(result.emailed).toEqual(["Cynthia Kizza", "Ada Obi", "Tolu B"]);
    const urls = sendRebookRequestEmailSafelyMock.mock.calls.map((c) => c[0].rebookUrl);
    expect(urls[0]).toMatch(/\/rebook\/3\//);
    expect(db.markRebookRequested).toHaveBeenCalledTimes(3);
  });

  it("with one time, only that time's customers are emailed", async () => {
    vi.spyOn(db, "blockBookingSlots").mockResolvedValue(undefined as any);
    const result = await appRouter.createCaller(ctx()).admin.blockAvailabilityDays({ dates: ["2026-11-20"], time: "14:00", emailAffected: true });
    expect(result.emailed).toEqual(["Tolu B"]);
  });

  it("refuses an empty list", async () => {
    await expect(appRouter.createCaller(ctx()).admin.blockAvailabilityDays({ dates: [] })).rejects.toThrow();
  });

  it("the Bookings role can use it", () => {
    expect(allows("bookings", "admin.blockAvailabilityDays", "mutation")).toBe(true);
    expect(allows("bookings", "admin.bookingsOnDates", "query")).toBe(true);
    expect(allows("viewer", "admin.blockAvailabilityDays", "mutation")).toBe(false);
  });
});

describe("mergeBlockedSlots", () => {
  it("replaces an existing block for the same day instead of doubling it, and keeps other days", () => {
    const merged = db.mergeBlockedSlots(
      [{ date: "2026-11-17", time: "", reason: "Old" }, { date: "2026-11-07", time: "", reason: "Fully booked" }, { date: "2026-11-17", time: "14:00", reason: "Dentist" }],
      [{ date: "2026-11-17", reason: "Holiday" }, { date: "2026-11-18" }],
    );
    expect(merged).toEqual([
      { date: "2026-11-07", time: "", reason: "Fully booked" },
      { date: "2026-11-17", time: "14:00", reason: "Dentist" },
      { date: "2026-11-17", time: "", reason: "Holiday" },
      { date: "2026-11-18", time: "", reason: "Unavailable" },
    ]);
  });
});
