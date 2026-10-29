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

describe("category tree", () => {
  const cats = [
    { id: "apl", name: "Aplikasi", sort: 1, parent_id: null },
    { id: "prem", name: "App Premium", sort: 2, parent_id: "apl" },
    { id: "canva", name: "Canva", sort: 3, parent_id: "prem" },
    { id: "zoom", name: "Zoom", sort: 4, parent_id: "apl" },
    { id: "ai", name: "AI Tools", sort: 5, parent_id: null },
  ];
  it("a parent category includes every nested sub-category", () => {
    expect(descendantIds(cats, "apl").sort()).toEqual(["apl", "canva", "prem", "zoom"]);
    expect(descendantIds(cats, "ai")).toEqual(["ai"]);
  });
  it("breadcrumb goes Kategori > Aplikasi > App Premium > Canva", () => {
    expect(categoryPath(cats, "canva").map((c) => c.name)).toEqual(["Aplikasi", "App Premium", "Canva"]);
  });
  it("picker lists only direct children, alphabetically", () => {
    expect(childCategories(cats, "apl").map((c) => c.name)).toEqual(["App Premium", "Zoom"]);
    expect(childCategories(cats, null).map((c) => c.name)).toEqual(["AI Tools", "Aplikasi"]);
  });
});
