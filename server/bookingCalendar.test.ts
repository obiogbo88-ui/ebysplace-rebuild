import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));

import { appRouter } from "./routers";
import * as db from "./db";
import { timesLeftToday } from "../client/src/components/booking/DayTimePicker";
import type { TrpcContext } from "./_core/context";

const publicCtx = (): TrpcContext => ({
  user: null,
  req: { protocol: "https", headers: { origin: "https://www.ebysplace.com" }, ip: "10.1.1.2" } as TrpcContext["req"],
  res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
});

const booking = { serviceName: "Cornrows", clientName: "New Client", clientEmail: "new@example.com", clientPhone: "07123456789", appointmentDate: "2026-11-13", appointmentTime: "10:00" };

describe("public booking calendar", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns closed days and booked times only, with no customer details", async () => {
    vi.spyOn(db, "getAvailabilitySettings").mockResolvedValue({ blockedSlots: [{ date: "2026-11-07", time: "", reason: "Fully booked" }], homeServiceSurcharge: "40.00" } as any);
    vi.spyOn(db, "listLiveTakenSlots").mockResolvedValue([{ date: "2026-11-13", time: "10:00" }]);
    const result = await appRouter.createCaller(publicCtx()).public.bookingCalendar();
    expect(result.blockedSlots).toEqual([{ date: "2026-11-07", time: "", reason: "Fully booked" }]);
    expect(result.taken).toEqual([{ date: "2026-11-13", time: "10:00" }]);
    expect(result.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(result).sort()).toEqual(["blockedSlots", "taken", "today"]);
  });

  it("refuses a time someone has already booked", async () => {
    vi.spyOn(db, "isBookingSlotBlocked").mockResolvedValue(false);
    vi.spyOn(db, "listLiveTakenSlots").mockResolvedValue([{ date: "2026-11-13", time: "10:00" }]);
    const create = vi.spyOn(db, "createBooking");
    await expect(appRouter.createCaller(publicCtx()).public.createBooking(booking)).rejects.toThrow(/just been booked/);
    expect(create).not.toHaveBeenCalled();
  });

  it("only paid or confirmed bookings count as taken", () => {
    expect(db.isLiveBooking({ status: "pending", depositStatus: "unpaid" })).toBe(false);
    expect(db.isLiveBooking({ status: "pending", depositStatus: "paid" })).toBe(true);
    expect(db.isLiveBooking({ status: "confirmed", depositStatus: "unpaid" })).toBe(true);
    expect(db.isLiveBooking({ status: "cancelled", depositStatus: "paid" })).toBe(false);
  });

  it("today only offers times at least an hour away", () => {
    expect(timesLeftToday(["09:30", "10:00", "11:00", "12:00"], "10:15")).toEqual(["12:00"]);
    expect(timesLeftToday(["16:00", "17:00"], "07:00")).toEqual(["16:00", "17:00"]);
  });
});
