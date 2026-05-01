import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const source = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("strict visual-only change regression coverage", () => {
  it("keeps booking, shop, AI try-on, admin, and notification procedures wired in the backend", () => {
    const routersSource = source("server/routers.ts");
    const webhookSource = source("server/stripeWebhook.ts");

    expect(routersSource).toContain("createBooking: publicProcedure");
    expect(routersSource).toContain("db.createBooking({ ...input, status: \"pending\", depositStatus: \"unpaid\" })");
    expect(routersSource).toContain("createDepositCheckout: publicProcedure");
    expect(routersSource).toContain("deposit_type: \"non_refundable_20_gbp\"");
    expect(routersSource).toContain("products: publicProcedure.query(() => db.listProducts())");
    expect(routersSource).toContain("uploadTryOnPhoto: publicProcedure");
    expect(routersSource).toContain("generateTryOn: publicProcedure");
    expect(routersSource).toContain("summary: adminProcedure.query(() => db.adminSummary())");
    expect(routersSource).toContain("notifyOwnerSafely(");
    expect(routersSource).toContain("New Eby’s Place booking request");
    expect(webhookSource).toContain("await db.markBookingDepositPaid(session.id, paymentIntentId)");
    expect(webhookSource).toContain("notifyOwner({");
    expect(webhookSource).toContain("Eby’s Place deposit paid");
  });

  it("keeps customer-facing booking, shop, AI try-on, admin, and navigation entry points wired in the frontend", () => {
    const appSource = source("client/src/App.tsx");
    const homeSource = source("client/src/pages/Home.tsx");
    const bookingSource = source("client/src/pages/Booking.tsx");
    const shopSource = source("client/src/pages/Shop.tsx");
    const tryOnSource = source("client/src/pages/TryOn.tsx");
    const adminSource = source("client/src/pages/Admin.tsx");

    expect(appSource).toContain("window.scrollTo({ top: 0, left: 0, behavior: \"auto\" })");
    expect(appSource).toContain("<Route path=\"/booking\" component={Booking} />");
    expect(appSource).toContain("<Route path=\"/shop\" component={Shop} />");
    expect(appSource).toContain("<Route path=\"/ai-try-on\" component={TryOn} />");
    expect(appSource).toContain("<Route path=\"/admin\" component={Admin} />");
    expect(homeSource).toContain("href=\"/booking\"");
    expect(homeSource).toContain("href=\"/shop\"");
    expect(homeSource).toContain("href=\"/ai-try-on\"");
    expect(bookingSource).toContain("trpc.public.createBooking.useMutation()");
    expect(bookingSource).toContain("trpc.public.createDepositCheckout.useMutation()");
    expect(bookingSource).toContain("window.open(session.checkoutUrl");
    expect(shopSource).toContain("trpc.public.products.useQuery()");
    expect(shopSource).toContain("Add ${readableColourLabel(selectedVariant)} to bag");
    expect(shopSource).toContain("trpc.public.createOrder.useMutation()");
    expect(tryOnSource).toContain("trpc.public.uploadTryOnPhoto.useMutation()");
    expect(tryOnSource).toContain("trpc.public.generateTryOn.useMutation()");
    expect(adminSource).toContain("trpc.admin.summary.useQuery");
    expect(adminSource).toContain("trpc.admin.lists.useQuery");
  });
});
