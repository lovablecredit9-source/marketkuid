import { describe, expect, it } from "vitest";
import { isReferralCode, normalizeReferralCode, referralLink, referralRuleLines } from "./referral";

describe("referral helpers", () => {
  it("normalizes typed codes to uppercase letters and digits", () => {
    expect(normalizeReferralCode(" mk ab-12 ")).toBe("MKAB12");
  });
  it("rejects codes shorter than 4 characters", () => {
    expect(isReferralCode("MK1")).toBe(false);
    expect(isReferralCode("MKAB12")).toBe(true);
  });
  it("builds the register link with the code", () => {
    expect(referralLink("https://marketkuid.lovable.app/", "MKAB12")).toBe("https://marketkuid.lovable.app/register?ref=MKAB12");
  });
  it("omits the friend bonus line when the admin sets it to 0", () => {
    const lines = referralRuleLines({ is_enabled: true, referrer_reward: 2000, referee_reward: 0, min_order: 10000, max_rewards_per_referrer: 50, claim_window_days: 7 });
    expect(lines.some((l) => l.includes("bonus"))).toBe(false);
    expect(lines.some((l) => l.includes("Rp 2.000"))).toBe(true);
  });
});
