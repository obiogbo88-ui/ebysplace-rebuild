/**
 * The email a new Command Centre admin gets. Shown to the owner, exactly as
 * it will look, before they press Send (nothing goes out automatically).
 * Sent in the standard Eby's Place branded email (server/emailTemplates).
 */
export const ADMIN_INVITE_SUBJECT = "You’ve been given access to the Eby’s Place Command Centre";
export const ADMIN_INVITE_CTA = "Choose your password";

export function adminInviteParagraphs(input: { name?: string | null; invitedBy?: string | null }): string[] {
  const first = (input.name ?? "").trim().split(/\s+/)[0] || "there";
  return [
    `Hello ${first},`,
    `${input.invitedBy?.trim() || "Eby’s Place"} has given you access to the Eby’s Place Command Centre, where bookings, clients and the website are managed.`,
    "Press the button below to choose your password. After that, sign in at www.ebysplace.com/admin with this email address.",
    "The link works once and expires after a short time. If it has expired, use “Forgot password” on the sign-in page.",
    "If you weren’t expecting this email, you can ignore it.",
  ];
}
