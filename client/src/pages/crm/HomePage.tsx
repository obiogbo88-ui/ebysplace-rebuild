import { trpc } from "@/lib/trpc";
import { CalendarDays, MessageSquare, Package, Star } from "lucide-react";
import { clientHash, goCrm } from "./nav";
import { toast } from "sonner";
import { Avatar, Card, Empty, ErrorNote, GhostButton, Kpi, Loading, Pill, PrimaryButton, Row, STAGE_LABEL, STATUS_TONE, gbp, niceDate, niceDateTime, whatsappLink, ScrollBox } from "./ui";

const STAGES = ["enquiry", "booked", "deposit_paid", "done", "review_asked", "due_rebook"] as const;
const AUTOMATION_NAME: Record<string, string> = { review_ask: "Review request", rebook_nudge: "Rebook reminder", win_back: "We-miss-you email" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** "+2 on last week", "Same as last week", or nothing to compare yet. */
function weekTrend(now: number, before: number, money = false) {
  if (!before && !now) return undefined;
  const diff = Math.round((now - before) * 100) / 100;
  if (diff === 0) return "Same as last week";
  const amount = money ? gbp(Math.abs(diff)) : Math.abs(diff).toLocaleString("en-GB");
  return `${diff > 0 ? "+" : "−"}${amount} on last week`;
}

const stockOf = (p: any) => Number(p?.stock ?? p?.stockQuantity ?? 0);

export function HomePage() {
  const utils = trpc.useUtils();
  const q = trpc.crm.overview.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const lists = trpc.admin.lists.useQuery(undefined, { retry: false });
  const confirm = trpc.admin.updateBookingStatus.useMutation({
    onSuccess: () => {
      utils.crm.overview.invalidate();
      utils.admin.lists.invalidate();
      toast.success("Booking confirmed");
    },
    onError: (e) => toast.error(e.message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data!;
  const postsLeft = d.social.filter((s) => s.post && s.post.status !== "posted").length;
  const needs = d.needsYou;
  const needsCount = needs.pendingBookingCount + needs.chatCount + needs.reviewsPending + needs.ordersToSend;
  const products: any[] = ((lists.data as any)?.products ?? []).filter((p: any) => p && p.name);
  const lowStock = products.filter((p) => stockOf(p) <= 3).sort((a, b) => stockOf(a) - stockOf(b));
  const todayCount = d.todayList.length;
  const summary = [
    `${todayCount} appointment${todayCount === 1 ? "" : "s"} today`,
    needsCount ? `${needsCount} thing${needsCount === 1 ? "" : "s"} need${needsCount === 1 ? "s" : ""} you` : "nothing waiting for you",
    postsLeft ? `${postsLeft} Instagram post${postsLeft === 1 ? "" : "s"} ready to go out` : "today's Instagram posts are out",
  ].join(", ");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A641E]">{niceDate(d.today, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="serif !text-[28px] font-bold sm:!text-4xl leading-tight text-[#1A1A1A]">{greeting()}, Eby</h1>
          <p className="text-sm text-[#6B6458]">{summary.charAt(0).toUpperCase() + summary.slice(1)}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => goCrm("#availability")}>Block time off</GhostButton>
          <GhostButton onClick={() => goCrm("#campaigns")}>Email a group</GhostButton>
          <GhostButton href="https://www.ebysplace.com/">View live site</GhostButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Appointments this week" value={d.week.appointments.now} hint={weekTrend(d.week.appointments.now, d.week.appointments.before)} onClick={() => goCrm("#calendar")} />
        <Kpi label="Paid online this week" value={gbp(d.week.paidOnline.now)} hint={weekTrend(d.week.paidOnline.now, d.week.paidOnline.before, true)} onClick={() => goCrm("#money")} />
        <Kpi label="New clients this week" value={d.week.newClients.now} hint={weekTrend(d.week.newClients.now, d.week.newClients.before)} onClick={() => goCrm("#clients:new_this_month")} />
        <Kpi label="Website visits this week" value={d.week.visits.now.toLocaleString("en-GB")} hint={weekTrend(d.week.visits.now, d.week.visits.before)} onClick={() => goCrm("#reports")} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Today in the studio" action={<button type="button" className="text-[13px] font-semibold text-[#8A641E] hover:underline" onClick={() => goCrm("#calendar")}>Open calendar</button>}>
          {todayCount === 0 ? (
            <Empty>No appointments today.</Empty>
          ) : (
            <ScrollBox label="Today's appointments" size="md">
              <ul className="grid grid-cols-1">
                {d.todayList.map((b) => {
                  const wa = whatsappLink(b.phone, `Hi ${b.name.split(" ")[0]}, it's Eby from Eby's Place.`);
                  const paid = b.depositStatus === "paid";
                  return (
                    <li key={b.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#EFEBE4] py-3 first:border-t-0 first:pt-0">
                      <div className="grid">
                        <strong className="text-[15px] tabular-nums">{b.time}</strong>
                        {b.duration ? <span className="text-xs text-[#6B6458]">{b.duration}</span> : null}
                      </div>
                      <button type="button" onClick={() => goCrm(clientHash(b.clientKey))} className="flex min-w-0 items-center gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]">
                        <Avatar name={b.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#1A1A1A]">{b.name}</span>
                          <span className="block truncate text-[13px] text-[#6B6458]">
                            {b.serviceName} · {b.homeVisit ? `Home visit${b.city ? `, ${b.city}` : ""}` : "Studio"}
                          </span>
                          <span className="block text-xs text-[#6B6458]">{b.returning ? "Returning client" : "First visit"}</span>
                        </span>
                      </button>
                      <div className="grid justify-items-end gap-1.5">
                        <Pill tone={paid ? "live" : "wait"}>{paid ? "Deposit paid" : "Deposit not paid"}</Pill>
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-[#8A641E] hover:underline">
                            WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollBox>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FBF8F2] px-3.5 py-3 text-sm">
            <span>
              <strong>Tomorrow:</strong>{" "}
              {d.tomorrow.count
                ? `${d.tomorrow.count} appointment${d.tomorrow.count === 1 ? "" : "s"}, first at ${String(d.tomorrow.first?.time).slice(0, 5)} (${d.tomorrow.first?.serviceName})`
                : "nothing booked yet"}
            </span>
            <button type="button" className="font-semibold text-[#8A641E] hover:underline" onClick={() => goCrm("#calendar")}>
              See the week
            </button>
          </div>
        </Card>

        <Card title={needsCount ? `Needs you · ${needsCount}` : "Needs you"}>
          {needsCount === 0 ? (
            <Empty>Nothing waiting. Bookings, chats asking for you, reviews and orders to send show up here.</Empty>
          ) : (
            <ScrollBox label="Needs you" size="md">
              {needs.pendingBookings.map((b) => (
                <Row key={`b${b.id}`}>
                  <CalendarDays className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">Booking to confirm: {b.name}</div>
                    <div className="truncate text-[13px] text-[#6B6458]">
                      {b.serviceName} · {niceDate(b.date, { weekday: "short", day: "numeric", month: "short" })} {b.time} · deposit {b.depositStatus.replace("_", " ")}
                    </div>
                  </div>
                  <PrimaryButton disabled={confirm.isPending} onClick={() => confirm.mutate({ id: b.id, status: "confirmed" })}>
                    Confirm
                  </PrimaryButton>
                </Row>
              ))}
              {needs.chats.map((c) => (
                <Row key={`c${c.id}`}>
                  <MessageSquare className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name || "A visitor"} asked to talk to you</div>
                    <div className="truncate text-[13px] text-[#6B6458]">{c.lastMessage ? `"${c.lastMessage}"` : niceDateTime(c.updatedAt)}</div>
                  </div>
                  <PrimaryButton onClick={() => goCrm("#inbox")}>Reply</PrimaryButton>
                </Row>
              ))}
              {needs.reviewsPending > 0 ? (
                <Row>
                  <Star className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {needs.reviewsPending} review{needs.reviewsPending === 1 ? "" : "s"} to approve
                    </div>
                    <div className="text-[13px] text-[#6B6458]">They show on the website once approved</div>
                  </div>
                  <PrimaryButton onClick={() => goCrm("#website")}>Review</PrimaryButton>
                </Row>
              ) : null}
              {needs.ordersToSend > 0 ? (
                <Row>
                  <Package className="h-5 w-5 shrink-0 text-[#8A641E]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {needs.ordersToSend} shop order{needs.ordersToSend === 1 ? "" : "s"} to send
                    </div>
                  </div>
                  <PrimaryButton onClick={() => goCrm("#orders")}>Open</PrimaryButton>
                </Row>
              ) : null}
            </ScrollBox>
          )}
        </Card>
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

      <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card title="Instagram today" action={<button type="button" className="text-[13px] font-semibold text-[#8A641E] hover:underline" onClick={() => goCrm("#social")}>Open</button>}>
            {d.social.map((s) => (
              <Row key={s.slot}>
                <Pill tone="gold">{s.time}</Pill>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{s.post ? s.post.title : "Not written yet"}</div>
                  <div className="truncate text-[13px] text-[#6B6458]">{s.post ? `${s.post.kindLabel} · Reel` : "Written automatically before it's due"}</div>
                </div>
                {s.post ? <Pill tone={STATUS_TONE[s.post.status] ?? "grey"}>{s.post.status === "posted" ? "Posted" : s.post.status === "ready" ? "Ready" : s.post.status}</Pill> : <Pill tone="grey">Later</Pill>}
              </Row>
            ))}
          </Card>
          <Card title="Shop" action={<button type="button" className="text-[13px] font-semibold text-[#8A641E] hover:underline" onClick={() => goCrm("#shop")}>Shop &amp; orders</button>}>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => goCrm("#orders")} className="rounded-xl bg-[#FBF8F2] p-3 text-left transition hover:bg-[#F3EBDC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]">
                <b className="block text-[22px] tabular-nums text-[#1A1A1A]">{d.shop.toSend}</b>
                <span className="text-xs text-[#6B6458]">orders to send</span>
              </button>
              <div className="rounded-xl bg-[#FBF8F2] p-3">
                <b className="block text-[22px] tabular-nums text-[#1A1A1A]">{gbp(d.shop.soldThisWeek)}</b>
                <span className="text-xs text-[#6B6458]">sold this week</span>
              </div>
              <button type="button" onClick={() => goCrm("#products")} className={`rounded-xl p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] ${lowStock.length ? "bg-[#FBEFD9] hover:bg-[#F6E3BF]" : "bg-[#FBF8F2] hover:bg-[#F3EBDC]"}`}>
                <b className="block text-[22px] tabular-nums text-[#1A1A1A]">{lists.isLoading ? "…" : lowStock.length}</b>
                <span className="text-xs text-[#6B6458]">running low</span>
              </button>
            </div>
            {lowStock.length ? (
              <p className="mt-3 text-[13px] text-[#6B6458]">
                Running low: {lowStock.slice(0, 6).map((p) => `${p.name} (${stockOf(p) === 0 ? "sold out" : `${stockOf(p)} left`})`).join(", ")}
                {lowStock.length > 6 ? ` and ${lowStock.length - 6} more` : ""}
              </p>
            ) : null}
          </Card>
      </div>

      {d.recentSends.length ? (
        <Card title="Sent for you automatically">
          <ScrollBox label="Sent automatically, lately" size="sm">
          {d.recentSends.map((s, i) => (
            <Row key={i}>
              <Pill tone="new">Auto</Pill>
              <div className="min-w-0 flex-1 truncate text-sm">
                {AUTOMATION_NAME[s.automation] ?? s.automation} · {s.clientKey.replace(/^[ep]:/, "")}
              </div>
              <span className="text-xs text-[#6B6458]">{niceDateTime(s.sentAt)}</span>
            </Row>
          ))}
          </ScrollBox>
        </Card>
      ) : null}
    </div>
  );
}
