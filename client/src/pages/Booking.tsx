import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { smoothScrollToTop } from "@/lib/smoothScroll";
import { SiteFooter, SiteHeader } from "./Home";
import { ChevronLeft } from "lucide-react";

type ServiceLocation = "studio" | "home_service";

const initial: {
  serviceName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceLocation: ServiceLocation;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  deliveryNote: string;
  appointmentDate: string;
  appointmentTime: string;
} = {
  serviceName: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  serviceLocation: "studio",
  addressLine1: "",
  addressLine2: "",
  city: "",
  county: "",
  postcode: "",
  deliveryNote: "",
  appointmentDate: "",
  appointmentTime: "10:00",
};

const STEPS = [
  { id: 0, label: "Choose Service" },
  { id: 1, label: "Date & Time" },
  { id: 2, label: "Location" },
  { id: 3, label: "Your Details" },
  { id: 4, label: "Add-ons" },
  { id: 5, label: "Shop Products" },
  { id: 6, label: "Review & Pay" },
];

const addOnOptions = [
  { id: "hair-wash-prep", name: "Hair wash prep", price: "15.00", description: "A gentle cleanse and prep service before braiding." },
  { id: "beads", name: "Beads", price: "8.00", description: "Decorative bead finish selected to complement your style." },
  { id: "edge-control", name: "Edge control finish", price: "5.00", description: "A polished edge-control finish for a neat final look." },
  { id: "take-down-help", name: "Take-down help", price: "20.00", description: "Assistance removing an existing protective style before the appointment." },
];

type AddOnOption = typeof addOnOptions[number];
type BookingProductSelection = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
};

type BookingShopProduct = {
  id?: number | string;
  productId?: number | string;
  slug?: string;
  name: string;
  price: string;
  badge?: string | null;
  imageUrl?: string | null;
  stockStatus?: string;
};

function parsePositiveInteger(value: unknown) {
  const productId = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

function normalizeProductId(product: BookingShopProduct) {
  return parsePositiveInteger(product.id ?? product.productId);
}

function normalizeBookingProductsForCheckout(products: BookingProductSelection[]) {
  return products.map((item) => {
    const productId = parsePositiveInteger(item.productId);
    return {
      ...item,
      productId: productId ?? Number.NaN,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    };
  });
}

function moneyToNumber(value: string | number | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function calculateBookingCheckoutTotal(input: {
  selectedAddOns: AddOnOption[];
  selectedProducts: BookingProductSelection[];
  homeServiceSurcharge: number;
  includeHomeServiceSurcharge: boolean;
}) {
  const addOnsTotal = input.selectedAddOns.reduce((sum, item) => sum + moneyToNumber(item.price), 0);
  const productsTotal = input.selectedProducts.reduce((sum, item) => sum + moneyToNumber(item.unitPrice) * Math.max(1, Math.floor(Number(item.quantity) || 1)), 0);
  const surchargeTotal = input.includeHomeServiceSurcharge ? moneyToNumber(input.homeServiceSurcharge) : 0;
  return 20 + addOnsTotal + productsTotal + surchargeTotal;
}

function bookingCheckoutErrorDescription(error: unknown) {
  const message = error instanceof Error ? error.message : "Please check the form and try again.";
  if (message.includes("Live Stripe payments require a live Stripe secret key") || message.includes("Stripe is not configured")) {
    return "Payment is currently unavailable. Please contact us to complete your booking.";
  }
  if (message.includes("Invalid input") || message.includes("bookingProducts")) {
    return "One selected appointment product could not be prepared for checkout. Please remove it, add it again, and try once more.";
  }
  return message;
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
          Step {step + 1} of {total}
        </span>
        <span className="text-sm font-semibold text-[#4a3014]">{STEPS[step]?.label}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8d5b0]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#c8a95a] to-[#f5d98a] transition-all duration-500"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
      <div className="mt-4 hidden grid-cols-7 gap-1 sm:grid">
        {STEPS.map(item => (
          <div
            key={item.id}
            className={`rounded-xl px-1 py-2 text-center text-[0.6rem] font-bold uppercase tracking-wide transition ${
              item.id === step
                ? "bg-primary text-primary-foreground"
                : item.id < step
                  ? "bg-primary/20 text-primary"
                  : "bg-[#e8d5b0]/60 text-[#6f4b16]/50"
            }`}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Booking() {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOnOption[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<BookingProductSelection[]>([]);
  const { data: services = [], isLoading: servicesLoading } = trpc.public.services.useQuery({});
  const { data: products = [], isLoading: productsLoading } = trpc.public.products.useQuery();
  const serviceOptions = useMemo(
    () => (services as any[]).filter(service => service.isBookable !== "false"),
    [services]
  );
  const productOptions = useMemo(
    () => (products as any[]).filter(product => product.stockStatus !== "out_of_stock").slice(0, 6),
    [products]
  );
  const create = trpc.public.createBooking.useMutation();
  const checkout = trpc.public.createDepositCheckout.useMutation();
  const availability = trpc.public.availability.useQuery();
  const paymentMode = trpc.public.paymentMode.useQuery();
  const bookingBlockedSlots = availability.data?.blockedSlots || [];
  const homeServiceSurcharge = Number(availability.data?.homeServiceSurcharge || 0);
  const checkoutReturn = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("payment") === "cancelled" ? { status: "cancelled" as const, bookingId: params.get("booking") } : null;
  }, []);
  const selectedSlotBlocked = bookingBlockedSlots.some((slot: any) => slot.date === form.appointmentDate && (!slot.time || slot.time === form.appointmentTime));
  // Regression anchors: Choose style, Date & time, Your details, Deposit, setStep(1), Selecting a style automatically moves you to appointment timing., canContinueFromDate, Continue to deposit.
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preselected = params.get("service");
    if (preselected) {
      set("serviceName", preselected);
      goToStep(1);
    }
    if (params.get("payment") === "cancelled") {
      goToStep(6);
      toast.error("Deposit payment was not completed", {
        description: "No payment was taken. Review your booking and click Pay £20 Deposit again when ready.",
      });
    }
  }, []);

  const homeAddressRequired = form.serviceLocation === "home_service";
  const bookingCheckoutTotal = calculateBookingCheckoutTotal({
    selectedAddOns,
    selectedProducts,
    homeServiceSurcharge,
    includeHomeServiceSurcharge: form.serviceLocation === "home_service",
  });
  const canContinueFromDate = Boolean(form.appointmentDate && form.appointmentTime && !selectedSlotBlocked);
  const canContinueFromDetails = Boolean(
    form.clientName && form.clientEmail && form.clientPhone && (!homeAddressRequired || (form.addressLine1 && form.city && form.county))
  );

  function toggleAddOn(addOn: AddOnOption) {
    setSelectedAddOns(current => current.some(item => item.id === addOn.id) ? current.filter(item => item.id !== addOn.id) : [...current, addOn]);
  }

  function toggleProduct(product: BookingShopProduct) {
    const productId = normalizeProductId(product);
    if (!productId) {
      toast.error("This product cannot be added to your booking", {
        description: "The product data is missing a valid checkout ID. Please continue without it or contact Eby’s Place.",
      });
      return;
    }
    setSelectedProducts(current => current.some(item => item.productId === productId)
      ? current.filter(item => item.productId !== productId)
      : [...current, { productId, productName: product.name, quantity: 1, unitPrice: product.price }]);
  }

  function goToStep(nextStep: number) {
    setStep(nextStep);
    smoothScrollToTop(60);
  }

  function goBack() {
    if (step > 0) goToStep(step - 1);
  }

  function continueToAddons() {
    if (!canContinueFromDetails) {
      toast.error("Complete your details", {
        description: "Name, email, phone" + (homeAddressRequired ? ", and full address" : "") + " are required.",
      });
      return;
    }
    goToStep(4);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.serviceName || !form.appointmentDate || !form.appointmentTime || selectedSlotBlocked || !canContinueFromDetails) {
      toast.error("Please complete all required steps before paying.");
      return;
    }
    try {
      const checkoutProducts = normalizeBookingProductsForCheckout(selectedProducts);
      if (checkoutProducts.some((item) => !Number.isFinite(item.productId) || item.productId <= 0)) {
        toast.error("Please remove and re-add the affected appointment product before checkout.");
        return;
      }
      const booking = await create.mutateAsync({
        ...form,
        addOns: selectedAddOns.map(({ id, name, price }) => ({ id, name, price })),
        bookingProducts: checkoutProducts,
      });
      toast.success(booking.customerNotification);
      toast.message("Opening Eby's Place secure payment", {
        description: "Your deposit, selected add-ons, and selected appointment products will be included in one secure payment.",
      });
      const session = await checkout.mutateAsync({
        bookingId: booking.bookingId,
        clientEmail: form.clientEmail,
        clientName: form.clientName,
        serviceName: form.serviceName,
        addOns: selectedAddOns.map(({ id, name, price }) => ({ id, name, price })),
        bookingProducts: checkoutProducts,
      });
      if (session.checkoutUrl) window.open(session.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Booking could not be completed", {
        description: bookingCheckoutErrorDescription(error),
      });
    }
  }

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">Appointment booking</p>
        <h1 className="serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
          Secure your appointment with a <span className="gold-text">£20 deposit.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-white/70">
          Seven simple steps — choose your service, pick a date and time, select your location, enter your details, add optional extras, and pay a £20 deposit securely to confirm.
        </p>

        {!paymentMode.isLoading && paymentMode.data && !paymentMode.data.publishableKeyConfigured ? (
          <div className="mt-6 rounded-3xl border border-red-400/40 bg-red-50 p-5" role="alert">
            <p className="font-semibold text-red-900">Online payment is currently unavailable</p>
            <p className="mt-2 text-sm text-red-800">
              Secure card payment is temporarily offline. Please{" "}
              <a href="https://wa.me/447864585110" className="font-bold underline" target="_blank" rel="noopener noreferrer">
                contact Eby's Place on WhatsApp
              </a>{" "}
              or email us directly to complete your booking deposit.
            </p>
          </div>
        ) : null}

        {checkoutReturn ? (
          <div className="mt-6 rounded-3xl border border-amber-300/35 bg-amber-300/10 p-5 text-amber-50" role="status">
            <p className="font-semibold">Deposit payment not completed</p>
            <p className="mt-2 text-sm text-amber-50/85">
              Your Eby’s Place booking{checkoutReturn.bookingId ? ` #${checkoutReturn.bookingId}` : ""} is still waiting for the £20 deposit. No payment was taken, and you can review the details below before starting secure payment again.
            </p>
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl border border-primary/30 bg-primary/10 p-5 text-white/85">
          <b className="text-primary">48-hour cancellation policy</b>
          <p className="mt-2 text-sm leading-6">Cancel 48 hours or more before your appointment for a full deposit refund. Cancellations under 48 hours are non-refundable — please choose your date and time carefully.</p>
        </div>

        <div className="lux-card mt-8 grid gap-6">
          <StepIndicator step={step} total={STEPS.length} />

          {step === 0 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Choose your service</h2>
                <p className="mt-2 text-[#4a3014]">Select the braid service you would like. Tap a service card to continue automatically.</p>
              </div>
              {servicesLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map(n => <div key={n} className="h-52 animate-pulse rounded-2xl bg-[#f5ead7]" />)}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {serviceOptions.map((service: any) => (
                    <button
                      key={service.id ?? service.slug}
                      type="button"
                      onClick={() => { set("serviceName", service.name); goToStep(1); }}
                      className={`overflow-hidden rounded-3xl border p-0 text-left transition hover:-translate-y-0.5 ${form.serviceName === service.name ? "border-primary bg-primary/15" : "border-[#d8bd74]/45 bg-white/60 hover:border-primary/60"}`}
                    >
                      {service.imageUrl ? (
                        <div className="h-40 overflow-hidden rounded-t-3xl bg-[#f5ead7]">
                          <img
                            src={service.imageUrl}
                            alt={`${service.name} braid style by Eby's Place`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : null}
                      <div className="p-5">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{service.category}</span>
                        <h3 className="serif mt-2 text-2xl font-bold text-[#24170d]">{service.name}</h3>
                        {service.description ? <p className="mt-1 line-clamp-2 text-sm text-[#4a3014]">{service.description}</p> : null}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm text-[#6f4b16]">{service.duration}</span>
                          <b className="text-xl text-primary">from £{service.priceFrom}</b>
                        </div>
                      </div>
                    </button>
                  ))}
                  {serviceOptions.length === 0 ? (
                    <button type="button" onClick={() => { set("serviceName", "Knotless Braids"); goToStep(1); }} className="overflow-hidden rounded-3xl border border-[#d8bd74]/45 bg-white/60 p-0 text-left">
                      <div className="p-5">
                        <h3 className="serif text-2xl font-bold text-[#24170d]">Knotless Braids</h3>
                        <b className="mt-2 block text-xl text-primary">from £80</b>
                      </div>
                    </button>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Choose date and time</h2>
                <p className="mt-2 text-[#4a3014]">Select your preferred appointment date and time, then tap Confirm Date and Time to continue.</p>
                {form.serviceName ? <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary">{form.serviceName}</div> : null}
              </div>
              <div className="input-grid">
                <label className="font-semibold text-[#24170d]">
                  Appointment Date
                  <input
                    type="date"
                    required
                    value={form.appointmentDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={event => set("appointmentDate", event.target.value)}
                  />
                </label>
                <label className="font-semibold text-[#24170d]">
                  Appointment Time
                  <input
                    type="time"
                    required
                    value={form.appointmentTime}
                    onChange={event => set("appointmentTime", event.target.value)}
                  />
                </label>
              </div>
              {selectedSlotBlocked ? (
                <div className="rounded-2xl border border-red-400/40 bg-red-50 p-4 text-sm font-semibold text-red-800">
                  This slot has been blocked by Eby's Place. Please choose a different date or time.
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark inline-flex items-center gap-2" onClick={goBack}><ChevronLeft className="h-4 w-4" /> Back</button>
                <button
                  type="button"
                  className="btn-gold"
                  disabled={!canContinueFromDate}
                  onClick={() => { if (canContinueFromDate) goToStep(2); }}
                >
                  Confirm Date and Time
                </button>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Choose your location</h2>
                <p className="mt-2 text-[#4a3014]">Will you visit the studio or would you like a home service? Tap your choice to continue automatically.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    value: "studio" as ServiceLocation,
                    title: "Visit the Studio",
                    emoji: "🏛️",
                    note: "Come to the Eby's Place studio. The studio address is shared only in your post-payment confirmation — it is never published on the website.",
                  },
                  {
                    value: "home_service" as ServiceLocation,
                    title: "Home Service",
                    emoji: "🏠",
                    note: "Eby's Place comes to you. Requires your full address at the next step" + (homeServiceSurcharge > 0 ? " and includes a travel surcharge of £" + homeServiceSurcharge.toFixed(2) : "") + ".",
                  },
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { set("serviceLocation", option.value); goToStep(3); }}
                    className="flex min-h-[160px] flex-col gap-3 rounded-3xl border border-[#d8bd74]/45 bg-white/70 p-7 text-left transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_16px_40px_rgba(189,140,52,.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="text-4xl">{option.emoji}</span>
                    <h3 className="serif text-2xl font-bold text-[#24170d]">{option.title}</h3>
                    <p className="text-sm leading-6 text-[#4a3014]">{option.note}</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark inline-flex items-center gap-2" onClick={goBack}><ChevronLeft className="h-4 w-4" /> Back</button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Your details</h2>
                <p className="mt-2 text-[#4a3014]">
                  {homeAddressRequired
                    ? "Please enter your full home address and contact details so we can confirm your appointment."
                    : "Please enter your contact details so we can send your confirmation after payment."}
                </p>
              </div>
              <div className="input-grid">
                <label className="font-semibold text-[#24170d]">
                  Full Name
                  <input required value={form.clientName} onChange={event => set("clientName", event.target.value)} placeholder="Your full name" />
                </label>
                <label className="font-semibold text-[#24170d]">
                  Email Address
                  <input type="email" required value={form.clientEmail} onChange={event => set("clientEmail", event.target.value)} placeholder="your@email.com" />
                </label>
                <label className="font-semibold text-[#24170d]">
                  Phone Number
                  <input required value={form.clientPhone} onChange={event => set("clientPhone", event.target.value)} placeholder="+44 7700 000000" />
                </label>
                {homeAddressRequired ? (
                  <>
                    <label className="font-semibold text-[#24170d]">
                      Address Line 1
                      <input required value={form.addressLine1} onChange={event => set("addressLine1", event.target.value)} placeholder="House number and street name" />
                    </label>
                    <label className="font-semibold text-[#24170d]">
                      Address Line 2 (optional)
                      <input value={form.addressLine2} onChange={event => set("addressLine2", event.target.value)} placeholder="Flat, apartment, building (optional)" />
                    </label>
                    <label className="font-semibold text-[#24170d]">
                      City / Town
                      <input required value={form.city} onChange={event => set("city", event.target.value)} placeholder="City or town" />
                    </label>
                    <label className="font-semibold text-[#24170d]">
                      County
                      <input required value={form.county} onChange={event => set("county", event.target.value)} placeholder="County" />
                    </label>
                    <label className="font-semibold text-[#24170d]">
                      Postcode (optional)
                      <input value={form.postcode} onChange={event => set("postcode", event.target.value)} placeholder="e.g. TA7 8HD" />
                    </label>
                  </>
                ) : null}
              </div>
              <label className="font-semibold text-[#24170d]">
                Notes (optional)
                <textarea
                  placeholder="Any appointment notes or special requests"
                  value={form.deliveryNote}
                  onChange={event => set("deliveryNote", event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark inline-flex items-center gap-2" onClick={goBack}><ChevronLeft className="h-4 w-4" /> Back</button>
                <button type="button" className="btn-gold" onClick={continueToAddons}>Continue to Add-ons</button>
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Optional add-ons</h2>
                <p className="mt-2 text-[#4a3014]">Enhance your appointment with optional extras. Tap to select or deselect. This step is optional.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {addOnOptions.map(addOn => {
                  const selected = selectedAddOns.some(item => item.id === addOn.id);
                  return (
                    <button
                      key={addOn.id}
                      type="button"
                      onClick={() => toggleAddOn(addOn)}
                      className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 ${selected ? "border-primary bg-primary/15" : "border-[#d8bd74]/45 bg-white/60 hover:border-primary/50"}`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wide text-primary">{selected ? "Selected" : "Optional"}</span>
                      <h3 className="serif mt-2 text-2xl font-bold text-[#24170d]">{addOn.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#4a3014]">{addOn.description}</p>
                      <b className="mt-3 block text-xl text-primary">£{addOn.price}</b>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark inline-flex items-center gap-2" onClick={goBack}><ChevronLeft className="h-4 w-4" /> Back</button>
                <button type="button" className="btn-dark" onClick={() => goToStep(5)}>Skip add-ons</button>
                <button type="button" className="btn-gold" onClick={() => goToStep(5)}>
                  {selectedAddOns.length > 0 ? "Continue with " + selectedAddOns.length + " add-on" + (selectedAddOns.length > 1 ? "s" : "") : "Continue"}
                </button>
              </div>
            </section>
          ) : null}

          {step === 5 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Optional shop products</h2>
                <p className="mt-2 text-[#4a3014]">Add hair care or accessories to your appointment order. This step is optional.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {productOptions.map((product: BookingShopProduct) => {
                  const productId = normalizeProductId(product);
                  const selected = productId ? selectedProducts.some(item => item.productId === productId) : false;
                  return (
                    <button
                      key={product.id ?? product.productId ?? product.slug ?? product.name}
                      type="button"
                      onClick={() => toggleProduct(product)}
                      aria-pressed={selected}
                      className={`relative overflow-hidden rounded-3xl border text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-primary/20 shadow-[0_14px_36px_rgba(201,168,76,.22)] ring-2 ring-primary/35" : "border-[#d8bd74]/45 bg-white/60 hover:border-primary/50"}`}
                    >
                      {selected ? <span className="absolute right-3 top-3 z-10 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#111111]">✓ Added</span> : null}
                      {product.imageUrl ? (
                        <div className="h-36 overflow-hidden">
                          <img src={product.imageUrl} alt={`Shop product: ${product.name}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        </div>
                      ) : null}
                      <div className="p-4">
                        <span className="text-xs font-bold uppercase tracking-wide text-primary">{selected ? "Selected — tap again to remove" : product.badge || "Optional"}</span>
                        <h3 className="serif mt-2 text-xl font-bold text-[#24170d]">{product.name}</h3>
                        <b className="mt-2 block text-lg text-primary">£{product.price}</b>
                      </div>
                    </button>
                  );
                })}
                {!productsLoading && productOptions.length === 0 ? (
                  <p className="rounded-3xl border border-[#d8bd74]/45 bg-white/60 p-5 text-[#4a3014]">No shop products available right now. Continue to review your booking.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark inline-flex items-center gap-2" onClick={goBack}><ChevronLeft className="h-4 w-4" /> Back</button>
                <button type="button" className="btn-dark" onClick={() => goToStep(6)}>Skip products</button>
                <button type="button" className="btn-gold" onClick={() => goToStep(6)}>
                  {selectedProducts.length > 0 ? "Continue with " + selectedProducts.length + " product" + (selectedProducts.length > 1 ? "s" : "") : "Continue"}
                </button>
              </div>
            </section>
          ) : null}

          {step === 6 ? (
            <form onSubmit={submit} className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Review and Pay</h2>
                <p className="mt-2 text-[#4a3014]">Please review your booking summary. Click Pay £20 Deposit to proceed to secure payment and confirm your appointment.</p>
              </div>
              <div className="grid gap-3 rounded-3xl border border-primary/25 bg-primary/10 p-5 text-[#3a2615] sm:grid-cols-2">
                <p><strong className="text-primary">Service:</strong> {form.serviceName}</p>
                <p><strong className="text-primary">Date:</strong> {form.appointmentDate}</p>
                <p><strong className="text-primary">Time:</strong> {form.appointmentTime}</p>
                <p><strong className="text-primary">Location:</strong> {form.serviceLocation === "home_service" ? "Home Service" : "Studio Visit"}</p>
                {form.serviceLocation === "home_service" ? (
                  <p className="sm:col-span-2"><strong className="text-primary">Address:</strong> {[form.addressLine1, form.addressLine2, form.city, form.county, form.postcode].filter(Boolean).join(", ")}</p>
                ) : null}
                <p><strong className="text-primary">Name:</strong> {form.clientName}</p>
                <p><strong className="text-primary">Email:</strong> {form.clientEmail}</p>
                <p><strong className="text-primary">Phone:</strong> {form.clientPhone}</p>
                {selectedAddOns.length > 0 ? (
                  <p className="sm:col-span-2"><strong className="text-primary">Add-ons:</strong> {selectedAddOns.map(item => item.name + " (£" + item.price + ")").join(", ")}</p>
                ) : null}
                {selectedProducts.length > 0 ? (
                  <p className="sm:col-span-2"><strong className="text-primary">Shop products:</strong> {selectedProducts.map(item => item.quantity + " x " + item.productName + " (£" + item.unitPrice + ")").join(", ")}</p>
                ) : null}
                {homeServiceSurcharge > 0 && form.serviceLocation === "home_service" ? (
                  <p><strong className="text-primary">Travel surcharge:</strong> £{homeServiceSurcharge.toFixed(2)}</p>
                ) : null}
                <p className="font-bold text-primary sm:col-span-2">Total due now: £{formatMoney(bookingCheckoutTotal)}</p>
                <p className="text-sm font-semibold text-[#4a3014] sm:col-span-2">Includes the £20.00 booking deposit{selectedAddOns.length > 0 ? ", selected add-ons" : ""}{selectedProducts.length > 0 ? ", selected shop products" : ""}{homeServiceSurcharge > 0 && form.serviceLocation === "home_service" ? ", and home-service travel" : ""}.</p>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                After successful payment you will receive a confirmation email, WhatsApp, and SMS.
                {form.serviceLocation === "studio"
                  ? " The studio address is included in your confirmation — it is never shown on the website."
                  : " Your confirmed home address will be included in the confirmation message."}
              </div>
              {create.error && <p className="rounded-2xl border border-red-400/40 bg-red-50 p-4 font-semibold text-red-900">{bookingCheckoutErrorDescription(create.error)}</p>}
              {checkout.error && <p className="rounded-2xl border border-red-400/40 bg-red-50 p-4 font-semibold text-red-900">{bookingCheckoutErrorDescription(checkout.error)}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark inline-flex items-center gap-2" onClick={goBack}><ChevronLeft className="h-4 w-4" /> Back</button>
                <button
                  type="submit"
                  className="btn-gold min-h-12 px-8 text-base"
                  disabled={create.isPending || checkout.isPending}
                >
                  {create.isPending || checkout.isPending ? "Opening payment..." : "Pay £20 Deposit"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
