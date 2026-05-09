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
    expect(routersSource).toContain("services: publicProcedure.input");
    expect(routersSource).toContain("db.listServices(input?.category)");
    expect(routersSource).toContain("createOrder: publicProcedure.input(orderInput)");
    expect(routersSource).toContain("const order = await db.createOrderWithItems(input)");
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
    const servicesSource = source("client/src/pages/Services.tsx");
    const shopSource = source("client/src/pages/Shop.tsx");
    const tryOnSource = source("client/src/pages/TryOn.tsx");
    const adminSource = source("client/src/pages/Admin.tsx");

    expect(appSource).toContain('afterRouteScroll(`${location}${window.location.hash || ""}`, 40)');
    expect(appSource).toContain('navigateWithSmoothScroll("/booking", setLocation)');
    expect(appSource).toContain("const Services = lazy(() => import(\"./pages/Services\"));");
    expect(appSource).toContain("<Route path=\"/services\" component={Services} />");
    expect(appSource).toContain("<Route path=\"/booking\" component={Booking} />");
    expect(appSource).toContain("<Route path=\"/shop\" component={Shop} />");
    expect(appSource).toContain("<Route path=\"/ai-try-on\" component={TryOn} />");
    expect(appSource).toContain("<Route path=\"/admin\" component={Admin} />");
    expect(homeSource).toContain("href=\"/services\"");
    expect(homeSource).toContain('navigateWithSmoothScroll("/booking", setLocation)');
    expect(homeSource).toContain('navigateWithSmoothScroll("/shop", setLocation)');
    expect(homeSource).toContain("href=\"/ai-try-on\"");
    expect(bookingSource).toContain("trpc.public.createBooking.useMutation()");
    expect(bookingSource).toContain("trpc.public.createDepositCheckout.useMutation()");
    expect(bookingSource).toContain("window.open(session.checkoutUrl");
    expect(servicesSource).toContain("const serviceQueryInput = useMemo(() => (category === \"All\" ? {} : { category }), [category])");
    expect(servicesSource).toContain("trpc.public.services.useQuery(serviceQueryInput)");
    expect(servicesSource).toContain("<SiteHeader />");
    expect(servicesSource).toContain("<SiteFooter />");
    expect(servicesSource).toContain("Services & pricing");
    expect(servicesSource).toContain("Book This Style");
    expect(servicesSource).toContain("Currently unavailable");
    expect(servicesSource).toContain("const isBookable = service.isBookable !== \"false\";");
    expect(shopSource).toContain("trpc.public.products.useQuery()");
    expect(shopSource).toContain("Add ${readableColourLabel(selectedVariant)} to bag");
    expect(shopSource).toContain("trpc.public.createOrder.useMutation()");
    expect(tryOnSource).toContain("trpc.public.uploadTryOnPhoto.useMutation()");
    expect(tryOnSource).toContain("trpc.public.generateTryOn.useMutation()");
    expect(adminSource).toContain("trpc.admin.summary.useQuery");
    expect(adminSource).toContain("trpc.admin.lists.useQuery");
  });

  it("keeps admin product and service prices explicitly editable with validation", () => {
    const adminSource = source("client/src/pages/Admin.tsx");
    const routersSource = source("server/routers.ts");
    const dbSource = source("server/db.ts");

    expect(adminSource).toContain("Shop price (£)");
    expect(adminSource).toContain("id={`product-price-${product.id}`}");
    expect(adminSource).toContain("Save product price, SEO & colours");
    expect(adminSource).toContain("Service price (£)");
    expect(adminSource).toContain("id={`price-${service.id}`}");
    expect(adminSource).toContain("Save service");
    expect(adminSource).toContain("Availability");
    expect(adminSource).toContain("id={`availability-${service.id}`}");
    expect(adminSource).toContain("isBookable: (document.getElementById(`availability-${service.id}`) as HTMLSelectElement).value as \"true\" | \"false\"");
    expect(adminSource).toContain("readAdminPrice");
    expect(adminSource).toContain("must be a valid price of 0 or more");
    expect(adminSource).toContain("updateProduct.mutate({ id: product.id");
    expect(adminSource).toContain("updateService.mutate({ id: service.id");
    expect(routersSource).toContain("updateService: adminProcedure.input");
    expect(routersSource).toContain("priceFrom: z.string().regex");
    expect(routersSource).toContain("isBookable: z.enum([\"true\", \"false\"]).optional()");
    expect(routersSource).toContain("updateProduct: adminProcedure.input");
    expect(routersSource).toContain("price: z.string().regex");
    expect(dbSource).toContain("export async function updateService");
    expect(dbSource).toContain("export async function updateProduct");
  });

  it("offers all current website braiding-related styles in AI Try-On without changing the generation flow", () => {
    const tryOnSource = source("client/src/pages/TryOn.tsx");
    const websiteStyles = [
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
    ];

    websiteStyles.forEach((style) => expect(tryOnSource).toContain(`\"${style}\"`));
    expect(tryOnSource).toContain("trpc.public.uploadTryOnPhoto.useMutation()");
    expect(tryOnSource).toContain("trpc.public.generateTryOn.useMutation()");
    expect(tryOnSource).toContain("This is a visual preview before booking, not a guarantee of an exact finished salon result.");
  });
});
