import { describe, expect, it } from "vitest";
import type { CardProduct } from "@/lib/market";
import { filterReviews, filterStoreProducts, reviewBreakdown, shortCount, storeBadges, storeCategories, topSellers, voucherTerms, voucherValue } from "@/lib/store-page";

const p = (id: string, o: Partial<CardProduct> = {}): CardProduct => ({
  id, name: id, owner_id: "A", images: [], sold_count: 0, created_at: "2026-01-01", product_type: "account", category: null,
  minPrice: 1000, basePrice: 1000, maxPrice: 1000, stock: 1, storeName: "T", storeOpen: true, rating: { avg: 0, count: 0 }, likes: 0, ...o,
});

describe("store page products", () => {
  const list = [
    p("Netflix", { minPrice: 30000, sold_count: 5, created_at: "2026-01-03", category: "Streaming" }),
    p("Canva", { minPrice: 10000, sold_count: 9, created_at: "2026-01-01", category: "Desain" }),
    p("Spotify", { minPrice: 20000, sold_count: 1, created_at: "2026-01-02", category: "Streaming" }),
    p("Other store", { owner_id: "B", minPrice: 1 }),
  ];
  it("never shows another store's products", () => {
    expect(filterStoreProducts(list, "A", { q: "", category: null, sort: "termurah" }).map((x) => x.id)).toEqual(["Canva", "Spotify", "Netflix"]);
  });
  it("searches by name and filters by category", () => {
    expect(filterStoreProducts(list, "A", { q: "spot", category: null, sort: "terbaru" }).map((x) => x.id)).toEqual(["Spotify"]);
    expect(filterStoreProducts(list, "A", { q: "", category: "Streaming", sort: "termahal" }).map((x) => x.id)).toEqual(["Netflix", "Spotify"]);
  });
  it("sorts by newest and best selling", () => {
    expect(filterStoreProducts(list, "A", { q: "", category: null, sort: "terbaru" }).map((x) => x.id)).toEqual(["Netflix", "Spotify", "Canva"]);
    expect(filterStoreProducts(list, "A", { q: "", category: null, sort: "terlaris" }).map((x) => x.id)).toEqual(["Canva", "Netflix", "Spotify"]);
  });
  it("lists categories by product count", () => {
    expect(storeCategories(list)).toEqual([{ name: "Streaming", n: 2 }, { name: "Desain", n: 1 }]);
  });
});

describe("store vouchers", () => {
  it("formats percent and nominal values", () => {
    expect(voucherValue({ value: 10, value_type: "percent" })).toBe("Diskon 10%");
    expect(voucherValue({ value: 5000, value_type: "nominal" })).toBe("Potongan Rp 5.000");
  });
  it("shows minimum spend and max discount for percent vouchers", () => {
    expect(voucherTerms({ code: "X", name: "", kind: "", value: 10, value_type: "percent", max_discount: 20000, min_spend: 50000 })).toBe("Min. belanja Rp 50.000 · Maks. Rp 20.000");
    expect(voucherTerms({ code: "X", name: "", kind: "", value: 5000, value_type: "nominal", max_discount: 0, min_spend: 0 })).toBe("Tanpa minimal belanja");
  });
});

describe("store reviews", () => {
  const rows = [{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 1 }];
  it("computes star percentages", () => {
    expect(reviewBreakdown(rows).map((b) => b.pct)).toEqual([50, 25, 0, 0, 25]);
  });
  it("filters by star", () => {
    expect(filterReviews(rows, 5)).toHaveLength(2);
    expect(filterReviews(rows, null)).toHaveLength(4);
  });
});

describe("store badges", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const base = { avg: 0, reviews: 0, sold: 0, products: 1, createdAt: "2026-01-01", now };
  const keys = (o: Partial<typeof base>) => storeBadges({ ...base, ...o }).map((b) => b.key);
  it("Rating Tinggi needs at least 5 reviews averaging 4.5+", () => {
    expect(keys({ avg: 4.5, reviews: 5 })).toContain("rating");
    expect(keys({ avg: 5, reviews: 4 })).not.toContain("rating");
    expect(keys({ avg: 4.4, reviews: 50 })).not.toContain("rating");
  });
  it("Toko Laris from 50 sold", () => {
    expect(keys({ sold: 50 })).toContain("laris");
    expect(keys({ sold: 49 })).not.toContain("laris");
  });
  it("Koleksi Lengkap from 20 active products", () => {
    expect(keys({ products: 20 })).toContain("lengkap");
    expect(keys({ products: 19 })).not.toContain("lengkap");
  });
  it("Toko Baru only within 30 days of joining", () => {
    expect(keys({ createdAt: "2026-06-10" })).toContain("baru");
    expect(keys({ createdAt: "2026-05-01" })).not.toContain("baru");
  });
});

describe("top sellers and counts", () => {
  it("keeps only sold products, most sold first, max 3", () => {
    const l = [p("a", { sold_count: 2 }), p("b", { sold_count: 0 }), p("c", { sold_count: 9 }), p("d", { sold_count: 5 }), p("e", { sold_count: 1 })];
    expect(topSellers(l).map((x) => x.id)).toEqual(["c", "d", "a"]);
    expect(topSellers([p("z")])).toEqual([]);
  });
  it("short counts", () => {
    expect(shortCount(950)).toBe("950");
    expect(shortCount(1200)).toBe("1,2 rb");
    expect(shortCount(3_000_000)).toBe("3 jt");
  });
});
