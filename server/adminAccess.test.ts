import { describe, expect, it, vi } from "vitest";

vi.mock("./adminAccess", () => ({
  isAddedAdmin: vi.fn(async (email: string | null) => email === "helper@example.com"),
  addedAdminRole: vi.fn(async (email: string | null) => (email === "helper@example.com" ? "bookings" : null)),
}));

import { adminRoleFor, isAdminEmail, isOwnerEmail } from "./supabaseAuth";
import { allows, deniedMessage, isAssignableRole } from "../shared/adminRoles";
import { redactMoney } from "./_core/trpc";
import { ADMIN_INVITE_SUBJECT, adminInviteParagraphs } from "../shared/adminInvite";
import { renderBrandedEmail } from "./resendEmail";

describe("Command Centre access", () => {
  it("lets owners and added admins in, and nobody else", async () => {
    expect(isOwnerEmail("info@ebysplace.com")).toBe(true);
    expect(await isAdminEmail("INFO@ebysplace.com")).toBe(true);
    expect(await isAdminEmail("helper@example.com")).toBe(true);
    expect(isOwnerEmail("helper@example.com")).toBe(false);
    expect(await isAdminEmail("stranger@example.com")).toBe(false);
    expect(await isAdminEmail(null)).toBe(false);
  });

  it("writes the invite in the branded Eby's Place email", () => {
    const paragraphs = adminInviteParagraphs({ name: "Ada Lovelace", invitedBy: "Eby" });
    expect(paragraphs[0]).toBe("Hello Ada,");
    expect(paragraphs[1]).toContain("Eby has given you access to the Eby’s Place Command Centre");
    const html = renderBrandedEmail({ subject: ADMIN_INVITE_SUBJECT, paragraphs, cta: { label: "Choose your password", url: "https://www.ebysplace.com/admin/reset-password" } });
    expect(html).toContain("Hello Ada,");
    expect(html).toContain("Choose your password");
    expect(html).not.toContain("{{BODY_HTML}}");
  });

  it("falls back to a friendly greeting without a name", () => {
    expect(adminInviteParagraphs({})[0]).toBe("Hello there,");
  });

  it("gives owners the owner role and added admins their assigned role", async () => {
    expect(await adminRoleFor("info@ebysplace.com")).toBe("owner");
    expect(await adminRoleFor("helper@example.com")).toBe("bookings");
    expect(await adminRoleFor("stranger@example.com")).toBeNull();
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole("marketing")).toBe(true);
  });

  it("limits each role to its own areas", () => {
    // Everyone can look; only the right roles can change.
    expect(allows("viewer", "crm.clients", "query")).toBe(true);
    expect(allows("viewer", "admin.updateBookingStatus", "mutation")).toBe(false);
    expect(allows("bookings", "admin.updateBookingStatus", "mutation")).toBe(true);
    expect(allows("bookings", "admin.updateWebsiteSection", "mutation")).toBe(false);
    expect(allows("marketing", "admin.updateWebsiteSection", "mutation")).toBe(true);
    expect(allows("marketing", "crm.sendCampaign", "mutation")).toBe(true);
    expect(allows("marketing", "admin.updateBookingStatus", "mutation")).toBe(false);
    // Money: owner and manager only.
    expect(allows("bookings", "admin.transactions", "query")).toBe(false);
    expect(allows("manager", "admin.transactions", "query")).toBe(true);
    // Access: owner only, even for managers.
    expect(allows("manager", "crm.addAdmin", "mutation")).toBe(false);
    expect(allows("owner", "crm.addAdmin", "mutation")).toBe(true);
    // Unlisted changes count as settings: managers and owners only.
    expect(allows("bookings", "admin.somethingNew", "mutation")).toBe(false);
    expect(allows("manager", "admin.somethingNew", "mutation")).toBe(true);
    expect(allows("viewer", "crm.me", "query")).toBe(true);
    expect(deniedMessage("viewer", "admin.updateBookingStatus")).toBe("The View only role can’t change this. Ask the owner if you need it.");
  });

  it("hides money from roles that can't see it", () => {
    const out = redactMoney({ week: { paidOnline: { now: 120.5, before: 80 }, bookings: 4 }, clients: [{ name: "A", paidOnline: 60, checkoutTotalCharged: "45.00" }], shop: { soldThisWeek: 30, toSend: 2 } }) as any;
    expect(out.week.paidOnline).toEqual({ now: 0, before: 0 });
    expect(out.week.bookings).toBe(4);
    expect(out.clients[0]).toEqual({ name: "A", paidOnline: 0, checkoutTotalCharged: "0" });
    expect(out.shop).toEqual({ soldThisWeek: 0, toSend: 2 });
  });
});
