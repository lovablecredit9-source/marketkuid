import { describe, expect, it } from "vitest";
import { parseItems, ratingOf, sortProducts, unitPrice, type CardProduct } from "@/lib/market";
import { sellerStats, tierFor } from "@/lib/seller-orders";
import { validateCampaign } from "@/lib/ads";

describe("harga varian", () => {
  it("diskon persen berlaku saat jumlah mencapai minimum order", () => {
    expect(unitPrice(10000, 2, { min_order: 2, percent: 10 })).toBe(9000);
    expect(unitPrice(10000, 1, { min_order: 2, percent: 10 })).toBe(10000);
  });
});

describe("isi checkout", () => {
  it("membuang item tidak valid dan membatasi jumlah maksimal 1000", () => {
    const id = "cc485186-9285-4768-87a6-2fe23adf1739";
    expect(parseItems(`${id}:2,bukan-id:3,${id}:5000`)).toEqual([{ variant_id: id, qty: 2 }, { variant_id: id, qty: 1000 }]);
  });
});

describe("rating", () => {
  it("rata-rata dibulatkan satu desimal", () => {
    expect(ratingOf([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({ avg: 4.3, count: 3 });
  });
});

describe("urutan produk", () => {
  const p = (id: string, minPrice: number, sold_count: number) => ({ id, name: id, minPrice, sold_count, created_at: "2026-10-01" }) as CardProduct;
  it("termurah dan terlaris", () => {
    const list = [p("a", 5000, 1), p("b", 1000, 9)];
    expect(sortProducts(list, "termurah").map((x) => x.id)).toEqual(["b", "a"]);
    expect(sortProducts(list, "terlaris").map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("statistik seller", () => {
  it("pendapatan hanya dari pesanan selesai, setelah potongan voucher", () => {
    const o = (status: string, subtotal: number, discount = 0) => ({ status, subtotal, discount, total: subtotal - discount, buyer_id: "b1", created_at: new Date().toISOString(), order_items: [] });
    const s = sellerStats([o("completed", 20000, 2000), o("pending", 50000), o("cancelled", 10000)]);
    expect(s.revenue).toBe(18000);
    expect(s.waiting).toBe(1);
    expect(s.cancelled).toBe(1);
  });
});

describe("program seller", () => {
  it("level naik sesuai jumlah transaksi selesai", () => {
    expect(tierFor(0).tier.name).toBe("Bronze");
    expect(tierFor(50).tier.name).toBe("Silver");
    expect(tierFor(49).toNext).toBe(1);
  });
});

describe("buat iklan", () => {
  it("anggaran harian minimal Rp5.000", () => {
    const base = { name: "Promo", product_id: "x", starts_at: "", ends_at: "" };
    expect(validateCampaign({ ...base, budget: 4999 })).toHaveLength(1);
    expect(validateCampaign({ ...base, budget: 5000 })).toEqual([]);
  });
});
