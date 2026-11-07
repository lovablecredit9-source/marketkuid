import { describe, expect, it } from "vitest";
import { sortProducts, SORTS, type CardProduct } from "./market";

const p = (id: string, avg: number, count: number): CardProduct => ({
  id, name: id, owner_id: "o", images: [], sold_count: 0, created_at: "2026-01-01", product_type: "account", category: null,
  minPrice: 1000, basePrice: 1000, maxPrice: 1000, stock: 1, storeName: "T", storeOpen: true, rating: { avg, count }, likes: 0,
});

describe("search sort", () => {
  it("offers 'Rating tinggi' like marketku.id", () => {
    expect(SORTS.find((s) => s.value === "rating")?.label).toBe("Rating tinggi");
  });
  it("orders by highest rating, then most reviews", () => {
    const out = sortProducts([p("a", 4.5, 10), p("b", 5, 2), p("c", 5, 9)], "rating");
    expect(out.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});
