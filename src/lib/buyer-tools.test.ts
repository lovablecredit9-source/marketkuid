import { describe, expect, it } from "vitest";
import { priceDrop, pushSearch, snapPrices, toggleCompareList } from "./buyer-tools";

describe("bandingkan produk", () => {
  it("menerima maksimal 3 produk", () => {
    const r = toggleCompareList(["a", "b", "c"], "d");
    expect(r.full).toBe(true);
    expect(r.list).toEqual(["a", "b", "c"]);
  });
  it("klik lagi menghapus produk dari daftar", () => {
    expect(toggleCompareList(["a", "b"], "a").list).toEqual(["b"]);
  });
});

describe("riwayat pencarian", () => {
  it("terbaru di depan tanpa duplikat, maksimal 8", () => {
    const list = ["netflix", "canva", "1", "2", "3", "4", "5", "6"];
    expect(pushSearch(list, " Canva ")).toEqual(["Canva", "netflix", "1", "2", "3", "4", "5", "6"]);
    expect(pushSearch(list, "spotify")).toHaveLength(8);
    expect(pushSearch(list, "   ")).toBe(list);
  });
});

describe("pantau harga wishlist", () => {
  it("menyimpan harga pertama saja", () => {
    expect(snapPrices({ a: 10000 }, [{ id: "a", price: 8000 }, { id: "b", price: 5000 }])).toEqual({ a: 10000, b: 5000 });
  });
  it("menghitung harga turun", () => {
    expect(priceDrop(10000, 8000)).toEqual({ amount: 2000, percent: 20 });
    expect(priceDrop(10000, 10000)).toBeNull();
    expect(priceDrop(undefined, 5000)).toBeNull();
  });
});

import { quickFilter, spendSummary } from "./buyer-tools";

describe("quickFilter", () => {
  const items = [
    { id: "a", stock: 0, minPrice: 9000, basePrice: 10000 },
    { id: "b", stock: 3, minPrice: 10000, basePrice: 10000 },
    { id: "c", stock: 2, minPrice: 8000, basePrice: 10000 },
  ];
  it("stok tersedia hides sold-out products", () => {
    expect(quickFilter(items, { inStock: true, onSale: false }).map((p) => p.id)).toEqual(["b", "c"]);
  });
  it("lagi diskon keeps only cheaper-than-normal products", () => {
    expect(quickFilter(items, { inStock: false, onSale: true }).map((p) => p.id)).toEqual(["a", "c"]);
  });
  it("both together", () => {
    expect(quickFilter(items, { inStock: true, onSale: true }).map((p) => p.id)).toEqual(["c"]);
  });
});

describe("spendSummary", () => {
  const now = new Date(2026, 10, 7);
  it("counts only paid orders, splitting this month from all time", () => {
    const s = spendSummary([
      { status: "completed", total: 10000, created_at: new Date(2026, 10, 2).toISOString() },
      { status: "paid", total: "5000", created_at: new Date(2026, 9, 20).toISOString() },
      { status: "pending", total: 99000, created_at: new Date(2026, 10, 3).toISOString() },
      { status: "cancelled", total: 7000, created_at: new Date(2026, 10, 4).toISOString() },
    ], now);
    expect(s).toEqual({ month: 10000, monthCount: 1, all: 15000, allCount: 2 });
  });
});
