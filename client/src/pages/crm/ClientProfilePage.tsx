import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Mail, MessageCircle, Plus, X } from "lucide-react";
import { goCrm } from "./nav";
import { Avatar, Card, Empty, ErrorNote, GhostButton, Kpi, Loading, Pill, PrimaryButton, Row, STAGE_LABEL, STATUS_TONE, Toggle, gbp, niceDate, niceDateTime, relativeDays, whatsappLink, ScrollBox } from "./ui";

const SWITCHES: Array<{ key: "reminders" | "review_ask" | "rebook_nudge" | "win_back" | "marketing"; label: string; detail: string }> = [
  { key: "reminders", label: "Appointment reminders", detail: "Day-before email and text" },
  { key: "review_ask", label: "Review request", detail: "The day after a completed visit" },
  { key: "rebook_nudge", label: "Rebook reminder", detail: "5–8 weeks after a braid" },
  { key: "win_back", label: "We-miss-you email", detail: "After three months away" },
  { key: "marketing", label: "Offers and campaigns", detail: "Off if they unsubscribed" },
];

const KIND_TONE: Record<string, "gold" | "live" | "new" | "wait" | "grey"> = { booking: "live", order: "gold", chat: "wait", review_ask: "new", subscribed: "new", automation: "new", email: "grey", note: "grey" };
const KIND_LABEL: Record<string, string> = { booking: "Booking", order: "Shop", chat: "Chat", review_ask: "Review", subscribed: "List", automation: "Auto", email: "Email", note: "Note" };

export function ClientProfilePage({ clientKey }: { clientKey: string }) {
  const utils = trpc.useUtils();
  const q = trpc.crm.client.useQuery({ key: clientKey }, { retry: false });
  const [note, setNote] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [newTag, setNewTag] = useState("");
  useEffect(() => {
    if (q.data && !noteDirty) setNote(q.data.client.note ?? "");
  }, [q.data, noteDirty]);

  const refresh = () => {
    utils.crm.client.invalidate({ key: clientKey });
    utils.crm.clients.invalidate();
  };
  const saveNote = trpc.crm.saveNote.useMutation({
    onSuccess: () => {
      setNoteDirty(false);
      toast.success("Note saved");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const addTag = trpc.crm.addTag.useMutation({ onSuccess: () => (setNewTag(""), refresh()), onError: (e) => toast.error(e.message) });
  const removeTag = trpc.crm.removeTag.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const setSwitch = trpc.crm.setClientSwitch.useMutation({
    onMutate: async (v: any) => {
      await utils.crm.client.cancel({ key: clientKey });
      const prev = utils.crm.client.getData({ key: clientKey });
      if (prev) utils.crm.client.setData({ key: clientKey }, { ...prev, switches: { ...prev.switches, [v.automation]: v.enabled } });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) utils.crm.client.setData({ key: clientKey }, ctx.prev);
      toast.error(e.message);
    },
    onSettled: refresh,
  });

  if (q.isLoading) return <Loading />;
  if (q.error)
    return (
      <div className="grid gap-3">
        <BackLink />
        <ErrorNote error={q.error} />
      </div>
    );
  const { client: c, timeline, switches } = q.data!;
  const today = new Date().toISOString().slice(0, 10);
  const wa = whatsappLink(c.phone, `Hi ${c.name.split(" ")[0]}, it's Eby from Eby's Place. `);
  const bookAgain = () => {
    try {
      window.sessionStorage.setItem("ebys-booking-prefill", JSON.stringify({ clientName: c.name, clientEmail: c.email ?? "", clientPhone: c.phone ?? "" }));
    } catch {
      // storage blocked: the form opens empty
    }
    window.location.assign(`/booking${c.usualStyle ? `?service=${encodeURIComponent(c.usualStyle)}` : ""}`);
  };

  return (
    <div className="grid gap-4">
      <BackLink />
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={c.name} size={56} />
          <div className="min-w-[200px] flex-1">
            <h1 className="serif !text-[24px] font-bold leading-tight text-[#1A1A1A]">{c.name}</h1>
            <p className="text-sm text-[#6B6458]">
              Client since {niceDate(c.firstSeen, { month: "long", year: "numeric" })}
              {c.usualStyle ? ` · usual style: ${c.usualStyle}` : ""}
              {c.city ? ` · ${c.city}` : ""}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#1A1A1A]">
              {c.email ? <span className="select-all">{c.email}</span> : null}
              {c.phone ? <span className="select-all tabular-nums">{c.phone}</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GhostButton onClick={bookAgain}>Book again</GhostButton>
            {wa ? (
              <GhostButton href={wa}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
              </GhostButton>
            ) : null}
            {c.email ? (
              <GhostButton onClick={() => (window.dispatchEvent(new CustomEvent("crm:compose", { detail: { to: c.email, name: c.name } })), goCrm("#customer-replies"))}>
                <Mail className="h-4 w-4" aria-hidden="true" /> Email
              </GhostButton>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Pill tone="new">{STAGE_LABEL[c.stage]}</Pill>
          {c.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDC] px-2.5 py-0.5 text-xs font-semibold text-[#8A641E]">
              {t}
              {c.ownTags.includes(t) ? (
                <button type="button" aria-label={`Remove tag ${t}`} className="rounded-full hover:text-[#B3261E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]" onClick={() => removeTag.mutate({ key: c.key, tag: t })}>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
          {c.marketingOptOut ? <Pill tone="bad">Unsubscribed from offers</Pill> : null}
          <form
            className="inline-flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTag.trim()) addTag.mutate({ key: c.key, tag: newTag.trim() });
            }}
          >
            <label htmlFor="crm-new-tag" className="sr-only">
              Add a tag
            </label>
            <input id="crm-new-tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={40} placeholder="Add a tag, e.g. likes satin bonnets" className="h-7 w-56 max-w-full rounded-full border border-[#E6E1D8] bg-white px-3 text-xs" />
            <button type="submit" aria-label="Add tag" disabled={!newTag.trim() || addTag.isPending} className="grid h-7 w-7 place-items-center rounded-full border border-[#E6E1D8] bg-white disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visits" value={c.visits} hint={c.bookings > c.visits ? `${c.bookings} bookings in all` : undefined} />
        <Kpi label="Paid online" value={gbp(c.paidOnline)} hint={c.orders ? `${c.orders} shop order${c.orders === 1 ? "" : "s"}` : undefined} />
        <Kpi label="Usual gap between visits" value={c.averageGapDays ? `${Math.round(c.averageGapDays / 7)} wk` : "–"} />
        <Kpi
          label={c.nextAppointment ? "Next appointment" : "Last visit"}
          value={c.nextAppointment ? niceDate(c.nextAppointment.date) : niceDate(c.lastVisit)}
          hint={c.nextAppointment ? `${c.nextAppointment.time} · ${c.nextAppointment.serviceName}` : c.dueRebook ? "Due a rebook now" : c.lastVisit ? relativeDays(c.lastVisit, today) ?? undefined : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Timeline">
          {timeline.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <ScrollBox label="Timeline" size="lg">
            <ol>
              {timeline.map((t, i) => (
                <li key={i}>
                  <Row>
                    <span className="w-16 shrink-0">
                      <Pill tone={KIND_TONE[t.kind] ?? "grey"}>{KIND_LABEL[t.kind] ?? t.kind}</Pill>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {t.title}
                        {t.status ? (
                          <span className="ml-2 align-middle">
                            <Pill tone={STATUS_TONE[t.status] ?? "grey"}>{t.status}</Pill>
                          </span>
                        ) : null}
                      </div>
                      <div className="break-words text-[13px] text-[#6B6458]">{t.detail}</div>
                    </div>
                    <time className="shrink-0 text-xs text-[#6B6458]" dateTime={t.at}>
                      {t.kind === "booking" ? niceDate(t.at.slice(0, 10)) : niceDateTime(t.at)}
                    </time>
                  </Row>
                </li>
              ))}
            </ol>
            </ScrollBox>
          )}
        </Card>

        <div className="grid min-w-0 content-start gap-4">
          <Card title="Automations for this client">
            {SWITCHES.map((s) => (
              <Row key={s.key}>
                <div className="min-w-0 flex-1">
                  <label htmlFor={`crm-switch-${s.key}`} className="block font-semibold">
                    {s.label}
                  </label>
                  <span className="text-[13px] text-[#6B6458]">{s.detail}</span>
                </div>
                <Toggle id={`crm-switch-${s.key}`} label={s.label} checked={switches[s.key]} disabled={setSwitch.isPending} onChange={(enabled) => setSwitch.mutate({ key: c.key, automation: s.key, enabled })} />
              </Row>
            ))}
          </Card>
          <Card title="Private note" action={<span className="text-xs text-[#6B6458]">Only you see this</span>}>
            <label htmlFor="crm-note" className="sr-only">
              Private note
            </label>
            <textarea
              id="crm-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteDirty(true);
              }}
              rows={4}
              maxLength={4000}
              placeholder="e.g. tender at the edges, prefers lighter hair"
              className="w-full rounded-xl border border-[#E6E1D8] bg-[#FBF8F2] p-3 text-sm text-[#1A1A1A]"
            />
            <div className="mt-2 flex justify-end">
              <PrimaryButton disabled={!noteDirty || saveNote.isPending} onClick={() => saveNote.mutate({ key: c.key, body: note })}>
                {saveNote.isPending ? "Saving…" : "Save note"}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <a href="#clients" className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-[#8A641E] no-underline hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All clients
    </a>
  );
}
