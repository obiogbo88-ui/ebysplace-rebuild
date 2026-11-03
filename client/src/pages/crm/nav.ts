/**
 * The CRM's pages. Each page shows its own new view, then the existing admin
 * tools that belong to it (the "legacy" panels, unchanged), so nothing the old
 * admin could do is lost.
 *
 * Old links like /admin#bookings still work: the panel id maps to its page.
 */
export type CrmPageId =
  | "home"
  | "clients"
  | "client"
  | "calendar"
  | "inbox"
  | "shop"
  | "money"
  | "social"
  | "campaigns"
  | "automations"
  | "reports"
  | "website";

export type CrmPage = {
  id: CrmPageId;
  label: string;
  group: "Run the studio" | "Sell" | "Grow" | "Website";
  title: string;
  description: string;
  panels: string[];
  inMenu: boolean;
};

export const CRM_PAGES: CrmPage[] = [
  { id: "home", label: "Home", group: "Run the studio", title: "Home", description: "What needs you today, and how the studio is doing.", panels: [], inMenu: true },
  { id: "clients", label: "Clients", group: "Run the studio", title: "Clients", description: "Everyone who has booked, bought, chatted or signed up, as one person each.", panels: [], inMenu: true },
  { id: "client", label: "Client", group: "Run the studio", title: "Client", description: "", panels: [], inMenu: false },
  { id: "calendar", label: "Calendar", group: "Run the studio", title: "Calendar", description: "Your week at a glance. Manage bookings and block time off below.", panels: ["bookings", "availability"], inMenu: true },
  { id: "inbox", label: "Inbox", group: "Run the studio", title: "Inbox", description: "Website chats and one-off replies to clients, from info@ebysplace.com.", panels: ["chats", "customer-replies"], inMenu: true },
  { id: "shop", label: "Shop & orders", group: "Sell", title: "Shop & orders", description: "Orders to send, products and stock, and product reviews.", panels: ["orders", "products", "product-reviews"], inMenu: true },
  { id: "money", label: "Money", group: "Sell", title: "Money", description: "What came in, what Stripe kept, and what reached the bank.", panels: ["transactions"], inMenu: true },
  { id: "social", label: "Social autopilot", group: "Grow", title: "Social autopilot", description: "Instagram posts itself three times a day. Every post is a Reel with its own tune.", panels: ["instagram"], inMenu: true },
  { id: "campaigns", label: "Campaigns", group: "Grow", title: "Campaigns", description: "Send one message to your list, or email a group of clients.", panels: ["announcements", "newsletter-subscribers"], inMenu: true },
  { id: "automations", label: "Automations", group: "Grow", title: "Automations", description: "Everything that runs by itself. Switch any of them off here.", panels: [], inMenu: true },
  { id: "reports", label: "Reports", group: "Grow", title: "Reports", description: "How the studio is doing month to month, and what visitors do on the website.", panels: ["activity-monitoring"], inMenu: true },
  { id: "website", label: "Website & settings", group: "Website", title: "Website & settings", description: "The parts of ebysplace.com you edit, plus email, cookie and access settings.", panels: ["services", "gallery", "reviews", "content", "seasonal", "email-notifications", "cookies", "users"], inMenu: true },
];

const BY_ID = new Map(CRM_PAGES.map((p) => [p.id, p]));
const PANEL_PAGE = new Map<string, CrmPageId>();
for (const p of CRM_PAGES) for (const panel of p.panels) PANEL_PAGE.set(panel, p.id);

export type CrmLocation = { page: CrmPageId; clientKey: string | null; panel: string | null; filter?: string };

export function parseCrmHash(hash: string): CrmLocation {
  const raw = hash.replace(/^#/, "").trim();
  if (raw.startsWith("client:")) {
    let key: string | null = null;
    try {
      key = decodeURIComponent(raw.slice("client:".length));
    } catch {
      key = null;
    }
    return key && /^[ep]:/.test(key) ? { page: "client", clientKey: key, panel: null } : { page: "clients", clientKey: null, panel: null };
  }
  if (raw.startsWith("clients:")) return { page: "clients", clientKey: null, panel: null, filter: raw.slice("clients:".length) };
  const id = raw.toLowerCase();
  if (!id || id === "overview") return { page: "home", clientKey: null, panel: null };
  if (id === "activity") return { page: "reports", clientKey: null, panel: "activity-monitoring" };
  if (BY_ID.has(id as CrmPageId) && id !== "client") return { page: id as CrmPageId, clientKey: null, panel: null };
  const page = PANEL_PAGE.get(id);
  return page ? { page, clientKey: null, panel: id } : { page: "home", clientKey: null, panel: null };
}

export function crmPage(id: CrmPageId) {
  return BY_ID.get(id)!;
}

export function clientHash(key: string) {
  return `#client:${encodeURIComponent(key)}`;
}

/** Moves the CRM to a page without reloading. */
export function goCrm(hash: string) {
  if (typeof window === "undefined") return;
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (window.location.hash === next) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.location.hash = next;
}
