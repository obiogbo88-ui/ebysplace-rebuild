import { trpc } from "@/lib/trpc";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Empty, ErrorNote, Kpi, Loading, gbp } from "./ui";

const BAR = "#8A641E";
const GRID = "#EFEBE4";
const AXIS = "#6B6458";

const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const monthLong = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** One measure per chart (never two scales on one axis); single series, so the title names it and no legend is needed. */
function MonthBars({ data, dataKey, title, unit }: { data: Array<Record<string, any>>; dataKey: string; title: string; unit: string }) {
  const total = data.reduce((s, d) => s + Number(d[dataKey] ?? 0), 0);
  return (
    <Card title={title} action={<span className="text-xs tabular-nums text-[#6B6458]">{total.toLocaleString("en-GB")} in 12 months</span>}>
      {total === 0 ? (
        <Empty>Nothing recorded in the last 12 months yet.</Empty>
      ) : (
        <>
          <div className="h-56 w-full" role="img" aria-label={`${title}, per month for the last 12 months`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={6}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
                <Tooltip
                  cursor={{ fill: "rgba(138,100,30,0.08)" }}
                  formatter={(v: number) => [`${v.toLocaleString("en-GB")} ${unit}`, ""]}
                  labelFormatter={(m: string) => monthLong(m)}
                  separator=""
                  contentStyle={{ borderRadius: 10, border: "1px solid #E6E1D8", fontSize: 12, color: "#1A1A1A" }}
                />
                <Bar dataKey={dataKey} fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 text-[13px]">
            <summary className="cursor-pointer font-semibold text-[#8A641E]">Show as a table</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[360px] border-collapse">
                <thead>
                  <tr>
                    {data.map((d) => (
                      <th key={d.month} className="border-b border-[#E6E1D8] px-1.5 py-1 text-left font-semibold text-[#6B6458]">
                        {monthLabel(d.month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {data.map((d) => (
                      <td key={d.month} className="px-1.5 py-1 tabular-nums">
                        {d[dataKey]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Card>
  );
}

export function ReportsPage() {
  const q = trpc.crm.reports.useQuery(undefined, { retry: false });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data!;
  const top = d.topStyles[0];
  const instagram30 = d.months.at(-1)?.instagramVisits ?? 0;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Clients who came back" value={d.rebookRate === null ? "–" : `${d.rebookRate}%`} hint="of clients with a completed visit" />
        <Kpi label="Average paid online" value={d.averagePaidOnline === null ? "–" : gbp(d.averagePaidOnline)} hint="per paying client" />
        <Kpi label="Usual gap between visits" value={d.averageGapDays === null ? "–" : `${Math.round(d.averageGapDays / 7)} wk`} />
        <Kpi label="Visits from Instagram" value={instagram30} hint="this month" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthBars data={d.months} dataKey="bookings" title="Appointments per month" unit="appointments" />
        <MonthBars data={d.months} dataKey="instagramVisits" title="Website visits from Instagram" unit="visits" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthBars data={d.months} dataKey="visits" title="All website visits" unit="visits" />
        <Card title="Most booked styles">
          {!top ? (
            <Empty>No bookings yet.</Empty>
          ) : (
            <ol className="grid gap-2.5">
              {d.topStyles.map((s) => (
                <li key={s.name} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold">{s.name}</span>
                    <span className="tabular-nums text-[#6B6458]">{s.bookings}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F6F5F2]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (s.bookings / top.bookings) * 100)}%`, background: BAR }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
