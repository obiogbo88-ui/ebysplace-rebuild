import { describe, expect, it, vi } from "vitest";

vi.mock("./adminAccess", () => ({ isAddedAdmin: vi.fn(async (email: string | null) => email === "helper@example.com") }));

import { isAdminEmail, isOwnerEmail } from "./supabaseAuth";
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
});
