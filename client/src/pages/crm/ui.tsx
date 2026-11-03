import type { ReactNode } from "react";

/**
 * Small building blocks for the CRM pages, in the Eby's Place admin palette:
 * warm off-white ground, white cards, hairline borders, gold for action.
 * Status colours (green live / blue new / amber waiting / red problem) are
 * separate from the gold accent so state reads at a glance.
 */

export const crm = {
  ground: "bg-[#F6F5F2]",
  card: "rounded-2xl border border-[#E6E1D8] bg-white",
  muted: "text-[#6B6458]",
  ink: "text-[#1A1A1A]",
};

export function Card({ title, action, children, className = "", id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`${crm.card} min-w-0 p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            // Inline style: the site-wide heading style (big serif on phones) must not apply to card titles.
            <h2 className="text-[#1A1A1A]" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 0, lineHeight: 1.4 }}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, onClick }: { label: string; value: ReactNode; hint?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="text-[28px] font-bold leading-tight tabular-nums text-[#1A1A1A]">{value}</div>
      <div className="text-[13px] text-[#6B6458]">{label}</div>
      {hint ? <div className="mt-1 text-xs text-[#8A641E]">{hint}</div> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${crm.card} min-w-0 p-4 text-left transition hover:border-[#C9A84C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]`}>
      {body}
    </button>
  ) : (
    <div className={`${crm.card} min-w-0 p-4`}>{body}</div>
  );
}

const PILL = {
  gold: "bg-[#F3EBDC] text-[#8A641E]",
  live: "bg-[#E3F2E8] text-[#1E7A46]",
  new: "bg-[#E4EDFA] text-[#1F5FB8]",
  wait: "bg-[#FBEFD9] text-[#9A5B00]",
  bad: "bg-[#FBE4E1] text-[#B3261E]",
  grey: "bg-[#EFEDE8] text-[#6B6458]",
} as const;

export type PillTone = keyof typeof PILL;

export function Pill({ tone = "gold", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tone]}`}>{children}</span>;
}

export function Toggle({ checked, onChange, disabled, label, id }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[#1E7A46]" : "bg-[#D9D4CB]"}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function Row({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const cls = `flex min-w-0 items-center gap-3 border-t border-[#EFEBE4] py-3 first:border-t-0 first:pt-0 last:pb-0 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} w-full text-left transition hover:bg-[#FBF8F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]`}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[#F3EBDC] font-bold text-[#8A641E]" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

export function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] ${active ? "border-[#1A1A1A] !bg-[#1A1A1A] !text-white" : "border-[#E6E1D8] !bg-white !text-[#1A1A1A] hover:border-[#C9A84C]"}`}
    >
      {children}
      {count !== undefined ? <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-[#6B6458]"}`}>{count}</span> : null}
    </button>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-full !border-0 !bg-[#1A1A1A] px-4 py-2 text-[13px] font-semibold !text-white !shadow-none transition hover:bg-[#333] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled, href }: { children: ReactNode; onClick?: () => void; disabled?: boolean; href?: string }) {
  const cls = "inline-flex items-center justify-center gap-2 rounded-full border border-[#E6E1D8] bg-white px-4 py-2 text-[13px] font-semibold text-[#1A1A1A] transition hover:border-[#C9A84C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] disabled:cursor-not-allowed disabled:opacity-50";
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[#E6E1D8] bg-[#FBF8F2] px-4 py-6 text-center text-sm text-[#6B6458]">{children}</p>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#EFEBE4]" />
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: { message: string } | null | undefined }) {
  if (!error) return null;
  return <p className="rounded-xl border border-[#F2C9C4] bg-[#FBE4E1] px-4 py-3 text-sm text-[#B3261E]">Couldn't load this: {error.message}</p>;
}

export const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function niceDate(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!date) return "–";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { ...opts, timeZone: "Europe/London" });
}

export function niceDateTime(value: string | Date | null | undefined) {
  if (!value) return "–";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function relativeDays(date: string | null | undefined, today: string) {
  if (!date) return null;
  const n = Math.round((Date.parse(`${date.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 1 && n < 14) return `in ${n} days`;
  if (n < -1 && n > -60) return `${-n} days ago`;
  if (n <= -60) return `${Math.round(-n / 7)} weeks ago`;
  return `in ${Math.round(n / 7)} weeks`;
}

/** WhatsApp click-to-chat link for a UK number; Eby presses send herself. */
export function whatsappLink(phone: string | null | undefined, text = "") {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `44${d.slice(1)}`;
  if (d.length < 10) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const STAGE_LABEL: Record<string, string> = {
  enquiry: "Enquiry",
  booked: "Booked",
  deposit_paid: "Deposit paid",
  done: "Done",
  review_asked: "Review asked",
  due_rebook: "Due a rebook",
};

export const STATUS_TONE: Record<string, PillTone> = {
  pending: "wait",
  confirmed: "live",
  completed: "grey",
  cancelled: "bad",
  paid: "live",
  fulfilling: "wait",
  shipped: "live",
  posted: "live",
  ready: "new",
  publishing: "wait",
  partial: "wait",
  failed: "bad",
  new: "wait",
};
