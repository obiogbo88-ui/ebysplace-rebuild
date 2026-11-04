import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { goCrm } from "./nav";
import { AdminAccessCard } from "./AdminAccess";
import { Avatar, Card, Chip, Empty, ErrorNote, GhostButton, Loading, Pill, PrimaryButton, Toggle, gbp, niceDate, niceDateTime, type PillTone, ScrollBox } from "./ui";

/**
 * Website & settings overview: what visitors see on ebysplace.com, what needs
 * Eby, and the things that run behind the scenes. Quick actions happen here;
 * the full editors (the panels below this view) open from each card's button.
 */

const SEASON_LABEL: Record<string, string> = {
  none: "Normal homepage",
  autumn: "Autumn leaves",
  winter: "Winter snow",
  christmas: "Christmas greeting",
  christmassnow: "Christmas greeting and snow",
  easter: "Easter blossoms",
  ramadan: "Ramadan lanterns",
  eid: "Eid lanterns",
};

const SERVICE_FILTERS = [
  { id: "all", label: "All" },
  { id: "braids", label: "Braids" },
  { id: "twists", label: "Twists" },
  { id: "locs", label: "Locs" },
  { id: "kids", label: "Kids" },
  { id: "nophoto", label: "No photo" },
] as const;
type ServiceFilter = (typeof SERVICE_FILTERS)[number]["id"];

const hasPhoto = (s: any) => Boolean(String(s?.imageUrl ?? "").trim());
const isOn = (v: unknown) => v === true || v === "true";
/** Opens one of the full editors on this page (the panels under this overview). */
const openEditor = (panel: string) => goCrm(panel);

function matchesFilter(s: any, f: ServiceFilter) {
  const text = `${s.category ?? ""} ${s.name ?? ""}`.toLowerCase();
  if (f === "all") return true;
  if (f === "nophoto") return !hasPhoto(s);
  if (f === "kids") return text.includes("kid") || text.includes("school");
  if (f === "braids") return text.includes("braid") || text.includes("cornrow");
  if (f === "twists") return text.includes("twist");
  return text.includes("loc");
}

function HealthTile({ label, state, tone, value, hint }: { label: string; state: string; tone: PillTone; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E6E1D8] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-[#6B6458]">{label}</span>
        <Pill tone={tone}>{state}</Pill>
      </div>
      <div className="mt-1.5 truncate text-[15px] font-semibold text-[#1A1A1A]">{value}</div>
      <div className="mt-0.5 text-[13px] text-[#6B6458]">{hint}</div>
    </div>
  );
}

export function WebsitePage() {
  const utils = trpc.useUtils();
  const lists = trpc.admin.lists.useQuery(undefined, { retry: false });
  const overview = trpc.crm.websiteOverview.useQuery(undefined, { retry: false });
  const season = trpc.public.seasonalTheme.useQuery(undefined, { refetchOnWindowFocus: false });
  const payment = trpc.public.paymentMode.useQuery(undefined, { retry: false });
  const [filter, setFilter] = useState<ServiceFilter>("all");

  const refreshLists = () => utils.admin.lists.invalidate();
  const updateService = trpc.admin.updateService.useMutation({ onSuccess: () => refreshLists(), onError: (e) => toast.error(e.message) });
  const moderate = trpc.admin.moderateReview.useMutation({
    onSuccess: (_r, v) => {
      refreshLists();
      utils.public.reviews.invalidate();
      toast.success((v as { status?: string } | undefined)?.status === "approved" ? "Review is now on the website" : "Review hidden");
    },
    onError: (e) => toast.error(e.message),
  });
  const setSeason = trpc.admin.updateSeasonalEffects.useMutation({
    onSuccess: (_r, v) => {
      utils.public.seasonalTheme.invalidate();
      toast.success((v as { enabled?: boolean } | undefined)?.enabled ? "Seasonal designs follow the calendar" : "Seasonal designs switched off");
    },
    onError: (e) => toast.error(e.message),
  });
  const reorder = trpc.crm.reorderGallery.useMutation({
    onSuccess: () => {
      refreshLists();
      utils.public.gallery.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const data = lists.data as any;
  const services: any[] = data?.services ?? [];
  const pendingReviews: any[] = (data?.reviews ?? []).filter((r: any) => r.status === "pending");
  const gallery: any[] = useMemo(
    () => [...(data?.gallery ?? [])].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(b.createdAt).localeCompare(String(a.createdAt))),
    [data?.gallery],
  );
  const about = (data?.sections ?? []).find((s: any) => s.sectionKey === "about_us");

  if (lists.isLoading) return <Loading />;
  if (lists.error) return <ErrorNote error={lists.error} />;

  const bookable = services.filter((s) => isOn(s.isBookable));
  const noPhoto = services.filter((s) => !hasPhoto(s));
  const ov = overview.data;
  const failedEmails = ov?.emails.failedThisWeek ?? 0;
  const seasonOn = season.data?.enabled ?? true;
  const shownServices = services.filter((s) => matchesFilter(s, filter));
  const cookieTotal = ov?.cookies30d.total ?? 0;
  const cookieYes = ov?.cookies30d.analytics ?? 0;
  const cookiePct = cookieTotal ? Math.round((cookieYes / cookieTotal) * 100) : 0;

  const needs: Array<{ text: string; panel: string }> = [];
  if (pendingReviews.length) needs.push({ text: `${pendingReviews.length} ${pendingReviews.length === 1 ? "review is" : "reviews are"} waiting for approval`, panel: "website-reviews" });
  if (noPhoto.length) needs.push({ text: `${noPhoto.length} ${noPhoto.length === 1 ? "service has" : "services have"} no photo`, panel: "website-services" });
  if (failedEmails) needs.push({ text: `${failedEmails} ${failedEmails === 1 ? "email" : "emails"} didn't send this week`, panel: "email-notifications" });

  const moveTo = (index: number, delta: number) => {
    const next = [...gallery];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ ids: next.map((g) => Number(g.id)) });
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <GhostButton href="https://www.ebysplace.com/">View live site</GhostButton>
      </div>

      <section aria-label="Site health" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthTile label="Website" state="Live" tone="live" value="www.ebysplace.com" hint={ov?.lastChangeAt ? `Last change: ${niceDateTime(ov.lastChangeAt)}` : "No changes recorded yet"} />
        <HealthTile
          label="Online booking"
          state={bookable.length ? "Open" : "Closed"}
          tone={bookable.length ? "live" : "bad"}
          value={`${bookable.length} of ${services.length} services bookable`}
          hint={payment.data?.publishableKeyConfigured ? "Card deposits by Stripe are on" : "Card deposits are not set up"}
        />
        <HealthTile
          label="Emails"
          state={overview.isLoading ? "Checking" : failedEmails ? "Problem" : "Working"}
          tone={overview.isLoading ? "grey" : failedEmails ? "bad" : "live"}
          value={`${ov?.emails.sentThisWeek ?? 0} sent this week`}
          hint={ov?.emails.lastSentAt ? `Last one: ${niceDateTime(ov.emails.lastSentAt)}` : "None sent yet"}
        />
        <HealthTile
          label="Homepage season"
          state={seasonOn ? "Auto" : "Off"}
          tone={seasonOn ? "gold" : "grey"}
          value={season.data ? (seasonOn ? SEASON_LABEL[season.data.theme] ?? "Normal homepage" : "Switched off") : "Checking…"}
          hint={seasonOn ? "Changes by itself with the calendar" : "Plain homepage all year"}
        />
      </section>

      {needs.length ? (
        <section aria-label="Needs you" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EBCF9B] bg-[#FBEFD9] px-4 py-3.5 sm:px-5">
          <div className="grid gap-0.5">
            <strong className="text-[15px] text-[#1A1A1A]">
              {needs.length} {needs.length === 1 ? "thing needs" : "things need"} you
            </strong>
            <span className="text-sm text-[#6B4000]">{needs.map((n) => n.text).join(" · ")}</span>
          </div>
          <PrimaryButton onClick={() => (needs[0].panel.startsWith("website-") ? jump(needs[0].panel) : openEditor(needs[0].panel))}>Start with the first</PrimaryButton>
        </section>
      ) : (
        <p className="rounded-2xl border border-[#CBE6D4] bg-[#E3F2E8] px-4 py-3 text-sm font-semibold text-[#1E7A46]">Nothing needs you on the website right now.</p>
      )}

      <h2 className="serif mt-1 !text-2xl font-bold text-[#1A1A1A]">What visitors see</h2>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          id="website-services"
          title={`Services & prices`}
          action={<PrimaryButton onClick={() => openEditor("services")}>Add a service</PrimaryButton>}
        >
          <p className="-mt-2 mb-3 text-[13px] text-[#6B6458]">
            The Services and Booking pages use this list. {services.length} services, {bookable.length} bookable.
          </p>
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter services">
            {SERVICE_FILTERS.map((f) => (
              <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} count={f.id === "nophoto" ? noPhoto.length : undefined}>
                {f.label}
              </Chip>
            ))}
          </div>
          {shownServices.length === 0 ? (
            <Empty>{filter === "nophoto" ? "Every service has a photo." : "No services in this group."}</Empty>
          ) : (
            <ScrollBox label="Services list" size="lg">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead className="sticky top-0 z-[1] bg-white">
                  <tr className="text-left text-xs text-[#6B6458]">
                    <th className="py-2 pr-2 font-semibold">Service</th>
                    <th className="p-2 font-semibold">From</th>
                    <th className="p-2 font-semibold">Time</th>
                    <th className="p-2 font-semibold">Photo</th>
                    <th className="p-2 font-semibold">Bookable</th>
                    <th className="py-2 pl-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shownServices.map((s) => (
                    <tr key={s.id ?? s.slug} className="border-t border-[#EFEBE4]">
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-[#1A1A1A]">{s.name}</div>
                        <div className="text-xs text-[#6B6458]">
                          {s.category}
                          {s.badge ? ` · ${s.badge}` : ""}
                        </div>
                      </td>
                      <td className="p-2 tabular-nums">{Number.isFinite(Number(s.priceFrom)) ? gbp(Number(s.priceFrom)) : "–"}</td>
                      <td className="p-2 text-[#6B6458]">{s.duration}</td>
                      <td className="p-2">{hasPhoto(s) ? <Pill tone="live">Yes</Pill> : <Pill tone="wait">Missing</Pill>}</td>
                      <td className="p-2">
                        <Toggle
                          label={`${s.name} can be booked online`}
                          checked={isOn(s.isBookable)}
                          disabled={!s.id || updateService.isPending}
                          onChange={(next) => updateService.mutate({ id: Number(s.id), isBookable: next ? "true" : "false" }, { onSuccess: () => toast.success(`${s.name} ${next ? "can be booked" : "is hidden from booking"}`) })}
                        />
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <GhostButton onClick={() => openEditor("services")}>Edit</GhostButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBox>
          )}
        </Card>

        <div className="grid gap-5">
          <Card id="website-reviews" title={`Reviews waiting · ${pendingReviews.length}`}>
            <p className="-mt-2 mb-3 text-[13px] text-[#6B6458]">Nothing goes on the Reviews page until you approve it.</p>
            {pendingReviews.length === 0 ? (
              <Empty>No reviews waiting.</Empty>
            ) : (
              <ScrollBox label="Reviews waiting" size="md">
              <div className="grid gap-3">
                {pendingReviews.map((r) => (
                  <div key={r.id} className="grid gap-2 rounded-xl border border-[#EFEBE4] bg-[#FBF8F2] p-3">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <strong className="min-w-0 truncate text-[#1A1A1A]">{r.customerName}</strong>
                      <span className="shrink-0 font-semibold text-[#8A641E]">{r.rating} of 5</span>
                    </div>
                    <p className="text-sm leading-relaxed text-[#1A1A1A]">{r.reviewText}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ id: r.id, status: "approved" })}
                        className="bg-[#1E7A46] text-white inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <GhostButton disabled={moderate.isPending} onClick={() => moderate.mutate({ id: r.id, status: "rejected" })}>
                        Hide
                      </GhostButton>
                    </div>
                  </div>
                ))}
              </div>
              </ScrollBox>
            )}
          </Card>

          <Card title="Gallery" action={<PrimaryButton onClick={() => openEditor("gallery")}>Add photos</PrimaryButton>}>
            <p className="-mt-2 mb-3 text-[13px] text-[#6B6458]">
              {gallery.length} {gallery.length === 1 ? "photo" : "photos"} on the Gallery page. The first 9 also show on the homepage.
            </p>
            {gallery.length === 0 ? (
              <Empty>No photos yet. Add some so visitors can see your work.</Empty>
            ) : (
              <>
                <ScrollBox label="Gallery photos" size="md">
                <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {gallery.map((g, i) => (
                    <li key={g.id} className="group relative overflow-hidden rounded-xl bg-[#EFEBE4]">
                      <img src={g.imageUrl} alt={g.altText || g.title} loading="lazy" className="aspect-square w-full object-cover" />
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 text-[11px] font-bold tabular-nums text-[#1A1A1A]">{i + 1}</span>
                      <div className="absolute inset-x-1 bottom-1 flex justify-between">
                        <button
                          type="button"
                          aria-label={`Move ${g.title} earlier`}
                          disabled={i === 0 || reorder.isPending}
                          onClick={() => moveTo(i, -1)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[#1A1A1A] shadow disabled:opacity-0"
                        >
                          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${g.title} later`}
                          disabled={i === gallery.length - 1 || reorder.isPending}
                          onClick={() => moveTo(i, 1)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[#1A1A1A] shadow disabled:opacity-0"
                        >
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                </ScrollBox>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#6B6458]">
                  <span>Use the arrows to change the order. Scroll inside the box to see every photo.</span>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="About Us on the homepage" action={<GhostButton onClick={() => openEditor("content")}>Edit</GhostButton>}>
          <div className="flex items-center gap-4 rounded-xl bg-[#FBF8F2] p-4">
            {about?.portraitImageUrl ? (
              <img src={about.portraitImageUrl} alt="" className="h-20 w-20 shrink-0 rounded-full border-[3px] border-[#C9A84C] object-cover" />
            ) : (
              <span aria-hidden="true" className="h-20 w-20 shrink-0 rounded-full border-[3px] border-[#C9A84C] bg-[#2B2118]" />
            )}
            <div className="grid min-w-0 gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A641E]">{about?.eyebrow || "Our Story"}</span>
              <strong className="serif truncate text-xl text-[#1A1A1A]">{about?.title || "About Us"}</strong>
              {about?.portraitDescription ? <span className="truncate text-[13px] text-[#6B6458]">{about.portraitDescription}</span> : null}
            </div>
          </div>
          <p className="mt-3 text-[13px] text-[#6B6458]">{about?.updatedAt ? `Last changed ${niceDate(String(about.updatedAt).slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}.` : "Not changed yet."}</p>
        </Card>

        <Card title="Homepage season">
          <fieldset className="grid gap-2" disabled={!season.data || setSeason.isPending}>
            <legend className="sr-only">Seasonal designs on the homepage</legend>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${seasonOn ? "border-[#C9A84C] bg-[#FBF8F2]" : "border-[#E6E1D8]"}`}>
              <input type="radio" name="crm-season" className="mt-1 accent-[#1A1A1A]" checked={seasonOn} onChange={() => setSeason.mutate({ enabled: true })} />
              <span>
                <strong className="text-sm text-[#1A1A1A]">Follow the calendar</strong>
                <span className="block text-[13px] text-[#6B6458]">
                  Showing now: {season.data ? SEASON_LABEL[season.data.theme] ?? "Normal homepage" : "checking…"}. Autumn leaves, snow and festival greetings switch on by themselves.
                </span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${!seasonOn ? "border-[#C9A84C] bg-[#FBF8F2]" : "border-[#E6E1D8]"}`}>
              <input type="radio" name="crm-season" className="mt-1 accent-[#1A1A1A]" checked={!seasonOn} onChange={() => setSeason.mutate({ enabled: false })} />
              <span>
                <strong className="text-sm text-[#1A1A1A]">Off</strong>
                <span className="block text-[13px] text-[#6B6458]">Plain homepage all year</span>
              </span>
            </label>
          </fieldset>
        </Card>
      </div>

      <h2 className="serif mt-1 !text-2xl font-bold text-[#1A1A1A]">Behind the scenes</h2>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Emails the site sends">
          <p className="-mt-2 mb-2 text-[13px] text-[#6B6458]">Booking and order emails from info@ebysplace.com</p>
          {overview.error ? (
            <ErrorNote error={overview.error} />
          ) : !ov?.emails.recent.length ? (
            <Empty>No emails sent yet.</Empty>
          ) : (
            <ScrollBox label="Emails the site sends" size="sm">
            <ul className="grid grid-cols-1">
              {ov.emails.recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 border-t border-[#EFEBE4] py-2.5 first:border-t-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#1A1A1A]">{e.subject}</div>
                    <div className="text-xs text-[#6B6458]">
                      {niceDateTime(e.createdAt)} · to {e.audience === "owner" ? "you" : "a client"}
                    </div>
                  </div>
                  <Pill tone={e.status === "sent" ? "live" : e.status === "failed" ? "bad" : "wait"}>{e.status === "sent" ? "Sent" : e.status === "failed" ? "Failed" : "Waiting"}</Pill>
                </li>
              ))}
            </ul>
            </ScrollBox>
          )}
          <button type="button" onClick={() => openEditor("email-notifications")} className="mt-2 text-sm font-semibold text-[#8A641E] hover:underline">
            See all emails
          </button>
        </Card>

        <Card title="Cookie choices · last 30 days">
          <p className="-mt-2 mb-3 text-[13px] text-[#6B6458]">Visitor numbers in Reports only count people who said yes.</p>
          {cookieTotal === 0 ? (
            <Empty>No cookie choices in the last 30 days.</Empty>
          ) : (
            <>
              <div className="flex h-3.5 overflow-hidden rounded-full bg-[#D9D4CB]" role="img" aria-label={`${cookiePct}% allowed analytics, ${100 - cookiePct}% essential only`}>
                <div className="h-full bg-[#1A1A1A]" style={{ width: `${cookiePct}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  <strong>{cookiePct}%</strong> allowed analytics ({cookieYes})
                </span>
                <span className="text-[#6B6458]">
                  <strong className="text-[#1A1A1A]">{100 - cookiePct}%</strong> essential only ({cookieTotal - cookieYes})
                </span>
              </div>
            </>
          )}
          <button type="button" onClick={() => openEditor("cookies")} className="mt-3 text-sm font-semibold text-[#8A641E] hover:underline">
            Open consent log
          </button>
        </Card>

        <AdminAccessCard admins={ov?.admins ?? []} canManage={Boolean(ov?.canManageAdmins)} />
      </div>
    </div>
  );
}
