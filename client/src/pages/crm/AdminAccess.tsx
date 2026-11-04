import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Avatar, Card, GhostButton, Pill, PrimaryButton, niceDateTime } from "./ui";
import { ASSIGNABLE_ROLES, ROLE_INFO, type AdminRole, type AssignableRole } from "@shared/adminRoles";

type Admin = { email: string; name: string | null; lastSignedIn: string | null; owner: boolean; role: AdminRole; addedBy: string | null; invitedAt: string | null };

/**
 * Website › Who can sign in. The owner can give someone access, check the
 * invite email exactly as it will arrive, and only then press Send.
 * Removing someone stops their access straight away.
 */
export function AdminAccessCard({ admins, canManage }: { admins: Admin[]; canManage: boolean }) {
  const utils = trpc.useUtils();
  const refresh = () => utils.crm.websiteOverview.invalidate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AssignableRole>("bookings");
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const add = trpc.crm.addAdmin.useMutation({
    onSuccess: (_d, vars) => { const v = vars as { email: string; name?: string }; toast.success(`${v.name || v.email} can now be invited`); setEmail(""); setName(""); setPreviewFor(v.email); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.crm.removeAdmin.useMutation({
    onSuccess: (_d, vars) => { const v = vars as { email: string }; toast.success(`Access removed for ${v.email}`); setConfirmRemove(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const changeRole = trpc.crm.setAdminRole.useMutation({
    onSuccess: (_d, vars) => { const v = vars as { email: string; role: AssignableRole }; toast.success(`${v.email} is now ${ROLE_INFO[v.role].label}`); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const send = trpc.crm.sendAdminInvite.useMutation({
    onSuccess: (_d, vars) => { const v = vars as { email: string }; toast.success(`Invite sent to ${v.email}`); setPreviewFor(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const preview = trpc.crm.adminInvitePreview.useQuery({ email: previewFor ?? "" }, { enabled: Boolean(previewFor), retry: false });

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <Card title="Who can sign in">
      <ul className="grid grid-cols-1" aria-label="People with access">
        {admins.map((a) => (
          <li key={a.email} className="flex min-w-0 flex-wrap items-center gap-3 border-t border-[#EFEBE4] py-2.5 first:border-t-0">
            <Avatar name={a.name || a.email} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[#1A1A1A]">{a.name || a.email}</div>
              <div className="truncate text-xs text-[#6B6458]">
                {a.email} · {a.lastSignedIn ? `signed in ${niceDateTime(a.lastSignedIn)}` : a.invitedAt ? `invited ${niceDateTime(a.invitedAt)}, not signed in yet` : a.owner ? "not signed in yet" : "not invited yet"}
              </div>
            </div>
            {canManage && !a.owner ? (
              <label className="text-xs font-semibold text-[#6B6458]">
                <span className="sr-only">Role for {a.name || a.email}</span>
                <select value={a.role} disabled={changeRole.isPending} onChange={(e) => changeRole.mutate({ email: a.email, role: e.target.value as AssignableRole })} className="rounded-full border border-[#E6E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]">
                  {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                </select>
              </label>
            ) : (
              <Pill tone={a.owner ? "gold" : "grey"}>{ROLE_INFO[a.role]?.label ?? "Admin"}</Pill>
            )}
            {canManage && !a.owner && (
              confirmRemove === a.email ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#B3261E]">Remove their access?</span>
                  <PrimaryButton onClick={() => remove.mutate({ email: a.email })} disabled={remove.isPending}>{remove.isPending ? "Removing…" : "Yes, remove"}</PrimaryButton>
                  <GhostButton onClick={() => setConfirmRemove(null)}>Keep</GhostButton>
                </span>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  {!a.lastSignedIn && <GhostButton onClick={() => setPreviewFor(a.email)}>{a.invitedAt ? "Resend invite" : "Send invite"}</GhostButton>}
                  <button type="button" onClick={() => setConfirmRemove(a.email)} className="text-xs font-semibold text-[#B3261E] hover:underline">Remove</button>
                </span>
              )
            )}
          </li>
        ))}
      </ul>

      {previewFor && (
        <div className="mt-4 rounded-2xl border border-[#E6E1D8] bg-[#FBFAF7] p-3" role="region" aria-label="Invite email preview">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="mr-2 inline-flex rounded-full bg-[#FBEFD9] px-2 py-0.5 text-xs font-semibold text-[#9A5B00]">Ready for review</span>
              <strong>To:</strong> {previewFor}
              {preview.data && <span className="block text-xs text-[#6B6458]">Subject: {preview.data.subject}</span>}
            </div>
            <GhostButton onClick={() => setPreviewFor(null)}>Close</GhostButton>
          </div>
          {preview.isLoading && <p className="text-sm text-[#6B6458]">Loading the email…</p>}
          {preview.error && <p className="text-sm text-[#B3261E]">{preview.error.message}</p>}
          {preview.data && (
            <iframe title="Invite email, exactly as it will arrive" srcDoc={preview.data.html} sandbox="" className="h-[420px] w-full rounded-xl border border-[#E6E1D8] bg-white" />
          )}
          <p className="mt-2 text-xs text-[#6B6458]">This is exactly what {previewFor} will receive, with a private link to choose their password. Nothing is sent until you press Send.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => send.mutate({ email: previewFor })} disabled={send.isPending || !preview.data}>{send.isPending ? "Sending…" : "Send invite"}</PrimaryButton>
            <GhostButton onClick={() => setPreviewFor(null)}>Not now</GhostButton>
          </div>
        </div>
      )}

      <details className="mt-3 text-[13px] text-[#6B6458]">
        <summary className="cursor-pointer font-semibold text-[#8A641E]">What each role can do</summary>
        <ul className="mt-2 grid gap-1">
          {(["owner", ...ASSIGNABLE_ROLES] as AdminRole[]).map((r) => <li key={r}><strong className="text-[#1A1A1A]">{ROLE_INFO[r].label}:</strong> {ROLE_INFO[r].description}</li>)}
        </ul>
      </details>

      {canManage ? (
        <form
          className="mt-4 grid min-w-0 grid-cols-1 gap-3 border-t border-[#EFEBE4] pt-4"
          onSubmit={(e) => { e.preventDefault(); if (validEmail) add.mutate({ email: email.trim().toLowerCase(), name: name.trim() || undefined, role }); }}
          aria-label="Give someone access"
        >
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#6B6458]">Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Ada" className="rounded-xl border border-[#E6E1D8] px-3 py-2 text-sm font-normal text-[#1A1A1A] w-full min-w-0" />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#6B6458]">Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} placeholder="their@email.com" required className="rounded-xl border border-[#E6E1D8] px-3 py-2 text-sm font-normal text-[#1A1A1A] w-full min-w-0" />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#6B6458]">Role
            <select value={role} onChange={(e) => setRole(e.target.value as AssignableRole)} className="rounded-xl border border-[#E6E1D8] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] w-full min-w-0">
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
            </select>
          </label>
          <div><PrimaryButton type="submit" disabled={!validEmail || add.isPending}>{add.isPending ? "Adding…" : "Give access"}</PrimaryButton></div>
          <p className="text-[13px] text-[#6B6458]"><strong className="text-[#1A1A1A]">{ROLE_INFO[role].label}:</strong> {ROLE_INFO[role].description} Next you&apos;ll see their invite email to check before sending.</p>
        </form>
      ) : (
        <p className="mt-2 text-[13px] text-[#6B6458]">Only the owner can give or remove access, or change roles.</p>
      )}
    </Card>
  );
}
