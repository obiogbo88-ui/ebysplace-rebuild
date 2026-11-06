import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, Chip, GhostButton, PrimaryButton } from "./ui";
import { QuickAnnouncements } from "./QuickAnnouncements";
import { ListInviteCard } from "./ListInviteCard";

const GROUPS = [
  { id: "all", label: "Everyone" },
  { id: "due_rebook", label: "Due a rebook" },
  { id: "regulars", label: "Regulars" },
  { id: "shop", label: "Shop interest" },
  { id: "subscribers", label: "Subscribers" },
  { id: "new_this_month", label: "New this month" },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];

/** Group email to clients. Two steps: preview (who and what), then send. One email per person. */
export function CampaignsPage() {
  const [group, setGroup] = useState<GroupId>("due_rebook");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const audience = trpc.crm.campaignAudience.useQuery({ filter: group }, { retry: false });
  const send = trpc.crm.sendCampaign.useMutation({
    onSuccess: (r) => {
      setPreviewing(false);
      setSubject("");
      setMessage("");
      toast.success(`Sent to ${r.delivered} of ${r.recipientCount}`, { description: r.failed.length ? `Not delivered: ${r.failed.join(", ")}` : undefined });
    },
    onError: (e) => toast.error(e.message),
  });
  const count = audience.data?.count ?? 0;
  const paragraphs = message.split(/\r?\n\s*\r?\n/).map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim()).filter(Boolean);
  const ready = subject.trim().length >= 3 && message.trim().length >= 10 && count > 0;

  return (
    <div className="grid gap-4">
    <QuickAnnouncements />
    <ListInviteCard />
    <Card title="Email a group of clients" action={<span className="text-xs text-[#6B6458]">From info@ebysplace.com</span>}>
      <div className="grid gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold">Who</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a group">
            {GROUPS.map((g) => (
              <Chip key={g.id} active={group === g.id} onClick={() => (setGroup(g.id), setPreviewing(false))}>
                {g.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-[#6B6458]">
            {audience.isLoading ? "Counting…" : `${count} ${count === 1 ? "person" : "people"}`}
            {audience.data?.sample.length ? `, including ${audience.data.sample.join(", ")}` : ""}. Only clients who booked, bought or joined your list, and never anyone who unsubscribed.
          </p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="crm-campaign-subject" className="text-sm font-semibold">
            Subject
          </label>
          <input id="crm-campaign-subject" value={subject} onChange={(e) => (setSubject(e.target.value), setPreviewing(false))} maxLength={120} placeholder="Christmas slots are open" className="rounded-xl border border-[#E6E1D8] bg-white px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="crm-campaign-message" className="text-sm font-semibold">
            Message
          </label>
          <textarea id="crm-campaign-message" value={message} onChange={(e) => (setMessage(e.target.value), setPreviewing(false))} rows={6} maxLength={3000} placeholder={"Book before 1 December to get your pick of dates.\n\nLeave a blank line between paragraphs."} className="rounded-xl border border-[#E6E1D8] bg-white px-3 py-2 text-sm" />
          <span className="text-xs text-[#6B6458]">"Hi [first name]," is added at the top and an unsubscribe link at the bottom.</span>
        </div>

        {previewing ? (
          <div className="grid gap-3 rounded-2xl border border-[#C9A84C] bg-[#FBF8F2] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A641E]">Preview · what {audience.data?.sample[0]?.split(" ")[0] ?? "each person"} will get</p>
            <p className="font-semibold">{subject}</p>
            <div className="grid gap-2 text-sm">
              <p>Hi {audience.data?.sample[0]?.split(" ")[0] ?? "there"},</p>
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p className="text-xs text-[#6B6458]">Don't want emails like this? Unsubscribe here: (their own link)</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton disabled={send.isPending} onClick={() => send.mutate({ filter: group, subject, message, expectedCount: count })}>
                {send.isPending ? "Sending…" : `Send to ${count} ${count === 1 ? "person" : "people"}`}
              </PrimaryButton>
              <GhostButton onClick={() => setPreviewing(false)} disabled={send.isPending}>
                Edit
              </GhostButton>
            </div>
          </div>
        ) : (
          <div>
            <PrimaryButton disabled={!ready} onClick={() => setPreviewing(true)}>
              Preview
            </PrimaryButton>
          </div>
        )}
      </div>
    </Card>
    </div>
  );
}
