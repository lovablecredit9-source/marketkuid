import { describe, it, expect } from "vitest";
import { sellerNet, holdLeft } from "./seller-holds";
describe("saldo tertahan", () => {
  it("potongan admin 3%", () => { expect(sellerNet(100000)).toBe(97000); });
  it("sisa waktu jam & menit", () => {
    const now = Date.parse("2026-10-30T00:00:00Z");
    expect(holdLeft("2026-10-30T04:30:00Z", now)).toBe("4 jam 30 menit lagi");
    expect(holdLeft("2026-10-30T00:20:00Z", now)).toBe("20 menit lagi");
  });
});
