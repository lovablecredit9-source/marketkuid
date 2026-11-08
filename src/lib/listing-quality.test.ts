import { describe, expect, it } from "vitest";
import { listingScore, moveItem, scoreTone } from "./listing-quality";

const empty = { name: "", description: "", photos: 0, hasCategory: false, pricedVariants: 0, stockCount: 0, unlimitedStock: false, hasGuide: false };

describe("listing quality", () => {
  it("empty listing scores 0", () => expect(listingScore(empty)).toBe(0));
  it("complete listing scores 100", () => {
    expect(listingScore({ name: "ChatGPT Plus 1 Bulan", description: "x".repeat(60), photos: 3, hasCategory: true, pricedVariants: 1, stockCount: 5, unlimitedStock: false, hasGuide: true })).toBe(100);
  });
  it("short name and 2 photos do not count", () => {
    expect(listingScore({ ...empty, name: "Netflix", photos: 2 })).toBe(0);
  });
  it("unlimited stock counts as stock ready", () => expect(listingScore({ ...empty, unlimitedStock: true })).toBe(10));
  it("tones by threshold", () => {
    expect(scoreTone(80).tone).toBe("high");
    expect(scoreTone(50).tone).toBe("mid");
    expect(scoreTone(49).tone).toBe("low");
  });
  it("moves photos", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
