import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { londonToday } from "@shared/rebook";

// Tap every day you're not available, then block them all in one go.
// Days that already have customers are flagged, and the confirm step can
// email each of them a "choose a new date" link.

type BlockedSlot = { date: string; time?: string; reason?: string };
type Affected = { id: number; date: string; clientName: string; serviceName: string; appointmentTime: string; depositPaid: boolean };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function BlockDaysPicker({ blockedSlots, bookingsByDate, onBlocked }: {
  blockedSlots: BlockedSlot[];
  bookingsByDate: Record<string, number>;
  onBlocked: () => void;
}) {
  const today = londonToday();
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm - 1 });
  const [chosen, setChosen] = useState<string[]>([]);
  const [oneTime, setOneTime] = useState(false);
  const [time, setTime] = useState("14:00");
  const [reason, setReason] = useState("Unavailable");
  const [confirm, setConfirm] = useState<{ bookings: Affected[]; emailAffected: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const utils = trpc.useUtils();

  const closedDays = useMemo(() => new Set(blockedSlots.filter((s) => !(s.time || "").trim()).map((s) => s.date)), [blockedSlots]);

  const block = trpc.admin.blockAvailabilityDays.useMutation({
    onSuccess: (result) => {
      const days = plural(result.blocked, "day");
      if (result.failed.length) {
        toast.warning(`Blocked ${days}. ${result.emailed.length} emailed, ${result.failed.length} not sent`, { description: `Not sent: ${result.failed.join(", ")}. Use "Send rebooking link" on their booking, or contact them.` });
      } else if (result.emailed.length) {
        toast.success(`Blocked ${days} and emailed ${plural(result.emailed.length, "customer")}`, { description: "They can choose a new date from the email. You'll get a notification when they do." });
      } else {
        toast.success(`Blocked ${days}`);
      }
      setChosen([]);
      setConfirm(null);
      onBlocked();
    },
    onError: (error) => toast.error(error.message),
  });

  const sorted = [...chosen].sort();
  const timeArg = oneTime ? time : undefined;

  const toggle = (iso: string) => {
    setConfirm(null);
    setChosen((current) => (current.includes(iso) ? current.filter((d) => d !== iso) : [...current, iso]));
  };

  const start = async () => {
    if (!sorted.length) return;
    setChecking(true);
    try {
      const affected = await utils.admin.bookingsOnDates.fetch({ dates: sorted, time: timeArg });
      if (!affected.length) {
        block.mutate({ dates: sorted, time: timeArg, reason, emailAffected: false });
        return;
      }
      setConfirm({ bookings: affected, emailAffected: true });
    } catch (error: any) {
      toast.error(error?.message || "Couldn't check those days' bookings.");
    } finally {
      setChecking(false);
    }
  };

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const atThisMonth = view.y === ty && view.m === tm - 1;
  const move = (delta: number) => setView(({ y, m }) => {
    const d = new Date(Date.UTC(y, m + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });
  const dayWord = sorted.length > 1 ? `${sorted.length} days` : "day";

  return (
    <div className="mt-5 grid gap-3 rounded-2xl border border-[#C9A84C]/40 bg-white p-4 text-[#1A1A1A]">
      <div className="flex items-center justify-between gap-2">
        <b className="text-base">{monthLabel}</b>
        <div className="flex gap-2">
          <button type="button" className="rounded-full border border-[#1A1A1A]/25 bg-white p-2 text-[#1A1A1A] disabled:opacity-40" onClick={() => move(-1)} disabled={atThisMonth} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className="rounded-full border border-[#1A1A1A]/25 bg-white p-2 text-[#1A1A1A]" onClick={() => move(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-[#6B6458]">
        {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = isoOf(view.y, view.m, i + 1);
          const past = iso < today;
          const closed = closedDays.has(iso);
          const on = chosen.includes(iso);
          const booked = bookingsByDate[iso] || 0;
          const base = "flex min-h-[52px] flex-col items-start gap-0.5 rounded-xl border p-1.5 text-left sm:min-h-[60px]";
          const look = past
            ? "cursor-not-allowed border-transparent bg-[#F4F1EB] text-[#A39C90]"
            : closed
              ? "cursor-not-allowed border-transparent bg-[#E6E1D8] text-[#4A443B]"
              : on
                ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                : "border-[#1A1A1A]/15 bg-white text-[#1A1A1A] hover:border-[#C9A84C]";
          return (
            <button
              key={iso}
              type="button"
              disabled={past || closed}
              aria-pressed={on}
              aria-label={`${shortDay(iso)}${closed ? ", already blocked" : ""}${booked ? `, ${booked} booked` : ""}`}
              onClick={() => toggle(iso)}
              className={`${base} ${look} ${iso === today ? "outline outline-2 -outline-offset-2 outline-[#C9A84C]" : ""}`}
            >
              <span className="text-sm font-bold">{i + 1}</span>
              <span className={`text-[10px] leading-tight sm:text-[11px] ${on ? "text-[#F3E3B5]" : closed ? "font-semibold" : "text-[#6B6458]"}`}>
                {closed ? "Closed" : booked && !past ? `${booked} booked` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[#6B6458]">Tap each day you&rsquo;re not available. Tap again to undo. Grey days are already blocked.</p>

      <div className="grid gap-3 rounded-xl border border-[#C9A84C]/40 bg-[#FFFCF6] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <b>{sorted.length ? `${plural(sorted.length, "day")} chosen` : "No days chosen yet"}</b>
          {sorted.length ? <button type="button" className="rounded-full border border-[#1A1A1A]/25 bg-white px-3 py-0.5 text-xs font-semibold text-[#1A1A1A]" onClick={() => { setChosen([]); setConfirm(null); }}>Clear</button> : null}
        </div>
        {sorted.length ? (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((d) => <span key={d} className="rounded-full bg-[#1A1A1A] px-2.5 py-0.5 text-xs font-semibold text-white">{shortDay(d)}</span>)}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-semibold">Block
            <select value={oneTime ? "time" : "day"} onChange={(event) => { setOneTime(event.target.value === "time"); setConfirm(null); }}>
              <option value="day">All day</option>
              <option value="time">Just one time</option>
            </select>
          </label>
          {oneTime ? <label className="grid gap-1 text-sm font-semibold">Time<input type="time" value={time} onChange={(event) => { setTime(event.target.value); setConfirm(null); }} /></label> : null}
          <label className="grid min-w-[10rem] flex-1 gap-1 text-sm font-semibold">Reason<input value={reason} maxLength={120} onChange={(event) => setReason(event.target.value)} /></label>
          <button className="btn-gold py-2" type="button" disabled={!sorted.length || checking || block.isPending} onClick={() => void start()}>
            {checking ? "Checking…" : `Block ${dayWord}`}
          </button>
        </div>
      </div>

      {confirm ? (
        <div className="grid gap-2 rounded-xl border border-[#E7C873] bg-[#FFF6DD] p-4 text-sm text-[#5E4512]" role="dialog" aria-label="Confirm blocking">
          <b className="text-[#1A1A1A]">Block {plural(sorted.length, "day")}{oneTime ? ` at ${time}` : ""}?</b>
          <span>{confirm.bookings.length === 1 ? "1 customer is" : `${confirm.bookings.length} customers are`} booked on {sorted.length === 1 ? "this day" : "these days"}:</span>
          <ul className="grid gap-1">
            {confirm.bookings.map((b) => <li key={b.id} className="rounded-lg border border-[#E7C873] bg-white px-3 py-2 text-[#1A1A1A]">{shortDay(b.date)}: {b.clientName} · {b.serviceName} · {b.appointmentTime}{b.depositPaid ? " · £20 paid" : ""}</li>)}
          </ul>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={confirm.emailAffected} onChange={(event) => setConfirm({ ...confirm, emailAffected: event.target.checked })} />
            <span>Email them our apology with a &ldquo;Choose a new date&rdquo; link. A paid deposit moves with them, they get one reminder after 24 hours, and you get an alert the day before to call them.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold py-2 text-sm" type="button" disabled={block.isPending} onClick={() => block.mutate({ dates: sorted, time: timeArg, reason, emailAffected: confirm.emailAffected })}>
              {block.isPending ? "Working…" : confirm.emailAffected ? `Block ${dayWord} and email ${plural(confirm.bookings.length, "customer")}` : "Block without emailing"}
            </button>
            <button className="btn-dark py-2 text-sm" type="button" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
