/**
 * Kouvia Booking braider-recruitment cards (approved mockups K1-K5,
 * https://claude.ai/artifact/6wrAohCXAwN7Uz5W9yzYfP), drawn at 540x675
 * (story 405x720) and rendered here at 2x / full 1080x1920.
 *
 * Kouvia Booking is powered by Eby's Place: the logo on every card carries
 * "Powered by ebysplace.com", and every caption says so.
 */
export const KOUVIA = {
  teal: "#0D5C63",
  deep: "#0A3D42",
  gold: "#C2A378",
  mist: "#D7ECEC",
  mist2: "#CFE3E4",
  slate: "#3C5F62",
  line: "#D5E6E7",
  edge: "#5E9EA3",
  paper: "#F7FAFA",
  white: "#FFFFFF",
  signupUrl: "kouviabooking.ebysplace.com/for-braiders",
  site: "kouviabooking.ebysplace.com",
} as const;

/** kouvia-logo.png in the social kit is 700x476. */
export const KOUVIA_LOGO_ASPECT = 700 / 476;

export type KouviaVariant = "hook" | "profile" | "steps" | "free";
export const KOUVIA_VARIANTS: KouviaVariant[] = ["hook", "profile", "steps", "free"];

export const KOUVIA_PROFILE_FEATURES: Array<[string, string]> = [
  ["Booking page", "Your photos, services and prices in one link"],
  ["Real calendar", "Set your hours, block days, no double-bookings"],
  ["Deposits", "Clients pay a deposit to hold the slot"],
  ["Get found", "Listed in \"braiders near me\" by area and style"],
  ["Reminders", "Clients get reminded before their appointment"],
  ["WhatsApp link", "Clients can still message you the way they like"],
];

export const KOUVIA_STEPS: Array<[string, string]> = [
  ["Create your profile", "Name, area, a short bio. Takes a few minutes."],
  ["Add your photos and prices", "Show off your work and the styles you do."],
  ["Get found and booked", "Clients search by area and style, then book with a deposit."],
];

/**
 * Fixed captions (not AI-written) so the facts stay exactly as on the
 * Kouvia site: free while the platform grows, no card, no cut of bookings.
 * {FOLLOW} becomes "Follow @ebysplace1" on Instagram (captionFor).
 */
export const KOUVIA_CAPTIONS: Record<KouviaVariant, string> = {
  hook: [
    "No website? You can still get booked online. 💇🏾‍♀️",
    "If your braids are great but clients can't find you, Kouvia Booking gives you a booking page, a calendar and deposits in one link. No coding, no tech skills.",
    "Free to join, no card needed, and Kouvia takes no cut of your bookings.",
    "Know a braider who needs this? Send it to them.",
    "Kouvia Booking is powered by Eby's Place.",
    "{FOLLOW} for more tips for braiders.",
    `Sign up free: ${KOUVIA.signupUrl}`,
    "#Braiders #UKBraiders #BraiderBusiness #KouviaBooking #EbysPlace",
  ].join("\n\n"),
  profile: [
    "Everything a website does, without building one. ✨",
    "Your free Kouvia profile comes with:\n• A booking page with your photos, services and prices\n• A real calendar: set your hours, block days, no double-bookings\n• Deposits to hold the slot\n• A listing in \"braiders near me\" by area and style\n• Reminders for your clients\n• Your WhatsApp link, so clients can still message you",
    "Save this, and send it to a braider who needs it.",
    "Kouvia Booking is powered by Eby's Place.",
    "{FOLLOW} for more tips for braiders.",
    `Join free: ${KOUVIA.signupUrl}`,
    "#BraidersOfInstagram #UKBraiders #KouviaBooking #EbysPlace",
  ].join("\n\n"),
  steps: [
    "Struggling to get noticed? Get booked online in 3 steps 👇🏾",
    "1. Create your profile: name, area and a short bio. Takes a few minutes.\n2. Add your photos and prices.\n3. Get found and booked: clients search by area and style, then book with a deposit.",
    "Join free, no tech skills needed.",
    "Kouvia Booking is powered by Eby's Place.",
    "{FOLLOW} for more tips for braiders.",
    KOUVIA.signupUrl,
    "#Braiders #BraidBusiness #KouviaBooking #EbysPlace",
  ].join("\n\n"),
  free: [
    "\"Is Kouvia really free?\" Yes. 🙌🏾",
    "Kouvia is free for braiders while the platform grows. No credit card to sign up, and no cut of your bookings, so what you earn stays yours. If that ever changes, we'll tell you first.",
    "Any other questions? Ask below and we'll answer.",
    "Kouvia Booking is powered by Eby's Place.",
    "{FOLLOW} for more tips for braiders.",
    `Claim your free profile: ${KOUVIA.site}`,
    "#UKBraiders #KouviaBooking #EbysPlace",
  ].join("\n\n"),
};
