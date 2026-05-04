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
const storagePutMock = vi.hoisted(() => vi.fn());
const storageGetSignedUrlMock = vi.hoisted(() => vi.fn());
const generateImageMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

vi.mock("./storage", () => ({
  storagePut: storagePutMock,
  storageGetSignedUrl: storageGetSignedUrlMock,
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: generateImageMock,
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: stripeCreateSessionMock } },
    webhooks: { constructEvent: stripeConstructEventMock },
  })),
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
    process.env.STRIPE_WEBHOOK_SECRET = "webhook_secret_mock";
    stripeCreateSessionMock.mockReset();
    stripeConstructEventMock.mockReset();
    notifyOwnerMock.mockReset();
    storagePutMock.mockReset();
    storageGetSignedUrlMock.mockReset();
    generateImageMock.mockReset();
    notifyOwnerMock.mockResolvedValue(true);
    storagePutMock.mockResolvedValue({ url: "/manus-storage/try-on/uploads/test-customer-photo.jpg", key: "try-on/uploads/test-customer-photo.jpg" });
    storageGetSignedUrlMock.mockResolvedValue("https://signed-storage.example.test/try-on/uploads/test-customer-photo.jpg");
    generateImageMock.mockResolvedValue({ url: "/manus-storage/try-on/generated/result.jpg" });
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
      expect(service.imageUrl, `${service.name} needs a migrated Supabase service image`).toMatch(/^https:\/\/jcyoipbiplzrocrrhwkp\.supabase\.co\/storage\/v1\/object\/public\/ebysplace-media\/manus-storage\/ebysplace_service_/);
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
    expect(result.customerNotification).toContain("Eby’s Place");
    expect(JSON.stringify(result)).not.toMatch(/Manus/i);
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
      payment_intent_data: expect.objectContaining({ receipt_email: "client@example.com", description: "Eby’s Place booking deposit for Goddess Braids", statement_descriptor_suffix: "EBYSPLACE" }),
      custom_text: { submit: { message: "You are paying Eby’s Place securely. Your booking deposit confirmation and receipt will use the email entered for checkout." } },
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
    expect(JSON.stringify(stripeCreateSessionMock.mock.calls[0][0])).not.toMatch(/Manus/i);
  });

  it("creates Stripe Checkout sessions for shop product orders with Eby’s Place customer-facing copy", async () => {
    stripeCreateSessionMock.mockResolvedValueOnce({ id: "cs_shop_123", url: "https://checkout.stripe.test/shop", payment_intent: "pi_shop_123" });
    const createOrderSpy = vi.spyOn(db, "createOrderWithItems").mockResolvedValueOnce({ id: 88 });
    const updateCheckoutSpy = vi.spyOn(db, "updateOrderCheckout").mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.createOrder({
      customerName: "Shop Client",
      customerEmail: "shop-client@example.com",
      customerPhone: "07123456789",
      addressLine1: "1 Gold Street",
      city: "London",
      county: "Greater London",
      postcode: "E1 1AA",
      deliveryNote: "Leave safely if needed",
      items: [{ productId: 1, variantId: 2, productName: "X-Pression Braiding Hair", variantName: "Colour 30", quantity: 2, unitPrice: "8.50" }],
    });

    expect(result).toEqual({ orderId: 88, checkoutUrl: "https://checkout.stripe.test/shop", status: "pending_payment", message: "Your secure Eby’s Place checkout is ready.", customerNotification: "Your Eby’s Place order checkout is ready. Please complete Stripe payment to confirm the order." });
    expect(result.customerNotification).toContain("Eby’s Place");
    expect(JSON.stringify(result)).not.toMatch(/Manus/i);
    expect(stripeCreateSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      customer_email: "shop-client@example.com",
      client_reference_id: "88",
      payment_intent_data: expect.objectContaining({ receipt_email: "shop-client@example.com", description: "Eby’s Place shop order", statement_descriptor_suffix: "EBYSPLACE" }),
      custom_text: { submit: { message: "You are paying Eby’s Place securely. Your shop order confirmation and receipt will use the email entered for checkout." } },
      success_url: "https://example.test/shop?payment=success&order=88",
      cancel_url: "https://example.test/shop?payment=cancelled&order=88",
      allow_promotion_codes: true,
      metadata: expect.objectContaining({
        order_id: "88",
        order_type: "shop_products",
        customer_email: "shop-client@example.com",
        customer_name: "Shop Client",
      }),
    }));
    const checkoutConfig = stripeCreateSessionMock.mock.calls[0][0];
    expect(checkoutConfig.line_items[0].price_data.unit_amount).toBe(850);
    expect(checkoutConfig.line_items[0].price_data.product_data).toEqual({
      name: "X-Pression Braiding Hair — Colour 30",
      description: "Eby’s Place shop product",
    });
    expect(JSON.stringify(checkoutConfig)).not.toMatch(/Manus/i);
    expect(updateCheckoutSpy).toHaveBeenCalledWith(88, "cs_shop_123", "pi_shop_123");
    createOrderSpy.mockRestore();
    updateCheckoutSpy.mockRestore();
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
      expect(JSON.stringify(notifyOwnerMock.mock.calls)).not.toMatch(/Manus/i);
    } finally {
      markPaidSpy.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("notifies the owner and marks shop orders paid for completed Stripe product webhooks", async () => {
    stripeConstructEventMock.mockReturnValueOnce({
      id: "evt_live_shop_mock",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_shop_live_mock",
          customer_email: "shop-client@example.com",
          payment_intent: "pi_shop_live_mock",
          metadata: {
            order_id: "88",
            order_type: "shop_products",
            customer_email: "shop-client@example.com",
            customer_name: "Shop Client",
          },
        },
      },
    });
    const markOrderPaidSpy = vi.spyOn(db, "markOrderPaid").mockResolvedValueOnce(undefined);
    const app = express();
    registerStripeWebhook(app);
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "live_signature" },
        body: JSON.stringify({ id: "evt_live_shop_mock" }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true });
      expect(markOrderPaidSpy).toHaveBeenCalledWith("cs_shop_live_mock", "pi_shop_live_mock");
      expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Eby’s Place shop order paid",
        content: expect.stringContaining("Order ID: 88"),
      }));
      expect(JSON.stringify(notifyOwnerMock.mock.calls)).not.toMatch(/Manus/i);
    } finally {
      markOrderPaidSpy.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("uploads AI Try-On photos as readable prepared images with MIME metadata", async () => {
    const caller = appRouter.createCaller(publicContext());
    const dataUrl = `data:image/jpeg;base64,${Buffer.from("prepared portrait bytes").toString("base64")}`;

    const result = await caller.public.uploadTryOnPhoto({ dataUrl, fileName: "Client Portrait.JPG" });

    expect(result).toEqual({
      url: "/manus-storage/try-on/uploads/test-customer-photo.jpg",
      key: "try-on/uploads/test-customer-photo.jpg",
      mimeType: "image/jpeg",
    });
    expect(storagePutMock).toHaveBeenCalledWith(
      expect.stringMatching(/^try-on\/uploads\/\d+-client-portrait\.jpg$/),
      expect.any(Buffer),
      "image/jpeg",
    );
  });

  it("uses the stored AI Try-On image key to generate from a signed readable image URL", async () => {
    const createSpy = vi.spyOn(db, "createTryOnGeneration").mockResolvedValueOnce({ id: 77 } as Awaited<ReturnType<typeof db.createTryOnGeneration>>);
    const updateSpy = vi.spyOn(db, "updateTryOnGeneration").mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.generateTryOn({
      styleName: "Knotless Braids",
      originalImageUrl: "/manus-storage/try-on/uploads/test-customer-photo.jpg",
      originalImageKey: "try-on/uploads/test-customer-photo.jpg",
      mimeType: "image/jpeg",
    });

    expect(result).toEqual({ id: 77, generatedImageUrl: "/manus-storage/try-on/generated/result.jpg", status: "completed", customerNotification: "Your Eby’s Place AI Try-On preview is ready." });
    expect(result.customerNotification).toContain("Eby’s Place");
    expect(result.customerNotification).not.toMatch(/Manus/i);
    expect(storageGetSignedUrlMock).toHaveBeenCalledWith("try-on/uploads/test-customer-photo.jpg");
    expect(generateImageMock).toHaveBeenCalledWith(expect.objectContaining({
      originalImages: [{ url: "https://signed-storage.example.test/try-on/uploads/test-customer-photo.jpg", mimeType: "image/jpeg" }],
    }));
    createSpy.mockRestore();
    updateSpy.mockRestore();
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

  it("returns an admin summary fallback with seeded services and products", async () => {
    const summary = await db.adminSummary();
    expect(summary.services).toBeGreaterThanOrEqual(20);
    expect(summary.products).toBeGreaterThanOrEqual(3);
  });
});
