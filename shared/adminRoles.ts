/**
 * Command Centre roles. The owner (emails in Vercel env vars) can do
 * everything, including giving and removing access. Everyone else is
 * given one of the roles below when they're added, and the server checks
 * it on every request (server/_core/trpc.ts).
 */
export type AdminRole = "owner" | "manager" | "bookings" | "marketing" | "viewer";
export type AssignableRole = Exclude<AdminRole, "owner">;

export type Area = "bookings" | "website" | "shop" | "marketing" | "money" | "settings" | "access" | "general";

export const ROLE_INFO: Record<AdminRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Everything, including who can sign in." },
  manager: { label: "Manager", description: "Everything except giving or removing access." },
  bookings: { label: "Bookings", description: "Bookings, clients, calendar, messages and reviews. Can see the rest, but not money." },
  marketing: { label: "Marketing", description: "Website, gallery, services and shop, social posts, announcements and campaigns. Can see the rest, but not money." },
  viewer: { label: "View only", description: "Can look at everything except money. Can’t change anything." },
};

export const ASSIGNABLE_ROLES: AssignableRole[] = ["manager", "bookings", "marketing", "viewer"];

export function isAssignableRole(v: unknown): v is AssignableRole {
  return typeof v === "string" && (ASSIGNABLE_ROLES as string[]).includes(v);
}

/** What each role can change. Everyone except View only can also change "general" things like marking their notifications read. */
const EDIT: Record<AdminRole, Area[]> = {
  owner: ["bookings", "website", "shop", "marketing", "money", "settings", "access", "general"],
  manager: ["bookings", "website", "shop", "marketing", "money", "settings", "general"],
  bookings: ["bookings", "general"],
  marketing: ["website", "shop", "marketing", "general"],
  viewer: [],
};

/** Who can see money (takings, transactions, Stripe). */
const SEES_MONEY: AdminRole[] = ["owner", "manager"];

/** Which area each admin procedure belongs to. Anything not listed counts as "settings". */
const AREA: Record<string, Area> = {
  // Bookings and clients
  "admin.updateBookingStatus": "bookings", "admin.blockAvailabilitySlot": "bookings", "admin.unblockAvailabilitySlot": "bookings",
  "admin.bookingsOnDate": "bookings", "admin.sendRebookLink": "bookings", "admin.moveBooking": "bookings",
  "admin.updateChatConversationStatus": "bookings", "admin.sendCustomerReply": "bookings", "admin.sendReviewRequest": "bookings",
  "admin.moderateReview": "bookings", "admin.moderateProductReview": "bookings", "admin.resendEmailNotification": "bookings",
  "admin.updateOrderStatus": "shop",
  "crm.saveNote": "bookings", "crm.addTag": "bookings", "crm.removeTag": "bookings", "crm.setClientSwitch": "bookings",
  // Website and gallery
  "admin.updateWebsiteSection": "website", "admin.uploadWebsiteSectionImage": "website", "admin.clearWebsiteSectionImage": "website",
  "admin.uploadGalleryImage": "website", "admin.addGalleryImage": "website", "admin.deleteGalleryImage": "website", "crm.reorderGallery": "website",
  "admin.updateSeasonalEffects": "website", "admin.updateInstagramSettings": "website",
  // Services and shop
  "admin.createService": "shop", "admin.updateService": "shop", "admin.deleteService": "shop", "admin.uploadServiceImage": "shop", "admin.clearServiceImage": "shop",
  "admin.createProduct": "shop", "admin.updateProduct": "shop", "admin.updateProductStock": "shop", "admin.updateProductVariants": "shop",
  "admin.deleteProduct": "shop", "admin.uploadProductImage": "shop", "admin.clearProductImage": "shop", "admin.updateHomeServiceSurcharge": "shop",
  // Marketing
  "admin.sendAnnouncement": "marketing", "crm.sendCampaign": "marketing", "crm.postNow": "marketing", "crm.setAutomation": "marketing",
  // Money
  "admin.transactionSummary": "money", "admin.transactions": "money", "admin.transactionMonthly": "money", "admin.syncTransactionBreakdowns": "money",
  "admin.deleteIncompleteTransactions": "money", "admin.importTryOnPurchasesFromStripe": "money",
  // Access
  "crm.addAdmin": "access", "crm.removeAdmin": "access", "crm.sendAdminInvite": "access", "crm.adminInvitePreview": "access", "crm.setAdminRole": "access",
  // Personal or harmless
  "admin.markActivityLogsRead": "general", "crm.me": "general", "admin.subscribeOwnerPush": "general", "admin.sendTestOwnerAlert": "general",
};

export function areaFor(path: string): Area {
  return AREA[path] ?? "settings";
}

export function canEdit(role: AdminRole | null | undefined, area: Area): boolean {
  return Boolean(role && EDIT[role].includes(area));
}

export function canSeeMoney(role: AdminRole | null | undefined): boolean {
  return Boolean(role && SEES_MONEY.includes(role));
}

/**
 * Whether a role may call an admin procedure. Reading is allowed everywhere
 * except money and access; changing needs edit rights for that area.
 */
export function allows(role: AdminRole | null | undefined, path: string, type: "query" | "mutation" | "subscription"): boolean {
  if (!role) return false;
  const area = areaFor(path);
  if (area === "money") return canSeeMoney(role) && (type === "query" || canEdit(role, "money"));
  if (area === "access") return role === "owner";
  if (type === "query") return true;
  return canEdit(role, area);
}

export function deniedMessage(role: AdminRole | null | undefined, path: string): string {
  const label = role ? ROLE_INFO[role].label : "Your";
  const area = areaFor(path);
  if (area === "access") return "Only the owner can give or remove access.";
  if (area === "money") return `The ${label} role can’t see money. Ask the owner if you need it.`;
  return `The ${label} role can’t change this. Ask the owner if you need it.`;
}
