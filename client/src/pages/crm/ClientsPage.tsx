import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Search } from "lucide-react";
import { clientHash, goCrm } from "./nav";
import { Avatar, Card, Chip, Empty, ErrorNote, Loading, Pill, STAGE_LABEL, gbp, niceDate, ScrollBox } from "./ui";
import { useAccess } from "./access";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "regulars", label: "Regulars" },
  { id: "due_rebook", label: "Due a rebook" },
  { id: "shop", label: "Shop interest" },
  { id: "subscribers", label: "Subscribers" },
  { id: "new_this_month", label: "New this month" },
  { id: "enquiries", label: "Enquiries" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const NEXT_STEP: Record<string, string> = {
  enquiry: "Invite to book",
  booked: "Confirm booking",
  deposit_paid: "See you soon",
  done: "Ask for a review",
  review_asked: "Rebook in a few weeks",
  due_rebook: "Rebook reminder due",
};

export function ClientsPage({ initialFilter }: { initialFilter?: string }) {
  const access = useAccess();
  const [filter, setFilter] = useState<FilterId>(() => (FILTERS.some((f) => f.id === initialFilter) ? (initialFilter as FilterId) : "all"));
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    if (initialFilter && FILTERS.some((f) => f.id === initialFilter)) setFilter(initialFilter as FilterId);
  }, [initialFilter]);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 200);
    return () => window.clearTimeout(t);
  }, [search]);
  const q = trpc.crm.clients.useQuery({ filter, search: debounced }, { retry: false, placeholderData: (prev) => prev });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-[1_1_260px] items-center gap-2 rounded-full border border-[#E6E1D8] bg-white px-4 py-2 focus-within:border-[#C9A84C]" htmlFor="crm-client-search">
          <Search className="h-4 w-4 shrink-0 text-[#6B6458]" aria-hidden="true" />
          <span className="sr-only">Search clients</span>
          <input id="crm-client-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, style or tag" className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[#1A1A1A] shadow-none outline-none placeholder:text-[#9A9183] focus:ring-0" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter clients">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} count={q.data?.counts[f.id]}>
            {f.label}
          </Chip>
        ))}
      </div>

      <ErrorNote error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.clients.length ? (
        <Empty>{debounced ? `No clients match "${debounced}".` : "No clients in this group yet."}</Empty>
      ) : (
        <Card>
          {/* Table on wider screens */}
          <ScrollBox label="Clients list" size="lg" className="hidden md:block">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead className="sticky top-0 z-[1] bg-white">
                <tr className="text-left text-[#6B6458]">
                  <th className="border-b border-[#E6E1D8] px-2 py-2 font-semibold">Client</th>
                  <th className="border-b border-[#E6E1D8] px-2 py-2 font-semibold">Last visit</th>
                  <th className="border-b border-[#E6E1D8] px-2 py-2 text-right font-semibold">Visits</th>
                  <th className="border-b border-[#E6E1D8] px-2 py-2 text-right font-semibold">Paid online</th>
                  <th className="border-b border-[#E6E1D8] px-2 py-2 font-semibold">Tags</th>
                  <th className="border-b border-[#E6E1D8] px-2 py-2 font-semibold">Next step</th>
                </tr>
              </thead>
              <tbody>
                {q.data.clients.map((c) => (
                  <tr key={c.key} className="cursor-pointer transition hover:bg-[#FBF8F2]" onClick={() => goCrm(clientHash(c.key))}>
                    <td className="border-b border-[#EFEBE4] px-2 py-2.5">
                      <a href={clientHash(c.key)} className="flex items-center gap-3 font-semibold text-[#1A1A1A] no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]" onClick={(e) => e.stopPropagation()}>
                        <Avatar name={c.name} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate">{c.name}</span>
                          <span className="block truncate text-xs font-normal text-[#6B6458]">{c.city || c.email || c.phone}</span>
                        </span>
                      </a>
                    </td>
                    <td className="border-b border-[#EFEBE4] px-2 py-2.5">{c.nextAppointment ? <span>Booked {niceDate(c.nextAppointment.date)}</span> : niceDate(c.lastVisit)}</td>
                    <td className="border-b border-[#EFEBE4] px-2 py-2.5 text-right tabular-nums">{c.visits}</td>
                    <td className="border-b border-[#EFEBE4] px-2 py-2.5 text-right tabular-nums">{access.money(c.paidOnline)}</td>
                    <td className="border-b border-[#EFEBE4] px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <Pill key={t}>{t}</Pill>
                        ))}
                        {c.tags.length > 3 ? <Pill tone="grey">+{c.tags.length - 3}</Pill> : null}
                      </div>
                    </td>
                    <td className="border-b border-[#EFEBE4] px-2 py-2.5">
                      <Pill tone={c.stage === "due_rebook" || c.stage === "booked" ? "wait" : c.stage === "enquiry" ? "new" : "grey"}>{NEXT_STEP[c.stage]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>
          {/* Cards on phones */}
          <ScrollBox label="Clients list" size="lg" className="md:hidden">
          <ul className="grid gap-2">
            {q.data.clients.map((c) => (
              <li key={c.key}>
                <a href={clientHash(c.key)} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#EFEBE4] p-3 text-[#1A1A1A] no-underline">
                  <Avatar name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block truncate text-xs text-[#6B6458]">
                      {c.visits} visit{c.visits === 1 ? "" : "s"} · {STAGE_LABEL[c.stage]}
                      {c.nextAppointment ? ` · booked ${niceDate(c.nextAppointment.date)}` : ""}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{access.money(c.paidOnline)}</span>
                </a>
              </li>
            ))}
          </ul>
          </ScrollBox>
          <p className="mt-3 text-xs text-[#6B6458]">"Paid online" is deposits and shop orders paid through the website. Money taken in the studio isn't recorded here.</p>
        </Card>
      )}
    </div>
  );
}
