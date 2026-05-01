import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { z } from "zod";
import { storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
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

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload must be a base64 data URL." });
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
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
    reviews: publicProcedure.query(() => db.listApprovedReviews()),
    gallery: publicProcedure.input(z.object({ category: z.string().optional() }).optional()).query(({ input }) => db.listGallery(input?.category)),
    newsletter: publicProcedure.input(z.object({ email: z.string().email(), productAlerts: z.boolean().default(false) })).mutation(({ input }) => db.subscribeNewsletter(input.email, input.productAlerts)),
    submitReview: publicProcedure.input(z.object({ customerName: z.string().min(2), rating: z.number().min(1).max(5), reviewText: z.string().min(10) })).mutation(({ input }) => db.submitReview(input)),
    createBooking: publicProcedure.input(bookingInput).mutation(async ({ input }) => {
      const booking = await db.createBooking({ ...input, status: "pending", depositStatus: "unpaid" });
      return { bookingId: booking.id, depositAmount: 20, depositCurrency: "GBP", message: "A £20 non-refundable deposit is required to secure your Eby’s Place appointment." };
    }),
    createDepositCheckout: publicProcedure.input(z.object({ bookingId: z.number(), clientEmail: z.string().email(), clientName: z.string().min(2), serviceName: z.string().min(2) })).mutation(async ({ input, ctx }) => {
      const stripe = getStripe();
      const origin = getOrigin(ctx.req);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.clientEmail,
        client_reference_id: input.bookingId.toString(),
        line_items: [{ price_data: { currency: "gbp", unit_amount: 2000, product_data: { name: "Eby’s Place £20 non-refundable booking deposit", description: `Deposit for ${input.serviceName}` } }, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${origin}/booking/success?booking=${input.bookingId}`,
        cancel_url: `${origin}/booking?booking=${input.bookingId}`,
        metadata: { booking_id: input.bookingId.toString(), customer_email: input.clientEmail, customer_name: input.clientName, service_name: input.serviceName, deposit_type: "non_refundable_20_gbp" },
      });
      await db.updateBookingCheckout(input.bookingId, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
      return { checkoutUrl: session.url, bookingId: input.bookingId };
    }),
    createOrder: publicProcedure.input(orderInput).mutation(async ({ input }) => {
      const order = await db.createOrderWithItems(input);
      return { orderId: order.id, status: "draft", message: "Order captured with delivery details. The admin team can manage fulfilment from the dashboard." };
    }),
    uploadTryOnPhoto: publicProcedure.input(z.object({ dataUrl: z.string().min(50), fileName: z.string().default("try-on-photo.png") })).mutation(async ({ input }) => {
      const { mimeType, buffer } = decodeDataUrl(input.dataUrl);
      const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
      const safeName = input.fileName.replace(/[^a-z0-9.-]/gi, "-");
      const uploaded = await storagePut(`try-on/uploads/${Date.now()}-${safeName}.${extension}`, buffer, mimeType);
      return { url: uploaded.url, key: uploaded.key };
    }),
    generateTryOn: publicProcedure.input(z.object({ styleName: z.string().min(2), originalImageUrl: z.string().min(5) })).mutation(async ({ input }) => {
      const record = await db.createTryOnGeneration({ styleName: input.styleName, originalImageUrl: input.originalImageUrl, status: "pending" });
      try {
        const prompt = `Preserve the person's exact face, identity, facial structure, skin tone, expression, and all non-hair features. Only change the hairstyle into ${input.styleName} braids in an elegant Eby's Place premium black-and-gold beauty editorial style. Keep the photo realistic, scalp-friendly, neat, tension-free, and suitable for a customer hairstyle preview. Do not alter eyes, nose, mouth, face shape, body, background, or clothing.`;
        const result = await generateImage({ prompt, originalImages: [{ url: input.originalImageUrl, mimeType: "image/png" }] });
        await db.updateTryOnGeneration(record.id, { status: "completed", generatedImageUrl: result.url });
        return { id: record.id, generatedImageUrl: result.url, status: "completed" as const };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image generation failed.";
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
    updateService: adminProcedure.input(z.object({ id: z.number(), name: z.string().min(2).optional(), description: z.string().min(10).optional(), duration: z.string().min(2).optional(), priceFrom: z.string().regex(/^\d+(\.\d{2})?$/).optional(), badge: z.string().optional(), isBookable: z.enum(["true", "false"]).optional(), isFeatured: z.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { id, ...changes } = input;
      return db.updateService(id, changes);
    }),
    updateProduct: adminProcedure.input(z.object({ id: z.number(), name: z.string().min(2).optional(), category: productCategory.optional(), description: z.string().min(10).optional(), price: z.string().regex(/^\d+(\.\d{2})?$/).optional(), badge: z.string().optional(), stockStatus: productStockStatus.optional(), stockQuantity: z.number().int().min(0).optional(), isFeatured: z.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { id, ...changes } = input;
      return db.updateProduct(id, changes);
    }),
    updateProductStock: adminProcedure.input(z.object({ id: z.number(), stockQuantity: z.number().int().min(0), stockStatus: productStockStatus })).mutation(({ input }) => db.updateProductStock(input.id, input.stockQuantity, input.stockStatus)),
    addGalleryImage: adminProcedure.input(z.object({ title: z.string().min(2), category: galleryCategory, imageUrl: z.string().min(5), altText: z.string().min(5), isPublished: z.enum(["true", "false"]).default("true"), sortOrder: z.number().int().default(0) })).mutation(({ input }) => db.addGalleryImage(input)),
    updateWebsiteSection: adminProcedure.input(z.object({ sectionKey: z.string().min(2), title: z.string().min(2).optional(), eyebrow: z.string().optional(), body: z.string().optional(), ctaLabel: z.string().optional(), ctaHref: z.string().optional(), imageUrl: z.string().optional(), isPublished: z.enum(["true", "false"]).optional() })).mutation(({ input }) => {
      const { sectionKey, ...changes } = input;
      return db.updateWebsiteSection(sectionKey, changes);
    }),
  }),
});

export type AppRouter = typeof appRouter;
