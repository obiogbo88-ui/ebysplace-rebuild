import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { SEASONAL_GREETINGS, SEASONAL_THEMES, type SeasonalTheme } from "@shared/seasonal";

// `?seasonal-preview=christmas` (any theme) shows a design on demand, for checking it before its date.
function previewTheme(): SeasonalTheme | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("seasonal-preview");
  return value && (SEASONAL_THEMES as string[]).includes(value) ? (value as SeasonalTheme) : null;
}

export function useSeasonalTheme(): SeasonalTheme {
  const preview = useMemo(previewTheme, []);
  const query = trpc.public.seasonalTheme.useQuery(undefined, { staleTime: 30 * 60 * 1000, retry: false, refetchOnWindowFocus: false, enabled: !preview });
  return preview ?? query.data?.theme ?? "none";
}

export function seasonalGreeting(theme: SeasonalTheme): string | null {
  return SEASONAL_GREETINGS[theme] ?? null;
}

const SHAPES = {
  maple: "M12 1.5l1.7 3.9 3.1-1.3-.7 3.9 3.6-.8-1.6 3.3 3.2 1.4-3.8 1.6.9 2.4-4-.9L13 20.5h-2l-.4-5.5-4 .9.9-2.4-3.8-1.6 3.2-1.4-1.6-3.3 3.6.8-.7-3.9 3.1 1.3z",
  leaf: "M3 21C3 10 10 3 21 3c0 11-7 18-18 18z",
  snow: "M12 3a9 9 0 1 0 .01 0z",
} as const;
const VEINS: Partial<Record<keyof typeof SHAPES, string>> = { maple: "M12 20.5V9M12 13l-4-3M12 13l4-3", leaf: "M3 21L17 7M9 15l-1-5M13 11l4 1" };
const LEAF_COLOURS = ["#E8541E", "#F28C28", "#F5B841", "#C0392B", "#D9762B", "#B5651D", "#E46A2E"];

type Particle = { key: number; kind: keyof typeof SHAPES; colour: string; style: React.CSSProperties; innerStyle?: React.CSSProperties };

function buildParticles(kind: "leaves" | "snow", wide: boolean): Particle[] {
  let seed = kind === "leaves" ? 41 : 97;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const span = (min: number, max: number) => min + rand() * (max - min);
  const count = Math.round((kind === "leaves" ? 36 : 70) * (wide ? 1.8 : 1));
  return Array.from({ length: count }, (_, key) => {
    const shape: keyof typeof SHAPES = kind === "snow" ? "snow" : key % 2 ? "leaf" : "maple";
    const size = kind === "snow" ? span(3, 10) : span(20, 38) * (wide ? 1.15 : 1);
    const duration = kind === "snow" ? span(9, 18) : span(8, 15);
    return {
      key,
      kind: shape,
      colour: kind === "snow" ? "#ffffff" : LEAF_COLOURS[Math.floor(rand() * LEAF_COLOURS.length)],
      style: {
        left: `${(rand() * 104 - 2).toFixed(1)}%`,
        width: size,
        height: size,
        animationDuration: `${duration.toFixed(2)}s`,
        animationDelay: `-${(rand() * duration).toFixed(2)}s`,
        opacity: kind === "snow" ? 0.55 + rand() * 0.45 : 0.95,
        ["--drift" as string]: `${Math.round((rand() - 0.35) * (kind === "snow" ? 90 : 180))}px`,
      },
      innerStyle: kind === "leaves"
        ? { animationDuration: `${span(1.6, 3.2).toFixed(2)}s`, animationDelay: `-${span(0, 3).toFixed(2)}s`, ["--spin" as string]: `${Math.round(span(60, 220))}deg` }
        : undefined,
    };
  });
}

/** Leaves (autumn) or snow (winter, and Christmas once it has snowed) drifting over the hero. */
export function SeasonalFall({ theme }: { theme: SeasonalTheme }) {
  const kind = theme === "autumn" ? "leaves" : theme === "winter" || theme === "christmassnow" ? "snow" : null;
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(900);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!kind || !ref.current) return;
    const node = ref.current;
    const measure = () => { setHeight(node.offsetHeight); setWide(node.offsetWidth >= 1024); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [kind]);

  const particles = useMemo(() => (kind ? buildParticles(kind, wide) : []), [kind, wide]);
  if (!kind) return null;

  return (
    <div ref={ref} className="seasonal-fall" aria-hidden="true" data-seasonal-fall={kind} style={{ ["--fall" as string]: `${height + 90}px` }}>
      {particles.map((p) => (
        <span key={p.key} className={`seasonal-particle${kind === "snow" ? " is-snow" : ""}`} style={p.style}>
          <span className={p.innerStyle ? "seasonal-sway" : "seasonal-still"} style={p.innerStyle}>
            <svg viewBox="0 0 24 24">
              <path d={SHAPES[p.kind]} fill={p.colour} />
              {VEINS[p.kind] && <path d={VEINS[p.kind]} stroke="rgba(90,30,0,.45)" strokeWidth="0.8" fill="none" />}
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Festival touches drawn in the logo's own coordinates (the 834×448 header logo PNG), so the
 * Santa hat sits on the crown of the head, blossoms on the braid crown, crescent above "Eby’s".
 * The SVG spans 200 units above the logo, hence the -44.64% top and 144.64% height.
 */
export function SeasonalLogoDecoration({ theme }: { theme: SeasonalTheme }) {
  const hat = theme === "christmas" || theme === "christmassnow";
  const blossom = theme === "easter";
  const moon = theme === "ramadan" || theme === "eid";
  if (!hat && !blossom && !moon) return null;
  return (
    <svg className="seasonal-logo-decoration" viewBox="0 -200 834 648" aria-hidden="true" data-seasonal-logo={theme}>
      {hat && (
        <g>
          <path d="M50 66C55 -20 120 -110 215 -118C300 -124 360 -80 382 -12C350 -50 320 -60 290 -50C300 0 305 40 300 82Z" fill="#C8102E" />
          <path d="M120 -60C150 -95 190 -108 230 -110" stroke="#e8394f" strokeWidth="10" fill="none" strokeLinecap="round" opacity=".6" />
          <path d="M48 72Q176 52 308 88" stroke="#d8cdb8" strokeWidth="58" fill="none" strokeLinecap="round" />
          <path d="M48 72Q176 52 308 88" stroke="#ffffff" strokeWidth="50" fill="none" strokeLinecap="round" />
          <circle cx="385" cy="-8" r="34" fill="#d8cdb8" />
          <circle cx="385" cy="-8" r="30" fill="#ffffff" />
        </g>
      )}
      {blossom && (
        <g>
          {[[290, 62, 1], [318, 100, 1], [262, 40, 0.75], [336, 140, 0.7], [232, 24, 0.55]].map(([x, y, s]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
              <g fill="#F4A7BB">
                <circle cx="0" cy="-15" r="14" /><circle cx="14" cy="-5" r="14" /><circle cx="9" cy="12" r="14" /><circle cx="-9" cy="12" r="14" /><circle cx="-14" cy="-5" r="14" />
              </g>
              <circle r="8" fill="#F6D365" />
            </g>
          ))}
        </g>
      )}
      {moon && (
        <g transform="translate(560 40)">
          <path d="M10 -70a72 72 0 1 0 58 112a58 58 0 1 1 -58 -112z" fill="#C9A84C" />
          <path d="M78 -38l7 16 17 1-13 11 4 17-15-9-15 9 4-17-13-11 17-1z" fill="#C9A84C" />
        </g>
      )}
    </svg>
  );
}

function Lantern({ height, width, className }: { height: number; width: number; className: string }) {
  return (
    <span className={`seasonal-lantern ${className}`} style={{ width }}>
      <svg viewBox="0 0 40 110" style={{ width, height }}>
        <path d="M20 0v44" stroke="#C9A84C" strokeWidth="1.3" />
        <path d="M13 44h14l-3 6h-8z" fill="#8a641e" />
        <path d="M12 50h16c2.5 9 2.5 22 0 31H12c-2.5-9-2.5-22 0-31z" fill="#C9A84C" />
        <path d="M15 54h10c1.5 7 1.5 16 0 23H15c-1.5-7-1.5-16 0-23z" fill="#FFE9A8" />
        <path d="M20 54v23M15.5 65h9" stroke="#C9A84C" strokeWidth="1" />
        <path d="M15 81h10l-2 6h-6z" fill="#8a641e" />
        <path d="M20 87v10" stroke="#C9A84C" strokeWidth="1.4" />
      </svg>
    </span>
  );
}

/** Ramadan / Eid: gold lanterns hanging from the top of the hero. Nothing falls. */
export function SeasonalLanterns({ theme }: { theme: SeasonalTheme }) {
  if (theme !== "ramadan" && theme !== "eid") return null;
  return (
    <div className="seasonal-lanterns" aria-hidden="true" data-seasonal-lanterns={theme}>
      <Lantern width={34} height={94} className="" />
      <Lantern width={26} height={120} className="is-b" />
      <Lantern width={30} height={70} className="is-c" />
    </div>
  );
}

const TINTS: Partial<Record<SeasonalTheme, string>> = {
  autumn: "linear-gradient(180deg, rgba(200,90,20,.10), rgba(120,40,0,.12))",
  winter: "linear-gradient(180deg, rgba(205,225,245,.30), rgba(10,25,50,.30))",
  christmas: "linear-gradient(180deg, rgba(150,10,30,.14), rgba(40,0,10,.20))",
  christmassnow: "linear-gradient(180deg, rgba(150,10,30,.14), rgba(40,0,10,.22))",
  easter: "linear-gradient(180deg, rgba(255,225,235,.14), rgba(60,20,40,.06))",
  ramadan: "linear-gradient(180deg, rgba(6,38,32,.40), rgba(6,38,32,0) 45%)",
  eid: "linear-gradient(180deg, rgba(6,38,32,.40), rgba(6,38,32,0) 45%)",
};

export function SeasonalTint({ theme }: { theme: SeasonalTheme }) {
  const background = TINTS[theme];
  if (!background) return null;
  return <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background }} />;
}

export const SEASONAL_PILL_CLASSES: Partial<Record<SeasonalTheme, string>> = {
  christmas: "seasonal-pill-christmas",
  christmassnow: "seasonal-pill-christmas",
  easter: "seasonal-pill-easter",
  ramadan: "seasonal-pill-moon",
  eid: "seasonal-pill-moon",
};
