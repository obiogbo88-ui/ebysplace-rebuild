import { SiteFooter, SiteHeader } from "@/pages/Home";
import { trpc } from "@/lib/trpc";
import { getExistingPushSubscription, isPushSupported, pushSubscriptionToInput, subscribeToPush } from "@/lib/webPush";
import { REBOOK_WINDOW_DAYS, addDays, formatLongDate, isDayBlocked, isTimeUnavailable, startTimesFor, weekdayOf } from "@shared/rebook";
import { CalendarCheck2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RebookPageProps = { params: { id: string; token: string } };

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayNumber(date: string) {
  return Number(date.slice(8, 10));
}

function monthShort(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default function Rebook({ params }: RebookPageProps) {
  const bookingId = Number(params.id);
  const token = params.token || "";
  const validId = Number.isInteger(bookingId) && bookingId > 0;
  const info = trpc.public.getRebook.useQuery({ bookingId, token }, { enabled: validId && token.length >= 10, retry: false });
  const rebook = trpc.public.rebook.useMutation();
  const subscribePush = trpc.public.subscribePush.useMutation();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pushState, setPushState] = useState<"idle" | "on" | "unsupported" | "denied">("idle");

  useEffect(() => {
    document.title = "Choose a new date | Eby's Place";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  const days = useMemo(() => {
    if (!info.data) return [] as { date: string; full: boolean }[];
    const list: { date: string; full: boolean }[] = [];
    for (let i = 1; i <= REBOOK_WINDOW_DAYS; i += 1) {
      const d = addDays(info.data.today, i);
      const times = startTimesFor(d);
      const full = isDayBlocked(d, info.data.blockedSlots) || times.every((t) => isTimeUnavailable(d, t, info.data!.blockedSlots, info.data!.taken));
      list.push({ date: d, full });
    }
    return list;
  }, [info.data]);

  const times = useMemo(() => (date ? startTimesFor(date) : []), [date]);

  const turnOnNotifications = async () => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    try {
      const subscription = (await getExistingPushSubscription()) || (await subscribeToPush());
      if (!subscription) {
        setPushState(typeof Notification !== "undefined" && Notification.permission === "denied" ? "denied" : "unsupported");
        return;
      }
      await subscribePush.mutateAsync(pushSubscriptionToInput(subscription));
      setPushState("on");
    } catch {
      setPushState("unsupported");
    }
  };

  const shell = (children: React.ReactNode) => (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-28 sm:pt-32">{children}</main>
      <SiteFooter />
    </>
  );

  if (!validId || token.length < 10 || info.error) {
    return shell(
      <section className="rounded-3xl border border-[#c9a84c]/30 bg-[#fffaf1] p-6 text-[#2a1a0b] shadow-sm sm:p-8">
        <h1 className="serif text-3xl">This link can&rsquo;t be used</h1>
        <p className="mt-3 text-[#4a3014]/80">{info.error?.message || "This link isn't valid. If you need to change your booking, reply to our email."}</p>
        <p className="mt-3 text-[#4a3014]/80">You can also email us at <strong>info@ebysplace.com</strong>.</p>
      </section>,
    );
  }

  if (info.isLoading || !info.data) {
    return shell(<p className="py-20 text-center text-[#4a3014]/70">Loading your booking&hellip;</p>);
  }

  const data = info.data;

  if (rebook.data) {
    return shell(
      <section className="rounded-3xl border border-[#c9a84c]/30 bg-[#fffaf1] p-6 text-[#2a1a0b] shadow-sm sm:p-8">
        <CalendarCheck2 aria-hidden className="h-10 w-10 text-[#8a641e]" />
        <h1 className="serif mt-3 text-3xl">You&rsquo;re booked in, {data.firstName}!</h1>
        <p className="mt-3 text-lg">{data.serviceName} &middot; <strong>{rebook.data.dateLabel}, {rebook.data.time}</strong>{data.serviceLocation === "home_service" ? " at your home" : " at the studio"}.</p>
        <p className="mt-2 text-[#4a3014]/80">{rebook.data.emailSent ? "A confirmation email is on its way." : "We've saved your new date."}{data.depositPaid ? " Your £20 deposit has moved with you." : ""}</p>
        <div className="mt-6 rounded-2xl border border-[#c9a84c]/30 bg-white/70 p-4">
          <p className="font-bold">Get a reminder, and hear first when dates open up</p>
          {pushState === "on" ? (
            <p className="mt-2 text-emerald-700">Notifications are on. Thank you!</p>
          ) : pushState === "unsupported" ? (
            <p className="mt-2 text-sm text-[#4a3014]/80">On an iPhone, tap Share, then Add to Home Screen. Open Eby&rsquo;s Place from your home screen and tap Allow when it asks.</p>
          ) : pushState === "denied" ? (
            <p className="mt-2 text-sm text-[#4a3014]/80">Notifications are switched off for this site in your browser settings. You can turn them back on there.</p>
          ) : (
            <button type="button" className="btn-gold mt-3 w-full sm:w-auto" onClick={turnOnNotifications} disabled={subscribePush.isPending}>Turn on notifications</button>
          )}
        </div>
      </section>,
    );
  }

  return shell(
    <section className="rounded-3xl border border-[#c9a84c]/30 bg-[#fffaf1] p-5 text-[#2a1a0b] shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a641e]" style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}>Choose a new date</p>
      <h1 className="serif mt-2 text-3xl">Hi {data.firstName}</h1>
      <p className="mt-2 text-[#4a3014]/80">
        {data.serviceName}{data.depositPaid ? " · £20 deposit paid" : ""} · was {formatLongDate(data.currentDate)}, {data.currentTime}
      </p>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#8a641e]">Pick a day</h2>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-2" role="listbox" aria-label="Days">
        {days.map((day) => {
          const selected = day.date === date;
          return (
            <button
              key={day.date}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={day.full}
              onClick={() => { setDate(day.date); setTime(""); }}
              className={`flex w-16 flex-none flex-col items-center rounded-2xl border px-1 py-2 text-xs transition ${selected ? "border-black bg-black text-[#C9A84C]" : day.full ? "border-[#e2d8c6] text-[#b8ad9c] line-through" : "border-[#e2d8c6] bg-white hover:border-[#8a641e]"}`}
            >
              <span>{DAY_SHORT[weekdayOf(day.date)]}</span>
              <strong className="text-lg leading-tight">{dayNumber(day.date)}</strong>
              <span>{day.full ? "Full" : monthShort(day.date)}</span>
            </button>
          );
        })}
      </div>

      {date ? (
        <>
          <h2 className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#8a641e]">Pick a time · {formatLongDate(date)}</h2>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {times.map((t) => {
              const unavailable = isTimeUnavailable(date, t, data.blockedSlots, data.taken);
              const selected = t === time;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={selected}
                  onClick={() => setTime(t)}
                  className={`rounded-xl border py-2 text-sm transition ${selected ? "border-black bg-black text-[#C9A84C]" : unavailable ? "border-[#e2d8c6] text-[#b8ad9c] line-through" : "border-[#e2d8c6] bg-white hover:border-[#8a641e]"}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {rebook.error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{rebook.error.message}</p> : null}

      <button
        type="button"
        className="btn-gold mt-6 w-full"
        disabled={!date || !time || rebook.isPending}
        onClick={() => rebook.mutate({ bookingId, token, date, time })}
      >
        {rebook.isPending ? "Moving your booking…" : date && time ? `Move my booking to ${formatLongDate(date)}, ${time}` : "Choose a day and time"}
      </button>
      <p className="mt-3 text-center text-sm text-[#4a3014]/70">
        {data.depositPaid ? "No extra payment. Your £20 deposit comes with you." : "No payment needed to move your booking."} Rather talk to us? Reply to our email.
      </p>
    </section>,
  );
}
