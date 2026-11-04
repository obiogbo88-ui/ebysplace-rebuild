import { trpc } from "@/lib/trpc";
import { gbp } from "./ui";

/** What the signed-in person's role lets them do (server/crm/router.ts `me`). */
export function useAccess() {
  const me = trpc.crm.me.useQuery(undefined, { staleTime: 60_000, retry: false });
  const d = me.data;
  return {
    loaded: Boolean(d),
    roleLabel: d?.roleLabel ?? "",
    canSeeMoney: d ? d.canSeeMoney : true,
    canManageAccess: Boolean(d?.canManageAccess),
    /** Money as £, or "Hidden" for roles that can't see money. */
    money: (n: number | null | undefined) => (d && !d.canSeeMoney ? "Hidden" : gbp(Number(n ?? 0))),
  };
}
