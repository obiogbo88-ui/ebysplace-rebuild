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
  "Choose style",
  "Date & time",
  "Your details",
  "Address",
  "Deposit",
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
  const selectedService = useMemo(
    () =>
      serviceOptions.find(service => service.name === form.serviceName) ??
      serviceOptions[0],
    [form.serviceName, serviceOptions]
  );
  const create = trpc.public.createBooking.useMutation();
  const checkout = trpc.public.createDepositCheckout.useMutation();
  const set = (key: string, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const goToStep = (nextStep: number) => {
    setStep(Math.max(0, Math.min(steps.length - 1, nextStep)));
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };
  const selectStyle = (service: any) => {
    setForm(current => ({ ...current, serviceName: service.name }));
    toast.message(`${service.name} selected`, {
      description: "Next, choose your preferred appointment date and time.",
    });
    goToStep(1);
  };

  useEffect(() => {
    const selectedServiceName = new URLSearchParams(window.location.search).get(
      "service"
    );
    if (selectedServiceName) {
      set("serviceName", selectedServiceName);
      setStep(1);
    }
  }, []);

  useEffect(() => {
    if (!form.serviceName && serviceOptions[0]?.name)
      set("serviceName", serviceOptions[0].name);
  }, [form.serviceName, serviceOptions]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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

  const canContinueFromSchedule = Boolean(
    form.serviceName && form.appointmentDate && form.appointmentTime
  );
  const canContinueFromDetails = Boolean(
    form.clientName && form.clientEmail && form.clientPhone
  );
  const canContinueFromAddress = Boolean(
    form.addressLine1 && form.city && form.postcode
  );

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">Appointment booking</p>
        <h1 className="serif mt-4 text-5xl font-bold md:text-6xl">
          Choose a style, then move step by step to your{" "}
          <span className="gold-text">£20 secure deposit.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-white/70">
          The booking now works like a guided journey. Pick your hairstyle first,
          then continue through date, details, address, and Stripe payment without
          being shown every field at once.
        </p>

        <div className="mt-9 grid gap-3 sm:grid-cols-5">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => index <= step && goToStep(index)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                index === step
                  ? "border-primary bg-primary/20 text-primary"
                  : index < step
                    ? "border-primary/35 bg-primary/10 text-white/80"
                    : "border-white/10 bg-white/[0.035] text-white/40"
              }`}
            >
              <span className="block text-xs uppercase tracking-[0.22em] text-white/45">
                Step {index + 1}
              </span>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-10">
          {step === 0 ? (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {(serviceOptions.length ? serviceOptions : [{ id: "fallback", name: "Knotless Braids", category: "Braids", priceFrom: 120, imageUrl: "/manus-storage/ebysplace_service_knotless_braids_7dbbea62.png", duration: "3-5 hours" }]).map(service => (
                <button
                  key={service.id ?? service.slug ?? service.name}
                  type="button"
                  onClick={() => selectStyle(service)}
                  className="group overflow-hidden rounded-[1.6rem] border border-primary/25 bg-card/75 text-left transition hover:-translate-y-1 hover:border-primary/70"
                >
                  <div className="media-portrait overflow-hidden">
                    <img
                      src={service.imageUrl}
                      alt={`${service.name} style`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/80">
                      {service.category}
                    </p>
                    <h2 className="serif mt-2 text-3xl font-bold text-white">
                      {service.name}
                    </h2>
                    <p className="mt-2 text-sm text-white/62">
                      From £{service.priceFrom} · {service.duration ?? "Consultation advised"}
                    </p>
                    <span className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-extrabold text-black">
                      Choose this style
                    </span>
                  </div>
                </button>
              ))}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="lux-card grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
              <div>
                <p className="pill w-fit">Selected style</p>
                <h2 className="serif mt-4 text-4xl font-bold text-white">
                  {form.serviceName}
                </h2>
                <p className="mt-3 text-white/65">
                  Confirm the style, then choose the best appointment date and
                  time. You can go back if you want a different style.
                </p>
                {selectedService?.imageUrl ? (
                  <div className="media-portrait mt-6 max-w-sm overflow-hidden rounded-[1.4rem] border border-primary/25">
                    <img src={selectedService.imageUrl} alt={`${form.serviceName} selected style`} />
                  </div>
                ) : null}
              </div>
              <div className="grid content-start gap-4">
                <label>
                  Service
                  <select
                    value={form.serviceName}
                    onChange={event => set("serviceName", event.target.value)}
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
                  <button type="button" className="btn-dark" onClick={() => goToStep(0)}>
                    Back to styles
                  </button>
                  <button
                    type="button"
                    className="btn-gold"
                    disabled={!canContinueFromSchedule}
                    onClick={() => goToStep(2)}
                  >
                    Continue to your details
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="lux-card grid gap-6">
              <div>
                <p className="pill w-fit">Client details</p>
                <h2 className="serif mt-4 text-4xl font-bold text-white">
                  Who is the appointment for?
                </h2>
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
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-dark" onClick={() => goToStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn-gold"
                  disabled={!canContinueFromDetails}
                  onClick={() => goToStep(3)}
                >
                  Continue to address
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="lux-card grid gap-6">
              <div>
                <p className="pill w-fit">Address and notes</p>
                <h2 className="serif mt-4 text-4xl font-bold text-white">
                  Where should the appointment be prepared for?
                </h2>
              </div>
              <div className="input-grid">
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
                <button type="button" className="btn-dark" onClick={() => goToStep(2)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn-gold"
                  disabled={!canContinueFromAddress}
                  onClick={() => goToStep(4)}
                >
                  Review and pay deposit
                </button>
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="lux-card grid gap-6 lg:grid-cols-[1fr_.85fr]">
              <div>
                <p className="pill w-fit">Final step</p>
                <h2 className="serif mt-4 text-4xl font-bold text-white">
                  Review your appointment and continue to Stripe.
                </h2>
                <div className="mt-6 grid gap-3 text-white/72">
                  <p><strong className="text-primary">Style:</strong> {form.serviceName}</p>
                  <p><strong className="text-primary">Appointment:</strong> {form.appointmentDate} at {form.appointmentTime}</p>
                  <p><strong className="text-primary">Client:</strong> {form.clientName} · {form.clientEmail} · {form.clientPhone}</p>
                  <p><strong className="text-primary">Address:</strong> {form.addressLine1}, {form.city}{form.county ? `, ${form.county}` : ""}, {form.postcode}</p>
                  {form.deliveryNote ? <p><strong className="text-primary">Notes:</strong> {form.deliveryNote}</p> : null}
                </div>
                <div className="mt-7 rounded-2xl border border-primary/30 bg-primary/10 p-5 text-primary">
                  Stripe Checkout opens next for a £20 non-refundable deposit.
                  This deposit secures the requested appointment and is clearly
                  marked before payment.
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" className="btn-dark" onClick={() => goToStep(3)}>
                    Back
                  </button>
                  <button
                    className="btn-gold"
                    disabled={create.isPending || checkout.isPending || servicesLoading}
                  >
                    {checkout.isPending ? "Opening Stripe…" : "Continue to £20 Deposit"}
                  </button>
                </div>
                {create.error && (
                  <p className="mt-4 text-destructive">{create.error.message}</p>
                )}
                {checkout.error && (
                  <p className="mt-4 text-destructive">{checkout.error.message}</p>
                )}
              </div>
              {selectedService?.imageUrl ? (
                <div className="media-portrait overflow-hidden rounded-[1.4rem] border border-primary/25">
                  <img src={selectedService.imageUrl} alt={`${form.serviceName} booking review`} />
                </div>
              ) : null}
            </section>
          ) : null}
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
