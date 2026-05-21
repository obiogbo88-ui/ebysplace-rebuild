import { AddressInfo } from "node:net";
import Stripe from "stripe";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { EBYSPLACE_STRIPE_WEBHOOK_PATH, registerStripeWebhook } from "./stripeWebhook";
import type { TrpcContext } from "./_core/context";

const stripeCreateSessionMock = vi.hoisted(() => vi.fn());
const stripeConstructEventMock = vi.hoisted(() => vi.fn());
const notifyOwnerMock = vi.hoisted(() => vi.fn());
const sendCustomerEmailSafelyMock = vi.hoisted(() => vi.fn());
const sendShopOrderPaidEmailSafelyMock = vi.hoisted(() => vi.fn());
const sendCustomerSmsSafelyMock = vi.hoisted(() => vi.fn());
const sendCustomerWhatsAppSafelyMock = vi.hoisted(() => vi.fn());
const sendOwnerSmsAndWhatsAppSafelyMock = vi.hoisted(() => vi.fn());
const sendReviewRequestEmailSafelyMock = vi.hoisted(() => vi.fn());
const sendNewsletterWelcomeEmailSafelyMock = vi.hoisted(() => vi.fn());
const storagePutMock = vi.hoisted(() => vi.fn());
const storageGetSignedUrlMock = vi.hoisted(() => vi.fn());
const generateImageMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

vi.mock("./customerNotifications", () => ({
  sendCustomerEmailSafely: sendCustomerEmailSafelyMock,
  sendShopOrderPaidEmailSafely: sendShopOrderPaidEmailSafelyMock,
  sendCustomerSmsSafely: sendCustomerSmsSafelyMock,
  sendCustomerWhatsAppSafely: sendCustomerWhatsAppSafelyMock,
  sendOwnerSmsAndWhatsAppSafely: sendOwnerSmsAndWhatsAppSafelyMock,
  sendReviewRequestEmailSafely: sendReviewRequestEmailSafelyMock,
  sendNewsletterWelcomeEmailSafely: sendNewsletterWelcomeEmailSafelyMock,
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
    process.env.STRIPE_SECRET_KEY = ["sk", "live", "mock"].join("_");
    process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY = ["sk", "live", "mock"].join("_");
    process.env.STRIPE_WEBHOOK_SECRET = "webhook_secret_mock";
    process.env.EBYSPLACE_LIVE_STRIPE_WEBHOOK_SECRET = "webhook_secret_mock";
    vi.mocked(Stripe).mockClear();
    stripeCreateSessionMock.mockReset();
    stripeConstructEventMock.mockReset();
    notifyOwnerMock.mockReset();
    sendCustomerEmailSafelyMock.mockReset();
    sendShopOrderPaidEmailSafelyMock.mockReset();
    sendCustomerSmsSafelyMock.mockReset();
    sendCustomerWhatsAppSafelyMock.mockReset();
    sendOwnerSmsAndWhatsAppSafelyMock.mockReset();
    sendReviewRequestEmailSafelyMock.mockReset();
    sendNewsletterWelcomeEmailSafelyMock.mockReset();
    storagePutMock.mockReset();
    storageGetSignedUrlMock.mockReset();
    generateImageMock.mockReset();
    notifyOwnerMock.mockResolvedValue(true);
    sendCustomerEmailSafelyMock.mockResolvedValue({ sent: true });
    sendShopOrderPaidEmailSafelyMock.mockResolvedValue({ sent: true });
    sendCustomerSmsSafelyMock.mockResolvedValue({ sent: true });
    sendCustomerWhatsAppSafelyMock.mockResolvedValue({ sent: true });
    sendOwnerSmsAndWhatsAppSafelyMock.mockResolvedValue([{ sent: true }, { sent: true }]);
    sendReviewRequestEmailSafelyMock.mockResolvedValue({ sent: true });
    sendNewsletterWelcomeEmailSafelyMock.mockResolvedValue({ sent: true });
    storagePutMock.mockResolvedValue({ url: "/try-on/uploads/test-customer-photo.jpg", key: "try-on/uploads/test-customer-photo.jpg" });
    storageGetSignedUrlMock.mockResolvedValue("https://signed-storage.example.test/try-on/uploads/test-customer-photo.jpg");
    generateImageMock.mockResolvedValue({ url: "/try-on/generated/result.jpg" });
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
    expect(new Set(services.map((service) => service.category))).toEqual(new Set(["Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"]));
  });

  it("maps every exact service name to an uploaded HD service image", async () => {
    const services = await db.listServices();
    expect(services).toHaveLength(29);
    for (const service of services) {
      expect(service.imageUrl, `${service.name} needs a migrated Supabase service image`).toMatch(/^https:\/\/jcyoipbiplzrocrrhwkp\.supabase\.co\/storage\/v1\/object\/public\/ebysplace-media\/ebysplace_service_/);
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
    expect(JSON.stringify(result)).not.toMatch(new RegExp(["Man", "us"].join(""), "i"));
    expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "New Eby’s Place booking request",
      content: expect.stringContaining("Knotless Braids"),
    }));
  });

  it("accepts a home-service booking when postcode is left blank", async () => {
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.createBooking({
      serviceLocation: "home_service",
      serviceName: "Knotless Braids",
      clientName: "Test Client",
      clientEmail: "client@example.com",
      clientPhone: "07123456789",
      addressLine1: "1 Gold Street",
      city: "London",
      county: "Greater London",
      postcode: "",
      deliveryNote: "Postcode intentionally omitted",
      appointmentDate: "2026-07-02",
      appointmentTime: "11:00",
    });

    expect(result.depositAmount).toBe(20);
    expect(result.customerNotification).toContain("Eby’s Place");
    expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Customer address: 1 Gold Street, London, Greater London"),
    }));
  });

  it("creates Stripe Checkout sessions with booking metadata and dynamic redirects", async () => {
    stripeCreateSessionMock.mockResolvedValueOnce({ id: "cs_live_123", url: "https://checkout.stripe.com/session", payment_intent: "pi_live_123" });
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.createDepositCheckout({
      bookingId: 42,
      clientEmail: "client@example.com",
      clientName: "Test Client",
      serviceName: "Goddess Braids",
      addOns: [{ id: "beads", name: "Beads", price: "8.00" }],
      bookingProducts: [{ productId: 7, productName: "X-Pression Braiding Hair", quantity: 2, unitPrice: "8.50" }],
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/session");
    expect(stripeCreateSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      customer_email: "client@example.com",
      client_reference_id: "42",
      payment_intent_data: expect.objectContaining({ receipt_email: "client@example.com", description: "Eby’s Place booking deposit for Goddess Braids", statement_descriptor_suffix: "EBYSPLACE" }),
      custom_text: { submit: { message: "You are paying Eby’s Place securely. Your booking deposit confirmation and receipt will use the email entered for checkout." } },
      success_url: "https://example.test/booking/success?booking=42",
      cancel_url: "https://example.test/booking?payment=cancelled&booking=42",
      allow_promotion_codes: true,
      metadata: expect.objectContaining({
        booking_id: "42",
        customer_email: "client@example.com",
        customer_name: "Test Client",
        service_name: "Goddess Braids",
        deposit_type: "non_refundable_20_gbp",
      }),
    }));
    const checkoutConfig = stripeCreateSessionMock.mock.calls[0][0];
    expect(checkoutConfig.line_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 2000, product_data: expect.objectContaining({ name: "Eby’s Place £20 non-refundable booking deposit" }) }), quantity: 1 }),
      expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 800, product_data: expect.objectContaining({ name: "Add-on: Beads" }) }), quantity: 1 }),
      expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 850, product_data: expect.objectContaining({ name: "X-Pression Braiding Hair" }) }), quantity: 2 }),
    ]));
    expect(checkoutConfig.metadata).toEqual(expect.objectContaining({ booking_extras_total: "25.00" }));
    expect(JSON.stringify(stripeCreateSessionMock.mock.calls[0][0])).not.toMatch(new RegExp(["Man", "us"].join(""), "i"));
  });

  it("uses project-specific live Stripe secret override when the platform-managed Stripe key is not live", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_platform_managed_key";
    process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY = ["sk", "live", "project", "override"].join("_");
    stripeCreateSessionMock.mockResolvedValueOnce({ id: "cs_live_override", url: "https://checkout.stripe.com/live-override", payment_intent: "pi_live_override" });
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.createDepositCheckout({
      bookingId: 44,
      serviceName: "Knotless Braids",
      clientName: "Eby Test",
      clientEmail: "eby@example.com",
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/live-override");
    expect(stripeCreateSessionMock).toHaveBeenCalledOnce();
    expect(vi.mocked(Stripe)).toHaveBeenCalledWith(["sk", "live", "project", "override"].join("_"));
    delete process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY;
  });

  it("normalizes quoted Stripe keys and falls back to a live platform key when the project-specific key is not live", async () => {
    process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY = " 'sk_test_project_key_with_quotes' ";
    process.env.STRIPE_SECRET_KEY = `\"${["sk", "live", "platform", "fallback"].join("_")}\"`;
    stripeCreateSessionMock.mockResolvedValueOnce({ id: "cs_live_fallback", url: "https://checkout.stripe.com/live-fallback", payment_intent: "pi_live_fallback" });
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.createDepositCheckout({
      bookingId: 44,
      serviceName: "Knotless Braids",
      clientName: "Eby Test",
      clientEmail: "eby@example.com",
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/live-fallback");
    expect(stripeCreateSessionMock).toHaveBeenCalledOnce();
    expect(vi.mocked(Stripe)).toHaveBeenCalledWith(["sk", "live", "platform", "fallback"].join("_"));
  });

  it("removes accidental internal whitespace from copied live Stripe secret keys", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_platform_managed_key";
    process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY = ` ${["sk", "live", "project"].join("_")} \n override\twithout\rspaces `;
    stripeCreateSessionMock.mockResolvedValueOnce({ id: "cs_live_whitespace", url: "https://checkout.stripe.com/live-whitespace", payment_intent: "pi_live_whitespace" });
    const caller = appRouter.createCaller(publicContext());

    const result = await caller.public.createDepositCheckout({
      bookingId: 44,
      serviceName: "Knotless Braids",
      clientName: "Eby Test",
      clientEmail: "eby@example.com",
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/live-whitespace");
    expect(stripeCreateSessionMock).toHaveBeenCalledOnce();
    expect(vi.mocked(Stripe)).toHaveBeenCalledWith(["sk", "live", "project"].join("_") + "overridewithoutspaces");
  });

  it("creates Stripe Checkout sessions for shop product orders with Eby’s Place customer-facing copy", async () => {

    stripeCreateSessionMock.mockResolvedValueOnce({ id: "cs_shop_live_123", url: "https://checkout.stripe.com/shop", payment_intent: "pi_shop_live_123" });
    const createOrderSpy = vi.spyOn(db, "createOrderWithItems").mockResolvedValueOnce({
      id: 88,
      items: [{ productId: 1, variantId: 2, productName: "X-Pression Braiding Hair", variantName: "Colour 30", quantity: 2, unitPrice: "8.50" }],
    } as any);
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

    expect(result).toEqual({ orderId: 88, checkoutUrl: "https://checkout.stripe.com/shop", status: "pending_payment", message: "Your secure Eby’s Place checkout is ready.", customerNotification: "Your Eby’s Place order checkout is ready. Please complete secure payment to confirm the order." });
    expect(result.customerNotification).toContain("Eby’s Place");
    expect(JSON.stringify(result)).not.toMatch(new RegExp(["Man", "us"].join(""), "i"));
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
    expect(JSON.stringify(checkoutConfig)).not.toMatch(new RegExp(["Man", "us"].join(""), "i"));
    expect(updateCheckoutSpy).toHaveBeenCalledWith(88, "cs_shop_live_123", "pi_shop_live_123");
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
    const getBookingSpy = vi.spyOn(db, "getBookingByCheckoutSession").mockResolvedValueOnce({
      id: 42,
      clientName: "Test Client",
      clientEmail: "client@example.com",
      clientPhone: "07123456789",
      serviceName: "Goddess Braids",
      appointmentDate: "2026-07-01",
      appointmentTime: "10:00",
      serviceLocation: "studio",
      estimatedPrice: "180.00",
      homeServiceSurcharge: "0.00",
      deliveryNote: "Keep braids waist length",
    } as any);
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
      expect(sendCustomerSmsSafelyMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "07123456789",
        body: expect.stringContaining("Goddess Braids"),
      }));
      expect(sendCustomerWhatsAppSafelyMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "07123456789",
        body: expect.stringContaining("£20 booking deposit has been confirmed"),
      }));
      expect(sendCustomerEmailSafelyMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "client@example.com",
        subject: "Eby’s Place booking deposit confirmed",
        body: expect.stringContaining("Studio visit address"),
      }));
      expect(sendCustomerEmailSafelyMock.mock.calls[0][0].body).toContain("Estimated remaining balance due at appointment: £160.00.");
      expect(sendOwnerSmsAndWhatsAppSafelyMock).toHaveBeenCalledWith(expect.stringContaining("Booking deposit paid"));
      expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Eby’s Place deposit paid",
        content: expect.stringContaining("Goddess Braids"),
      }));
      expect(JSON.stringify(notifyOwnerMock.mock.calls)).not.toMatch(new RegExp(["Man", "us"].join(""), "i"));
    } finally {
      markPaidSpy.mockRestore();
      getBookingSpy.mockRestore();
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
    const getOrderSpy = vi.spyOn(db, "getOrderByCheckoutSession").mockResolvedValueOnce({
      id: 88,
      customerName: "Shop Client",
      customerEmail: "shop-client@example.com",
      customerPhone: "07123456789",
      addressLine1: "1 Gold Street",
      addressLine2: null,
      city: "London",
      county: "Greater London",
      postcode: null,
    } as any);
    const getOrderItemsSpy = vi.spyOn(db, "getOrderItemsByOrderId").mockResolvedValueOnce([
      { productName: "X-Pression Braiding Hair", variantName: "Colour 30", quantity: 2, unitPrice: "8.50" },
    ] as any);
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
      expect(sendCustomerSmsSafelyMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "07123456789",
        body: expect.stringContaining("order #88"),
      }));
      expect(sendShopOrderPaidEmailSafelyMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "shop-client@example.com",
        customerName: "Shop Client",
        orderId: 88,
        deliveryAddress: "1 Gold Street, London, Greater London",
        itemsSummary: expect.stringContaining("2 × X-Pression Braiding Hair — Colour 30 (£17.00)"),
      }));
      expect(sendShopOrderPaidEmailSafelyMock.mock.calls[0][0].itemsSummary).toContain("Total paid: £17.00");
      expect(sendOwnerSmsAndWhatsAppSafelyMock).toHaveBeenCalledWith(expect.stringContaining("New Eby's Place shop order paid"));
      expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Eby’s Place shop order paid",
        content: expect.stringContaining("Order ID: 88"),
      }));
      expect(JSON.stringify(notifyOwnerMock.mock.calls)).not.toMatch(new RegExp(["Man", "us"].join(""), "i"));
    } finally {
      markOrderPaidSpy.mockRestore();
      getOrderSpy.mockRestore();
      getOrderItemsSpy.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("notifies the owner when Stripe reports a failed payment intent", async () => {
    stripeConstructEventMock.mockReturnValueOnce({
      id: "evt_live_failed_payment",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_failed_123",
          receipt_email: "client@example.com",
          last_payment_error: { message: "Your card was declined." },
        },
      },
    });
    const app = express();
    registerStripeWebhook(app);
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "live_signature" },
        body: JSON.stringify({ id: "evt_live_failed_payment" }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true });
      expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Eby’s Place payment failed",
        content: expect.stringContaining("Your card was declined."),
      }));
      expect(notifyOwnerMock.mock.calls[0][0].content).toContain("client@example.com");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("uploads AI Try-On photos as readable prepared images with MIME metadata", async () => {
    const caller = appRouter.createCaller(publicContext());
    const dataUrl = `data:image/jpeg;base64,${Buffer.from("prepared portrait bytes").toString("base64")}`;

    const result = await caller.public.uploadTryOnPhoto({ dataUrl, fileName: "Client Portrait.JPG" });

    expect(result).toEqual({
      url: "/try-on/uploads/test-customer-photo.jpg",
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
      originalImageUrl: "/try-on/uploads/test-customer-photo.jpg",
      originalImageKey: "try-on/uploads/test-customer-photo.jpg",
      mimeType: "image/jpeg",
    });

    expect(result).toEqual({ id: 77, generatedImageUrl: "/try-on/generated/result.jpg", status: "completed", customerNotification: "Your Eby’s Place AI Try-On preview is ready." });
    expect(result.customerNotification).toContain("Eby’s Place");
    expect(result.customerNotification).not.toMatch(new RegExp(["Man", "us"].join(""), "i"));
    expect(storageGetSignedUrlMock).toHaveBeenCalledWith("try-on/uploads/test-customer-photo.jpg");
    expect(generateImageMock).toHaveBeenCalledWith(expect.objectContaining({
      originalImages: [{ url: "https://signed-storage.example.test/try-on/uploads/test-customer-photo.jpg", mimeType: "image/jpeg" }],
    }));
    const generateImageCall = generateImageMock.mock.calls[0]?.[0];
    expect(generateImageCall?.prompt).toContain("apply the selected hairstyle: Knotless Braids");
    expect(generateImageCall?.prompt).toContain("Preserve the person’s exact face, identity, skin tone, facial expression, head shape");
    expect(generateImageCall?.prompt).toContain("Do not change the person into someone else. Only edit the hair area.");
    expect(generateImageCall?.prompt).toContain("salon preview for Eby’s Place.");
    expect(generateImageCall?.prompt).not.toContain("{{STYLE_NAME}}");
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

  it("exposes the new Eby’s Place live Stripe webhook URL", async () => {
    stripeConstructEventMock.mockReturnValueOnce({ id: "evt_test_ebysplace_live_webhook", type: "checkout.session.completed", data: { object: {} } });
    const app = express();
    registerStripeWebhook(app);
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}${EBYSPLACE_STRIPE_WEBHOOK_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "test_signature" },
        body: JSON.stringify({ id: "evt_test_ebysplace_live_webhook" }),
      });
      expect(EBYSPLACE_STRIPE_WEBHOOK_PATH).toBe("/api/stripe/ebysplace-live-webhook");
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ verified: true });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });


  it("keeps shop delivery postcode optional in frontend checkout copy", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(process.cwd(), "client/src/pages/Shop.tsx"), "utf8");
    expect(source).toContain('placeholder="Postcode (optional if unavailable)"');
    expect(source).toContain('Please add your delivery address and city before opening secure checkout.');
    expect(source).not.toContain('required placeholder="Address line 2 (optional)"');
  });

  it("returns an admin summary fallback with seeded services and products", async () => {
    const summary = await db.adminSummary();
    expect(summary.services).toBeGreaterThanOrEqual(20);
    expect(summary.products).toBeGreaterThanOrEqual(3);
  });
});
