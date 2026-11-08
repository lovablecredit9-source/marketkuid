import { describe, expect, it } from "vitest";
import { productJsonLd } from "./meta";

const base = { name: "Canva Pro", description: "Akun Canva", store: "Tambas", minPrice: 9000, maxPrice: 12000, ratingAvg: 0, ratingCount: 0, inStock: true };

describe("product structured data", () => {
  it("has no rating when the product has no real reviews", () => {
    expect("aggregateRating" in productJsonLd("/produk/toko/x", base)).toBe(false);
  });
  it("uses the real review count and average", () => {
    const ld = productJsonLd("/produk/toko/x", { ...base, ratingAvg: 4.666, ratingCount: 3 }) as { aggregateRating: { ratingValue: number; reviewCount: number } };
    expect(ld.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.7, reviewCount: 3 });
  });
  it("prices in rupiah with low and high variant price", () => {
    const ld = productJsonLd("/produk/toko/x", base);
    expect(ld.offers.priceCurrency).toBe("IDR");
    expect([ld.offers.lowPrice, ld.offers.highPrice]).toEqual([9000, 12000]);
  });
});
