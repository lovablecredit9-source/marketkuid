import { describe, expect, it } from "vitest";
import { MIN_WITHDRAW, regularQuotaLeft, withdrawQuote, type Withdrawal } from "@/lib/withdraw";

describe("withdraw rules", () => {
  it("regular withdrawal costs Rp2.000 and no commission", () => {
    expect(withdrawQuote(40800, false)).toMatchObject({ fee: 2000, commission: 0, net: 38800 });
  });
  it("same day processing costs Rp3.000", () => {
    expect(withdrawQuote(40800, true)).toMatchObject({ fee: 3000, net: 37800 });
  });
  it("needs at least Rp50.000", () => {
    expect(MIN_WITHDRAW).toBe(50000);
    expect(withdrawQuote(49999, false).allowed).toBe(false);
    expect(withdrawQuote(50000, false).allowed).toBe(true);
  });
  it("one regular withdrawal per day; rejected ones give the quota back", () => {
    const now = new Date("2026-10-30T05:00:00Z");
    const base = { id: "1", amount: 1, fee: 0, net: 1, auto: false, bank_provider: "DANA", bank_number: "1", bank_holder: null, admin_note: null, reviewed_at: null, created_at: "2026-10-30T02:00:00Z" };
    expect(regularQuotaLeft([], now)).toBe(1);
    expect(regularQuotaLeft([{ ...base, same_day: false, status: "pending" } as Withdrawal], now)).toBe(0);
    expect(regularQuotaLeft([{ ...base, same_day: false, status: "rejected" } as Withdrawal], now)).toBe(1);
    expect(regularQuotaLeft([{ ...base, same_day: true, status: "sent" } as Withdrawal], now)).toBe(1);
  });
});
