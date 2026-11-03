import { trpc } from "@/lib/trpc";
import { CalendarDays, MessageSquare, Package, Star } from "lucide-react";
import { clientHash, goCrm } from "./nav";
import { Avatar, Card, Empty, ErrorNote, Kpi, Loading, Pill, Row, STAGE_LABEL, STATUS_TONE, niceDate, niceDateTime, relativeDays } from "./ui";

const STAGES = ["enquiry", "booked", "deposit_paid", "done", "review_asked", "due_rebook"] as const;
const AUTOMATION_NAME: Record<string, string> = { review_ask: "Review request", rebook_nudge: "Rebook reminder", win_back: "We-miss-you email" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function HomePage() {
  const q = trpc.crm.overview.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data!;
  const next = d.social.find((s) => !s.post || s.post.status !== "posted");
  const needs = d.needsYou;
  const needsCount = needs.pendingBookingCount + needs.chatCount + needs.reviewsPending + needs.ordersToSend;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="serif !text-[28px] font-bold sm:!text-4xl leading-tight text-[#1A1A1A]">{greeting()}, Eby</h1>
        <p className="text-sm text-[#6B6458]">
          {niceDate(d.today, { weekday: "long", day: "numeric", month: "long" })} · {d.counts.upcoming} appointment{d.counts.upcoming === 1 ? "" : "s"} coming up
          {next ? ` · next post ${next.time}` : " · all of today's posts are out"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Clients" value={d.counts.clients} onClick={() => goCrm("#clients")} />
        <Kpi label="Bookings, last 30 days" value={d.counts.bookingsLast30} hint={`${d.counts.bookings} all time`} onClick={() => goCrm("#calendar")} />
        <Kpi label="Upcoming appointments" value={d.counts.upcoming} onClick={() => goCrm("#calendar")} />
        <Kpi label="Subscribers" value={d.counts.subscribers} onClick={() => goCrm("#campaigns")} />
      </div>

      <Card title="Client journey" action={<span className="text-xs text-[#6B6458]">Each client sits in one stage</span>}>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {STAGES.map((s) => (
            <button key={s} type="button" onClick={() => goCrm(`#clients:${s === "due_rebook" ? "due_rebook" : s === "enquiry" ? "enquiries" : "all"}`)} className="rounded-xl bg-[#F6F5F2] p-3 text-left transition hover:bg-[#F3EBDC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]">
              <b className="block text-[22px] tabular-nums text-[#1A1A1A]">{d.journey[s]}</b>
              <span className="text-xs text-[#6B6458]">{STAGE_LABEL[s]}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={needsCount ? `Needs you (${needsCount})` : "Needs you"}>
          {needsCount === 0 ? (
            <Empty>Nothing waiting. Bookings, chats asking for you, reviews and orders to send show up here.</Empty>
          ) : (
            <div>
              {needs.pendingBookings.map((b) => (
                <Row key={`b${b.id}`} onClick={() => goCrm("#bookings")}>
                  <CalendarDays className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold [overflow-wrap:anywhere]">{b.name} · waiting for you to confirm</div>
                    <div className="truncate text-[13px] text-[#6B6458]">
                      {b.serviceName} · {niceDate(b.date, { weekday: "short", day: "numeric", month: "short" })} {b.time} · deposit {b.depositStatus.replace("_", " ")}
                    </div>
                  </div>
                  <Pill tone="wait">Confirm</Pill>
                </Row>
              ))}
              {needs.pendingBookingCount > needs.pendingBookings.length ? <p className="pt-2 text-xs text-[#6B6458]">+{needs.pendingBookingCount - needs.pendingBookings.length} more in Calendar</p> : null}
              {needs.chats.map((c) => (
                <Row key={`c${c.id}`} onClick={() => goCrm("#inbox")}>
                  <MessageSquare className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold [overflow-wrap:anywhere]">{c.name || "A visitor"} asked to talk to you</div>
                    <div className="truncate text-[13px] text-[#6B6458]">{c.lastMessage ? `"${c.lastMessage}"` : niceDateTime(c.updatedAt)}</div>
                  </div>
                  <Pill tone="wait">Reply</Pill>
                </Row>
              ))}
              {needs.reviewsPending > 0 ? (
                <Row onClick={() => goCrm("#reviews")}>
                  <Star className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {needs.reviewsPending} review{needs.reviewsPending === 1 ? "" : "s"} to approve
                    </div>
                    <div className="text-[13px] text-[#6B6458]">They show on the website once approved</div>
                  </div>
                  <Pill tone="wait">Open</Pill>
                </Row>
              ) : null}
              {needs.ordersToSend > 0 ? (
                <Row onClick={() => goCrm("#orders")}>
                  <Package className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {needs.ordersToSend} shop order{needs.ordersToSend === 1 ? "" : "s"} to send
                    </div>
                  </div>
                  <Pill tone="wait">Open</Pill>
                </Row>
              ) : null}
            </div>
          )}
        </Card>

        <div className="grid min-w-0 gap-4">
          <Card title="Coming up" action={<button type="button" className="text-[13px] font-semibold text-[#8A641E] hover:underline" onClick={() => goCrm("#calendar")}>Calendar</button>}>
            {d.nextAppointments.length === 0 ? (
              <Empty>No appointments booked yet.</Empty>
            ) : (
              d.nextAppointments.map((b) => (
                <Row key={b.id} onClick={b.clientKey ? () => goCrm(clientHash(b.clientKey!)) : undefined}>
                  <Avatar name={b.name} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold [overflow-wrap:anywhere]">{b.name}</div>
                    <div className="truncate text-[13px] text-[#6B6458]">
                      {b.serviceName} · {niceDate(b.date, { weekday: "short", day: "numeric", month: "short" })} {b.time}
                    </div>
                  </div>
                  <Pill tone={STATUS_TONE[b.status] ?? "grey"}>{relativeDays(b.date, d.today)}</Pill>
                </Row>
              ))
            )}
          </Card>

          <Card title="Social autopilot" action={<button type="button" className="text-[13px] font-semibold text-[#8A641E] hover:underline" onClick={() => goCrm("#social")}>Open</button>}>
            {d.social.map((s) => (
              <Row key={s.slot}>
                <Pill tone="gold">{s.time}</Pill>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold [overflow-wrap:anywhere]">{s.post ? s.post.title : "Not written yet"}</div>
                  <div className="truncate text-[13px] text-[#6B6458]">{s.post ? `${s.post.kindLabel} · Reel` : "Written automatically before it's due"}</div>
                </div>
                {s.post ? <Pill tone={STATUS_TONE[s.post.status] ?? "grey"}>{s.post.status === "posted" ? "Posted" : s.post.status === "ready" ? "Ready" : s.post.status}</Pill> : <Pill tone="grey">Later</Pill>}
              </Row>
            ))}
          </Card>
        </div>
      </div>

      {d.recentSends.length ? (
        <Card title="Sent automatically, lately">
          {d.recentSends.map((s, i) => (
            <Row key={i}>
              <Pill tone="new">Auto</Pill>
              <div className="min-w-0 flex-1 truncate text-sm">
                {AUTOMATION_NAME[s.automation] ?? s.automation} · {s.clientKey.replace(/^[ep]:/, "")}
              </div>
              <span className="text-xs text-[#6B6458]">{niceDateTime(s.sentAt)}</span>
            </Row>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
