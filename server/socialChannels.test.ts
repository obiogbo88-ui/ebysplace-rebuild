import { describe, expect, it } from "vitest";
import { chipState } from "../client/src/pages/crm/SocialPage";

const post = (status: string, ids: Partial<{ igMediaId: string; threadsPostId: string; fbPostId: string }> = {}) => ({ status, igMediaId: null, threadsPostId: null, fbPostId: null, ...ids });

describe("where a post went, per channel", () => {
  it("shows posted when the channel has an id, whatever the overall status", () => {
    expect(chipState(post("partial", { igMediaId: "1" }), "1", true)).toBe("posted");
  });
  it("shows a dash for a channel that isn't connected", () => {
    expect(chipState(post("posted"), null, false)).toBe("off");
  });
  it("shows due while the post is still to go out or will be retried", () => {
    for (const s of ["ready", "publishing", "partial"]) expect(chipState(post(s), null, true)).toBe("due");
  });
  it("shows a dash on older posts that went out before the channel was connected", () => {
    expect(chipState(post("posted"), null, true)).toBe("off");
  });
  it("shows not posted when the post failed", () => {
    expect(chipState(post("failed"), null, true)).toBe("missed");
  });
});
