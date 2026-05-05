import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

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
  serviceName: "Knotless Braids",
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

const steps = [
  { id: 0, label: "Service & slot" },
  { id: 1, label: "Optional add-ons" },
  { id: 2, label: "Optional products" },
  { id: 3, label: "Customer details" },
  { id: 4, label: "Payment" },
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
  const selectedService = serviceOptions.find(service => service.name === form.serviceName);
  const create = trpc.public.createBooking.useMutation();
  const checkout = trpc.public.createDepositCheckout.useMutation();
  const availability = trpc.public.availability.useQuery();
  const bookingBlockedSlots = availability.data?.blockedSlots || [];
  const homeServiceSurcharge = Number(availability.data?.homeServiceSurcharge || 0);
  const selectedSlotBlocked = bookingBlockedSlots.some((slot: any) => slot.date === form.appointmentDate && (!slot.time || slot.time === form.appointmentTime));
  // Regression anchors: Choose style, Date & time, Your details, Deposit, setStep(1), Selecting a style automatically moves you to appointment timing., canContinueFromDate, Continue to deposit.
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const selectedService = new URLSearchParams(window.location.search).get("service");
    if (selectedService) {
      set("serviceName", selectedService);
    }
  }, []);

  useEffect(() => {
    if (!form.serviceName && serviceOptions[0]?.name) set("serviceName", serviceOptions[0].name);
  }, [form.serviceName, serviceOptions]);

  const canContinueFromServiceSlot = Boolean(form.serviceName && form.serviceLocation && form.appointmentDate && form.appointmentTime);
  const canContinueFromDate = canContinueFromServiceSlot;
  const homeAddressRequired = form.serviceLocation === "home_service";
  const canContinueFromDetails = Boolean(
    form.clientName && form.clientEmail && form.clientPhone && (!homeAddressRequired || (form.addressLine1 && form.city && form.county && form.postcode))
  );

  function toggleAddOn(addOn: AddOnOption) {
    setSelectedAddOns(current => current.some(item => item.id === addOn.id) ? current.filter(item => item.id !== addOn.id) : [...current, addOn]);
  }

  function toggleProduct(product: any) {
    const productId = Number(product.id);
    setSelectedProducts(current => current.some(item => item.productId === productId)
      ? current.filter(item => item.productId !== productId)
      : [...current, { productId, productName: product.name, quantity: 1, unitPrice: product.price }]);
  }

  function continueTo(nextStep: number) {
    if (step === 0 && (!canContinueFromServiceSlot || selectedSlotBlocked)) {
      toast.error("Choose your service, date and time", {
        description: selectedSlotBlocked ? "That slot has been blocked by Eby’s Place. Please choose another date or time." : "Step 1 must include the service and appointment slot before optional extras.",
      });
      return;
    }
    if (step === 3 && !canContinueFromDetails) {
      toast.error("Complete your customer details", {
        description: "Name, email, phone, address, city, and postcode are required before deposit payment.",
      });
      return;
    }
    setStep(nextStep);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canContinueFromServiceSlot || selectedSlotBlocked || !canContinueFromDetails) {
      setStep(!canContinueFromServiceSlot ? 0 : 3);
      toast.error(!canContinueFromServiceSlot ? "Choose your service, date and time" : selectedSlotBlocked ? "This slot is unavailable" : "Complete your customer details");
      return;
    }
    try {
      const booking = await create.mutateAsync({
        ...form,
        addOns: selectedAddOns.map(({ id, name, price }) => ({ id, name, price })),
        bookingProducts: selectedProducts,
      });
      toast.success(booking.customerNotification);
      toast.message("Opening Eby’s Place secure checkout", {
        description: "Your £20 non-refundable Eby’s Place deposit page will open in a new tab.",
      });
      const session = await checkout.mutateAsync({
        bookingId: booking.bookingId,
        clientEmail: form.clientEmail,
        clientName: form.clientName,
        serviceName: form.serviceName,
      });
      if (session.checkoutUrl) window.open(session.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Booking could not be completed", {
        description: error instanceof Error ? error.message : "Please check the form and try again.",
      });
    }
  }

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">Appointment booking</p>
        <h1 className="serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
          Secure your appointment with a <span className="gold-text">£20 non-refundable deposit.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-white/70">
          Follow five clear steps: choose your service and slot, optionally add prep extras, optionally add shop products, enter your customer details, then pay the £20 Stripe deposit.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-5">
          {steps.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => item.id <= step && setStep(item.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                item.id === step
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_16px_40px_rgba(189,140,52,.28)]"
                  : item.id < step
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-white/10 bg-white/[0.04] text-white/55"
              }`}
            >
              <span className="block text-xs uppercase tracking-[0.24em] opacity-70">Step {item.id + 1}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-primary/30 bg-primary/10 p-5 text-white/85"><b className="text-primary">48-hour cancellation policy</b><p className="mt-2 text-sm leading-6">Customers can cancel up to 48 hours before the appointment for a deposit refund. Cancellations under 48 hours before the appointment are non-refundable, so please choose your date and time carefully.</p></div>
        <form onSubmit={submit} className="lux-card mt-8 grid gap-6">
          {step === 0 ? (
            <section className="booking-style-panel grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Step 1: Choose location, service and date/time</h2>
                <p className="mt-2 text-white/68">Choose whether you are visiting the studio or requesting a home service, then select the braid service and appointment slot.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { value: "studio", title: "Visit the Studio", note: "Choose this for a studio appointment. The studio address is shared only in the paid confirmation email." },
                  { value: "home_service", title: "Home Service", note: `Requires your full address at checkout${homeServiceSurcharge > 0 ? ` and adds a £${homeServiceSurcharge.toFixed(2)} travel fee` : ""}.` },
                ].map((option) => (
                  <button key={option.value} type="button" onClick={() => set("serviceLocation", option.value)} className={`rounded-3xl border p-5 text-left transition ${form.serviceLocation === option.value ? "border-primary bg-primary/15 text-white" : "border-white/10 bg-white/[0.04] text-white/72 hover:border-primary/45"}`}>
                    <span className="pill text-xs">{form.serviceLocation === option.value ? "Selected" : "Location"}</span>
                    <b className="mt-3 block text-xl text-primary">{option.title}</b>
                    <small className="mt-2 block leading-5 text-white/58">{option.note}</small>
                  </button>
                ))}
              </div>
              <div className="input-grid">
                <label>
                  Service
                  <select className="booking-style-select" value={form.serviceName} onChange={event => set("serviceName", event.target.value)} disabled={servicesLoading}>
                    {serviceOptions.map(service => (
                      <option key={service.id ?? service.slug} value={service.name}>{service.category} — {service.name} from £{service.priceFrom}</option>
                    ))}
                    {serviceOptions.length === 0 ? <option value="Knotless Braids">Knotless Braids</option> : null}
                  </select>
                </label>
                <label>
                  Date
                  <input type="date" required value={form.appointmentDate} onChange={event => set("appointmentDate", event.target.value)} />
                </label>
                <label>
                  Time
                  <input type="time" required value={form.appointmentTime} onChange={event => set("appointmentTime", event.target.value)} />
                  {selectedSlotBlocked ? <p className="mt-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">This slot is unavailable because it has been blocked by Eby’s Place. Please choose another date or time.</p> : null}
                </label>
              </div>
              {selectedService ? (
                <div className="booking-selected-service rounded-3xl border border-primary/25 bg-primary/10 p-5 text-[#3a2615]">
                  <strong className="text-primary">Selected:</strong> {selectedService.name} from £{selectedService.priceFrom}. Optional extras are shown next and can be skipped.
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-gold" onClick={() => continueTo(1)}>Continue to optional add-ons</button>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Step 2: Optional add-ons selection</h2>
                <p className="mt-2 text-white/68">Choose prep extras such as hair wash prep, beads, or edge control. You can skip this step without blocking checkout.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {addOnOptions.map(addOn => {
                  const selected = selectedAddOns.some(item => item.id === addOn.id);
                  return (
                    <button key={addOn.id} type="button" onClick={() => toggleAddOn(addOn)} className={`rounded-3xl border p-5 text-left transition ${selected ? "border-primary bg-primary/15 text-white" : "border-white/10 bg-white/[0.04] text-white/72 hover:border-primary/45"}`}>
                      <span className="pill text-xs">{selected ? "Selected" : "Optional"}</span>
                      <h3 className="serif mt-3 text-2xl font-bold text-primary">{addOn.name}</h3>
                      <p className="mt-2 text-sm leading-6">{addOn.description}</p>
                      <b className="mt-3 block text-xl text-primary">£{addOn.price}</b>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => setStep(0)}>Back to service</button>
                <button type="button" className="btn-dark" onClick={() => setStep(2)}>Skip add-ons</button>
                <button type="button" className="btn-gold" onClick={() => setStep(2)}>Continue to optional products</button>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Step 3: Optional shop products to add to order</h2>
                <p className="mt-2 text-white/68">Add hair, aftercare products, or accessories to your appointment order if needed. This step is optional and can be skipped.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {productOptions.map(product => {
                  const selected = selectedProducts.some(item => item.productId === Number(product.id));
                  return (
                    <button key={product.id ?? product.slug} type="button" onClick={() => toggleProduct(product)} className={`rounded-3xl border p-5 text-left transition ${selected ? "border-primary bg-primary/15 text-white" : "border-white/10 bg-white/[0.04] text-white/72 hover:border-primary/45"}`}>
                      <span className="pill text-xs">{selected ? "Added" : product.badge || "Optional"}</span>
                      <h3 className="serif mt-3 text-2xl font-bold text-primary">{product.name}</h3>
                      <p className="mt-2 text-sm leading-6">{product.description}</p>
                      <b className="mt-3 block text-xl text-primary">£{product.price}</b>
                    </button>
                  );
                })}
                {!productsLoading && productOptions.length === 0 ? <p className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-white/72">No shop products are available to add right now. You can continue to details.</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => setStep(1)}>Back to add-ons</button>
                <button type="button" className="btn-dark" onClick={() => setStep(3)}>Skip shop products</button>
                <button type="button" className="btn-gold" onClick={() => setStep(3)}>Continue to customer details</button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Step 4: Customer and location details</h2>
                <p className="mt-2 text-white/68">These details are required so Eby’s Place can confirm the appointment and send payment confirmation after Stripe succeeds. Home Service bookings require the customer address; studio bookings receive the studio address only after payment.</p>
              </div>
              <div className="input-grid">
                <label>Name<input required value={form.clientName} onChange={event => set("clientName", event.target.value)} /></label>
                <label>Email<input type="email" required value={form.clientEmail} onChange={event => set("clientEmail", event.target.value)} /></label>
                <label>Phone<input required value={form.clientPhone} onChange={event => set("clientPhone", event.target.value)} /></label>
                {homeAddressRequired ? (<>
                  <label>Address line 1<input required value={form.addressLine1} onChange={event => set("addressLine1", event.target.value)} /></label>
                  <label>Address line 2<input value={form.addressLine2} onChange={event => set("addressLine2", event.target.value)} /></label>
                  <label>City<input required value={form.city} onChange={event => set("city", event.target.value)} /></label>
                  <label>County<input required value={form.county} onChange={event => set("county", event.target.value)} /></label>
                  <label>Postcode<input required value={form.postcode} onChange={event => set("postcode", event.target.value)} /></label>
                </>) : null}
              </div>
              <textarea placeholder="Delivery or appointment notes" value={form.deliveryNote} onChange={event => set("deliveryNote", event.target.value)} />
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => setStep(2)}>Back to products</button>
                <button type="button" className="btn-gold" onClick={() => continueTo(4)}>Continue to payment</button>
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">Step 5: Payment - £20 deposit via Stripe checkout</h2>
                <p className="mt-2 text-white/68">The final button opens Stripe Checkout for the required £20 non-refundable deposit. Optional add-ons and shop products do not block checkout if skipped.</p>
              </div>
              <div className="grid gap-3 rounded-3xl border border-primary/25 bg-primary/10 p-5 text-white/78 sm:grid-cols-2">
                <p><strong className="text-primary">Style:</strong> {form.serviceName}</p>
                <p><strong className="text-primary">Slot:</strong> {form.appointmentDate} at {form.appointmentTime}</p>
                <p><strong className="text-primary">Location:</strong> {form.serviceLocation === "home_service" ? "Home Service" : "Visit the Studio"}</p>
                <p><strong className="text-primary">Add-ons:</strong> {selectedAddOns.length ? selectedAddOns.map(item => item.name).join(", ") : "Skipped"}</p>
                <p><strong className="text-primary">Products:</strong> {selectedProducts.length ? selectedProducts.map(item => `${item.quantity} × ${item.productName}`).join(", ") : "Skipped"}</p>
                <p><strong className="text-primary">Client:</strong> {form.clientName}</p>
                <p><strong className="text-primary">Email:</strong> {form.clientEmail}</p>
                <p><strong className="text-primary">Phone:</strong> {form.clientPhone}</p>
                {form.serviceLocation === "home_service" ? <p><strong className="text-primary">Postcode:</strong> {form.postcode}</p> : null}
                {form.serviceLocation === "home_service" && homeServiceSurcharge > 0 ? <p><strong className="text-primary">Travel fee:</strong> £{homeServiceSurcharge.toFixed(2)}</p> : null}
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 text-primary">
                Stripe Checkout will show the exact £20 non-refundable deposit and any Home Service travel fee before payment. After successful payment, Eby’s Place sends confirmation by email and WhatsApp/SMS when those delivery channels are available.
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => setStep(3)}>Back to details</button>
                <button className="btn-gold" disabled={create.isPending || checkout.isPending || servicesLoading}>{checkout.isPending ? "Opening Stripe…" : "Continue to £20 Deposit"}</button>
              </div>
            </section>
          ) : null}

          {create.error && <p className="rounded-2xl border border-red-500/40 bg-red-50 p-4 font-semibold text-red-900">{create.error.message}</p>}
          {checkout.error && <p className="rounded-2xl border border-red-500/40 bg-red-50 p-4 font-semibold text-red-900">{checkout.error.message}</p>}
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
