import { describe, expect, it } from "vitest";
import { emptyVariant, stockLines, validateInfo, validateVariants, warrantyLabel, priceRange } from "@/lib/products";

describe("product form rules", () => {
  it("info needs name, type and category", () => {
    expect(validateInfo({ name: "", type: "", category_id: null })).toHaveLength(3);
    expect(validateInfo({ name: "ChatGPT Plus", type: "preorder", category_id: "c1" })).toEqual([]);
  });

  it("flags a variant missing duration and price like the reference", () => {
    const ok = { ...emptyVariant(), name: "CHATGPT PLUS", price: "10.000", lifetime: true };
    const bad = { ...emptyVariant(), name: "Paket 2" };
    expect(validateVariants([ok, bad])).toEqual(["Varian 2: durasi dan harga belum diisi"]);
  });

  it("each non-empty line is one stock item", () => {
    expect(stockLines("a\n\n b \n")).toEqual(["a", "b"]);
  });

  it("warranty labels follow the mode", () => {
    expect(warrantyLabel({ mode: "backfree", days: 7, max_claims: 0 })).toBe("Garansi Backfree 7 Hari");
    expect(warrantyLabel({ mode: "login", days: null, max_claims: 0 })).toBe("Garansi Login");
  });

  it("price range shows min – max", () => {
    expect(priceRange([20000, 30000])).toBe("Rp. 20.000,- – Rp. 30.000,-");
  });
});
