import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-rebook-links-0123456789"; });

const notifyOwnerMock = vi.hoisted(() => vi.fn());
const sendRebookRequestEmailSafelyMock = vi.hoisted(() => vi.fn());
const sendBookingMovedEmailSafelyMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/notification", () => ({ notifyOwner: notifyOwnerMock }));
vi.mock("./customerNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./customerNotifications")>()),
  sendRebookRequestEmailSafely: sendRebookRequestEmailSafelyMock,
  sendBookingMovedEmailSafely: sendBookingMovedEmailSafelyMock,
}));

import { addDays, formatLongDate, londonToday, rebookSlotProblem, startTimesFor } from "../shared/rebook";
import { isValidRebookToken, rebookToken, rebookUrl } from "./rebook";
import { renderBrandedEmail } from "./resendEmail";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function ctx(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: { origin: "https://www.ebysplace.com" }, ip: `10.0.0.${Math.floor(Math.random() * 250)}` } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

const today = londonToday();
const tomorrow = addDays(today, 1);
const booking = {
  id: 64,
  serviceName: "Cornrows",
  clientName: "Fenton Richards",
  clientEmail: "fenton@example.com",
  clientPhone: "07000000000",
  serviceLocation: "studio",
  appointmentDate: addDays(today, 2),
  appointmentTime: "10:00",
  status: "pending",
  depositStatus: "paid",
} as any;

describe("rebooking rules", () => {
  it("offers opening-hours start times per weekday", () => {
    expect(startTimesFor("2026-11-07")[0]).toBe("07:00"); // Saturday
    expect(startTimesFor("2026-11-07").at(-1)).toBe("20:00");
    expect(startTimesFor("2026-11-08")).toEqual(["16:00", "17:00", "18:00", "19:00", "20:00"]); // Sunday
    expect(startTimesFor("2026-11-10").slice(0, 3)).toEqual(["09:30", "10:00", "11:00"]); // Tuesday
  });

  it("formats long dates in UK style", () => {
    expect(formatLongDate("2026-11-07")).toBe("Saturday 7 November");
  });

  it("rejects past, blocked, taken and out-of-hours slots", () => {
    expect(rebookSlotProblem({ date: today, time: "10:00", blocked: [], taken: [] })).toMatch(/tomorrow/);
    const day = addDays(today, 3);
    const time = startTimesFor(day)[1];
    expect(rebookSlotProblem({ date: day, time, blocked: [], taken: [] })).toBeNull();
    expect(rebookSlotProblem({ date: day, time, blocked: [{ date: day, time: "" }], taken: [] })).toMatch(/taken/);
    expect(rebookSlotProblem({ date: day, time, blocked: [], taken: [{ date: day, time }] })).toMatch(/taken/);
    expect(rebookSlotProblem({ date: day, time: "03:00", blocked: [], taken: [] })).toMatch(/opening hours/);
    expect(rebookSlotProblem({ date: addDays(today, 90), time: "10:00", blocked: [], taken: [] })).toMatch(/60 days/);
  });
});

describe("rebooking links", () => {
  it("only opens its own booking, and dies once the booking moves", () => {
    const token = rebookToken(booking);
    expect(isValidRebookToken(booking, token)).toBe(true);
    expect(isValidRebookToken({ ...booking, id: 65 }, token)).toBe(false);
    expect(isValidRebookToken({ ...booking, appointmentTime: "11:00" }, token)).toBe(false);
    expect(isValidRebookToken(booking, "x".repeat(32))).toBe(false);
    expect(rebookUrl(booking)).toBe(`https://www.ebysplace.com/rebook/64/${token}`);
  });
});

describe("branded email closing paragraphs", () => {
  it("renders text below the button", () => {
    const html = renderBrandedEmail({ subject: "S", paragraphs: ["Hi A,", "Body"], cta: { label: "Choose a new date", url: "https://x.test/r" }, closing: ["After the button"] });
    expect(html.indexOf("Choose a new date")).toBeGreaterThan(-1);
    expect(html.indexOf("After the button")).toBeGreaterThan(html.indexOf("Choose a new date"));
  });
});

describe("rebook routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    notifyOwnerMock.mockReset().mockResolvedValue(true);
    sendBookingMovedEmailSafelyMock.mockReset().mockResolvedValue({ sent: true });
    sendRebookRequestEmailSafelyMock.mockReset().mockResolvedValue({ sent: true });
    vi.spyOn(db, "getBookingById").mockResolvedValue(booking);
    vi.spyOn(db, "getAvailabilitySettings").mockResolvedValue({ blockedSlots: [{ date: booking.appointmentDate, time: "", reason: "Fully booked" }], homeServiceSurcharge: "40.00" } as any);
    vi.spyOn(db, "listTakenBookingSlots").mockResolvedValue([]);
  });

  it("shows the booking to the link holder without other customers' details", async () => {
    const data = await appRouter.createCaller(ctx()).public.getRebook({ bookingId: 64, token: rebookToken(booking) });
    expect(data.firstName).toBe("Fenton");
    expect(data.depositPaid).toBe(true);
    expect(JSON.stringify(data)).not.toContain("fenton@example.com");
    expect(JSON.stringify(data)).not.toContain("07000000000");
  });

  it("refuses a wrong token", async () => {
    await expect(appRouter.createCaller(ctx()).public.getRebook({ bookingId: 64, token: "x".repeat(32) })).rejects.toThrow(/already been used|isn.t valid/);
  });

  it("moves the booking, emails the customer and notifies the owner", async () => {
    const day = addDays(today, 3);
    const time = startTimesFor(day)[1];
    const move = vi.spyOn(db, "moveBookingDate").mockResolvedValue({ previousDate: booking.appointmentDate, previousTime: "10:00", booking: { ...booking, appointmentDate: day, appointmentTime: time, status: "confirmed" } } as any);
    const result = await appRouter.createCaller(ctx()).public.rebook({ bookingId: 64, token: rebookToken(booking), date: day, time });
    expect(move).toHaveBeenCalledWith(64, day, time);
    expect(result.emailSent).toBe(true);
    expect(sendBookingMovedEmailSafelyMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnerMock.mock.calls[0][0].content).toContain("Fenton Richards moved Cornrows");
    expect(notifyOwnerMock.mock.calls[0][0].content).toContain("Deposit paid.");
  });

  it("won't move onto a blocked day", async () => {
    const move = vi.spyOn(db, "moveBookingDate");
    await expect(appRouter.createCaller(ctx()).public.rebook({ bookingId: 64, token: rebookToken(booking), date: booking.appointmentDate, time: "10:00" })).rejects.toThrow();
    expect(move).not.toHaveBeenCalled();
  });

  it("refuses cancelled bookings", async () => {
    vi.spyOn(db, "getBookingById").mockResolvedValue({ ...booking, status: "cancelled" });
    await expect(appRouter.createCaller(ctx()).public.getRebook({ bookingId: 64, token: rebookToken(booking) })).rejects.toThrow(/cancelled/);
  });

  it("keeps the admin routes behind sign-in", async () => {
    await expect(appRouter.createCaller(ctx()).admin.sendRebookLink({ bookingId: 64 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx()).admin.moveBooking({ bookingId: 64, date: tomorrow, time: "10:00", notifyCustomer: true })).rejects.toThrow();
  });
});
