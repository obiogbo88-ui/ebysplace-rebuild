import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, Chip, Empty, GhostButton, Pill, PrimaryButton, ScrollBox, gbp, niceDate, niceDateTime, type PillTone } from "./ui";

/**
 * Quick announcements: ready-made messages that fill themselves in from the
 * calendar, blocked-off time and the shop. Eby picks one, checks the exact
 * previews, and presses Send. Nothing goes out without that press.
 */

const SITE = "https://www.ebysplace.com";
const DEPOSIT = "Book online with a £20 deposit.";
const TITLE_MAX = 80;
const BODY_MAX = 200;

type TemplateId = "free_days" | "opening" | "christmas" | "closed" | "back" | "new_product" | "restock" | "kids";
type Message = { title: string; body: string; cta: string; url: string };
type Template = { id: TemplateId; name: string; tag: "Booking" | "Season" | "Notice" | "Shop"; fills: string; build: () => Message | null; missing: string };

const TAG_TONE: Record<Template["tag"], PillTone> = { Booking: "live", Season: "gold", Notice: "new", Shop: "wait" };
const day = (d: string) => niceDate(d, { weekday: "short", day: "numeric", month: "short" });
const dayLong = (d: string) => niceDate(d, { weekday: "short", day: "numeric", month: "long" });
const listJoin = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
const priceOf = (p: any) => {
  const n = Number(p?.price ?? p?.priceFrom ?? p?.unitPrice);
  return Number.isFinite(n) && n > 0 ? gbp(n) : null;
};
const stockOf = (p: any) => Number(p?.stock ?? p?.stockQuantity ?? 0);
const createdOf = (p: any) => String(p?.createdAt ?? p?.created_at ?? "");

export function QuickAnnouncements() {
  const utils = trpc.useUtils();
  const ctx = trpc.crm.announcementContext.useQuery(undefined, { retry: false });
  const status = trpc.admin.announcementStatus.useQuery(undefined, { retry: false });
  const lists = trpc.admin.lists.useQuery(undefined, { retry: false });
  const [picked, setPicked] = useState<TemplateId>("free_days");
  const [chosenDays, setChosenDays] = useState<string[] | null>(null);
  const [productId, setProductId] = useState<string>("");
  const [audience, setAudience] = useState<"all_clients" | "subscribers">("all_clients");
  const [channels, setChannels] = useState({ email: true, webPush: true, sms: false, whatsapp: false });
  const [editing, setEditing] = useState(false);
  const [override, setOverride] = useState<{ title: string; body: string } | null>(null);

  const send = trpc.admin.sendAnnouncement.useMutation({
    onSuccess: (r) => {
      const parts = [r.email?.sent ? "email" : null, r.webPush?.sent ? "phone notification" : null, r.sms?.sent ? "text" : null, r.whatsapp?.sent ? "WhatsApp" : null].filter(Boolean);
      toast.success("Announcement sent", { description: parts.length ? `By ${listJoin(parts as string[])}.` : undefined });
      setOverride(null);
      setEditing(false);
      utils.crm.announcementContext.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const c = ctx.data;
  const freeDays = (c?.days ?? []).filter((d) => !d.blocked && d.bookings === 0).slice(0, 7).map((d) => d.date);
  const days = chosenDays ?? freeDays.slice(0, 3);
  const products: any[] = ((lists.data as any)?.products ?? []).filter((p: any) => p?.name);
  const newest = [...products].sort((a, b) => createdOf(b).localeCompare(createdOf(a)));
  const inStock = newest.filter((p) => stockOf(p) > 0);

  const templates: Template[] = useMemo(() => {
    const product = (pool: any[]) => pool.find((p) => String(p.id) === productId) ?? pool[0];
    return [
      {
        id: "free_days",
        name: "Slots free this week",
        tag: "Booking",
        fills: "Days with no bookings, from your calendar",
        missing: "Every day in the next two weeks has a booking or is blocked off.",
        build: () => (days.length ? { title: "Free slots coming up", body: `I have space on ${listJoin(days.map(day))}. ${DEPOSIT}`, cta: "Book now", url: `${SITE}/booking` } : null),
      },
      {
        id: "opening",
        name: "Last-minute opening",
        tag: "Booking",
        fills: "A cancelled slot that is free again",
        missing: "No cancelled appointment has freed up a slot.",
        build: () =>
          c?.opening ? { title: `A slot just opened on ${day(c.opening.date)}`, body: `A space has opened on ${dayLong(c.opening.date)} at ${c.opening.time}. First to book gets it. ${DEPOSIT}`, cta: "Book this slot", url: `${SITE}/booking` } : null,
      },
      {
        id: "christmas",
        name: "Christmas bookings open",
        tag: "Season",
        fills: "Your December booking reminder",
        missing: "",
        build: () => ({ title: "Christmas slots are open", body: "December is filling up. Book before 1 December to get your pick of dates for Christmas and New Year.", cta: "Book for Christmas", url: `${SITE}/booking` }),
      },
      {
        id: "closed",
        name: "Studio closed",
        tag: "Notice",
        fills: "Dates from the time you blocked off",
        missing: "Block the days off in Calendar first.",
        build: () =>
          c?.closed
            ? {
                title: c.closed.from === c.closed.to ? `Studio closed ${day(c.closed.from)}` : `Studio closed ${day(c.closed.from)} to ${day(c.closed.to)}`,
                body: `The studio is closed ${c.closed.from === c.closed.to ? `on ${dayLong(c.closed.from)}` : `from ${dayLong(c.closed.from)} to ${dayLong(c.closed.to)}`}. Online booking stays open for dates after that.`,
                cta: "See free dates",
                url: `${SITE}/booking`,
              }
            : null,
      },
      {
        id: "back",
        name: "Back and booking",
        tag: "Notice",
        fills: "The day you reopen",
        missing: "Block the days off in Calendar first.",
        build: () => (c?.closed ? { title: "I'm back and booking", body: `The studio is open again from ${dayLong(c.closed.reopen)}. ${DEPOSIT}`, cta: "Book now", url: `${SITE}/booking` } : null),
      },
      {
        id: "new_product",
        name: "New in the shop",
        tag: "Shop",
        fills: "Your newest product and its price",
        missing: "Add a product to the shop first.",
        build: () => {
          const p = product(newest);
          if (!p) return null;
          const price = priceOf(p);
          return { title: `New in the shop: ${p.name}`, body: `Just added: ${p.name}${price ? `, ${price}` : ""}. Order online for UK delivery.`, cta: "Shop now", url: `${SITE}/shop` };
        },
      },
      {
        id: "restock",
        name: "Back in stock",
        tag: "Shop",
        fills: "A product you pick that is in stock",
        missing: "Nothing in the shop is in stock.",
        build: () => {
          const p = product(inStock);
          if (!p) return null;
          const price = priceOf(p);
          return { title: `Back in stock: ${p.name}`, body: `${p.name} is back in stock${price ? ` at ${price}` : ""}. It sold out last time, so order soon.`, cta: "Shop now", url: `${SITE}/shop` };
        },
      },
      {
        id: "kids",
        name: "Kids' styles for school",
        tag: "Season",
        fills: "Your kids' services and starting price",
        missing: "No kids' services are bookable.",
        build: () => (c?.kidsFrom ? { title: "Back-to-school braids", body: `Neat, long-lasting kids' styles from ${gbp(c.kidsFrom)}. Book a weekend slot before term starts.`, cta: "Book for your child", url: `${SITE}/booking` } : null),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, days.join(","), productId, products.length]);

  const template = templates.find((t) => t.id === picked)!;
  const built = template.build();
  const msg: Message | null = built ? { ...built, ...(override ?? {}) } : null;
  const s = status.data;
  const people = audience === "all_clients" ? s?.email.allClientCount ?? 0 : s?.email.subscriberCount ?? 0;
  const anyChannel = channels.email || channels.webPush || channels.sms || channels.whatsapp;
  const tooLong = msg ? msg.title.length > TITLE_MAX || msg.body.length > BODY_MAX : false;
  const ready = Boolean(msg) && anyChannel && !tooLong && !send.isPending;

  const pick = (id: TemplateId) => {
    setPicked(id);
    setOverride(null);
    setEditing(false);
    setProductId("");
  };
  const toggleDay = (d: string) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    setChosenDays(next.slice(0, 4));
    setOverride(null);
  };
  const channelRow: Array<{ key: keyof typeof channels; label: string; configured: boolean; count?: number }> = [
    { key: "email", label: "Email", configured: Boolean(s?.email.configured), count: people },
    { key: "webPush", label: "Phone notification", configured: Boolean(s?.webPush.configured), count: s?.webPush.subscriberCount },
    { key: "sms", label: "Text", configured: Boolean(s?.sms.configured), count: audience === "all_clients" ? s?.sms.allClientCount : s?.sms.subscriberCount },
    { key: "whatsapp", label: "WhatsApp", configured: Boolean(s?.whatsapp.configured), count: audience === "all_clients" ? s?.whatsapp.allClientCount : s?.whatsapp.subscriberCount },
  ];

  return (
    <Card title="Quick announcements" action={<span className="text-xs text-[#6B6458]">Tap a message, check it, then press Send</span>}>
      <div className="grid gap-5">
        <section aria-labelledby="qa-pick" className="grid gap-2.5">
          <h3 id="qa-pick" className="!font-sans !text-xs font-semibold uppercase !tracking-[0.08em] text-[#6B6458]">1 · Pick a message</h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((t) => {
              const available = Boolean(t.build());
              const active = picked === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pick(t.id)}
                  className={`grid min-h-[6.5rem] content-start gap-1.5 rounded-2xl border p-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] ${active ? "border-2 border-[#1A1A1A] bg-[#FBF8F2]" : "border-[#E6E1D8] bg-white hover:border-[#C9A84C]"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="text-[15px] text-[#1A1A1A]">{t.name}</strong>
                    <Pill tone={TAG_TONE[t.tag]}>{t.tag}</Pill>
                  </span>
                  <span className="text-[13px] leading-snug text-[#6B6458]">{available ? t.fills : t.missing}</span>
                </button>
              );
            })}
          </div>
          {picked === "free_days" && freeDays.length ? (
            <div className="grid gap-1.5">
              <span className="text-[13px] text-[#6B6458]">Days with no bookings. Tap to add or remove (up to 4).</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Days to offer">
                {freeDays.map((d) => (
                  <Chip key={d} active={days.includes(d)} onClick={() => toggleDay(d)}>
                    {day(d)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          {(picked === "new_product" || picked === "restock") && (picked === "new_product" ? newest : inStock).length ? (
            <label className="grid max-w-sm gap-1.5 text-[13px] text-[#6B6458]">
              Product
              <select
                value={productId || String((picked === "new_product" ? newest : inStock)[0]?.id ?? "")}
                onChange={(e) => (setProductId(e.target.value), setOverride(null))}
                className="rounded-xl border border-[#E6E1D8] bg-white px-3 py-2 text-sm text-[#1A1A1A]"
              >
                {(picked === "new_product" ? newest : inStock).slice(0, 40).map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        <section aria-labelledby="qa-check" className="grid gap-2.5">
          <h3 id="qa-check" className="!font-sans !text-xs font-semibold uppercase !tracking-[0.08em] text-[#6B6458]">2 · Check what people get</h3>
          {!msg ? (
            <Empty>{template.missing}</Empty>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="grid gap-4">
                <div className="grid gap-2 rounded-2xl border border-[#E6E1D8] bg-white p-4">
                  <span className="text-xs font-semibold text-[#6B6458]">Phone notification</span>
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#EFEDE8] p-3">
                    <img src="/email/ebysplace-logo-email.png" alt="" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain" />
                    <div className="min-w-0 text-[13px]">
                      <div className="font-bold text-[#1A1A1A]">{msg.title}</div>
                      <div className="leading-snug text-[#1A1A1A]">{msg.body}</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 rounded-2xl border border-[#E6E1D8] bg-white p-4">
                  <span className="text-xs font-semibold text-[#6B6458]">Text message and WhatsApp</span>
                  <p className="max-w-[92%] whitespace-pre-line rounded-[14px_14px_14px_4px] bg-[#E3F2E8] px-3 py-2.5 text-[13px] leading-snug text-[#1A1A1A]">{`${msg.title}\n${msg.body}\n${msg.url}`}</p>
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl bg-[#ECE4D2] p-3 sm:p-5">
                <span className="px-1 text-xs font-semibold text-[#6B4000]">Email · from info@ebysplace.com · subject: {msg.title}</span>
                <div className="mx-auto w-full max-w-[560px] rounded border border-[#DED4C4] bg-[#FAF7F2]">
                  <div className="border-b border-[#DED4C4] px-6 pb-5 pt-7 text-center">
                    <img src="/email/ebysplace-logo-email.png" alt="Eby's Place — Beauty in every strand" className="mx-auto block h-auto w-[200px]" />
                  </div>
                  <div className="px-6 pb-2 pt-7 font-[Arial,'Segoe_UI',sans-serif] text-[15px] leading-[1.7] text-[#1A1A1A] sm:px-9">
                    {/* Same as renderBrandedEmail: the one paragraph, then the gold button. */}
                    <p className="mb-5 text-[16.5px]">{msg.body}</p>
                    <span className="mb-8 mt-2.5 inline-block rounded-[3px] bg-[#C9A84C] px-[26px] py-[13px] font-[Arial,sans-serif] text-[12.5px] font-bold uppercase tracking-[1px] text-[#FFFBF2]">{msg.cta}</span>
                    <p className="my-7">
                      <span className="block font-[Georgia,serif] text-xl italic">Eby's Place</span>
                      <span className="text-sm text-[#6b5f4d]">Founder &amp; Service Lead</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-t border-[#DED4C4] px-6 pb-6 pt-4 font-[Arial,sans-serif] sm:px-9">
                    <span className="text-[10.5px] font-bold uppercase tracking-[1.5px] text-[#8a7256]">Beauty in every strand</span>
                    <span className="text-[13px] text-[#8a641e]">info@ebysplace.com</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {msg && editing ? (
            <div className="grid gap-2 rounded-2xl border border-[#E6E1D8] bg-white p-4">
              <label htmlFor="qa-title" className="text-sm font-semibold">
                Subject and notification title <span className="font-normal text-[#6B6458]">({msg.title.length}/{TITLE_MAX})</span>
              </label>
              <input id="qa-title" value={msg.title} maxLength={TITLE_MAX} onChange={(e) => setOverride({ title: e.target.value, body: msg.body })} className="rounded-xl border border-[#E6E1D8] bg-white px-3 py-2 text-sm" />
              <label htmlFor="qa-body" className="text-sm font-semibold">
                Message <span className="font-normal text-[#6B6458]">({msg.body.length}/{BODY_MAX})</span>
              </label>
              <textarea id="qa-body" value={msg.body} maxLength={BODY_MAX} rows={3} onChange={(e) => setOverride({ title: msg.title, body: e.target.value })} className="rounded-xl border border-[#E6E1D8] bg-white px-3 py-2 text-sm" />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="qa-send" className="grid gap-3 rounded-2xl border border-[#E6E1D8] bg-white p-4">
          <h3 id="qa-send" className="!font-sans !text-xs font-semibold uppercase !tracking-[0.08em] text-[#6B6458]">3 · Send</h3>
          <div className="flex flex-wrap gap-6">
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Who</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Who gets it">
                <Chip active={audience === "all_clients"} onClick={() => setAudience("all_clients")} count={s?.email.allClientCount}>
                  All clients
                </Chip>
                <Chip active={audience === "subscribers"} onClick={() => setAudience("subscribers")} count={s?.email.subscriberCount}>
                  Subscribers only
                </Chip>
              </div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">How</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {channelRow.map((ch) => (
                  <label key={ch.key} className={`inline-flex min-h-10 items-center gap-2 ${ch.configured ? "" : "text-[#6B6458]"}`}>
                    <input
                      type="checkbox"
                      className="h-[18px] w-[18px] accent-[#1A1A1A]"
                      checked={channels[ch.key] && ch.configured}
                      disabled={!ch.configured}
                      onChange={(e) => setChannels((prev) => ({ ...prev, [ch.key]: e.target.checked }))}
                    />
                    {ch.label}
                    {ch.configured ? (ch.count !== undefined ? <span className="tabular-nums text-[#6B6458]">· {ch.count}</span> : null) : <span className="text-xs">(not set up)</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#EFEBE4] pt-3">
            <PrimaryButton
              disabled={!ready}
              onClick={() =>
                msg &&
                send.mutate({
                  title: msg.title.trim(),
                  body: msg.body.trim(),
                  url: msg.url,
                  ctaLabel: msg.cta,
                  audience,
                  channels: {
                    email: channels.email && Boolean(s?.email.configured),
                    webPush: channels.webPush && Boolean(s?.webPush.configured),
                    sms: channels.sms && Boolean(s?.sms.configured),
                    whatsapp: channels.whatsapp && Boolean(s?.whatsapp.configured),
                  },
                })
              }
            >
              {send.isPending ? "Sending…" : `Send to ${people} ${people === 1 ? "person" : "people"}`}
            </PrimaryButton>
            <GhostButton disabled={!msg} onClick={() => setEditing((v) => !v)}>
              {editing ? "Done changing" : "Change the wording"}
            </GhostButton>
            <span className="text-[13px] text-[#6B6458]">Never goes to anyone who unsubscribed. Texts and WhatsApp are charged per message by your SMS provider.</span>
          </div>
          {tooLong ? <p className="text-[13px] text-[#B3261E]">Keep the title under {TITLE_MAX} characters and the message under {BODY_MAX}.</p> : null}
        </section>

        <section aria-labelledby="qa-recent" className="grid gap-2">
          <h3 id="qa-recent" className="!font-sans !text-[15px] font-semibold text-[#1A1A1A]">Sent recently</h3>
          {!c?.recent.length ? (
            <Empty>No announcements sent yet.</Empty>
          ) : (
            <ScrollBox label="Sent recently" size="sm">
              <ul className="grid grid-cols-1">
                {c.recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 border-t border-[#EFEBE4] py-2.5 first:border-t-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#1A1A1A]">{r.title}</div>
                      <div className="text-xs text-[#6B6458]">
                        {r.ways.length ? r.ways.join(", ") : "Sent"} · {r.audience === "subscribers" ? "subscribers" : r.audience === "selected" ? "chosen people" : "all clients"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.failed ? <Pill tone="bad">Partly failed</Pill> : null}
                      <span className="text-xs text-[#6B6458]">{niceDateTime(r.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollBox>
          )}
        </section>
      </div>
    </Card>
  );
}
