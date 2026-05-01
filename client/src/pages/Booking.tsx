import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

const initial = { serviceName: "Knotless Braids", clientName: "", clientEmail: "", clientPhone: "", addressLine1: "", city: "", county: "", postcode: "", deliveryNote: "", appointmentDate: "", appointmentTime: "10:00" };

export default function Booking() {
  const [form, setForm] = useState(initial);
  const create = trpc.public.createBooking.useMutation();
  const checkout = trpc.public.createDepositCheckout.useMutation();
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const booking = await create.mutateAsync(form);
      toast.message("Opening Stripe Checkout", { description: "Your £20 non-refundable deposit page will open in a new tab." });
      const session = await checkout.mutateAsync({ bookingId: booking.bookingId, clientEmail: form.clientEmail, clientName: form.clientName, serviceName: form.serviceName });
      if (session.checkoutUrl) window.open(session.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Booking could not be completed", { description: error instanceof Error ? error.message : "Please check the form and try again." });
    }
  }
  return <div className="luxury-shell"><SiteHeader /><main className="container section-pad"><p className="pill w-fit">Appointment booking</p><h1 className="serif mt-4 text-5xl font-bold md:text-6xl">Secure your appointment with a <span className="gold-text">£20 non-refundable deposit.</span></h1><p className="mt-4 max-w-3xl text-white/65">Choose your style, date, time, client details, and address. The final step is a Stripe-hosted payment page for the exact £20 deposit.</p><form onSubmit={submit} className="lux-card mt-10 grid gap-6"><div className="input-grid"><label>Service<select value={form.serviceName} onChange={(event) => set("serviceName", event.target.value)}><option>Knotless Braids</option><option>Boho Goddess Braids</option><option>Senegalese Twists</option><option>Invisible Locs</option><option>Kids Cornrows</option></select></label><label>Date<input type="date" required value={form.appointmentDate} onChange={(event) => set("appointmentDate", event.target.value)} /></label><label>Time<input type="time" required value={form.appointmentTime} onChange={(event) => set("appointmentTime", event.target.value)} /></label><label>Name<input required value={form.clientName} onChange={(event) => set("clientName", event.target.value)} /></label><label>Email<input type="email" required value={form.clientEmail} onChange={(event) => set("clientEmail", event.target.value)} /></label><label>Phone<input required value={form.clientPhone} onChange={(event) => set("clientPhone", event.target.value)} /></label><label>Address<input required value={form.addressLine1} onChange={(event) => set("addressLine1", event.target.value)} /></label><label>City<input required value={form.city} onChange={(event) => set("city", event.target.value)} /></label><label>County<input value={form.county} onChange={(event) => set("county", event.target.value)} /></label><label>Postcode<input required value={form.postcode} onChange={(event) => set("postcode", event.target.value)} /></label></div><textarea placeholder="Delivery or appointment notes" value={form.deliveryNote} onChange={(event) => set("deliveryNote", event.target.value)} /><div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 text-primary">The next step opens Stripe Checkout for a £20 non-refundable deposit. This deposit secures the requested appointment and is clearly marked before payment.</div><button className="btn-gold w-fit" disabled={create.isPending || checkout.isPending}>{checkout.isPending ? "Opening Stripe…" : "Continue to £20 Deposit"}</button>{create.error && <p className="text-destructive">{create.error.message}</p>}{checkout.error && <p className="text-destructive">{checkout.error.message}</p>}</form></main><SiteFooter /></div>;
}
