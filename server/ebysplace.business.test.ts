import { AddressInfo } from "node:net";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { registerStripeWebhook } from "./stripeWebhook";
import type { TrpcContext } from "./_core/context";

const stripeCreateSessionMock = vi.hoisted(() => vi.fn());
const stripeConstructEventMock = vi.hoisted(() => vi.fn());
const notifyOwnerMock = vi.hoisted(() => vi.fn());
const storageGetSignedUrlMock = vi.hoisted(() => vi.fn());
const storagePutMock = vi.hoisted(() => vi.fn());
const generateImageMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: stripeCreateSessionMock } },
    webhooks: { constructEvent: stripeConstructEventMock },
  })),
}));

vi.mock("./storage", () => ({
  storageGetSignedUrl: storageGetSignedUrlMock,
  storagePut: storagePutMock,
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: generateImageMock,
}));

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
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
    stripeCreateSessionMock.mockReset();
    stripeConstructEventMock.mockReset();
    notifyOwnerMock.mockReset();
    notifyOwnerMock.mockResolvedValue(true);
    storageGetSignedUrlMock.mockReset();
    storagePutMock.mockReset();
    generateImageMock.mockReset();
    storageGetSignedUrlMock.mockResolvedValue("https://signed-storage.example/try-on/customer-photo.png");
    storagePutMock.mockResolvedValue({ url: "/manus-storage/mock-upload.png", key: "mock-upload.png" });
    generateImageMock.mockResolvedValue({ url: "/manus-storage/generated-try-on.png" });
  });

  it("exposes premium featured services without requiring database access", async () => {
    const services = await db.listFeaturedServices();
    expect(services.length).toBeGreaterThanOrEqual(4);
    expect(services.map((service) => service.name)).toContain("Knotless Braids");
  });

  it("exposes the expanded braiding, twist, loc, kids, and add-on catalogue without requiring database access", async () => {
    const services = await db.listServices();
    const names = services.map((service) => service.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "Knotless Braids",
        "Box Braids",
        "Goddess Braids",
        "Fulani Braids",
        "Cornrows",
        "Stitch Braids",
        "Lemonade Braids",
        "Boho Braids",
        "Tribal Braids",
        "Senegalese Twists",
        "Passion Twists",
        "Faux Locs",
        "Butterfly Locs",
        "Starter Locs",
        "Kids Braids",
        "Kids Cornrows",
        "Hair Wash & Prep",
        "Beads & Accessories",
        "Edge Control & Styling",
        "Braid Takedown",
      ]),
    );
    expect(new Set(services.map((service) => service.category))).toEqual(new Set(["Braids", "Twists", "Locs", "Kids Styles", "Add-ons"]));
  });

  it("maps every exact service name to an uploaded HD service image", async () => {
    const services = await db.listServices();
    expect(services).toHaveLength(20);
    for (const service of services) {
      expect(service.imageUrl, `${service.name} needs an uploaded image`).toMatch(/^\/manus-storage\/ebysplace_service_/);
    }
    expect(services.find((service) => service.name === "Goddess Braids")?.imageUrl).toContain("goddess_braids");
    expect(services.find((service) => service.name === "Box Braids")?.imageUrl).toContain("box_braids");
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
    expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "New Eby’s Place booking request",
      content: expect.stringContaining("Knotless Braids"),
    }));
  });

  it("creates Stripe Checkout sessions with booking metadata and dynamic redirects", async () => {
    stripeCreateSessionMock.mockResolvedValueOnce({ id: "cs_test_123", url: "https://checkout.stripe.test/session", payment_intent: "pi_test_123" });
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.createDepositCheckout({
      bookingId: 42,
      clientEmail: "client@example.com",
      clientName: "Test Client",
      serviceName: "Goddess Braids",
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(stripeCreateSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      customer_email: "client@example.com",
      client_reference_id: "42",
      success_url: "https://example.test/booking/success?booking=42",
      cancel_url: "https://example.test/booking?booking=42",
      allow_promotion_codes: true,
      metadata: expect.objectContaining({
        booking_id: "42",
        customer_email: "client@example.com",
        customer_name: "Test Client",
        service_name: "Goddess Braids",
        deposit_type: "non_refundable_20_gbp",
      }),
    }));
  });

  it("notifies the owner and marks bookings paid for completed Stripe deposit webhooks", async () => {
    stripeConstructEventMock.mockReturnValueOnce({
      id: "evt_live_mock",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_live_mock",
          customer_email: "client@example.com",
          payment_intent: "pi_live_mock",
          metadata: {
            booking_id: "42",
            customer_email: "client@example.com",
            customer_name: "Test Client",
            service_name: "Goddess Braids",
            deposit_type: "non_refundable_20_gbp",
          },
        },
      },
    });
    const markPaidSpy = vi.spyOn(db, "markBookingDepositPaid").mockResolvedValueOnce(undefined);
    const app = express();
    registerStripeWebhook(app);
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "live_signature" },
        body: JSON.stringify({ id: "evt_live_mock" }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true });
      expect(markPaidSpy).toHaveBeenCalledWith("cs_live_mock", "pi_live_mock");
      expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Eby’s Place deposit paid",
        content: expect.stringContaining("Goddess Braids"),
      }));
    } finally {
      markPaidSpy.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("responds to Stripe test webhook events with the required verification payload", async () => {
    stripeConstructEventMock.mockReturnValueOnce({ id: "evt_test_webhook", type: "checkout.session.completed", data: { object: {} } });
    const app = express();
    registerStripeWebhook(app);
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "test_signature" },
        body: JSON.stringify({ id: "evt_test_webhook" }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ verified: true });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("lists approved reviews and accepts public review submissions for moderation", async () => {
    const caller = appRouter.createCaller(publicContext());

    const approvedReviews = await caller.public.reviews();
    expect(approvedReviews.length).toBeGreaterThanOrEqual(3);
    expect(approvedReviews.every((review) => review.status === "approved")).toBe(true);

    const submitted = await caller.public.submitReview({
      customerName: "Review Client",
      rating: 5,
      reviewText: "Eby’s Place gave me a lovely appointment experience.",
    });

    expect(submitted.status).toBe("pending");
    expect(submitted.id).toBeGreaterThan(0);
  });

  it("uses a signed absolute storage URL when generating AI Try-On previews from uploaded customer photos", async () => {
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.generateTryOn({
      styleName: "Knotless Braids",
      originalImageUrl: "/manus-storage/try-on/uploads/customer-photo.png",
    });

    expect(result.status).toBe("completed");
    expect(result.generatedImageUrl).toBe("/manus-storage/generated-try-on.png");
    expect(storageGetSignedUrlMock).toHaveBeenCalledWith("try-on/uploads/customer-photo.png");
    expect(generateImageMock).toHaveBeenCalledWith(expect.objectContaining({
      originalImages: [expect.objectContaining({
        url: "https://signed-storage.example/try-on/customer-photo.png",
        mimeType: "image/png",
      })],
    }));
  });

  it("returns an admin summary fallback with seeded services and products", async () => {
    const summary = await db.adminSummary();
    expect(summary.services).toBeGreaterThanOrEqual(20);
    expect(summary.products).toBeGreaterThanOrEqual(3);
  });
});
