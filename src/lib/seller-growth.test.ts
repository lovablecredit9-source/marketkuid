import { describe, expect, it } from "vitest";
import { achievements, loyalBuyers, peakTimes, profitCalc, promoCaption, statusBreakdown } from "./seller-growth";

const o = (buyer: string, day: number, hour: number, total: number, status = "completed") => ({
  status, subtotal: total, discount: 0, buyer_id: buyer, buyer_name: buyer.toUpperCase(),
  created_at: new Date(2026, 10, day, hour).toISOString(),
});

describe("seller growth insights", () => {
  it("finds the busiest hour and weekday from paid orders only", () => {
    const r = peakTimes([o("a", 8, 20, 1), o("b", 8, 20, 1), o("c", 9, 10, 1), o("d", 9, 10, 1, "cancelled"), o("e", 9, 10, 1, "pending")]);
    expect(r.total).toBe(3);
    expect(r.bestHour).toBe(20);
    expect(r.bestDay).toBe(0); // 8 Nov 2026 = Minggu
    expect(peakTimes([]).bestHour).toBeNull();
  });

  it("lists only buyers with 2+ completed orders", () => {
    const r = loyalBuyers([o("a", 1, 9, 10000), o("a", 2, 9, 5000), o("b", 1, 9, 99000), o("c", 1, 9, 1000), o("c", 2, 9, 1000), o("c", 3, 9, 1000, "cancelled")]);
    expect(r.map((b) => b.id)).toEqual(["a", "c"]);
    expect(r[0]!.spend).toBe(15000);
    expect(r[1]!.orders).toBe(2);
  });

  it("groups order statuses", () => {
    const r = statusBreakdown([{ status: "completed" }, { status: "paid" }, { status: "processing" }, { status: "pending" }, { status: "expired" }]);
    expect(r).toEqual({ selesai: 1, proses: 2, menunggu: 1, batal: 1, total: 5 });
  });

  it("calculates profit after the 3% fee, fee rounded up", () => {
    const r = profitCalc(10001, 5000, 3);
    expect(r.fee).toBe(301);
    expect(r.received).toBe(9700);
    expect(r.profit).toBe(4700);
    expect(profitCalc(0, 0, 3).margin).toBe(0);
  });

  it("unlocks achievements from real numbers", () => {
    const list = achievements({ completed: 10, revenue: 500000, activeProducts: 2, buyers: 4, loyal: 0 });
    const done = list.filter((a) => a.done).map((a) => a.key);
    expect(done).toEqual(["first", "o10"]);
    expect(list.find((a) => a.key === "r1m")!.current).toBe(500000);
  });

  it("builds a caption with price and link", () => {
    const c = promoCaption({ name: "Netflix", price: 25000, store: "Tambas", url: "https://x/produk/tambas/netflix", tone: "singkat" });
    expect(c).toBe("Netflix — Rp25.000\nBeli di Tambas: https://x/produk/tambas/netflix");
  });
});
