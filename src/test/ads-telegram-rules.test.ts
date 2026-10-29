import { describe, expect, it } from "vitest";
import { adCost, adMatches, parseKeywords, validateAd, AD_MIN_TOPUP } from "@/lib/ads";
import { actionFromText, cleanKeyboard, fillGate, isAdminWa, isBotToken, isChatRef, keyboardOrDefault, parseReferral, referralCode, DEFAULT_KEYBOARD, MAX_BOTS } from "@/lib/telegram";

describe("iklan", () => {
  it("costs Rp5.000 per day", () => {
    expect(adCost(7)).toBe(35000);
    expect(adCost(1)).toBe(5000);
  });
  it("allows 1 to 90 days only", () => {
    const base = { product_id: "p", keywords: ["netflix"], balance: 1_000_000 };
    expect(validateAd({ ...base, days: 0 })).toHaveLength(1);
    expect(validateAd({ ...base, days: 91 })).toHaveLength(1);
    expect(validateAd({ ...base, days: 90 })).toEqual([]);
  });
  it("blocks ordering when balance is below the total", () => {
    expect(validateAd({ product_id: "p", keywords: ["a1"], days: 7, balance: 34999 })).toEqual(["Saldo iklan belum cukup"]);
    expect(validateAd({ product_id: "p", keywords: ["a1"], days: 7, balance: 35000 })).toEqual([]);
  });
  it("splits keywords by comma, lowercased and unique", () => {
    expect(parseKeywords("Netflix, akun premium ,netflix,x")).toEqual(["netflix", "akun premium"]);
  });
  it("matches exact vs phrase mode", () => {
    expect(adMatches("netflix", ["netflix"], "persis")).toBe(true);
    expect(adMatches("netflix premium", ["netflix"], "persis")).toBe(false);
    expect(adMatches("netflix premium", ["netflix"], "frasa")).toBe(true);
  });
  it("minimum top up is Rp5.000", () => expect(AD_MIN_TOPUP).toBe(5000));
});

describe("bot telegram", () => {
  it("limits a store to 5 bots", () => expect(MAX_BOTS).toBe(5));
  it("accepts BotFather tokens only", () => {
    expect(isBotToken("123456789:AAEhBP0av28pFzlQ3xY4R8Kp1vW2aBcDeFg")).toBe(true);
    expect(isBotToken("hello")).toBe(false);
  });
  it("admin WhatsApp must start with 62", () => {
    expect(isAdminWa("6285769302532")).toBe(true);
    expect(isAdminWa("085769302532")).toBe(false);
  });
  it("force join needs @channel or -100 id", () => {
    expect(isChatRef("@marketku")).toBe(true);
    expect(isChatRef("-1001234567890")).toBe(true);
    expect(isChatRef("marketku")).toBe(false);
  });
  it("uses the default keyboard when none is designed, max 3 per row", () => {
    expect(keyboardOrDefault([])).toEqual(DEFAULT_KEYBOARD);
    expect(cleanKeyboard([["promo", "bogus", "topup", "garansi", "tarik"]])).toEqual([["promo", "topup", "garansi"]]);
  });
  it("maps keyboard labels back to actions", () => {
    expect(actionFromText("🎫 Promo")).toBe("promo");
    expect(actionFromText("/start")).toBe("start");
    expect(actionFromText("halo")).toBeNull();
  });
  it("referral code round-trips", () => {
    expect(parseReferral(`ref_${referralCode(506123)}`)).toBe(506123);
    expect(parseReferral("abc")).toBeNull();
  });
  it("fills gate placeholders", () => {
    expect(fillGate("Hai {nama} join {channel}", { nama: "Agung", username: "@a", channel: "@ch", bot: "@b" })).toBe("Hai Agung join @ch");
  });
});
