import { describe, expect, it } from "vitest";
import { inviteCandidates, inviteFirstName, joinListUrl, listInviteEmail } from "./listInvite";
import { verifyUnsubscribe } from "./automations";
import type { Client } from "./clients";

const client = (over: Partial<Client> & { key: string }): Client =>
  ({
    name: "Sammie Merry",
    email: over.key.slice(2),
    paidOnline: 20,
    bookings: 1,
    orders: 0,
    marketingOptOut: false,
    rebookPending: false,
    list: { status: "not_on", via: null, since: null, invitedOn: null },
    ...over,
  }) as Client;

describe("who the list invite goes to", () => {
  it("only paying customers who aren't on the list, never said no, never left and weren't invited", () => {
    const people = [
      client({ key: "e:pay@b.co" }),
      client({ key: "e:free@b.co", paidOnline: 0 }),
      client({ key: "e:on@b.co", list: { status: "on", via: "website", since: "2026-10-01" } }),
      client({ key: "e:no@b.co", list: { status: "said_no", via: null, since: null } }),
      client({ key: "e:left@b.co", list: { status: "left", via: null, since: null }, marketingOptOut: true }),
      client({ key: "e:done@b.co", list: { status: "not_on", via: null, since: null, invitedOn: "2026-11-06" } }),
      client({ key: "p:7700900000", email: null }),
    ];
    expect(inviteCandidates(people).map((c) => c.key)).toEqual(["e:pay@b.co"]);
  });

  it("flags someone waiting to pick a new date, so the card starts them unticked", () => {
    expect(inviteCandidates([client({ key: "e:fenton@b.co", rebookPending: true })])[0].waiting).toBe(true);
  });
});

describe("the invite email", () => {
  it("uses the approved wording, a first name without titles, and a one-tap join link", () => {
    const email = listInviteEmail({ key: "e:cw@b.co", name: "Miss Christina Wallbridge", email: "cw@b.co" }, "https://leave");
    expect(email.subject).toBe("Would you like to join the Eby’s Place list?");
    expect(email.paragraphs[0]).toBe("Hi Christina,");
    expect(email.cta?.label).toBe("Join the list");
    expect(email.closing).toEqual(["If you’d rather not, there’s nothing to do. We won’t add you unless you choose to join.", "Thank you, Eby"]);
    expect(email.headers?.["List-Unsubscribe"]).toBe("<https://leave>");
  });

  it("signs the join link so only that person can be added", () => {
    const url = new URL(joinListUrl("e:cw@b.co", "test-secret"));
    expect(url.pathname).toBe("/api/crm/join");
    expect(verifyUnsubscribe(url.searchParams.get("c")!, url.searchParams.get("s")!, "test-secret")).toBe("e:cw@b.co");
    expect(verifyUnsubscribe(url.searchParams.get("c")!, "forged", "test-secret")).toBeNull();
  });

  it("tidies first names", () => {
    expect(inviteFirstName("Kirsty harvey")).toBe("Kirsty");
    expect(inviteFirstName("Nasi")).toBe("Nasi");
    expect(inviteFirstName("  ")).toBe("There");
  });
});
