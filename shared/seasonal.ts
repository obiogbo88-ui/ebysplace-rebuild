// Seasonal hero/logo designs. Each one switches on the first time it happens in England:
// autumn leaves from 1 Sep (Met Office autumn), snow from the first real snow day recorded
// in England, festivals on their England dates. Festivals have nothing falling, except
// Christmas once it has snowed. Dates are Europe/London calendar days ("YYYY-MM-DD").

export type SeasonalTheme =
  | "none"
  | "autumn"
  | "winter"
  | "christmas"
  | "christmassnow"
  | "easter"
  | "ramadan"
  | "eid";

export const SEASONAL_THEMES: SeasonalTheme[] = ["none", "autumn", "winter", "christmas", "christmassnow", "easter", "ramadan", "eid"];

// Snow starts on 27 Dec at the latest if no snow has been recorded in England by then.
export const SNOW_FALLBACK_MONTH_DAY = "12-27";

// Moon-sighting dates as observed in the UK (first day). Estimates until each year's
// sighting is announced: check and adjust the coming year's row each January.
export const ISLAMIC_DATES: Record<number, { ramadanStart: string; eidAlFitr: string; eidAlAdha: string }> = {
  2027: { ramadanStart: "2027-02-08", eidAlFitr: "2027-03-09", eidAlAdha: "2027-05-16" },
  2028: { ramadanStart: "2028-01-28", eidAlFitr: "2028-02-26", eidAlAdha: "2028-05-05" },
  2029: { ramadanStart: "2029-01-16", eidAlFitr: "2029-02-14", eidAlAdha: "2029-04-24" },
  2030: { ramadanStart: "2030-01-05", eidAlFitr: "2030-02-04", eidAlAdha: "2030-04-13" },
};

const EID_DAYS = 3;

export function londonDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Western (Gregorian) Easter Sunday for a year, "YYYY-MM-DD". */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The winter a date belongs to (Oct–Feb), keyed by the year it starts in; null outside winter. */
export function winterKey(date: string): number | null {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (month >= 10) return year;
  if (month <= 2) return year - 1;
  return null;
}

/** Is snow falling on this date, given the first real snow day recorded in England this winter? */
export function isSnowActive(date: string, firstSnowDate: string | null): boolean {
  const month = Number(date.slice(5, 7));
  if (month === 1 || month === 2) return true;
  if (month < 10) return false;
  if (date.slice(5) >= SNOW_FALLBACK_MONTH_DAY) return true;
  return Boolean(firstSnowDate && date >= firstSnowDate);
}

function islamicTheme(date: string): SeasonalTheme | null {
  const row = ISLAMIC_DATES[Number(date.slice(0, 4))];
  if (!row) return null;
  for (const eid of [row.eidAlFitr, row.eidAlAdha]) {
    if (date >= eid && date < addDays(eid, EID_DAYS)) return "eid";
  }
  if (date >= row.ramadanStart && date < row.eidAlFitr) return "ramadan";
  return null;
}

export function resolveSeasonalTheme(date: string, firstSnowDate: string | null): SeasonalTheme {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const snow = isSnowActive(date, firstSnowDate);

  if (month === 12) return snow ? "christmassnow" : "christmas";

  const easter = easterSunday(year);
  if (date >= addDays(easter, -2) && date <= addDays(easter, 1)) return "easter";

  const islamic = islamicTheme(date);
  if (islamic) return islamic;

  if (snow) return "winter";
  if (month >= 9 && month <= 11) return "autumn";
  return "none";
}

export const SEASONAL_GREETINGS: Partial<Record<SeasonalTheme, string>> = {
  christmas: "Merry Christmas from Eby’s Place",
  christmassnow: "Merry Christmas from Eby’s Place",
  easter: "Happy Easter from Eby’s Place",
  ramadan: "Ramadan Mubarak from Eby’s Place",
  eid: "Eid Mubarak from Eby’s Place",
};
