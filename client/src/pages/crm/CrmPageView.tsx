import { createContext, useContext, useEffect, useState } from "react";
import { AutomationsPage } from "./AutomationsPage";
import { CalendarPage } from "./CalendarPage";
import { CampaignsPage } from "./CampaignsPage";
import { ClientProfilePage } from "./ClientProfilePage";
import { ClientsPage } from "./ClientsPage";
import { HomePage } from "./HomePage";
import { ReportsPage } from "./ReportsPage";
import { WebsitePage } from "./WebsitePage";
import { SocialPage } from "./SocialPage";
import { crmPage, parseCrmHash, type CrmLocation } from "./nav";

/** The current CRM page, from the address bar's #hash. */
export function useCrmLocation(): CrmLocation {
  const [loc, setLoc] = useState<CrmLocation>(() => parseCrmHash(typeof window === "undefined" ? "" : window.location.hash));
  useEffect(() => {
    const sync = () => setLoc(parseCrmHash(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return loc;
}

/** Which of the existing admin panels the current page shows (see AdminPanel). */
export const VisiblePanelsContext = createContext<Set<string> | null>(null);
export function usePanelVisible(id: string) {
  const visible = useContext(VisiblePanelsContext);
  return visible === null || visible.has(id);
}

export function CrmPageHeader({ loc }: { loc: CrmLocation }) {
  if (loc.page === "home" || loc.page === "client") return null;
  const p = crmPage(loc.page);
  return (
    <div>
      <h1 className="serif !text-[28px] font-bold sm:!text-4xl leading-tight text-[#1A1A1A]">{p.title}</h1>
      <p className="mt-1 max-w-[65ch] text-sm text-[#6B6458]">{p.description}</p>
    </div>
  );
}

export function CrmPageView({ loc, blockedSlots }: { loc: CrmLocation; blockedSlots: Array<{ date: string; time?: string; reason?: string }> }) {
  switch (loc.page) {
    case "home":
      return <HomePage />;
    case "clients":
      return <ClientsPage initialFilter={loc.filter} />;
    case "client":
      return loc.clientKey ? <ClientProfilePage key={loc.clientKey} clientKey={loc.clientKey} /> : <ClientsPage />;
    case "calendar":
      return <CalendarPage blockedSlots={blockedSlots} />;
    case "social":
      return <SocialPage />;
    case "campaigns":
      return <CampaignsPage />;
    case "automations":
      return <AutomationsPage />;
    case "reports":
      return <ReportsPage />;
    case "website":
      return <WebsitePage />;
    default:
      return null;
  }
}
