import { describe, expect, it } from "vitest";
import { lastRebookEmailWasOnceMore } from "../shared/rebookStatus";

describe("Send again after a rebooking email", () => {
  it("resends the sorry email when the link went out after the customer moved it themselves (Fenton, 6 Nov)", () => {
    expect(lastRebookEmailWasOnceMore({ rebookMovedBy: "customer", rebookMovedAt: "2026-11-06T11:47:57Z", rebookRequestedAt: "2026-11-06T12:58:30Z" })).toBe(true);
  });

  it("resends the ordinary email otherwise", () => {
    expect(lastRebookEmailWasOnceMore({ rebookMovedBy: null, rebookMovedAt: null, rebookRequestedAt: "2026-11-06T12:58:30Z" })).toBe(false);
    expect(lastRebookEmailWasOnceMore({ rebookMovedBy: "admin", rebookMovedAt: "2026-11-06T11:00:00Z", rebookRequestedAt: "2026-11-06T12:00:00Z" })).toBe(false);
    // Link sent first, customer moved after: nothing is waiting, and the next email isn't a resend.
    expect(lastRebookEmailWasOnceMore({ rebookMovedBy: "customer", rebookMovedAt: "2026-11-06T13:00:00Z", rebookRequestedAt: "2026-11-06T12:00:00Z" })).toBe(false);
  });
});
