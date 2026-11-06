import { describe, expect, it } from "vitest";
import { EXTRA_OWNER_PHONES, ownerPhones } from "./customerNotifications";

describe("owner alert numbers", () => {
  it("sends to the configured owner number and the extra number", () => {
    expect(EXTRA_OWNER_PHONES).toContain("+447849263765");
    expect(ownerPhones({ EBYSPLACE_OWNER_PHONE_E164: "+447864585110" })).toEqual(["+447864585110", "+447849263765"]);
  });

  it("accepts a comma-separated list and never texts the same number twice", () => {
    expect(ownerPhones({ OWNER_PHONE_E164: "+447864585110, 07849263765" })).toEqual(["+447864585110", "07849263765"]);
  });

  it("still reaches the extra number when no owner number is set", () => {
    expect(ownerPhones({})).toEqual(["+447849263765"]);
  });
});
