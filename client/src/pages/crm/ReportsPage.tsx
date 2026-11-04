import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { goCrm } from "./nav";
import { Card, Chip, Empty, ErrorNote, GhostButton, Kpi, Loading, Pill, PrimaryButton, gbp, niceDateTime, type PillTone } from "./ui";

const INK = "#1A1A1A";
const GOLD = "#C9A84C";
const BROWN = "#8A641E";
const BLUE = "#1F5FB8";
const SOFT = "#D9D4CB";
const GRID = "#EFEBE4";
const AXIS = "#6B6458";

const PERIODS = [
  { id: "month", label: "This month", compare: "on last month" },
  { id: "3m", label: "3 months", compare: "on the 3 months before" },
  { id: "12m", label: "12 months", compare: "on the 12 months before" },
] as const;
type Period = (typeof PERIODS)[number]["id"];

const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const monthLong = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const tooltipStyle = { borderRadius: 10, border: "1px solid #E6E1D8", fontSize: 12, color: INK };

/** "+18% on last month", "About the same", or nothing to compare yet. */
function trend(now: number | null, before: number | null, compare: string, money = false) {
  if (now === null || before === null || before === 0) return now ? "Nothing to compare yet" : undefined;
  const diff = now - before;
  if (Math.abs(diff) / before < 0.03) return "About the same";
  if (money) return `${diff > 0 ? "+" : "−"}${gbp(Math.abs(Math.round(diff)))} ${compare}`;
  return `${diff > 0 ? "+" : "−"}${Math.round((Math.abs(diff) / before) * 100)}% ${compare}`;
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#6B6458]">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function TableFallback({ rows, cols }: { rows: Array<Record<string, any>>; cols: Array<{ key: string; label: string }> }) {
  return (
    <details className="mt-2 text-[13px]">
      <summary className="cursor-pointer font-semibold text-[#8A641E]">Show as a table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse">
          <thead>
            <tr>
              <th className="border-b border-[#E6E1D8] px-1.5 py-1 text-left font-semibold text-[#6B6458]">Month</th>
              {cols.map((c) => (
                <th key={c.key} className="border-b border-[#E6E1D8] px-1.5 py-1 text-left font-semibold text-[#6B6458]">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="px-1.5 py-1">{monthLong(r.month)}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-1.5 py-1 tabular-nums">
                    {r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const ACTIVITY_TONE: Record<string, { label: string; tone: PillTone }> = {
  booking: { label: "Booking", tone: "live" },
  payment: { label: "Payment", tone: "live" },
  shop: { label: "Order", tone: "new" },
  review: { label: "Review", tone: "wait" },
  chat: { label: "Chat", tone: "new" },
  newsletter: { label: "List", tone: "grey" },
  social: { label: "Social", tone: "gold" },
  ai_try_on: { label: "Try-on", tone: "gold" },
  kouvia: { label: "Kouvia", tone: "gold" },
};

function downloadCsv(months: Array<Record<string, any>>) {
  const header = ["Month", "Appointments", "Done", "Booked not yet done", "Website visits", "Visits from Instagram"];
  const lines = months.map((m) => [monthLong(m.month), m.bookings, m.completed, m.upcoming, m.visits, m.instagramVisits].join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ebysplace-report-${months.at(-1)?.month ?? "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>("12m");
  const q = trpc.crm.reports.useQuery({ period }, { retry: false, placeholderData: (prev) => prev });
  const meta = PERIODS.find((p) => p.id === period)!;

  const controls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Time period">
        {PERIODS.map((p) => (
          <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </Chip>
        ))}
      </div>
      <GhostButton disabled={!q.data} onClick={() => q.data && downloadCsv(q.data.months)}>
        Download CSV
      </GhostButton>
    </div>
  );

  if (q.isLoading) return <div className="grid gap-4">{controls}<Loading /></div>;
  if (q.error) return <div className="grid gap-4">{controls}<ErrorNote error={q.error} /></div>;
  const d = q.data!;
  const k = d.kpis;
  const top = d.topStyles[0];
  const busiest = d.months.reduce((a, b) => (b.bookings > a.bookings ? b : a), d.months[0]);
  const quietest = d.months.filter((m) => m.bookings > 0).reduce((a, b) => (b.bookings < a.bookings ? b : a), busiest);
  const recentVisits = d.months.slice(-6).map((m) => ({ ...m, otherVisits: Math.max(0, m.visits - m.instagramVisits) }));
  const funnelTop = d.funnel?.[0]?.n ?? 0;
  const biggestDrop = d.funnel
    ? d.funnel.slice(1).reduce<{ from: string; to: string; lost: number } | null>((worst, step, i) => {
        const prev = d.funnel![i];
        const lost = prev.n ? (prev.n - step.n) / prev.n : 0;
        return !worst || lost > worst.lost ? { from: prev.step, to: step.step, lost } : worst;
      }, null)
    : null;

  return (
    <div className="grid gap-4">
      {controls}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Appointments" value={k.appointments.now.toLocaleString("en-GB")} hint={trend(k.appointments.now, k.appointments.before, meta.compare)} />
        <Kpi label="Paid online" value={gbp(k.paidOnline.now)} hint={trend(k.paidOnline.now, k.paidOnline.before, meta.compare, true)} />
        <Kpi label="Average payment online" value={k.averagePayment.now === null ? "–" : gbp(k.averagePayment.now)} hint={trend(k.averagePayment.now, k.averagePayment.before, meta.compare)} />
        <Kpi label="Clients who came back" value={d.rebookRate === null ? "–" : `${d.rebookRate}%`} hint="All time" />
        <Kpi label="Usual gap between visits" value={d.averageGapDays === null ? "–" : `${Math.round(d.averageGapDays / 7)} weeks`} hint="All time" />
        <Kpi label="Visits from Instagram" value={k.instagramVisits.now.toLocaleString("en-GB")} hint={trend(k.instagramVisits.now, k.instagramVisits.before, meta.compare)} />
      </div>

      <Card title="Appointments per month" action={<Legend items={[{ label: "Done", color: INK }, { label: "Booked, not yet done", color: GOLD }]} />}>
        {d.months.every((m) => m.bookings === 0) ? (
          <Empty>No appointments in the last 12 months yet.</Empty>
        ) : (
          <>
            <p className="-mt-2 mb-2 text-[13px] text-[#6B6458]">
              Busiest: {monthLong(busiest.month)} ({busiest.bookings}). Quietest: {monthLong(quietest.month)} ({quietest.bookings}).
            </p>
            <div className="h-60 w-full" role="img" aria-label="Appointments per month for the last 12 months, done and booked">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.months} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} barCategoryGap={6}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip cursor={{ fill: "rgba(138,100,30,0.08)" }} labelFormatter={(m: string) => monthLong(m)} contentStyle={tooltipStyle} />
                  <Bar dataKey="completed" name="Done" stackId="a" fill={INK} maxBarSize={36} />
                  <Bar dataKey="upcoming" name="Booked, not yet done" stackId="a" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <TableFallback rows={d.months} cols={[{ key: "completed", label: "Done" }, { key: "upcoming", label: "Booked, not yet done" }]} />
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Most booked styles">
          <p className="-mt-2 mb-3 text-[13px] text-[#6B6458]">{meta.label}. Use this to choose what to post and promote.</p>
          {!top ? (
            <Empty>No bookings in this period yet.</Empty>
          ) : (
            <ol className="grid gap-2.5">
              {d.topStyles.map((s) => (
                <li key={s.name} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.5rem] items-center gap-2.5 text-sm">
                  <span className="min-w-0 truncate">{s.name}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-[#F3EBDC]" aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (s.bookings / top.bookings) * 100)}%`, background: BROWN }} />
                  </div>
                  <span className="text-right font-semibold tabular-nums">{s.bookings}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Clients">
          <p className="-mt-2 mb-3 text-[13px] text-[#6B6458]">One person each, across bookings, shop orders, chats and your list.</p>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { n: d.clients.total, label: "clients in total", go: "clients" },
              { n: d.clients.newThisMonth, label: "new this month", go: "clients:new_this_month" },
              { n: d.clients.dueRebook, label: "due a rebook", go: "clients:due_rebook" },
            ].map((t) => (
              <button key={t.label} type="button" onClick={() => goCrm(t.go)} className="rounded-xl bg-[#FBF8F2] p-3 text-left transition hover:bg-[#F3EBDC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]">
                <div className="text-[22px] font-bold tabular-nums text-[#1A1A1A]">{t.n}</div>
                <div className="text-xs text-[#6B6458]">{t.label}</div>
              </button>
            ))}
          </div>
          {d.clients.dueRebook > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#EFEBE4] pt-3">
              <span className="text-sm">
                {d.clients.dueRebook} {d.clients.dueRebook === 1 ? "client is" : "clients are"} past their usual gap between visits.
              </span>
              <PrimaryButton onClick={() => goCrm("campaigns")}>Email them</PrimaryButton>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Website visits" action={<Legend items={[{ label: "From Instagram", color: BLUE }, { label: "Other visits", color: SOFT }]} />}>
          <p className="-mt-2 mb-2 text-[13px] text-[#6B6458]">Last 6 months. Only visitors who allowed analytics cookies are counted.</p>
          {recentVisits.every((m) => m.visits === 0) ? (
            <Empty>No visits recorded yet.</Empty>
          ) : (
            <>
              <div className="h-48 w-full" role="img" aria-label="Website visits per month for the last 6 months, with visits from Instagram">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recentVisits} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} barCategoryGap={10}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip cursor={{ fill: "rgba(31,95,184,0.06)" }} labelFormatter={(m: string) => monthLong(m)} contentStyle={tooltipStyle} />
                    <Bar dataKey="instagramVisits" name="From Instagram" stackId="v" fill={BLUE} maxBarSize={40} />
                    <Bar dataKey="otherVisits" name="Other visits" stackId="v" fill={SOFT} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <TableFallback rows={recentVisits} cols={[{ key: "visits", label: "All visits" }, { key: "instagramVisits", label: "From Instagram" }]} />
            </>
          )}
        </Card>

        <Card title="From visit to booking · this month" action={<Pill tone="new">New</Pill>}>
          <p className="-mt-2 mb-3 text-[13px] text-[#6B6458]">Where people drop off on the way to paying a deposit.</p>
          {!d.funnel || funnelTop === 0 ? (
            <Empty>Not enough visits this month yet.</Empty>
          ) : (
            <>
              <ol className="grid gap-3">
                {d.funnel.map((f) => (
                  <li key={f.step} className="grid gap-1">
                    <div className="flex justify-between text-sm">
                      <span>{f.step}</span>
                      <strong className="tabular-nums">{f.n.toLocaleString("en-GB")}</strong>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-[#EFEDE8]" aria-hidden="true">
                      <div className="h-full rounded-full bg-[#1A1A1A]" style={{ width: `${Math.max(2, Math.min(100, (f.n / funnelTop) * 100))}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
              {biggestDrop && biggestDrop.lost > 0 ? (
                <p className="mt-3 text-[13px] text-[#6B6458]">
                  Biggest drop: {biggestDrop.from} to {biggestDrop.to.toLowerCase()}.
                </p>
              ) : null}
            </>
          )}
        </Card>
      </div>

      <Card title="Recent activity" action={<GhostButton onClick={() => goCrm("activity")}>See everything</GhostButton>}>
        {d.recentActivity.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <ul className="grid grid-cols-1">
            {d.recentActivity.map((a) => {
              const t = ACTIVITY_TONE[a.activityCategory] ?? { label: a.status === "failed" ? "Problem" : "Update", tone: (a.status === "failed" ? "bad" : "grey") as PillTone };
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 border-t border-[#EFEBE4] py-2.5 first:border-t-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Pill tone={t.tone}>{t.label}</Pill>
                    <span className="min-w-0 truncate text-sm">{a.description}</span>
                  </div>
                  <span className="shrink-0 text-xs text-[#6B6458]">{niceDateTime(a.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
