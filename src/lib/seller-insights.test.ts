import { describe, expect, it } from "vitest";
import { greeting, monthRevenue, parseRupiah, productAlerts, targetProgress, todayVsYesterday } from "./seller-insights";

const now = new Date(2026, 10, 8, 12, 0, 0); // 8 Nov 2026 12:00
const o = (day: number, total: number, status = "completed") => ({ status, subtotal: total, discount: 0, created_at: new Date(2026, 10, day, 10).toISOString() });

describe("seller insights", () => {
  it("greets by time of day", () => {
    expect(greeting(new Date(2026, 0, 1, 7))).toBe("Selamat pagi");
    expect(greeting(new Date(2026, 0, 1, 12))).toBe("Selamat siang");
    expect(greeting(new Date(2026, 0, 1, 16))).toBe("Selamat sore");
    expect(greeting(new Date(2026, 0, 1, 22))).toBe("Selamat malam");
  });

  it("compares completed revenue today vs yesterday", () => {
    const r = todayVsYesterday([o(8, 15000), o(7, 10000), o(8, 5000, "pending")], now);
    expect(r.today).toBe(15000);
    expect(r.yesterday).toBe(10000);
    expect(r.change).toBe(50);
    expect(r.ordersToday).toBe(2);
    expect(todayVsYesterday([o(8, 15000)], now).change).toBeNull();
  });

  it("sums only completed orders of this month", () => {
    const old = { status: "completed", subtotal: 99000, discount: 0, created_at: new Date(2026, 9, 30).toISOString() };
    expect(monthRevenue([o(1, 20000), o(8, 5000), o(3, 7000, "cancelled"), old], now)).toBe(25000);
  });

  it("computes target progress and daily pace", () => {
    const t = targetProgress(300000, 1000000, now); // 23 days left in Nov incl. today
    expect(t.pct).toBe(30);
    expect(t.daysLeft).toBe(23);
    expect(t.perDay).toBe(Math.ceil(700000 / 23));
    expect(targetProgress(1200000, 1000000, now).reached).toBe(true);
  });

  it("flags empty/low stock, missing photo and short description on active products", () => {
    const base = { status: "active", product_type: "code", images: ["a.jpg"], description: "Deskripsi produk yang cukup panjang sekali." };
    const alerts = productAlerts([
      { ...base, id: "1", name: "A", product_stock: [] },
      { ...base, id: "2", name: "B", product_stock: [{ status: "available" }, { status: "sold" }] },
      { ...base, id: "3", name: "C", product_type: "preorder", images: [], product_stock: [] },
      { ...base, id: "4", name: "D", status: "draft", product_stock: [] },
    ]);
    expect(alerts.map((a) => `${a.id}:${a.kind}`)).toEqual(["1:habis", "2:menipis", "3:foto"]);
  });

  it("parses typed rupiah amounts", () => {
    expect(parseRupiah("Rp 1.500.000")).toBe(1500000);
    expect(parseRupiah("")).toBe(0);
  });
});
