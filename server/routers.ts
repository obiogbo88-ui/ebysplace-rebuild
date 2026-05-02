import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { z } from "zod";
import { storageGetSignedUrl, storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";

const serviceCategory = z.enum(["Braids", "Twists", "Locs", "Kids Styles", "Add-ons"]);
const bookingStatus = z.enum(["pending", "confirmed", "completed", "cancelled"]);
const reviewStatus = z.enum(["approved", "rejected"]);
const orderStatus = z.enum(["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
const productStockStatus = z.enum(["in_stock", "low_stock", "out_of_stock"]);
const productCategory = z.enum(["Accessories", "Aftercare", "Hair Attachments"]);
const galleryCategory = z.enum(["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);

const bookingInput = z.object({
  serviceId: z.number().optional(),
  serviceName: z.string().min(2),
  clientName: z.string().min(2),
  clientEmail: z.string().email(),
  clientPhone: z.string().min(6),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  county: z.string().optional(),
  postcode: z.string().min(3),
  deliveryNote: z.string().optional(),
  appointmentDate: z.string().min(8),
  appointmentTime: z.string().min(4),
});

const orderInput = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  county: z.string().optional(),
  postcode: z.string().min(3),
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

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe is not configured yet." });
  return new Stripe(key);
}

function getOrigin(req: { headers?: Record<string, unknown> }) {
  const origin = req.headers?.origin;
  return typeof origin === "string" ? origin : "http://localhost:3000";
}

async function notifyOwnerSafely(title: string, content: string) {
  try {
    await notifyOwner({ title, content });
  } catch (error) {
    console.warn("[Notification] Owner notification skipped", error);
  }
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload must be a base64 data URL." });
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

async function uploadDataUrlAsset(input: { dataUrl: string; fileName: string; folder: string }) {
  const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
  if (!mimeType.startsWith("image/")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only image uploads are supported for admin media." });
  }
  if (buffer.byteLength > 7 * 1024 * 1024) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Please upload an image smaller than 7MB." });
  }
  const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
  const baseName = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || "upload";
  const uploaded = await storagePut(`${input.folder}/${Date.now()}-${baseName}.${extension}`, buffer, mimeType);
  return { url: uploaded.url, key: uploaded.key, mimeType };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  public: router({
    services: publicProcedure.input(z.object({ category: serviceCategory.optional() }).optional()).query(({ input }) => db.listServices(input?.category)),
    featuredServices: publicProcedure.query(() => db.listFeaturedServices()),
    products: publicProcedure.query(() => db.listProducts()),
    websiteSections: publicProcedure.query(() => db.listWebsiteSections()),
    reviews: publicProcedure.query(() => db.listApprovedReviews()),
    gallery: publicProcedure.input(z.object({ category: z.string().optional() }).optional()).query(({ input }) => db.listGallery(input?.category)),
    newsletter: publicProcedure.input(z.object({ email: z.string().email(), productAlerts: z.boolean().default(false) })).mutation(({ input }) => db.subscribeNewsletter(input.email, input.productAlerts)),
    submitReview: publicProcedure.input(z.object({ customerName: z.string().min(2), rating: z.number().min(1).max(5), reviewText: z.string().min(10) })).mutation(({ input }) => db.submitReview(input)),
    createBooking: publicProcedure.input(bookingInput).mutation(async ({ input }) => {
      const booking = await db.createBooking({ ...input, status: "pending", depositStatus: "unpaid" });
      await notifyOwnerSafely(
        "New Eby’s Place booking request",
        [
          `A customer has submitted a booking request and needs to complete the £20 Stripe deposit.`,
          `Booking ID: ${booking.id}`,
          `Service: ${input.serviceName}`,
          `Customer: ${input.clientName}`,
          `Email: ${input.clientEmail}`,
          `Phone: ${input.clientPhone}`,
          `Appointment: ${input.appointmentDate} at ${input.appointmentTime}`,
          `Address: ${input.addressLine1}, ${input.city}${input.county ? `, ${input.county}` : ""}, ${input.postcode}`,
          input.deliveryNote ? `Notes: ${input.deliveryNote}` : undefined,
        ].filter(Boolean).join("\n")
      );
      return { bookingId: booking.id, depositAmount: 20, depositCurrency: "GBP", message: "A £20 non-refundable deposit is required to secure your Eby’s Place appointment. You will receive on-screen confirmation after Stripe confirms payment." };
    }),
    createDepositCheckout: publicProcedure.input(z.object({ bookingId: z.number(), clientEmail: z.string().email(), clientName: z.string().min(2), serviceName: z.string().min(2) })).mutation(async ({ input, ctx }) => {
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.clientEmail,
        client_reference_id: input.bookingId.toString(),
        payment_intent_data: { receipt_email: input.clientEmail },
        line_items: [{ price_data: { currency: "gbp", unit_amount: 2000, product_data: { name: "Eby’s Place £20 non-refundable booking deposit", description: `Deposit for ${input.serviceName}` } }, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${origin}/booking/success?booking=${input.bookingId}`,
        cancel_url: `${origin}/booking?booking=${input.bookingId}`,
        metadata: { booking_id: input.bookingId.toString(), customer_email: input.clientEmail, customer_name: input.clientName, service_name: input.serviceName, deposit_type: "non_refundable_20_gbp" },
      });
      await db.updateBookingCheckout(input.bookingId, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
      return { checkoutUrl: session.url, bookingId: input.bookingId };
    }),
    createOrder: publicProcedure.input(orderInput).mutation(async ({ input, ctx }) => {
      const order = await db.createOrderWithItems(input);
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const orderId = order.id.toString();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: orderId,
        payment_intent_data: { receipt_email: input.customerEmail },
        line_items: input.items.map((item) => ({
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
      if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a checkout link. Please try again." });
      await db.updateOrderCheckout(order.id, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
      return { orderId: order.id, checkoutUrl: session.url, status: "pending_payment", message: "Your secure Eby’s Place checkout is ready." };
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
    })).mutation(async ({ input }) => {
      const record = await db.createTryOnGeneration({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, status: "pending" });
      try {
        const prompt = `Change ONLY the hairstyle of the person in this photo to ${input.styleName}. Keep the person's face, skin tone, eye color, facial features, expression, body, background, and clothing EXACTLY the same — do not alter them in any way. Only modify the hair into neat, professional, realistic ${input.styleName} with the refined Eby’s Place salon finish.`;
        const storageKey = input.originalImageKey
          ?? (input.originalImageUrl.startsWith("/manus-storage/")
            ? decodeURIComponent(input.originalImageUrl.replace("/manus-storage/", ""))
            : null);
        const editableImageUrl = storageKey ? await storageGetSignedUrl(storageKey) : input.originalImageUrl;
        const mimeType = input.mimeType?.startsWith("image/") ? input.mimeType : "image/jpeg";
        const result = await generateImage({ prompt, originalImages: [{ url: editableImageUrl, mimeType }] });
        await db.updateTryOnGeneration(record.id, { status: "completed", generatedImageUrl: result.url });
        return { id: record.id, generatedImageUrl: result.url, status: "completed" as const };
      } catch (error) {
        const message = error instanceof Error ? error.message : "The AI could not read that photo clearly. Please upload a bright front-facing JPEG, PNG, WebP, or iPhone HEIC portrait where the face and hair are visible.";
        await db.updateTryOnGeneration(record.id, { status: "failed", errorMessage: message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
    track: publicProcedure.input(z.object({ eventName: z.string().min(2), pagePath: z.string().min(1), metadata: z.unknown().optional() })).mutation(({ input }) => db.recordAnalytics(input.eventName, input.pagePath, input.metadata)),
  }),

  admin: router({
    summary: adminProcedure.query(() => db.adminSummary()),
    lists: adminProcedure.query(() => db.adminLists()),
    moderateReview: adminProcedure.input(z.object({ id: z.number(), status: reviewStatus })).mutation(({ input }) => db.moderateReview(input.id, input.status)),
    updateBookingStatus: adminProcedure.input(z.object({ id: z.number(), status: bookingStatus })).mutation(({ input }) => db.updateBookingStatus(input.id, input.status)),
    updateOrderStatus: adminProcedure.input(z.object({ id: z.number(), status: orderStatus })).mutation(({ input }) => db.updateOrderStatus(input.id, input.status)),
    updateService: adminProcedure.input(z.object({ id: z.number(), name: z.string().min(2).optional(), description: z.string().min(10).optional(), duration: z.string().min(2).optional(), priceFrom: z.string().regex(/^\d+(\.\d{2})?$/).optional(), badge: z.string().optional(), imageUrl: z.string().min(5).optional(), isBookable: z.enum(["true", "false"]).optional(), isFeatured: z.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { id, ...changes } = input;
      return db.updateService(id, changes);
    }),
    createProduct: adminProcedure.input(z.object({ name: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), seoTitle: z.string().min(8).max(255).optional(), seoDescription: z.string().min(30).max(320).optional(), category: productCategory, description: z.string().min(10), price: z.string().regex(/^\d+(\.\d{2})?$/), imageUrl: z.string().min(5).optional(), badge: z.string().optional(), stockStatus: productStockStatus.default("in_stock"), stockQuantity: z.number().int().min(0).default(0), isFeatured: z.enum(["true", "false"]).default("false"), variants: z.array(z.object({ name: z.string().min(1), colourHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), stockQuantity: z.number().int().min(0).default(0) })).default([]) })).mutation(({ input }) => {
      const { variants, ...product } = input;
      return db.createProduct(product, variants);
    }),
    updateProduct: adminProcedure.input(z.object({ id: z.number(), name: z.string().min(2).optional(), slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), seoTitle: z.string().min(8).max(255).optional(), seoDescription: z.string().min(30).max(320).optional(), category: productCategory.optional(), description: z.string().min(10).optional(), price: z.string().regex(/^\d+(\.\d{2})?$/).optional(), imageUrl: z.string().min(5).optional(), badge: z.string().optional(), stockStatus: productStockStatus.optional(), stockQuantity: z.number().int().min(0).optional(), isFeatured: z.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { id, ...changes } = input;
      return db.updateProduct(id, changes);
    }),
    updateProductStock: adminProcedure.input(z.object({ id: z.number(), stockQuantity: z.number().int().min(0), stockStatus: productStockStatus })).mutation(({ input }) => db.updateProductStock(input.id, input.stockQuantity, input.stockStatus)),
    updateProductVariants: adminProcedure.input(z.object({ productId: z.number(), variants: z.array(z.object({ name: z.string().min(1), colourHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), stockQuantity: z.number().int().min(0).default(0) })) })).mutation(({ input }) => db.replaceProductVariants(input.productId, input.variants)),
    uploadProductImage: adminProcedure.input(z.object({ productId: z.number().optional(), productName: z.string().min(2), dataUrl: z.string().min(50), fileName: z.string().default("product-image.png") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.productName}-${input.fileName}`, folder: "products" });
      if (input.productId) await db.updateProduct(input.productId, { imageUrl: uploaded.url });
      return uploaded;
    }),
    insights: adminProcedure.query(() => db.adminInsights()),
    uploadServiceImage: adminProcedure.input(z.object({ serviceId: z.number(), serviceName: z.string().min(2), dataUrl: z.string().min(50), fileName: z.string().default("service-image.png") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.serviceName}-${input.fileName}`, folder: "services" });
      await db.updateService(input.serviceId, { imageUrl: uploaded.url });
      return uploaded;
    }),
    uploadGalleryImage: adminProcedure.input(z.object({ dataUrl: z.string().min(50), fileName: z.string().default("gallery-image.png") })).mutation(async ({ input }) => uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: input.fileName, folder: "gallery" })),
    uploadWebsiteSectionImage: adminProcedure.input(z.object({ sectionKey: z.string().min(2), dataUrl: z.string().min(50), fileName: z.string().default("section-image.png") })).mutation(async ({ input }) => {
      const uploaded = await uploadDataUrlAsset({ dataUrl: input.dataUrl, fileName: `${input.sectionKey}-${input.fileName}`, folder: "website-sections" });
      await db.updateWebsiteSection(input.sectionKey, { imageUrl: uploaded.url });
      return uploaded;
    }),
    addGalleryImage: adminProcedure.input(z.object({ title: z.string().min(2), category: galleryCategory, imageUrl: z.string().min(5), altText: z.string().min(5), isPublished: z.enum(["true", "false"]).default("true"), sortOrder: z.number().int().default(0) })).mutation(({ input }) => db.addGalleryImage(input)),
    updateWebsiteSection: adminProcedure.input(z.object({ sectionKey: z.string().min(2), title: z.string().min(2).optional(), eyebrow: z.string().optional(), body: z.string().optional(), ctaLabel: z.string().optional(), ctaHref: z.string().optional(), imageUrl: z.string().optional(), isPublished: z.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { sectionKey, ...changes } = input;
      return db.updateWebsiteSection(sectionKey, changes);
    }),
  }),
});

export type AppRouter = typeof appRouter;
