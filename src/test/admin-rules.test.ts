import { describe, expect, it } from "vitest";
import { BAN_DURATIONS, PAYMENT_PROVIDERS, banDaysLeft, banUntilLabel } from "@/lib/admin";

describe("admin ban rules", () => {
  it("a ban without an end date is permanent", () => {
    expect(banUntilLabel(null)).toBe("Permanen");
    expect(banDaysLeft(null)).toBeNull();
  });
  it("counts remaining ban days rounded up", () => {
    const now = Date.UTC(2026, 9, 30, 0, 0);
    expect(banDaysLeft(new Date(now + 3 * 86_400_000 - 60_000).toISOString(), now)).toBe(3);
    expect(banDaysLeft(new Date(now - 1000).toISOString(), now)).toBe(0);
  });
  it("offers day-based durations plus permanent", () => {
    expect(BAN_DURATIONS.map((d) => d.days)).toEqual([1, 3, 7, 14, 30, 0]);
  });
  it("supports QRIS, DANA, GoPay, OVO and ShopeePay top up", () => {
    const names = PAYMENT_PROVIDERS.map((p) => p.provider);
    for (const p of ["QRIS", "DANA", "GoPay", "OVO", "ShopeePay"]) expect(names).toContain(p);
  });
});
