import { useMemo } from "react";
import { addDays, formatLongDate, isDayBlocked, isTimeUnavailable, startTimesFor, weekdayOf } from "@shared/rebook";

// The day strip and time grid customers use to pick an appointment. Closed
// days and times someone has already booked are crossed out and can't be
// chosen, so what a customer picks is really free.

type Slot = { date: string; time?: string };
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const BOOKING_WINDOW_DAYS = 60;

const dayNumber = (date: string) => Number(date.slice(8, 10));
const monthShort = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
};

/** Times still bookable today: at least an hour from now, London time. */
export function timesLeftToday(times: string[], nowHHMM: string) {
  const [h, m] = nowHHMM.split(":").map(Number);
  const cutoff = h * 60 + m + 60;
  return times.filter((t) => {
    const [th, tm] = t.split(":").map(Number);
    return th * 60 + tm >= cutoff;
  });
}

export function londonTimeNow(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(now);
}

export function DayTimePicker({ today, blockedSlots, taken, date, time, onChange }: {
  today: string;
  blockedSlots: Slot[];
  taken: { date: string; time: string }[];
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
}) {
  const nowHHMM = londonTimeNow();
  const timesFor = (d: string) => (d === today ? timesLeftToday(startTimesFor(d), nowHHMM) : startTimesFor(d));

  const days = useMemo(() => {
    const list: { date: string; full: boolean }[] = [];
    for (let i = 0; i < BOOKING_WINDOW_DAYS; i += 1) {
      const d = addDays(today, i);
      const times = timesFor(d);
      const full = !times.length || isDayBlocked(d, blockedSlots) || times.every((t) => isTimeUnavailable(d, t, blockedSlots, taken));
      list.push({ date: d, full });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, blockedSlots, taken]);

  const times = date ? timesFor(date) : [];

  return (
    <div className="grid min-w-0 gap-4">
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-[.16em] text-[#8a641e]">Pick a day</h3>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2" role="listbox" aria-label="Days">
          {days.map((day) => {
            const selected = day.date === date;
            return (
              <button
                key={day.date}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`${formatLongDate(day.date)}${day.full ? ", fully booked" : ""}`}
                disabled={day.full}
                onClick={() => onChange({ date: day.date, time: "" })}
                className={`flex w-16 flex-none flex-col items-center rounded-2xl border px-1 py-2 text-xs transition ${selected ? "border-black bg-black text-[#C9A84C]" : day.full ? "border-[#e2d8c6] text-[#b8ad9c] line-through" : "border-[#e2d8c6] bg-white text-[#2a1a0b] hover:border-[#8a641e]"}`}
              >
                <span>{DAY_SHORT[weekdayOf(day.date)]}</span>
                <strong className="text-lg leading-tight">{dayNumber(day.date)}</strong>
                <span>{day.full ? "Full" : monthShort(day.date)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {date ? (
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-[.16em] text-[#8a641e]">Pick a time · {formatLongDate(date)}</h3>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {times.map((t) => {
              const unavailable = isTimeUnavailable(date, t, blockedSlots, taken);
              const selected = t === time;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={selected}
                  aria-label={`${t}${unavailable ? ", taken" : ""}`}
                  onClick={() => onChange({ date, time: t })}
                  className={`rounded-xl border py-2 text-sm transition ${selected ? "border-black bg-black text-[#C9A84C]" : unavailable ? "border-[#e2d8c6] text-[#b8ad9c] line-through" : "border-[#e2d8c6] bg-white text-[#2a1a0b] hover:border-[#8a641e]"}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-4 text-xs text-[#6B6257]">
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-[#e2d8c6] bg-white" /> Free</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-[#e2d8c6] line-through">&nbsp;</span> Full or taken (crossed out)</span>
      </div>
    </div>
  );
}
