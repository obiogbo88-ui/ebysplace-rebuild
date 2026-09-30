// Plain-English deposit state for the admin bookings table. "checkout_started" means the
// customer opened Stripe but never paid, so it must not read as a payment.
export function bookingDepositLabel(depositStatus?: string | null) {
  switch (depositStatus) {
    case "paid":
      return { label: "Paid", tone: "paid" as const };
    case "refunded":
      return { label: "Refunded", tone: "muted" as const };
    case "failed":
      return { label: "Payment failed", tone: "warn" as const };
    default:
      return { label: "Not paid", tone: "warn" as const };
  }
}

// True when the appointment date (YYYY-MM-DD) is before today in UK time.
export function isPastAppointment(appointmentDate?: string | null, today = new Date()) {
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return false;
  const todayKey = today.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return appointmentDate < todayKey;
}
