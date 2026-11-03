import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, Empty, ErrorNote, Loading, Pill, Row, Toggle, niceDateTime } from "./ui";

const STATUS: Record<string, { tone: "live" | "new" | "wait"; label: string }> = {
  live: { tone: "live", label: "Running" },
  new: { tone: "new", label: "New" },
  needs_meta: { tone: "wait", label: "Needs Meta permission" },
};
const SENT_NAME: Record<string, string> = { review_ask: "Review request", rebook_nudge: "Rebook reminder", win_back: "We-miss-you email" };

export function AutomationsPage() {
  const utils = trpc.useUtils();
  const q = trpc.crm.automations.useQuery(undefined, { retry: false });
  const set = trpc.crm.setAutomation.useMutation({
    onMutate: async (v: any) => {
      await utils.crm.automations.cancel();
      const prev = utils.crm.automations.getData();
      if (prev) utils.crm.automations.setData(undefined, { ...prev, automations: prev.automations.map((a) => (a.key === v.key ? { ...a, enabled: v.enabled } : a)) });
      return { prev };
    },
    onSuccess: (_r: unknown, v: any) => toast.success(v.enabled ? "Switched on" : "Switched off"),
    onError: (e, _v, ctx) => {
      if (ctx?.prev) utils.crm.automations.setData(undefined, ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      utils.crm.automations.invalidate();
      utils.crm.social.invalidate();
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const groups = ["Clients", "Eby", "Followers", "Housekeeping"] as const;
  const heading: Record<string, string> = { Clients: "To clients", Eby: "To you", Followers: "To followers", Housekeeping: "Housekeeping" };

  return (
    <div className="grid gap-4">
      <p className="rounded-xl border border-[#E4EDFA] bg-[#F3F7FD] px-4 py-3 text-sm text-[#1F3D66]">
        The new client emails (review request, rebook reminder, we-miss-you) start <b>off</b>. Switch on the ones you want; each person gets each one only once, and anyone who unsubscribes is skipped. You can also turn them off for a single client on their profile.
      </p>
      {groups.map((g) => {
        const items = q.data!.automations.filter((a) => a.audience === g);
        if (!items.length) return null;
        return (
          <Card key={g} title={heading[g]}>
            {items.map((a) => (
              <Row key={a.key}>
                <div className="min-w-0 flex-1">
                  <label htmlFor={`crm-auto-${a.key}`} className="block font-semibold">
                    {a.title}
                  </label>
                  <span className="block text-[13px] text-[#6B6458]">{a.detail}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Pill tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Pill>
                    <span className="text-xs text-[#6B6458]">{a.when}</span>
                  </span>
                </div>
                {a.switchable ? <Toggle id={`crm-auto-${a.key}`} label={a.title} checked={a.enabled} disabled={set.isPending} onChange={(enabled) => set.mutate({ key: a.key, enabled })} /> : <span className="text-xs font-semibold text-[#6B6458]">{a.status === "needs_meta" ? "Not yet" : "Always on"}</span>}
              </Row>
            ))}
          </Card>
        );
      })}
      <Card title="Sent automatically, lately">
        {q.data!.recentSends.length === 0 ? (
          <Empty>Nothing yet. Emails the new automations send will be listed here.</Empty>
        ) : (
          q.data!.recentSends.map((s, i) => (
            <Row key={i}>
              <Pill tone="new">{SENT_NAME[s.automation] ?? s.automation}</Pill>
              <span className="min-w-0 flex-1 truncate text-sm">{s.clientKey.replace(/^[ep]:/, "")}</span>
              <span className="text-xs text-[#6B6458]">{niceDateTime(s.sentAt)}</span>
            </Row>
          ))
        )}
      </Card>
    </div>
  );
}
