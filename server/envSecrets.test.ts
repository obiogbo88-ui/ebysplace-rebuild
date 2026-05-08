import { describe, expect, it } from "vitest";
import { normalizeEnvUrl, normalizeSecretKey, trimEnvValue } from "./_core/envSecrets";

describe("environment secret normalization", () => {
  it("removes accidental copy/paste whitespace from secret keys", () => {
    const liveKeyPrefix = ["sk", "live"].join("_");
    expect(normalizeSecretKey(` '${liveKeyPrefix}_abc \n def\tghi\rjkl' `)).toBe(`${liveKeyPrefix}_abcdefghijkl`);
    expect(normalizeSecretKey("\uFEFFSG.abc \n def\tghi")).toBe("SG.abcdefghi");
    expect(normalizeSecretKey(" AC123\u200B456 ")).toBe("AC123456");
  });

  it("trims quoted env values without altering intentional internal characters", () => {
    expect(trimEnvValue(" 'smtp.zoho.eu' ")).toBe("smtp.zoho.eu");
    expect(trimEnvValue(" info@ebysplace.com ")).toBe("info@ebysplace.com");
  });

  it("normalizes URLs copied with trailing slashes or whitespace", () => {
    expect(normalizeEnvUrl(" https://example.supabase.co/ \n")).toBe("https://example.supabase.co");
  });
});
