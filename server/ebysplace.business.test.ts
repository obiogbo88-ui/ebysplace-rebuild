import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: { origin: "https://example.test" } } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("Eby’s Place platform business rules", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "";
  });

  it("exposes premium featured services without requiring database access", async () => {
    const services = await db.listFeaturedServices();
    expect(services.length).toBeGreaterThanOrEqual(4);
    expect(services.map((service) => service.name)).toContain("Knotless Braids");
  });

  it("creates a booking draft that clearly requires the exact £20 non-refundable deposit", async () => {
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.public.createBooking({
      serviceName: "Knotless Braids",
      clientName: "Test Client",
      clientEmail: "client@example.com",
      clientPhone: "07123456789",
      addressLine1: "1 Gold Street",
      city: "London",
      county: "Greater London",
      postcode: "E1 1AA",
      deliveryNote: "Door code available on request",
      appointmentDate: "2026-07-01",
      appointmentTime: "10:00",
    });

    expect(result.depositAmount).toBe(20);
    expect(result.depositCurrency).toBe("GBP");
    expect(result.message).toContain("non-refundable deposit");
  });

  it("returns an admin summary fallback with seeded services and products", async () => {
    const summary = await db.adminSummary();
    expect(summary.services).toBeGreaterThanOrEqual(6);
    expect(summary.products).toBeGreaterThanOrEqual(3);
  });
});
