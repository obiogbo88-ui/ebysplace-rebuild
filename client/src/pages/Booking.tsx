import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

const initial = {
  serviceName: "Knotless Braids",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  addressLine1: "",
  city: "",
  county: "",
  postcode: "",
  deliveryNote: "",
  appointmentDate: "",
  appointmentTime: "10:00",
};

const steps = [
  { id: 0, label: "Choose style" },
  { id: 1, label: "Date & time" },
  { id: 2, label: "Your details" },
  { id: 3, label: "Deposit" },
];

export default function Booking() {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const { data: services = [], isLoading: servicesLoading } =
    trpc.public.services.useQuery({});
  const serviceOptions = useMemo(
    () => (services as any[]).filter(service => service.isBookable !== "false"),
    [services]
  );
  const selectedService = serviceOptions.find(
    service => service.name === form.serviceName
  );
  const create = trpc.public.createBooking.useMutation();
  const checkout = trpc.public.createDepositCheckout.useMutation();
  const set = (key: string, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const selectedService = new URLSearchParams(window.location.search).get(
      "service"
    );
    if (selectedService) {
      set("serviceName", selectedService);
      setStep(1);
    }
  }, []);

  useEffect(() => {
    if (!form.serviceName && serviceOptions[0]?.name)
      set("serviceName", serviceOptions[0].name);
  }, [form.serviceName, serviceOptions]);

  const canContinueFromDate = Boolean(
    form.appointmentDate && form.appointmentTime
  );
  const canContinueFromDetails = Boolean(
    form.clientName &&
      form.clientEmail &&
      form.clientPhone &&
      form.addressLine1 &&
      form.city &&
      form.postcode
  );

  function continueTo(nextStep: number) {
    if (step === 1 && !canContinueFromDate) {
      toast.error("Choose your appointment date and time", {
        description: "Select both fields before moving to your client details.",
      });
      return;
    }
    if (step === 2 && !canContinueFromDetails) {
      toast.error("Complete your contact and address details", {
        description:
          "Name, email, phone, address, city, and postcode are required before deposit payment.",
      });
      return;
    }
    setStep(nextStep);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canContinueFromDate || !canContinueFromDetails) {
      continueTo(!canContinueFromDate ? 1 : 2);
      return;
    }
    try {
      const booking = await create.mutateAsync(form);
      toast.message("Opening Stripe Checkout", {
        description:
          "Your £20 non-refundable deposit page will open in a new tab.",
      });
      const session = await checkout.mutateAsync({
        bookingId: booking.bookingId,
        clientEmail: form.clientEmail,
        clientName: form.clientName,
        serviceName: form.serviceName,
      });
      if (session.checkoutUrl)
        window.open(session.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Booking could not be completed", {
        description:
          error instanceof Error
            ? error.message
            : "Please check the form and try again.",
      });
    }
  }

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">Appointment booking</p>
        <h1 className="serif mt-4 text-5xl font-bold md:text-6xl">
          Secure your appointment with a{" "}
          <span className="gold-text">£20 non-refundable deposit.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-white/70">
          Choose your braid style first, then move through a simple staged flow for
          date, time, contact details, address, and Stripe-hosted deposit payment.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-4">
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
              <span className="block text-xs uppercase tracking-[0.24em] opacity-70">
                Step {item.id + 1}
              </span>
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="lux-card mt-8 grid gap-6">
          {step === 0 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">
                  Choose your style
                </h2>
                <p className="mt-2 text-white/68">
                  Selecting a style automatically moves you to appointment timing.
                </p>
              </div>
              <label>
                Service
                <select
                  value={form.serviceName}
                  onChange={event => {
                    set("serviceName", event.target.value);
                    setStep(1);
                  }}
                  disabled={servicesLoading}
                >
                  {serviceOptions.map(service => (
                    <option key={service.id ?? service.slug} value={service.name}>
                      {service.category} — {service.name} from £
                      {service.priceFrom}
                    </option>
                  ))}
                  {serviceOptions.length === 0 ? (
                    <option value="Knotless Braids">Knotless Braids</option>
                  ) : null}
                </select>
              </label>
              {selectedService ? (
                <div className="rounded-3xl border border-primary/25 bg-primary/10 p-5 text-white/78">
                  <strong className="text-primary">Selected:</strong>{" "}
                  {selectedService.name} from £{selectedService.priceFrom}. You can
                  change this before payment.
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">
                  Pick your date and time
                </h2>
                <p className="mt-2 text-white/68">
                  Choose the appointment slot you want to request for {form.serviceName}.
                </p>
              </div>
              <div className="input-grid">
                <label>
                  Date
                  <input
                    type="date"
                    required
                    value={form.appointmentDate}
                    onChange={event => set("appointmentDate", event.target.value)}
                  />
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    required
                    value={form.appointmentTime}
                    onChange={event => set("appointmentTime", event.target.value)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => setStep(0)}>
                  Back to style
                </button>
                <button
                  type="button"
                  className="btn-gold"
                  onClick={() => continueTo(2)}
                >
                  Continue to details
                </button>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">
                  Add your details
                </h2>
                <p className="mt-2 text-white/68">
                  These details help Eby’s Place confirm the appointment and prepare
                  for the service.
                </p>
              </div>
              <div className="input-grid">
                <label>
                  Name
                  <input
                    required
                    value={form.clientName}
                    onChange={event => set("clientName", event.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    required
                    value={form.clientEmail}
                    onChange={event => set("clientEmail", event.target.value)}
                  />
                </label>
                <label>
                  Phone
                  <input
                    required
                    value={form.clientPhone}
                    onChange={event => set("clientPhone", event.target.value)}
                  />
                </label>
                <label>
                  Address
                  <input
                    required
                    value={form.addressLine1}
                    onChange={event => set("addressLine1", event.target.value)}
                  />
                </label>
                <label>
                  City
                  <input
                    required
                    value={form.city}
                    onChange={event => set("city", event.target.value)}
                  />
                </label>
                <label>
                  County
                  <input
                    value={form.county}
                    onChange={event => set("county", event.target.value)}
                  />
                </label>
                <label>
                  Postcode
                  <input
                    required
                    value={form.postcode}
                    onChange={event => set("postcode", event.target.value)}
                  />
                </label>
              </div>
              <textarea
                placeholder="Delivery or appointment notes"
                value={form.deliveryNote}
                onChange={event => set("deliveryNote", event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => setStep(1)}>
                  Back to date
                </button>
                <button
                  type="button"
                  className="btn-gold"
                  onClick={() => continueTo(3)}
                >
                  Continue to deposit
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="grid gap-5">
              <div>
                <h2 className="serif text-3xl font-bold text-primary">
                  Review and pay deposit
                </h2>
                <p className="mt-2 text-white/68">
                  Your booking request is ready. The final button opens Stripe
                  Checkout for the required £20 non-refundable deposit.
                </p>
              </div>
              <div className="grid gap-3 rounded-3xl border border-primary/25 bg-primary/10 p-5 text-white/78 sm:grid-cols-2">
                <p><strong className="text-primary">Style:</strong> {form.serviceName}</p>
                <p><strong className="text-primary">Slot:</strong> {form.appointmentDate} at {form.appointmentTime}</p>
                <p><strong className="text-primary">Client:</strong> {form.clientName}</p>
                <p><strong className="text-primary">Email:</strong> {form.clientEmail}</p>
                <p><strong className="text-primary">Phone:</strong> {form.clientPhone}</p>
                <p><strong className="text-primary">Postcode:</strong> {form.postcode}</p>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 text-primary">
                Stripe Checkout will clearly show the exact £20 non-refundable
                deposit before payment. Your appointment request is submitted when
                you continue to deposit.
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => setStep(2)}>
                  Back to details
                </button>
                <button
                  className="btn-gold"
                  disabled={create.isPending || checkout.isPending || servicesLoading}
                >
                  {checkout.isPending ? "Opening Stripe…" : "Continue to £20 Deposit"}
                </button>
              </div>
            </section>
          ) : null}

          {create.error && (
            <p className="rounded-2xl border border-red-500/40 bg-red-50 p-4 font-semibold text-red-900">
              {create.error.message}
            </p>
          )}
          {checkout.error && (
            <p className="rounded-2xl border border-red-500/40 bg-red-50 p-4 font-semibold text-red-900">
              {checkout.error.message}
            </p>
          )}
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
