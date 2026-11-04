import { describe, expect, it } from "vitest";
import { clientBookings } from "./clients";

const b = (id: number, date: string, status: "pending" | "confirmed" | "completed" | "cancelled", email = "a@b.com") => ({
  id, serviceName: "Knotless Braids", clientName: "A", clientEmail: email, clientPhone: "", city: null,
  appointmentDate: date, appointmentTime: "10:00:00", status, depositStatus: "paid", checkoutTotalCharged: "20.00", reviewRequestSentAt: null, createdAt: "2026-11-01T09:00:00Z",
});

describe("clientBookings", () => {
  it("lists the dates a client booked for: upcoming soonest first, then past, newest first", () => {
    const list = clientBookings({ email: "A@B.com", phone: null }, [b(1, "2026-10-01", "completed"), b(2, "2026-11-20", "confirmed"), b(3, "2026-11-08", "pending"), b(4, "2026-09-01", "completed"), b(5, "2026-11-10", "confirmed", "other@x.com")], "2026-11-04");
    expect(list.map((x) => x.id)).toEqual([3, 2, 1, 4]);
    expect(list[0]).toMatchObject({ date: "2026-11-08", time: "10:00", upcoming: true, bookedOn: "2026-11-01" });
  });
});
