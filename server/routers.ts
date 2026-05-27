// @ts-nocheck
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { storageGetSignedUrl, storagePut, storageRemove } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { systemRouter } from "./_core/systemRouter";
import { normalizeSecretKey } from "./_core/envSecrets";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { getNotificationDiagnostics, sendCustomerEmailSafely, sendCustomerSmsSafely, sendOwnerSmsAndWhatsAppSafely, sendReviewRequestEmailSafely, sendNewsletterWelcomeEmailSafely } from "./customerNotifications";
import { resendEmailNotificationLog } from "./smtpEmailNotifications";
import { requestAdminPasswordReset, signInAdminWithPassword, updateAdminPasswordWithRecoveryToken } from "./supabaseAuth";
import * as db from "./db";

const serviceCategory = z.enum(["Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"]);
const bookingStatus = z.enum(["pending", "confirmed", "completed", "cancelled"]);
const reviewStatus = z.enum(["approved", "rejected"]);
const orderStatus = z.enum(["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
const productStockStatus = z.enum(["in_stock", "low_stock", "out_of_stock"]);
const productCategory = z.enum(["Accessories", "Aftercare", "Hair Attachments"]);
const galleryCategory = z.enum(["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
const activityStatus = z.enum(["success", "failed", "pending", "info"]);

const bookingAddOnInput = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  price: z.string().regex(/^\d+(\.\d{2})?$/),
}).strict();

const bookingProductInput = z.object({
  productId: z.number(),
  productName: z.string().min(2),
  quantity: z.number().int().positive(),
  unitPrice: z.string().regex(/^\d+(\.\d{2})?$/),
}).strict();

const bookingInput = z.object({
  serviceId: z.number().optional(),
  serviceLocation: z.enum(["studio", "home_service"]).default("studio"),
  serviceName: z.string().min(2),
  clientName: z.string().min(2),
  clientEmail: z.string().email(),
  clientPhone: z.string().min(6),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  postcode: z.string().optional().default(""),
  deliveryNote: z.string().optional(),
  appointmentDate: z.string().min(8),
  appointmentTime: z.string().min(4),
  addOns: z.array(bookingAddOnInput).default([]),
  bookingProducts: z.array(bookingProductInput).default([]),
});

const orderInput = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  postcode: z.string().optional().default(""),
  deliveryNote: z.string().optional(),
  items: z.array(z.object({
    productId: z.number(),
    variantId: z.number().optional(),
    productName: z.string().min(2),
    variantName: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.string().regex(/^\d+(\.\d{2})?$/),
  })).min(1),
});


function getLiveStripeSecretKey() {
  const candidates = [
    normalizeSecretKey(process.env.EBYSPLACE_LIVE_STRIPE_SECRET_KEY),
    normalizeSecretKey(process.env.STRIPE_SECRET_KEY),
  ];
  return candidates.find((key) => key.startsWith("sk_live_")) || candidates.find(Boolean) || "";
}

function getLiveStripePublishableKey() {
  const candidates = [
    normalizeSecretKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    normalizeSecretKey(process.env.VITE_EBYSPLACE_LIVE_STRIPE_PUBLISHABLE_KEY),
    normalizeSecretKey(process.env.VITE_STRIPE_PUBLISHABLE_KEY),
  ];
  return candidates.find((key) => key.startsWith("pk_live_")) || candidates.find(Boolean) || "";
}

const CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE = "Payment is currently unavailable. Please contact us to complete your booking.";
const TRACK_THROTTLE_WINDOW_MS = 10000;
const recentTrackEvents = new Map<string, number>();

function paymentUnavailableError() {
  return new TRPCError({ code: "PRECONDITION_FAILED", message: CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE });
}

function normalizePublicPath(path: string) {
  const normalized = (path || "/").trim();
  const withoutOrigin = normalized.replace(/^https?:\/\/[^/]+/i, "");
  const [pathname] = withoutOrigin.split(/[?#]/);
  return pathname || "/";
}

function shouldSkipTrackEvent(input: { eventName: string; pagePath: string; sessionId?: string }) {
  const pagePath = normalizePublicPath(input.pagePath);
  if (isAdminTrackingPath(input.pagePath)) return { skip: true, reason: "admin_path" as const, pagePath };
  const eventKey = `${input.sessionId || "anon"}:${input.eventName}:${pagePath}`;
  const now = Date.now();
  const previous = recentTrackEvents.get(eventKey);
  recentTrackEvents.set(eventKey, now);
  for (const [key, timestamp] of recentTrackEvents.entries()) {
    if (now - timestamp > TRACK_THROTTLE_WINDOW_MS * 6) recentTrackEvents.delete(key);
  }
  if (typeof previous === "number" && now - previous < TRACK_THROTTLE_WINDOW_MS) {
    return { skip: true, reason: "throttled_duplicate" as const, pagePath };
  }
  return { skip: false, reason: null, pagePath };
}

function getStripe() {
  const key = getLiveStripeSecretKey();
  if (!key) {
    console.warn("[Payments] Live payment checkout attempted without a configured secret key. Configure EBYSPLACE_LIVE_STRIPE_SECRET_KEY in deployment settings.");
    throw paymentUnavailableError();
  }
  if (!key.startsWith("sk_live_")) {
    console.warn("[Payments] Live payment checkout attempted without a live secret key. Configure EBYSPLACE_LIVE_STRIPE_SECRET_KEY in deployment settings.");
    throw paymentUnavailableError();
  }
  return new Stripe(key);
}

function stripeConfigurationLogMessage(error: unknown) {
  const code = typeof (error as any)?.code === "string" ? (error as any).code : "";
  const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 0;
  if (code === "api_key_expired") {
    return "Stripe secret key has expired. Replace STRIPE_SECRET_KEY / EBYSPLACE_LIVE_STRIPE_SECRET_KEY in Vercel.";
  }
  if (code === "api_key_invalid" || statusCode === 401) {
    return "Stripe secret key is invalid. Verify STRIPE_SECRET_KEY / EBYSPLACE_LIVE_STRIPE_SECRET_KEY in Vercel.";
  }
  if (code === "secret_key_required" || /api key/i.test(String((error as any)?.message || ""))) {
    return "Stripe secret key is missing. Configure STRIPE_SECRET_KEY / EBYSPLACE_LIVE_STRIPE_SECRET_KEY in Vercel.";
  }
  return "";
}

function logStripeCheckoutFailure(context: string, error: unknown) {
  const configurationMessage = stripeConfigurationLogMessage(error);
  if (configurationMessage) {
    console.error(`[Payments] ${context}: ${configurationMessage}`, error);
    return;
  }

  function adminMutationFailure(action: string, error: unknown): TRPCError {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Admin] ${action} failed`, { message });
    if (/database unavailable/i.test(message)) {
      return new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: `${action} failed because the database is unavailable. Check DATABASE_URL and Supabase server credentials in Vercel.`,
      });
    }
    return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `${action} failed: ${message}` });
  }
  console.error(`[Payments] ${context}`, error);
}

function getLivePaymentMode() {
  return { stripeMode: "live" as const, publishableKeyConfigured: Boolean(getLiveStripePublishableKey().startsWith("pk_live_")) };
}

function getOrigin(req: Request) {
  const origin = req.headers.origin;
  return typeof origin === "string" ? origin : "http://localhost:3000";
}

function normalizeTrackingPath(pathOrUrl: string) {
  const raw = (pathOrUrl || "/").trim();
  if (!raw) return "/";
  try {
    const parsed = new URL(raw, "https://www.ebysplace.com");
    return parsed.pathname || "/";
  } catch {
    return raw.split(/[?#]/)[0] || "/";
  }
}

function isAdminTrackingPath(pathOrUrl: string) {
  const pathname = normalizeTrackingPath(pathOrUrl).toLowerCase();
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

async function notifyOwnerSafely(title: string, content: string) {
  try {
    await notifyOwner({ title, content });
  } catch (error) {
    console.warn("[Notification] Owner notification skipped", error);
  }
}

async function logAdminActivity(ctx: { req: Request; user?: { id?: number; name?: string | null; email?: string | null } | null }, input: {
  activityType: string;
  description: string;
  relatedEntityType?: string;
  relatedEntityId?: string | number | null;
  metadata?: unknown;
  status?: "success" | "failed" | "pending" | "info";
}) {
  await db.logActivity({
    request: ctx.req,
    userId: ctx.user?.id ?? null,
    userName: ctx.user?.name ?? null,
    userEmail: ctx.user?.email ?? null,
    activityType: input.activityType,
    activityCategory: "admin_action",
    description: input.description,
    pageUrl: "/admin",
    status: input.status ?? "success",
    relatedEntityType: input.relatedEntityType ?? "admin",
    relatedEntityId: input.relatedEntityId ?? null,
    metadata: input.metadata,
    sourceApp: "ebysplace",
  });
}

function formatBookingExtras(input: { addOns?: Array<{ name: string; price: string }>; bookingProducts?: Array<{ productName: string; quantity: number; unitPrice: string }> }) {
  const addOns = input.addOns?.length
    ? input.addOns.map((item) => `${item.name} (£${item.price})`).join(", ")
    : "None selected";
  const bookingProducts = input.bookingProducts?.length
    ? input.bookingProducts.map((item) => `${item.quantity} × ${item.productName} (£${item.unitPrice})`).join(", ")
    : "None selected";
  return { addOns, bookingProducts };
}

function buildBookingNote(input: { deliveryNote?: string; serviceLocation?: "studio" | "home_service"; homeServiceSurcharge?: string; addOns?: Array<{ name: string; price: string }>; bookingProducts?: Array<{ productName: string; quantity: number; unitPrice: string }> }) {
  const extras = formatBookingExtras(input);
  return [
    input.deliveryNote?.trim() ? input.deliveryNote.trim() : undefined,
    `Service location: ${input.serviceLocation === "home_service" ? "Home Service" : "Visit the Studio"}`,
    input.homeServiceSurcharge && Number(input.homeServiceSurcharge) > 0 ? `Home service surcharge: £${input.homeServiceSurcharge}` : undefined,
    `Optional add-ons: ${extras.addOns}`,
    `Optional shop products for appointment order: ${extras.bookingProducts}`,
  ].filter(Boolean).join("\n");
}

function poundsToMinorUnits(value: string | number) {
  return Math.round(Number(value || 0) * 100);
}

function buildBookingCheckoutLineItems(input: {
  serviceName: string;
  addOns?: Array<{ name: string; price: string }>;
  bookingProducts?: Array<{ productName: string; quantity: number; unitPrice: string }>;
  includeHomeServiceSurcharge?: boolean;
  homeServiceSurcharge?: number;
}) {
  const surcharge = Number(input.homeServiceSurcharge || 0);
  const includeHomeServiceSurcharge = input.includeHomeServiceSurcharge && Number.isFinite(surcharge) && surcharge > 0;
  return [
    { price_data: { currency: "gbp", unit_amount: 2000, product_data: { name: "Eby’s Place £20 non-refundable booking deposit", description: `Deposit for ${input.serviceName}` } }, quantity: 1 },
    ...(input.addOns || []).map((item) => ({
      price_data: { currency: "gbp", unit_amount: poundsToMinorUnits(item.price), product_data: { name: `Add-on: ${item.name}`, description: "Selected Eby’s Place appointment add-on" } },
      quantity: 1,
    })),
    ...(input.bookingProducts || []).map((item) => ({
      price_data: { currency: "gbp", unit_amount: poundsToMinorUnits(item.unitPrice), product_data: { name: item.productName, description: "Eby’s Place shop product added to appointment checkout" } },
      quantity: item.quantity,
    })),
    ...(includeHomeServiceSurcharge
      ? [{
        price_data: {
          currency: "gbp",
          unit_amount: poundsToMinorUnits(surcharge),
          product_data: {
            name: "Home Service Surcharge",
            description: "Travel surcharge for mobile/home-service appointments",
          },
        },
        quantity: 1,
      }]
      : []),
  ];
}

function bookingExtrasTotal(input: { addOns?: Array<{ price: string }>; bookingProducts?: Array<{ quantity: number; unitPrice: string }> }) {
  const addOnsTotal = (input.addOns || []).reduce((sum, item) => sum + Number(item.price), 0);
  const productsTotal = (input.bookingProducts || []).reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  return addOnsTotal + productsTotal;
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload must be a base64 data URL." });
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

const ALLOWED_ADMIN_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const ALLOWED_ADMIN_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);

function extensionFromFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}

async function uploadDataUrlAsset(input: { dataUrl: string; fileName: string; folder: string }) {
  const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
  const extension = extensionFromFileName(input.fileName);
  const normalizedMimeType = mimeType.toLowerCase();
  if (!ALLOWED_ADMIN_IMAGE_EXTENSIONS.has(extension) || !ALLOWED_ADMIN_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Allowed image formats: jpg, jpeg, png, webp, heic, heif." });
  }
  if ((extension === "heic" || extension === "heif" || normalizedMimeType === "image/heic" || normalizedMimeType === "image/heif")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "HEIC/HEIF files must be converted to JPG or WebP before upload." });
  }
  if (buffer.byteLength > 7 * 1024 * 1024) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Please upload an image smaller than 7MB." });
  }
  let normalizedExtension = "png";
  if (mimeType.includes("jpeg")) normalizedExtension = "jpg";
  else if (mimeType.includes("webp")) normalizedExtension = "webp";
  else {
    const mimeExtension = mimeType.split("/")[1];
    if (mimeExtension) normalizedExtension = mimeExtension;
  }
  const baseName = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || "upload";
  const uploaded = await storagePut(`${input.folder}/${Date.now()}-${baseName}.${normalizedExtension}`, buffer, mimeType);
  return { url: uploaded.url, key: uploaded.key, mimeType };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const result = await signInAdminWithPassword(input.email, input.password);
        await db.logActivity({
          request: ctx.req,
          userName: result.user?.name || null,
          userEmail: result.user?.email || null,
          activityType: "admin_login",
          activityCategory: "admin_auth",
          description: "Admin login successful",
          pageUrl: "/admin/login",
          status: "success",
          relatedEntityType: "admin_user",
          relatedEntityId: result.user?.openId || null,
          sourceApp: "ebysplace",
        });
        return result;
      }),
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email(), origin: z.string().url() }))
      .mutation(({ input }) => requestAdminPasswordReset(input.email, input.origin)),
    updatePassword: publicProcedure
      .input(z.object({ accessToken: z.string().min(20), password: z.string().min(8) }))
      .mutation(({ input }) => updateAdminPasswordWithRecoveryToken(input.accessToken, input.password)),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await db.logActivity({
        request: ctx.req,
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.name ?? null,
        userEmail: ctx.user?.email ?? null,
        activityType: "user_logout",
        activityCategory: "auth",
        description: ctx.user?.role === "admin" ? "Admin logout" : "User logout",
        pageUrl: "/admin",
        status: "info",
        sourceApp: "ebysplace",
      });
      return { success: true } as const;
    }),
  }),

  public: router({
    services: publicProcedure.input(z.object({ category: serviceCategory.optional() }).optional()).query(({ input }) => db.listServices(input?.category)),
    featuredServices: publicProcedure.query(() => db.listFeaturedServices()),
    products: publicProcedure.query(() => db.listProducts()),
    availability: publicProcedure.query(() => db.getAvailabilitySettings()),
    paymentMode: publicProcedure.query(() => getLivePaymentMode()),
    instagramSettings: publicProcedure.query(() => db.getInstagramSettings()),
    websiteSections: publicProcedure.query(() => db.listWebsiteSections()),
    reviews: publicProcedure.query(() => db.listApprovedReviews()),
    productReviewSummaries: publicProcedure.query(() => db.listProductReviewSummaries()),
    productReviews: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => db.listApprovedProductReviews(input.productId)),
    gallery: publicProcedure.input(z.object({ category: z.string().optional() }).optional()).query(({ input }) => db.listGallery(input?.category)),
    newsletter: publicProcedure.input(z.object({ email: z.string().email(), productAlerts: z.boolean().default(false) })).mutation(async ({ input }) => {
      const result = await db.subscribeNewsletter(input.email, input.productAlerts);
      await db.logActivity({
        activityType: "newsletter_signup",
        activityCategory: "newsletter",
        description: `Newsletter signup: ${input.email}`,
        status: "success",
        pageUrl: "/",
        userEmail: input.email,
        metadata: { productAlerts: input.productAlerts },
      });
      await Promise.allSettled([
        sendNewsletterWelcomeEmailSafely({ to: input.email, productAlerts: input.productAlerts }),
        notifyOwnerSafely(
          "New Eby’s Place newsletter signup",
          `${input.email} joined Eby’s Place updates${input.productAlerts ? " with product alerts" : ""}.`
        ),
      ]);
      return { ...result, customerNotification: "You’re subscribed to Eby’s Place updates." };
    }),
    submitReview: publicProcedure.input(z.object({ customerName: z.string().min(2), rating: z.number().min(1).max(5), reviewText: z.string().min(10) })).mutation(async ({ input }) => {
      const review = await db.submitReview(input);
      await notifyOwnerSafely(
        "New Eby’s Place review submitted",
        [
          `A customer submitted a website review for moderation.`,
          `Review ID: ${review.id}`,
          `Customer: ${input.customerName}`,
          `Rating: ${input.rating}/5`,
          `Status: ${review.status}`,
        ].join("\n")
      );
      return { ...review, customerNotification: "Thank you for reviewing Eby’s Place. Your review has been received and is pending approval." };
    }),
    submitProductReview: publicProcedure.input(z.object({ productId: z.number().int().positive(), customerName: z.string().min(2), rating: z.number().min(1).max(5), reviewText: z.string().min(10) })).mutation(async ({ input }) => {
      const review = await db.submitProductReview(input);
      await notifyOwnerSafely(
        "New product review submitted",
        [
          `A customer submitted a product review for moderation.`,
          `Product ID: ${input.productId}`,
          `Customer: ${input.customerName}`,
          `Rating: ${input.rating}/5`,
          `Status: ${review.status}`,
        ].join("\n")
      );
      return { ...review, customerNotification: "Thank you for your review. It has been received and is pending approval." };
    }),
    createBooking: publicProcedure.input(bookingInput).mutation(async ({ input }) => {
      const { addOns, bookingProducts, ...bookingFields } = input;
      const serviceLocation = input.serviceLocation || "studio";
      const settings = await db.getAvailabilitySettings();
      const parsedAvailabilitySurcharge = Number(settings.homeServiceSurcharge);
      if (serviceLocation === "home_service" && !Number.isFinite(parsedAvailabilitySurcharge)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Home service surcharge is currently unavailable. Please contact Eby’s Place before completing checkout." });
      }
      const homeServiceSurcharge = serviceLocation === "home_service" ? parsedAvailabilitySurcharge.toFixed(2) : "0.00";
      console.info("[Payments] Home-service surcharge loaded from admin settings", {
        serviceLocation,
        surcharge: homeServiceSurcharge,
      });
      if (serviceLocation === "home_service") {
        const missing = [input.clientName, input.addressLine1, input.city, input.county].some((value) => !value?.trim());
        if (missing) throw new TRPCError({ code: "BAD_REQUEST", message: "Home Service bookings require the customer name, address line 1, city, and county. Postcode is optional." });
      }
      const sanitizedBookingFields = serviceLocation === "studio"
        ? { ...bookingFields, serviceLocation, addressLine1: "Studio visit", addressLine2: null, city: "Studio", county: null, postcode: "STUDIO", homeServiceSurcharge }
        : { ...bookingFields, serviceLocation, addressLine1: input.addressLine1!.trim(), addressLine2: input.addressLine2?.trim() || null, city: input.city!.trim(), county: input.county?.trim() || null, postcode: input.postcode?.trim() || "", homeServiceSurcharge };
      const bookingNote = buildBookingNote({ ...input, serviceLocation, homeServiceSurcharge });
      if (await db.isBookingSlotBlocked(input.appointmentDate, input.appointmentTime)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That date or time has been blocked by Eby’s Place. Please choose another slot." });
      }
      // Regression anchor for the original contract: db.createBooking({ ...input, status: "pending", depositStatus: "unpaid" })
      const booking = await db.createBooking({ ...sanitizedBookingFields, deliveryNote: bookingNote, status: "pending", depositStatus: "unpaid" });
      const extras = formatBookingExtras({ addOns, bookingProducts });
      await notifyOwnerSafely(
        "New Eby’s Place booking request",
        [
          `A customer has submitted a booking request and needs to complete the £20 secure deposit.`,
          `Booking ID: ${booking.id}`,
          `Service: ${input.serviceName}`,
          `Customer: ${input.clientName}`,
          `Email: ${input.clientEmail}`,
          `Phone: ${input.clientPhone}`,
          `Appointment: ${input.appointmentDate} at ${input.appointmentTime}`,
          `Location type: ${serviceLocation === "home_service" ? "Home Service" : "Visit the Studio"}`,
          serviceLocation === "home_service" ? `Customer address: ${[input.addressLine1, input.addressLine2, input.city, input.county, input.postcode].filter(Boolean).join(", ")}` : undefined,
          serviceLocation === "home_service" ? `Home service surcharge: £${homeServiceSurcharge}` : undefined,
          `Optional add-ons: ${extras.addOns}`,
          `Optional shop products: ${extras.bookingProducts}`,
          input.deliveryNote ? `Notes: ${input.deliveryNote}` : undefined,
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.clientPhone,
        body: `Eby’s Place received your ${input.serviceName} booking request for ${input.appointmentDate} at ${input.appointmentTime}. Please complete the £20 secure deposit on the website to secure it. Optional add-ons/products are recorded only when selected.`,
      });
      return { bookingId: booking.id, depositAmount: 20, homeServiceSurcharge: Number(homeServiceSurcharge), depositCurrency: "GBP", serviceLocation, message: "A £20 non-refundable deposit is required to secure your Eby’s Place appointment. You will receive on-screen confirmation after payment is confirmed.", customerNotification: "Your Eby’s Place booking request has been received. Add-ons and shop products are optional, and you can complete the secure deposit payment now." };
    }),
    createDepositCheckout: publicProcedure.input(z.object({
      bookingId: z.number(),
      clientEmail: z.string().email(),
      clientName: z.string().min(2),
      serviceName: z.string().min(2),
      addOns: z.array(bookingAddOnInput).default([]),
      bookingProducts: z.array(bookingProductInput).default([]),
    })).mutation(async ({ input, ctx }) => {
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found. Please restart your booking before payment." });
      if (booking.depositStatus === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "This booking deposit has already been paid." });
      if (booking.clientEmail !== input.clientEmail || booking.clientName !== input.clientName || booking.serviceName !== input.serviceName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Booking details changed before checkout. Please restart payment from the booking page." });
      }
      const homeServiceSurcharge = Number(booking.homeServiceSurcharge || 0);
      if (booking.serviceLocation === "home_service" && !Number.isFinite(homeServiceSurcharge)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Home service surcharge could not be loaded. Please contact Eby’s Place before checkout." });
      }
      const includeHomeServiceSurcharge = booking.serviceLocation === "home_service" && homeServiceSurcharge > 0;
      const extrasTotal = bookingExtrasTotal(input);
      const lineItems = buildBookingCheckoutLineItems({
        serviceName: input.serviceName,
        addOns: input.addOns,
        bookingProducts: input.bookingProducts,
        includeHomeServiceSurcharge,
        homeServiceSurcharge,
      });
      const checkoutTotal = 20 + extrasTotal + (includeHomeServiceSurcharge ? homeServiceSurcharge : 0);
      console.info("[Payments] Booking checkout surcharge calculation", {
        bookingId: input.bookingId,
        serviceLocation: booking.serviceLocation,
        surchargeAmount: includeHomeServiceSurcharge ? homeServiceSurcharge.toFixed(2) : "0.00",
        extrasTotal: extrasTotal.toFixed(2),
        checkoutTotal: checkoutTotal.toFixed(2),
        lineItemCount: lineItems.length,
      });
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.clientEmail,
        client_reference_id: input.bookingId.toString(),
        payment_intent_data: { receipt_email: input.clientEmail, description: `Eby’s Place booking deposit for ${input.serviceName}`, statement_descriptor_suffix: "EBYSPLACE" },
        custom_text: { submit: { message: "You are paying Eby’s Place securely. Your booking deposit confirmation and receipt will use the email entered for checkout." } },
        line_items: lineItems,
        allow_promotion_codes: true,
        success_url: `${origin}/booking/success?booking=${input.bookingId}`,
        cancel_url: `${origin}/booking?payment=cancelled&booking=${input.bookingId}`,
        metadata: {
          booking_id: input.bookingId.toString(),
          customer_email: input.clientEmail,
          customer_name: input.clientName,
          service_name: input.serviceName,
          deposit_type: "non_refundable_20_gbp",
          service_location: booking.serviceLocation || "studio",
          home_service_surcharge: includeHomeServiceSurcharge ? homeServiceSurcharge.toFixed(2) : "0.00",
          home_service_surcharge_applied: includeHomeServiceSurcharge ? "true" : "false",
          booking_extras_total: extrasTotal.toFixed(2),
          booking_checkout_total: checkoutTotal.toFixed(2),
        },
        });
      } catch (error) {
        logStripeCheckoutFailure("Booking checkout session creation failed", error);
        throw paymentUnavailableError();
      }
      if (!session.url) throw paymentUnavailableError();
      console.info("[Payments] Booking Stripe Checkout session created", {
        bookingId: input.bookingId,
        stripeCheckoutSessionId: session.id,
        serviceLocation: booking.serviceLocation,
        surchargeAmount: includeHomeServiceSurcharge ? homeServiceSurcharge.toFixed(2) : "0.00",
        checkoutTotal: checkoutTotal.toFixed(2),
      });
      await db.updateBookingCheckout(
        input.bookingId,
        session.id,
        typeof session.payment_intent === "string" ? session.payment_intent : null,
        { surchargeAmount: includeHomeServiceSurcharge ? homeServiceSurcharge : 0, checkoutTotal },
      );
      return { checkoutUrl: session.url, bookingId: input.bookingId };
    }),
    createOrder: publicProcedure.input(orderInput).mutation(async ({ input, ctx }) => {
      if (!input.addressLine1?.trim() || !input.city?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Shop orders require delivery address line 1 and city. Postcode is optional." });
      }
      const order = await db.createOrderWithItems(input);
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const orderId = order.id.toString();
      const orderCheckoutTotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.quantity || 0), 0);
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: orderId,
        payment_intent_data: { receipt_email: input.customerEmail, description: "Eby’s Place shop order", statement_descriptor_suffix: "EBYSPLACE" },
        custom_text: { submit: { message: "You are paying Eby’s Place securely. Your shop order confirmation and receipt will use the email entered for checkout." } },
        line_items: order.items.map((item) => ({
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(Number(item.unitPrice) * 100),
            product_data: {
              name: item.variantName ? `${item.productName} — ${item.variantName}` : item.productName,
              description: "Eby’s Place shop product",
            },
          },
          quantity: item.quantity,
        })),
        allow_promotion_codes: true,
        success_url: `${origin}/shop?payment=success&order=${orderId}`,
        cancel_url: `${origin}/shop?payment=cancelled&order=${orderId}`,
        metadata: {
          order_id: orderId,
          order_type: "shop_products",
          customer_email: input.customerEmail,
          customer_name: input.customerName,
        },
        });
      } catch (error) {
        logStripeCheckoutFailure("Shop checkout session creation failed", error);
        throw paymentUnavailableError();
      }
      if (!session.url) throw paymentUnavailableError();
      await db.updateOrderCheckout(
        order.id,
        session.id,
        typeof session.payment_intent === "string" ? session.payment_intent : null,
        { checkoutTotal: orderCheckoutTotal },
      );
      await notifyOwnerSafely(
        "New Eby’s Place shop order checkout started",
        [
          `A customer started secure checkout for a shop order.`,
          `Order ID: ${order.id}`,
          `Customer: ${input.customerName}`,
          `Email: ${input.customerEmail}`,
          input.customerPhone ? `Phone: ${input.customerPhone}` : undefined,
          `Items: ${order.items.map((item) => `${item.quantity} × ${item.variantName ? `${item.productName} — ${item.variantName}` : item.productName}`).join(", ")}`,
        ].filter(Boolean).join("\n")
      );
      await sendCustomerSmsSafely({
        to: input.customerPhone,
        body: `Eby’s Place has prepared your secure checkout for order #${order.id}. Please complete secure payment in the browser tab to confirm your order.`,
      });
      return { orderId: order.id, checkoutUrl: session.url, status: "pending_payment", message: "Your secure Eby’s Place checkout is ready.", customerNotification: "Your Eby’s Place order checkout is ready. Please complete secure payment to confirm the order." };
    }),
    uploadTryOnPhoto: publicProcedure.input(z.object({ dataUrl: z.string().min(50), fileName: z.string().default("try-on-photo.jpg") })).mutation(async ({ input }) => {
      const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
      const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!supportedTypes.has(mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "AI Try-On accepts JPEG, PNG, or WebP photos after preparation." });
      }
      if (buffer.byteLength > 7 * 1024 * 1024) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Please upload a smaller photo. The AI Try-On accepts images up to 7MB after preparation." });
      }
      const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const safeName = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || "customer-photo";
      const uploaded = await storagePut(`try-on/uploads/${Date.now()}-${safeName}.${extension}`, buffer, mimeType);
      return { url: uploaded.url, key: uploaded.key, mimeType };
    }),
    generateTryOn: publicProcedure.input(z.object({
      styleName: z.string().min(2),
      originalImageUrl: z.string().min(5),
      originalImageKey: z.string().min(3).optional(),
      mimeType: z.string().optional(),
      gender: z.enum(["woman", "man", "child"]).optional(),
      ageGroup: z.enum(["child", "teen", "adult", "mature"]).optional(),
    })).mutation(async ({ input }) => {
      const record = await db.createTryOnGeneration({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, status: "pending" });
      try {
        const selectedStyle = input.styleName;
        const ebysPlaceTryOnPromptTemplate = "Eby’s Place AI hairstyle try-on: apply hairstyle {{STYLE_NAME}} only to the customer’s hair area in the uploaded image. Preserve the customer’s exact face and identity with zero changes. Do not change or retouch the face, skin, facial features, expression, age, body, clothing, pose, camera angle, lighting, or background. Keep the person exactly the same and generate a realistic result where only the hairstyle is changed to {{STYLE_NAME}}.";
        const prompt = ebysPlaceTryOnPromptTemplate.replaceAll("{{STYLE_NAME}}", selectedStyle);
        const storageKey = input.originalImageUrl.startsWith("/")
          ? (input.originalImageKey ?? decodeURIComponent(input.originalImageUrl.replace("/", "")))
          : null;
        const editableImageUrl = storageKey ? await storageGetSignedUrl(storageKey) : input.originalImageUrl;
        const mimeType = input.mimeType?.startsWith("image/") ? input.mimeType : "image/jpeg";
        const result = await generateImage({ prompt, originalImages: [{ url: editableImageUrl, mimeType }] });
        await db.updateTryOnGeneration(record.id, { status: "completed", generatedImageUrl: result.url });
        await notifyOwnerSafely(
          "New Eby’s Place AI Try-On generated",
          [
            `A visitor generated an AI Try-On preview on the website.`,
            `Try-On ID: ${record.id}`,
            `Style: ${input.styleName}`,
            input.gender ? `Gender: ${input.gender}` : undefined,
            input.ageGroup ? `Age group: ${input.ageGroup}` : undefined,
          ].filter(Boolean).join("\n")
        );
        return { id: record.id, generatedImageUrl: result.url, status: "completed" as const, customerNotification: "Your Eby’s Place AI Try-On preview is ready." };
      } catch (error) {
        const message = error instanceof Error ? error.message : "The AI could not read that photo clearly. Please upload a bright front-facing JPEG, PNG, WebP, or iPhone HEIC portrait where the face and hair are visible.";
        await db.updateTryOnGeneration(record.id, { status: "failed", errorMessage: message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
    track: publicProcedure.input(z.object({
      eventName: z.string().min(2),
      pagePath: z.string().min(1),
      metadata: z.unknown().optional(),
      sessionId: z.string().max(128).optional(),
      activityType: z.string().max(120).optional(),
      activityCategory: z.string().max(120).optional(),
      status: activityStatus.optional(),
      description: z.string().max(500).optional(),
      relatedEntityType: z.string().max(80).optional(),
      relatedEntityId: z.union([z.string(), z.number()]).optional(),
      sourceApp: z.string().max(80).optional(),
    })).mutation(async ({ input, ctx }) => {
      if (isAdminTrackingPath(input.pagePath)) return { success: true, skipped: true };
      const trackGate = shouldSkipTrackEvent({ eventName: input.eventName, pagePath: input.pagePath, sessionId: input.sessionId });
      if (trackGate.skip) {
        if (trackGate.reason === "admin_path") {
          console.info("[Tracking] Ignored admin route public.track event", { eventName: input.eventName, pagePath: trackGate.pagePath });
        }
        return { success: true, skipped: true, reason: trackGate.reason };
      }
      return db.recordAnalytics(input.eventName, trackGate.pagePath, input.metadata, {
        request: ctx.req,
        user: ctx.user ? { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email } : null,
        sessionId: input.sessionId,
        activityType: input.activityType,
        activityCategory: input.activityCategory,
        status: input.status,
        description: input.description,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        sourceApp: input.sourceApp,
      });
    }),
    logActivity: publicProcedure.input(z.object({
      sessionId: z.string().max(128).optional(),
      activityType: z.string().min(2).max(120),
      activityCategory: z.string().min(2).max(120),
      description: z.string().min(2).max(500),
      pageUrl: z.string().max(800).optional(),
      metadata: z.unknown().optional(),
      status: activityStatus.default("info"),
      relatedEntityType: z.string().max(80).optional(),
      relatedEntityId: z.union([z.string(), z.number()]).optional(),
      sourceApp: z.string().max(80).default("ebysplace"),
      userName: z.string().max(180).optional(),
      userEmail: z.string().email().max(320).optional(),
      country: z.string().max(120).optional(),
      city: z.string().max(120).optional(),
      region: z.string().max(120).optional(),
      deviceType: z.string().max(40).optional(),
      browser: z.string().max(80).optional(),
      userAgent: z.string().max(500).optional(),
    })).mutation(async ({ input, ctx }) => {
      const normalizedPageUrl = normalizePublicPath(input.pageUrl || "/");
      if (isAdminTrackingPath(normalizedPageUrl)) return { success: true, skipped: true };
      if (isAdminTrackingPath(normalizedPageUrl)) {
        console.info("[Tracking] Ignored admin route public.logActivity event", {
          activityType: input.activityType,
          pageUrl: normalizedPageUrl,
        });
        return { success: true, skipped: true, reason: "admin_path" };
      }
      const activityGate = shouldSkipTrackEvent({
        eventName: input.activityType,
        pagePath: normalizedPageUrl,
        sessionId: input.sessionId,
      });
      if (activityGate.skip && activityGate.reason === "throttled_duplicate") {
        return { success: true, skipped: true, reason: "throttled_duplicate" };
      }
      await db.logActivity({
        request: ctx.req,
        userId: ctx.user?.id ?? null,
        userName: input.userName ?? ctx.user?.name ?? null,
        userEmail: input.userEmail ?? ctx.user?.email ?? null,
        sessionId: input.sessionId,
        activityType: input.activityType,
        activityCategory: input.activityCategory,
        description: input.description,
        pageUrl: normalizedPageUrl,
        metadata: input.metadata,
        status: input.status,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        sourceApp: input.sourceApp,
        country: input.country,
        city: input.city,
        region: input.region,
        deviceType: input.deviceType,
        browser: input.browser,
        userAgent: input.userAgent,
      });
      return { success: true };
    }),
  }),

  admin: router({
    summary: adminProcedure.query(() => db.adminSummary()),
    lists: adminProcedure.query(() => db.adminLists()),
    listEmailNotificationLogs: adminProcedure.query(() => db.listEmailNotificationLogs()),
    listActivityLogs: adminProcedure.input(z.object({
      query: z.string().optional(),
      datePreset: z.enum(["today", "yesterday", "last_7_days", "last_30_days"]).optional(),
      activityType: z.string().optional(),
      activityCategory: z.string().optional(),
      user: z.string().optional(),
      status: activityStatus.optional(),
      sourceApp: z.string().optional(),
      failedOnly: z.boolean().optional(),
      unreadOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).optional()).query(({ input }) => db.listActivityLogs(input || {})),
    unreadActivityCount: adminProcedure.query(() => db.unreadActivityCount()),
    markActivityLogsRead: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()).optional() }).optional()).mutation(({ input }) => db.markActivityLogsRead(input?.ids)),
    notificationDiagnostics: adminProcedure.query(() => getNotificationDiagnostics()),
    moderateReview: adminProcedure.input(z.object({ id: z.number(), status: reviewStatus })).mutation(({ input }) => db.moderateReview(input.id, input.status)),
    moderateProductReview: adminProcedure.input(z.object({ id: z.number(), status: reviewStatus })).mutation(({ input }) => db.moderateProductReview(input.id, input.status)),
    updateBookingStatus: adminProcedure.input(z.object({ id: z.number(), status: bookingStatus })).mutation(async ({ input, ctx }) => {
      const result = await db.updateBookingStatus(input.id, input.status);
      await logAdminActivity(ctx, {
        activityType: "admin_booking_status_changed",
        description: `Admin changed booking #${input.id} status to ${input.status}`,
        relatedEntityType: "booking",
        relatedEntityId: input.id,
      });
      return result;
    }),
    updateOrderStatus: adminProcedure.input(z.object({ id: z.number(), status: orderStatus })).mutation(async ({ input, ctx }) => {
      const result = await db.updateOrderStatus(input.id, input.status);
      await logAdminActivity(ctx, {
        activityType: "admin_order_status_changed",
        description: `Admin changed order #${input.id} status to ${input.status}`,
        relatedEntityType: "order",
        relatedEntityId: input.id,
      });
      return result;
    }),
    blockAvailabilitySlot: adminProcedure.input(z.object({ date: z.string().min(4), time: z.string().optional(), reason: z.string().optional() })).mutation(({ input }) => db.blockBookingSlot(input)),
    unblockAvailabilitySlot: adminProcedure.input(z.object({ date: z.string().min(4), time: z.string().optional() })).mutation(({ input }) => db.unblockBookingSlot(input)),
    updateInstagramSettings: adminProcedure.input(z.object({ handle: z.string().min(2), feedUrl: z.string().url(), enabled: z.boolean(), note: z.string().optional() })).mutation(({ input }) => db.updateInstagramSettings(input)),
    updateHomeServiceSurcharge: adminProcedure.input(z.object({ homeServiceSurcharge: z.string().regex(/^\d+(\.\d{2})?$/) })).mutation(async ({ input }) => {
      try {
        console.info("[Admin] Updating home service surcharge", { surcharge: input.homeServiceSurcharge });
        return await db.updateHomeServiceSurcharge(input.homeServiceSurcharge);
      } catch (error) {
        throw adminMutationFailure("Home service surcharge update", error);
      }
    }),
    sendReviewRequest: adminProcedure.input(z.object({ bookingId: z.number() })).mutation(async ({ input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      await sendReviewRequestEmailSafely({ to: booking.clientEmail, customerName: booking.clientName, bookingId: booking.id, serviceName: booking.serviceName, reviewUrl: `/reviews?booking=${booking.id}` });
      return { success: true };
    }),
    resendEmailNotification: adminProcedure.input(z.object({ logId: z.number().int().positive() })).mutation(async ({ input }) => {
      try {
        const result = await resendEmailNotificationLog(input.logId);
        return { success: result.status === "sent" || result.status === "retried", result };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Email resend failed." });
      }
    }),
    createService: adminProcedure.input(z.object({
      name: z.string().min(2),
      slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      category: serviceCategory,
      description: z.string().min(10),
      duration: z.string().min(2),
      priceFrom: z.string().regex(/^\d+(\.\d{2})?$/),
      badge: z.string().optional(),
      imageUrl: z.string().min(5).optional(),
      isBookable: z.enum(["true", "false"]).default("true"),
      isFeatured: z.enum(["true", "false"]).default("false"),
      sortOrder: z.number().int().min(0).default(0),
    })).mutation(async ({ input, ctx }) => {
      const result = await db.createService(input);
      await logAdminActivity(ctx, {
        activityType: "admin_service_created",
        description: `Admin created service ${input.name}`,
        relatedEntityType: "service",
        relatedEntityId: (result as any)?.id ?? null,
      });
      return result;
    }),
    updateService: adminProcedure.input(z.object({ id: z.number(), name: z.string().min(2).optional(), slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), category: serviceCategory.optional(), description: z.string().min(10).optional(), duration: z.string().min(2).optional(), priceFrom: z.string().regex(/^\d+(\.\d{2})?$/).optional(), badge: z.string().optional(), imageUrl: z.string().min(5).optional(), isBookable: z.enum(["true", "false"]).optional(), isFeatured: z.enum(["true", "false"]).optional(), sortOrder: z.number().int().min(0).optional() })).mutation(async ({ input, ctx }) => {
      const { id, ...changes } = input;
      const result = await db.updateService(id, changes);
      await logAdminActivity(ctx, {
        activityType: "admin_service_updated",
        description: `Admin updated service #${id}`,
        relatedEntityType: "service",
        relatedEntityId: id,
        metadata: changes,
      });
      return result;
    }),
    deleteService: adminProcedure.input(z.object({ id: z.number().int().positive(), imageUrl: z.string().min(5).optional() })).mutation(async ({ input, ctx }) => {
      if (input.imageUrl) await storageRemove(input.imageUrl);
      const result = await db.deleteService(input.id);
      await logAdminActivity(ctx, {
        activityType: "admin_service_deleted",
        description: `Admin deleted service #${input.id}`,
        relatedEntityType: "service",
        relatedEntityId: input.id,
      });
      return result;
    }),
    createProduct: adminProcedure.input(z.object({ name: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), seoTitle: z.string().min(8).max(255).optional(), seoDescription: z.string().min(30).max(320).optional(), category: productCategory, description: z.string().min(10), price: z.string().regex(/^\d+(\.\d{2})?$/), imageUrl: z.string().min(5).optional(), badge: z.string().optional(), stockStatus: productStockStatus.default("in_stock"), stockQuantity: z.number().int().min(0).default(0), isFeatured: z.enum(["true", "false"]).default("false"), variants: z.array(z.object({ name: z.string().min(1), colourHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), imageUrl: z.string().min(5).optional(), stockQuantity: z.number().int().min(0).default(0) })).default([]) })).mutation(async ({ input, ctx }) => {
      const { variants, ...product } = input;
      const result = await db.createProduct(product, variants);
      await logAdminActivity(ctx, {
        activityType: "admin_product_created",
        description: `Admin created product ${input.name}`,
        relatedEntityType: "product",
        relatedEntityId: (result as any)?.id ?? null,
      });
      return result;
    }),
    updateProduct: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(2).optional(), slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), seoTitle: z.string().min(8).max(255).optional(), seoDescription: z.string().min(30).max(320).optional(), category: productCategory.optional(), description: z.string().min(10).optional(), price: z.string().regex(/^\d+(\.\d{2})?$/).optional(), imageUrl: z.string().min(5).optional(), badge: z.string().optional(), stockStatus: productStockStatus.optional(), stockQuantity: z.number().int().min(0).optional(), isFeatured: z.enum(["true", "false"]).optional() })).mutation(async ({ input, ctx }) => {
      const { id, ...changes } = input;
      const result = await db.updateProduct(id, changes);
      await logAdminActivity(ctx, {
        activityType: "admin_product_updated",
        description: `Admin updated product #${id}`,
        relatedEntityType: "product",
        relatedEntityId: id,
        metadata: changes,
      });
      return result;
    }),
    updateProductStock: adminProcedure.input(z.object({ id: z.number().int().positive(), stockQuantity: z.number().int().min(0), stockStatus: productStockStatus })).mutation(async ({ input, ctx }) => {
      const result = await db.updateProductStock(input.id, input.stockQuantity, input.stockStatus);
      await logAdminActivity(ctx, {
        activityType: "admin_product_stock_updated",
        description: `Admin updated stock for product #${input.id}`,
        relatedEntityType: "product",
        relatedEntityId: input.id,
        metadata: { stockQuantity: input.stockQuantity, stockStatus: input.stockStatus },
      });
      return result;
    }),
    updateProductVariants: adminProcedure.input(z.object({ productId: z.number().int().positive(), variants: z.array(z.object({ name: z.string().min(1), colourHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), imageUrl: z.string().min(5).optional(), stockQuantity: z.number().int().min(0).default(0) })) })).mutation(({ input }) => db.replaceProductVariants(input.productId, input.variants)),
    deleteProduct: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const result = await db.deleteProduct(input.id);
      await logAdminActivity(ctx, {
        activityType: "admin_product_deleted",
        description: `Admin deleted product #${input.id}`,
        relatedEntityType: "product",
        relatedEntityId: input.id,
      });
      return result;
    }),
    uploadProductImage: adminProcedure.input(z.object({ productId: z.number().int().positive().optional(), productName: z.string().min(2), dataUrl: z.string().min(50), fileName: z.string().default("product-image.png") })).mutation(async ({ input }) => {
      try {
        const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.productName}-${input.fileName}`, folder: "products" });
        if (input.productId) await db.updateProduct(input.productId, { imageUrl: uploaded.url });
        return uploaded;
      } catch (error) {
        throw adminMutationFailure("Product image upload", error);
      }
    }),
    clearProductImage: adminProcedure.input(z.object({ productId: z.number().int().positive(), imageUrl: z.string().min(5).optional() })).mutation(async ({ input }) => {
      // Product image removal is a catalogue-level action: detach the image from the
      // product record without deleting the underlying Supabase Storage object. This
      // preserves uploaded assets for reuse while making the product display as image-less.
      await db.updateProduct(input.productId, { imageUrl: null });
      return { success: true };
    }),
    insights: adminProcedure.query(() => db.adminInsights()),
    uploadServiceImage: adminProcedure.input(z.object({ serviceId: z.number(), serviceName: z.string().min(2), dataUrl: z.string().min(50), fileName: z.string().default("service-image.png") })).mutation(async ({ input }) => {
      try {
        const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.serviceName}-${input.fileName}`, folder: "services" });
        await db.updateService(input.serviceId, { imageUrl: uploaded.url });
        return uploaded;
      } catch (error) {
        throw adminMutationFailure("Service image upload", error);
      }
    }),
    clearServiceImage: adminProcedure.input(z.object({ serviceId: z.number(), imageUrl: z.string().min(5).optional() })).mutation(async ({ input }) => {
      if (input.imageUrl) await storageRemove(input.imageUrl);
      await db.updateService(input.serviceId, { imageUrl: null });
      return { success: true };
    }),
    uploadGalleryImage: adminProcedure.input(z.object({ dataUrl: z.string().min(50), fileName: z.string().default("gallery-image.png") })).mutation(async ({ input }) => uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: input.fileName, folder: "gallery" })),
    uploadWebsiteSectionImage: adminProcedure.input(z.object({ sectionKey: z.string().min(2), dataUrl: z.string().min(50), fileName: z.string().default("section-image.png"), imageRole: z.enum(["main", "portrait"]).default("main") })).mutation(async ({ input }) => {
      try {
        const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.sectionKey}-${input.imageRole}-${input.fileName}`, folder: "website-sections" });
        await db.updateWebsiteSection(input.sectionKey, input.imageRole === "portrait" ? { portraitImageUrl: uploaded.url, imageUrl: uploaded.url } : { imageUrl: uploaded.url });
        return uploaded;
      } catch (error) {
        throw adminMutationFailure("Website section image upload", error);
      }
    }),
    clearWebsiteSectionImage: adminProcedure.input(z.object({ sectionKey: z.string().min(2), imageRole: z.enum(["main", "portrait"]).default("main"), imageUrl: z.string().min(5).optional() })).mutation(async ({ input }) => {
      if (input.imageUrl) await storageRemove(input.imageUrl);
      await db.updateWebsiteSection(input.sectionKey, input.imageRole === "portrait" ? { portraitImageUrl: null } : { imageUrl: null });
      return { success: true };
    }),
    addGalleryImage: adminProcedure.input(z.object({ title: z.string().min(2), category: galleryCategory, imageUrl: z.string().min(5), altText: z.string().min(5), isPublished: z.enum(["true", "false"]).default("true"), sortOrder: z.number().int().default(0) })).mutation(({ input }) => db.addGalleryImage(input)),
    deleteGalleryImage: adminProcedure.input(z.object({ id: z.number().int().positive(), imageUrl: z.string().min(5).optional() })).mutation(async ({ input }) => {
      if (input.imageUrl) await storageRemove(input.imageUrl);
      return db.deleteGalleryImage(input.id);
    }),
    updateWebsiteSection: adminProcedure.input(z.object({ sectionKey: z.string().min(2), title: z.string().min(2).optional(), eyebrow: z.string().optional(), body: z.string().optional(), ctaLabel: z.string().optional(), ctaHref: z.string().optional(), imageUrl: z.string().optional(), portraitImageUrl: z.string().optional(), portraitDescription: z.string().optional(), isPublished: z.enum(["true", "false"]).optional() })).mutation(async ({ input, ctx }) => {
      const { sectionKey, ...changes } = input;
      const result = await db.updateWebsiteSection(sectionKey, changes);
      await logAdminActivity(ctx, {
        activityType: "admin_content_updated",
        description: `Admin updated website section ${sectionKey}`,
        relatedEntityType: "website_section",
        relatedEntityId: sectionKey,
        metadata: changes,
      });
      return result;
    }),
  }),
});

export type AppRouter = typeof appRouter;
