import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clientHash, goCrm } from "./nav";
import { Card, ErrorNote, GhostButton, Loading, PrimaryButton, niceDate } from "./ui";

function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(date: string, n: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
function mondayOf(date: string) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 Sun
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

const SLOT_STYLE: Record<string, string> = {
  pending: "border-l-[#9A5B00] bg-[#FBEFD9] text-[#5A3600]",
  confirmed: "border-l-[#1E7A46] bg-[#E3F2E8] text-[#124A2B]",
  completed: "border-l-[#9A9183] bg-[#EFEDE8] text-[#4A443B]",
};

export function CalendarPage({ blockedSlots }: { blockedSlots: Array<{ date: string; time?: string; reason?: string }> }) {
  const today = londonToday();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const q = trpc.crm.calendar.useQuery({ from: weekStart, days: 7 }, { retry: false, placeholderData: (p) => p });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
        </GhostButton>
        <PrimaryButton onClick={() => setWeekStart(mondayOf(today))}>This week</PrimaryButton>
        <GhostButton onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </GhostButton>
        <span className="ml-1 text-sm font-semibold text-[#1A1A1A]">
          {niceDate(weekStart, { day: "numeric", month: "short" })} – {niceDate(addDays(weekStart, 6), { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <span className="ml-auto">
          <GhostButton onClick={() => goCrm("#availability")}>Block time off</GhostButton>
        </span>
      </div>
      <ErrorNote error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : (
        <Card>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((d) => {
              const bookings = (q.data?.bookings ?? []).filter((b) => b.date === d);
              const blocks = blockedSlots.filter((s) => s.date === d);
              const wholeDay = blocks.some((s) => !s.time);
              const isToday = d === today;
              return (
                <div key={d} className={`min-h-[110px] min-w-0 rounded-xl p-2.5 ${isToday ? "bg-[#F3EBDC] ring-1 ring-[#C9A84C]" : "bg-[#F6F5F2]"}`}>
                  <div className="flex items-baseline justify-between gap-2 text-xs font-bold text-[#6B6458]">
                    <span>{niceDate(d, { weekday: "short", day: "numeric" })}</span>
                    {isToday ? <span className="text-[#8A641E]">Today</span> : null}
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {wholeDay ? <div className="rounded-md bg-[#E6E1D8] px-2 py-1 text-xs font-semibold text-[#6B6458]">Closed{blocks.find((s) => !s.time)?.reason ? ` · ${blocks.find((s) => !s.time)?.reason}` : ""}</div> : null}
                    {blocks
                      .filter((s) => s.time)
                      .map((s) => (
                        <div key={`blk-${s.time}`} className="rounded-md bg-[#E6E1D8] px-2 py-1 text-xs font-semibold text-[#6B6458]">
                          {s.time} blocked
                        </div>
                      ))}
                    {bookings.map((b) => (
                      <a key={b.id} href={b.clientKey ? clientHash(b.clientKey) : "#bookings"} className={`block min-w-0 rounded-md border-l-4 px-2 py-1 text-xs no-underline ${SLOT_STYLE[b.status] ?? SLOT_STYLE.pending}`}>
                        <span className="block font-bold tabular-nums">{b.time}</span>
                        <span className="block truncate font-semibold">{b.name}</span>
                        <span className="block truncate opacity-80">{b.serviceName}</span>
                      </a>
                    ))}
                    {!wholeDay && !bookings.length && !blocks.length ? <span className="text-xs text-[#9A9183]">Free</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6B6458]">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#FBEFD9] ring-1 ring-[#9A5B00]" /> Waiting to confirm</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#E3F2E8] ring-1 ring-[#1E7A46]" /> Confirmed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#EFEDE8] ring-1 ring-[#9A9183]" /> Done</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#E6E1D8]" /> Blocked</span>
          </div>
        </Card>
      )}
    </div>
  );
}
