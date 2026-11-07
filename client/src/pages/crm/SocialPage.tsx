import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, Empty, ErrorNote, Loading, Pill, PrimaryButton, Row, STATUS_TONE, Toggle, niceDate, niceDateTime, ScrollBox } from "./ui";

const STATUS_LABEL: Record<string, string> = { posted: "Posted", ready: "Ready", publishing: "Posting…", partial: "Part posted", failed: "Failed" };

type ChannelKey = "instagram" | "threads" | "facebook";
type PostRow = { status: string; igMediaId: string | null; threadsPostId: string | null; fbPostId: string | null; threadsDue?: boolean };

/** The channels a post can go to, in the order they're shown. TikTok is a card only until it's built. */
const CHANNELS: Array<{ key: ChannelKey; short: string; name: string; logo: string; logoClass: string; idOf: (p: PostRow) => string | null }> = [
  { key: "instagram", short: "IG", name: "Instagram", logo: "IG", logoClass: "bg-[linear-gradient(135deg,#f58529,#dd2a7b,#8134af)]", idOf: (p) => p.igMediaId },
  { key: "threads", short: "Threads", name: "Threads", logo: "@", logoClass: "bg-[#111111]", idOf: (p) => p.threadsPostId },
  { key: "facebook", short: "FB", name: "Facebook", logo: "f", logoClass: "bg-[#1877F2]", idOf: (p) => p.fbPostId },
];

type ChipState = "posted" | "due" | "missed" | "off";

/**
 * Where one post went on one channel: posted (has an id), due (still to go
 * out), missed (the run finished without it) or off (channel not connected).
 */
export function chipState(post: PostRow, id: string | null, connected: boolean, dueOverride = false): ChipState {
  if (id) return "posted";
  if (!connected) return "off";
  // Threads runs on its own clock: still due until its Threads time has passed.
  if (dueOverride) return "due";
  if (post.status === "ready" || post.status === "publishing" || post.status === "partial") return "due";
  // A fully "posted" item means no channel failed, so a missing id means the
  // channel wasn't connected when it went out (e.g. posts from before Threads).
  if (post.status === "posted") return "off";
  return "missed";
}

const CHIP_CLASS: Record<ChipState, string> = {
  posted: "bg-[#E3F2E8] text-[#1E7A46]",
  due: "bg-[#E4EDFA] text-[#1F5FB8]",
  missed: "bg-[#FBE4E1] text-[#B3261E]",
  off: "bg-[#EFEDE8] text-[#8D867C]",
};
const CHIP_TEXT: Record<ChipState, string> = { posted: "✓", due: "due", missed: "not posted", off: "—" };

function ChannelChips({ post, connected }: { post: PostRow; connected: Record<ChannelKey, boolean> }) {
  return (
    <div className="flex flex-wrap justify-end gap-1" aria-label="Where this post went">
      {CHANNELS.map((c) => {
        const state = chipState(post, c.idOf(post), connected[c.key], c.key === "threads" && !!post.threadsDue);
        return (
          <span key={c.key} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${CHIP_CLASS[state]}`} title={`${c.name}: ${state === "off" ? "not connected at the time" : state === "posted" ? "posted" : state === "due" ? "goes out with the next run" : "didn't post"}`}>
            {c.short} {CHIP_TEXT[state]}
          </span>
        );
      })}
    </div>
  );
}

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
      if (o?.status === "posted") toast.success("Posted", { description: "It can take a minute to appear on each profile." });
      else if (o?.skipped) toast.info(`Nothing posted: ${o.skipped}`);
      else toast.info("Sent. Check today's list for where it went.");
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
  const connected: Record<ChannelKey, boolean> = { instagram: d.instagramConfigured, threads: d.threadsConfigured, facebook: d.facebookConfigured };
  const anyConnected = connected.instagram || connected.threads || connected.facebook;
  const times = d.schedule.map((s) => s.time).join(" · ");

  const channelCards: Array<{ key: string; name: string; logo: string; logoClass: string; line: string; pill: { tone: "live" | "wait" | "grey"; text: string } }> = [
    { key: "instagram", name: "Instagram", logo: "IG", logoClass: CHANNELS[0].logoClass, line: "@ebysplace1 · Reels with music", pill: connected.instagram ? { tone: "live", text: "Connected" } : { tone: "grey", text: "Not set up" } },
    { key: "threads", name: "Threads", logo: "@", logoClass: CHANNELS[1].logoClass, line: `@ebysplace1 · ${d.threadsSchedule.map((s) => s.time).join(" · ")} (Threads' own peak times)`, pill: connected.threads ? { tone: "live", text: "Connected" } : { tone: "grey", text: "Not set up" } },
    { key: "facebook", name: "Facebook", logo: "f", logoClass: CHANNELS[2].logoClass, line: connected.facebook ? "facebook.com/EbysPlace" : "facebook.com/EbysPlace · needs Eby to give Page access", pill: connected.facebook ? { tone: "live", text: "Connected" } : { tone: "wait", text: "Needs Page access" } },
    { key: "tiktok", name: "TikTok", logo: "♪", logoClass: "bg-[#000000]", line: "Not set up yet. Needs a TikTok developer app.", pill: { tone: "grey", text: "Not set up" } },
  ];

  return (
    <div className="grid gap-4">
      <Card>
        <Row>
          <div className="min-w-0 flex-1">
            <label htmlFor="crm-autopilot" className="block font-semibold">
              {d.envPaused ? "Paused in Vercel settings" : d.autopilot ? "Autopilot is on" : "Autopilot is paused"}
            </label>
            <span className="text-[13px] text-[#6B6458]">Posts three times a day: {times} UK time, to every connected channel.</span>
          </div>
          <Toggle id="crm-autopilot" label="Social autopilot" checked={d.autopilot && !d.envPaused} disabled={d.envPaused || setAutomation.isPending} onChange={(enabled) => setAutomation.mutate({ key: "social_autopilot", enabled })} />
        </Row>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#EFEBE4] pt-3">
          {confirming ? (
            <>
              <span className="text-sm">Post the next of today's posts to every connected channel now?</span>
              <PrimaryButton disabled={postNow.isPending} onClick={() => postNow.mutate()}>
                {postNow.isPending ? "Posting… (up to 2 minutes)" : "Yes, post it"}
              </PrimaryButton>
              <button type="button" className="text-sm font-semibold text-[#6B6458] hover:underline" onClick={() => setConfirming(false)} disabled={postNow.isPending}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <PrimaryButton disabled={!d.autopilot || d.envPaused || !anyConnected} onClick={() => setConfirming(true)}>
                Post one now
              </PrimaryButton>
              <span className="text-[13px] text-[#6B6458]">Sends the next of today's posts early, or finishes one that missed a channel. It won't post twice.</span>
            </>
          )}
        </div>
      </Card>

      <Card title="Channels" action={<span className="text-xs text-[#6B6458]">Where each post goes</span>}>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          {channelCards.map((c) => (
            <div key={c.key} className="grid content-start gap-1.5 rounded-xl border border-[#EFEBE4] bg-[#FBF8F2] p-3">
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold text-white ${c.logoClass}`} aria-hidden="true">{c.logo}</span>
                <b className="text-[13.5px]">{c.name}</b>
              </div>
              <span className="text-xs leading-snug text-[#6B6458]">{c.line}</span>
              <Pill tone={c.pill.tone}>{c.pill.text}</Pill>
            </div>
          ))}
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
                <div className="truncate font-semibold">{p ? p.title : "Not written yet"}</div>
                <div className="truncate text-[13px] text-[#6B6458]">
                  {p ? `${p.kindLabel}${p.isAiGenerated ? " · AI images (labelled on Instagram)" : ""}` : "The autopilot writes it before it's due"}
                  {p?.reelUrl ? (
                    <>
                      {" · "}
                      <a className="font-semibold text-[#8A641E] hover:underline" href={p.reelUrl} target="_blank" rel="noreferrer">
                        Watch Reel
                      </a>
                    </>
                  ) : null}
                </div>
                {p?.error ? <div className="mt-1 break-words text-xs text-[#B3261E]">{p.error}</div> : null}
              </div>
              {p ? <ChannelChips post={p} connected={connected} /> : <Pill tone="grey">Later</Pill>}
            </Row>
          );
        })}
        <p className="mt-2 text-xs text-[#6B6458]">✓ posted · due = goes out with the next run · — channel not connected at the time</p>
      </Card>

      <Card title="Last two weeks">
        {earlier.length === 0 ? (
          <Empty>No earlier posts yet.</Empty>
        ) : (
          <ScrollBox label="Last two weeks of posts" size="md">
            {earlier.map((p) => (
              <Row key={p.id}>
                <span className="w-20 shrink-0 text-xs text-[#6B6458]">
                  {niceDate(p.slotDate, { weekday: "short", day: "numeric", month: "short" })}
                  <br />
                  {d.schedule.find((s) => s.slot === p.slot)?.time}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.title}</div>
                  <div className="truncate text-[13px] text-[#6B6458]">
                    {p.kindLabel}
                    {p.postedAt ? ` · posted ${niceDateTime(p.postedAt)}` : ""}
                  </div>
                  {p.error ? <div className="mt-1 break-words text-xs text-[#B3261E]">{p.error}</div> : null}
                </div>
                {p.status === "failed" ? <Pill tone={STATUS_TONE[p.status] ?? "grey"}>{STATUS_LABEL[p.status]}</Pill> : <ChannelChips post={p} connected={connected} />}
              </Row>
            ))}
          </ScrollBox>
        )}
      </Card>

      <Card title="Coming next">
        <p className="text-sm text-[#6B6458]">Accessory question posts (to get the audience ready for the shop), Kouvia sign-up posts for braiders, and AI-model Reels. These join the rotation once you approve the mockups.</p>
      </Card>
    </div>
  );
}
