import * as db from "./db";
import { londonDateString, resolveSeasonalTheme, SNOW_FALLBACK_MONTH_DAY, winterKey, type SeasonalTheme } from "../shared/seasonal";

// Places across England, lowland towns plus the upland ones that usually see the first snow.
// Open-Meteo is free and needs no key; snowfall_sum is in cm per day.
export const ENGLAND_SNOW_LOCATIONS = [
  { name: "Bridgwater", lat: 51.128, lon: -3.003 },
  { name: "Exeter", lat: 50.718, lon: -3.534 },
  { name: "Bristol", lat: 51.455, lon: -2.588 },
  { name: "London", lat: 51.507, lon: -0.128 },
  { name: "Norwich", lat: 52.63, lon: 1.297 },
  { name: "Birmingham", lat: 52.486, lon: -1.89 },
  { name: "Manchester", lat: 53.481, lon: -2.243 },
  { name: "Buxton", lat: 53.259, lon: -1.911 },
  { name: "Leeds", lat: 53.801, lon: -1.549 },
  { name: "York", lat: 53.96, lon: -1.08 },
  { name: "Keswick", lat: 54.6, lon: -3.134 },
  { name: "Durham", lat: 54.776, lon: -1.576 },
  { name: "Newcastle", lat: 54.978, lon: -1.618 },
];

// Ignore model trace amounts so a single flake in the data does not start winter.
export const SNOW_THRESHOLD_CM = 0.2;
const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;

let lastCheck: { key: string; at: number } | null = null;

type OpenMeteoDaily = { daily?: { time?: string[]; snowfall_sum?: (number | null)[] } };

/** Earliest day since 1 Oct this winter with real snow at any England location, or null. */
export async function detectFirstSnowInEngland(winterYear: number, fetchImpl: typeof fetch = fetch, today: string = londonDateString()): Promise<string | null> {
  const params = new URLSearchParams({
    latitude: ENGLAND_SNOW_LOCATIONS.map((l) => l.lat).join(","),
    longitude: ENGLAND_SNOW_LOCATIONS.map((l) => l.lon).join(","),
    daily: "snowfall_sum",
    past_days: "92",
    forecast_days: "1",
    timezone: "Europe/London",
  });
  const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);
  const body = (await response.json()) as OpenMeteoDaily | OpenMeteoDaily[];
  const seasonStart = `${winterYear}-10-01`;
  let first: string | null = null;
  for (const place of Array.isArray(body) ? body : [body]) {
    const days = place.daily?.time ?? [];
    const snow = place.daily?.snowfall_sum ?? [];
    days.forEach((day, i) => {
      if (day < seasonStart || day > today) return;
      if ((snow[i] ?? 0) >= SNOW_THRESHOLD_CM && (!first || day < first)) first = day;
    });
  }
  return first;
}

export async function getSeasonalTheme(): Promise<{ enabled: boolean; theme: SeasonalTheme; firstSnowDate: string | null }> {
  const settings = await db.getSeasonalSettings();
  const today = londonDateString();
  const winter = winterKey(today);
  let firstSnowDate = winter === null ? null : settings.firstSnow[String(winter)] ?? null;

  const month = Number(today.slice(5, 7));
  const needsCheck = winter !== null && month >= 10 && !firstSnowDate && today.slice(5) < SNOW_FALLBACK_MONTH_DAY;
  if (needsCheck) {
    const key = `${winter}:${today}`;
    if (!lastCheck || lastCheck.key !== key || Date.now() - lastCheck.at > CHECK_INTERVAL_MS) {
      lastCheck = { key, at: Date.now() };
      try {
        const detected = await detectFirstSnowInEngland(winter);
        if (detected) {
          firstSnowDate = detected;
          await db.updateSeasonalSettings({ firstSnow: { ...settings.firstSnow, [String(winter)]: detected } });
          console.info("[Seasonal] First snow in England this winter", { winter, detected });
        }
      } catch (error) {
        console.warn("[Seasonal] Snow check failed; keeping the current season", error);
      }
    }
  }

  return { enabled: settings.enabled, theme: settings.enabled ? resolveSeasonalTheme(today, firstSnowDate) : "none", firstSnowDate };
}
