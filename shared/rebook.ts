/**
 * Rebooking rules shared by the "Choose a new date" page and the server.
 *
 * Opening hours follow the Google listing (Mon–Fri 09:30–21:00, Sat 07:00–23:00,
 * Sun 16:00–23:00). Start times stop 3 hours before closing so a long style
 * still finishes inside opening hours.
 */

export const REBOOK_WINDOW_DAYS = 60;

type BlockedSlot = { date: string; time?: string | null };
type TakenSlot = { date: string; time: string };

const OPENING: Record<number, { open: string; lastStart: string }> = {
  0: { open: "16:00", lastStart: "20:00" }, // Sunday
  1: { open: "09:30", lastStart: "18:00" },
  2: { open: "09:30", lastStart: "18:00" },
  3: { open: "09:30", lastStart: "18:00" },
  4: { open: "09:30", lastStart: "18:00" },
  5: { open: "09:30", lastStart: "18:00" },
  6: { open: "07:00", lastStart: "20:00" }, // Saturday
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Day of week for a YYYY-MM-DD date, independent of the runtime's time zone. */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Today's date in Bridgwater (Europe/London), as YYYY-MM-DD. */
export function londonToday(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Start times offered on a date: on the hour, plus the opening time if it's on the half hour. */
export function startTimesFor(date: string) {
  const hours = OPENING[weekdayOf(date)];
  const times: string[] = [];
  const open = toMinutes(hours.open);
  const last = toMinutes(hours.lastStart);
  if (open % 60 !== 0) times.push(hours.open);
  for (let t = Math.ceil(open / 60) * 60; t <= last; t += 60) times.push(fromMinutes(t));
  return times;
}

/** "Saturday 7 November" */
export function formatLongDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function isDayBlocked(date: string, blocked: BlockedSlot[]) {
  return blocked.some((slot) => slot.date === date && !(slot.time || "").trim());
}

export function isTimeUnavailable(date: string, time: string, blocked: BlockedSlot[], taken: TakenSlot[]) {
  return blocked.some((slot) => slot.date === date && (!(slot.time || "").trim() || slot.time === time))
    || taken.some((slot) => slot.date === date && slot.time === time);
}

/**
 * Why a new date/time can't be used, or null when it can. `taken` must not
 * include the booking being moved.
 */
export function rebookSlotProblem(input: { date: string; time: string; blocked: BlockedSlot[]; taken: TakenSlot[]; now?: Date }) {
  const { date, time } = input;
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return "Please choose a day and a time.";
  const today = londonToday(input.now);
  if (date <= today) return "Please choose a day from tomorrow onwards.";
  if (date > addDays(today, REBOOK_WINDOW_DAYS)) return `Please choose a day within the next ${REBOOK_WINDOW_DAYS} days, or reply to our email and we'll arrange a later date.`;
  if (!startTimesFor(date).includes(time)) return "That time is outside our opening hours. Please choose another.";
  if (isTimeUnavailable(date, time, input.blocked, input.taken)) return "Sorry, that time has just been taken. Please choose another.";
  return null;
}
