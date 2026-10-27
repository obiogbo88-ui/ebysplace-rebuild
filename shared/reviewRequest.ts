// A client should only get one review request per booking unless the admin
// deliberately sends it again.

export function formatReviewRequestDate(sentAt: Date | string): string {
  return new Date(sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

/** Why a review request must not go out yet, or null when it can be sent. */
export function reviewRequestBlockReason(sentAt: Date | string | null | undefined, sendAgain: boolean): string | null {
  if (!sentAt || sendAgain) return null;
  return `A review request was already sent on ${formatReviewRequestDate(sentAt)}.`;
}
