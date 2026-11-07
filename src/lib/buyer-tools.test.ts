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
