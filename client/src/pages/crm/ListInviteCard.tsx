import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, GhostButton, Pill, PrimaryButton } from "./ui";

/**
 * "Invite past customers to the list": paying customers who were never shown
 * the booking-form notice get one email each, and join only if they tap the
 * button. People waiting to pick a new date start unticked.
 */
export function ListInviteCard() {
  const utils = trpc.useUtils();
  const q = trpc.crm.listInvite.useQuery(undefined, { retry: false });
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"pick" | "preview" | "confirm">("pick");
  const [result, setResult] = useState<{ attempted: number; sent: number; failed: Array<{ key: string; name: string }>; at: Date } | null>(null);
  const send = trpc.crm.sendListInvite.useMutation({
    onSuccess: (r) => {
      setResult({ ...r, at: new Date() });
      setStep("pick");
      setTicked(new Set(r.failed.map((f) => f.key)));
      void utils.crm.listInvite.invalidate();
      void utils.crm.clients.invalidate();
    },
  });

  useEffect(() => {
    if (q.data && !result) setTicked(new Set(q.data.candidates.filter((c) => !c.waiting).map((c) => c.key)));
  }, [q.data, result]);

  const candidates = q.data?.candidates ?? [];
  const count = candidates.filter((c) => ticked.has(c.key)).length;
  const toggle = (key: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
  const preview = q.data?.preview;

  return (
    <Card title="Invite past customers to the list" action={<span className="text-xs text-[#6B6458]">From info@ebysplace.com</span>}>
      <div className="grid gap-3">
        {q.error ? <p className="text-sm text-[#B3261E]">{q.error.message}</p> : null}
        {q.isLoading ? <p className="text-sm text-[#6B6458]">Finding past customers…</p> : null}

        {result ? (
          <div className="grid gap-1 rounded-xl border border-[#BFE3CB] bg-[#EEF8F1] p-3 text-[13px] text-[#1E5A35]" role="status">
            <span>
              <b className="text-[#1A1A1A]">Invite sent to {result.sent} of {result.attempted}.</b> {result.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
            </span>
            <span>They show as "Invited" on Clients. Anyone who joins moves to "On the list".</span>
            {result.failed.length ? (
              <span className="text-[#B3261E]">
                Not sent: {result.failed.map((f) => f.name).join(", ")}.{" "}
                <button type="button" className="font-semibold underline" onClick={() => send.mutate({ keys: result.failed.map((f) => f.key) })} disabled={send.isPending}>
                  Try again
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        {q.data && !candidates.length ? (
          <p className="text-sm text-[#6B6458]">Everyone who has paid is on the list or has already been invited.</p>
        ) : null}

        {candidates.length ? (
          <>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-[28px] font-bold leading-tight tabular-nums">{candidates.length}</div>
                <div className="text-[13px] text-[#6B6458]">paying customers to invite</div>
              </div>
              <div>
                <div className="text-[28px] font-bold leading-tight tabular-nums">{count}</div>
                <div className="text-[13px] text-[#6B6458]">ticked</div>
              </div>
            </div>
            <div className="grid max-h-[260px] gap-0.5 overflow-auto rounded-xl border border-[#EFEBE4] p-1.5" role="group" aria-label="Customers to invite">
              {candidates.map((c) => (
                <label key={c.key} htmlFor={`invite-${c.key}`} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#FBF8F2]">
                  <input id={`invite-${c.key}`} type="checkbox" className="h-4 w-4 shrink-0 accent-[#1A1A1A]" checked={ticked.has(c.key)} onChange={() => toggle(c.key)} disabled={send.isPending} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block text-xs text-[#6B6458]">
                      {[c.bookings ? `${c.bookings} booking${c.bookings === 1 ? "" : "s"}` : null, c.orders ? `${c.orders} shop order${c.orders === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {c.waiting ? <Pill tone="wait">Picking a new date</Pill> : null}
                </label>
              ))}
            </div>

            {step === "preview" && preview ? (
              <div className="grid gap-2 rounded-2xl border border-[#C9A84C] bg-[#FBF8F2] p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A641E]">Preview · what each person gets</p>
                <p className="font-semibold">{preview.subject}</p>
                {preview.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <span className="w-fit rounded-[3px] bg-[#C9A84C] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#FFFBF2]">{preview.cta}</span>
                {preview.closing.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <p className="text-xs text-[#6B6458]">"Hi [first name]" uses each person's own name. "Join the list" is their own one-tap link.</p>
              </div>
            ) : null}

            {step === "confirm" ? (
              <div className="grid gap-2 rounded-xl border border-[#E7C873] bg-[#FFF6DD] p-3 text-[13px] text-[#5E4512]">
                <span>
                  <b className="text-[#1A1A1A]">Send the invite to {people(count)}?</b> Each gets their own email from info@ebysplace.com. They're only added if they tap "Join the list".
                </span>
                <div className="flex flex-wrap gap-2">
                  <GhostButton onClick={() => setStep("pick")} disabled={send.isPending}>
                    Cancel
                  </GhostButton>
                  <PrimaryButton onClick={() => send.mutate({ keys: candidates.filter((c) => ticked.has(c.key)).map((c) => c.key) })} disabled={send.isPending || !count}>
                    {send.isPending ? "Sending…" : `Yes, send ${count}`}
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <GhostButton onClick={() => setStep(step === "preview" ? "pick" : "preview")}>{step === "preview" ? "Hide the email" : "See the email"}</GhostButton>
                <PrimaryButton onClick={() => setStep("confirm")} disabled={!count}>
                  Send invite to {count}
                </PrimaryButton>
              </div>
            )}
            {send.error ? <p className="text-sm text-[#B3261E]">{send.error.message}</p> : null}
            <p className="text-xs text-[#6B6458]">Only people who paid a deposit or bought from the shop are shown. People who left the list, or said no when booking, never appear here. Each person can only be invited once.</p>
          </>
        ) : null}
      </div>
    </Card>
  );
}
