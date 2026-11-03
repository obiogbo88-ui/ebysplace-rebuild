import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Instagram } from "lucide-react";
import { Card, Empty, ErrorNote, Loading, Pill, PrimaryButton, Row, STATUS_TONE, Toggle, niceDate, niceDateTime } from "./ui";

const STATUS_LABEL: Record<string, string> = { posted: "Posted", ready: "Ready", publishing: "Posting…", partial: "Part posted", failed: "Failed" };

export function SocialPage() {
  const utils = trpc.useUtils();
  const q = trpc.crm.social.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const [confirming, setConfirming] = useState(false);
  const setAutomation = trpc.crm.setAutomation.useMutation({
    onSuccess: (_r: unknown, v: any) => {
      toast.success(v.enabled ? "Autopilot is on" : "Autopilot paused. Nothing will post until you switch it back on.");
      utils.crm.social.invalidate();
      utils.crm.automations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const postNow = trpc.crm.postNow.useMutation({
    onSuccess: (r) => {
      setConfirming(false);
      const o = r.outcome as any;
      if (o?.status === "posted" || o?.igMediaId) toast.success("Posted to Instagram", { description: "It can take a minute to appear on the profile." });
      else if (o?.skipped) toast.info(`Nothing posted: ${o.skipped}`);
      else toast.info("Sent to Instagram. Check the list below for the result.");
      utils.crm.social.invalidate();
      utils.crm.overview.invalidate();
    },
    onError: (e) => {
      setConfirming(false);
      toast.error(e.message);
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data!;
  const todays = d.posts.filter((p) => p.slotDate === d.today);
  const earlier = d.posts.filter((p) => p.slotDate !== d.today);

  return (
    <div className="grid gap-4">
      <Card>
        <Row>
          <Instagram className="h-6 w-6 shrink-0 text-[#8A641E]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <label htmlFor="crm-autopilot" className="block font-semibold">
              {d.envPaused ? "Paused in Vercel settings" : d.autopilot ? "Autopilot is on" : "Autopilot is paused"}
            </label>
            <span className="text-[13px] text-[#6B6458]">
              {d.instagramConfigured ? "Posting to @ebysplace1" : "Instagram isn't connected"} · {d.schedule.map((s) => s.time).join(" · ")} UK time
              {d.facebookConfigured ? " · Facebook too" : " · Facebook waits for Page access"}
            </span>
          </div>
          <Toggle id="crm-autopilot" label="Social autopilot" checked={d.autopilot && !d.envPaused} disabled={d.envPaused || setAutomation.isPending} onChange={(enabled) => setAutomation.mutate({ key: "social_autopilot", enabled })} />
        </Row>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#EFEBE4] pt-3">
          {confirming ? (
            <>
              <span className="text-sm">Post the next of today's posts to Instagram now?</span>
              <PrimaryButton disabled={postNow.isPending} onClick={() => postNow.mutate()}>
                {postNow.isPending ? "Posting… (up to 2 minutes)" : "Yes, post it"}
              </PrimaryButton>
              <button type="button" className="text-sm font-semibold text-[#6B6458] hover:underline" onClick={() => setConfirming(false)} disabled={postNow.isPending}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <PrimaryButton disabled={!d.autopilot || d.envPaused || !d.instagramConfigured} onClick={() => setConfirming(true)}>
                Post one now
              </PrimaryButton>
              <span className="text-[13px] text-[#6B6458]">Sends the next of today's three posts early. It won't post twice.</span>
            </>
          )}
        </div>
      </Card>

      <Card title="Today">
        {d.schedule.map((s) => {
          const p = todays.find((x) => x.slot === s.slot);
          return (
            <Row key={s.slot}>
              <Pill>{s.time}</Pill>
              {p?.imageUrl ? <img src={p.imageUrl} alt="" className="h-14 w-11 shrink-0 rounded-md object-cover" loading="lazy" /> : <span className="h-14 w-11 shrink-0 rounded-md bg-[#F6F5F2]" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold [overflow-wrap:anywhere]">{p ? p.title : "Not written yet"}</div>
                <div className="truncate text-[13px] text-[#6B6458]">{p ? `${p.kindLabel}${p.isAiGenerated ? " · AI images (labelled on Instagram)" : ""}` : "The autopilot writes it before it's due"}</div>
                {p?.error ? <div className="mt-1 break-words text-xs text-[#B3261E]">{p.error}</div> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {p ? <Pill tone={STATUS_TONE[p.status] ?? "grey"}>{STATUS_LABEL[p.status] ?? p.status}</Pill> : <Pill tone="grey">Later</Pill>}
                {p?.reelUrl ? (
                  <a className="text-xs font-semibold text-[#8A641E] hover:underline" href={p.reelUrl} target="_blank" rel="noreferrer">
                    Watch Reel
                  </a>
                ) : null}
              </div>
            </Row>
          );
        })}
      </Card>

      <Card title="Last two weeks">
        {earlier.length === 0 ? (
          <Empty>No earlier posts yet.</Empty>
        ) : (
          earlier.map((p) => (
            <Row key={p.id}>
              <span className="w-20 shrink-0 text-xs text-[#6B6458]">
                {niceDate(p.slotDate, { weekday: "short", day: "numeric", month: "short" })}
                <br />
                {d.schedule.find((s) => s.slot === p.slot)?.time}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold [overflow-wrap:anywhere]">{p.title}</div>
                <div className="truncate text-[13px] text-[#6B6458]">
                  {p.kindLabel}
                  {p.postedAt ? ` · posted ${niceDateTime(p.postedAt)}` : ""}
                </div>
                {p.error ? <div className="mt-1 break-words text-xs text-[#B3261E]">{p.error}</div> : null}
              </div>
              <Pill tone={STATUS_TONE[p.status] ?? "grey"}>{STATUS_LABEL[p.status] ?? p.status}</Pill>
            </Row>
          ))
        )}
      </Card>

      <Card title="Coming next">
        <p className="text-sm text-[#6B6458]">Accessory question posts (to get the audience ready for the shop), Kouvia sign-up posts for braiders, and AI-model Reels. These join the rotation once you approve the mockups.</p>
      </Card>
    </div>
  );
}
