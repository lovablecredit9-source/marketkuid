import { describe, expect, it } from "vitest";
import { rekberFees } from "./rekber";

describe("rekber fees (1%, mirrors create_rekber)", () => {
  it("buyer pays the fee on top when Pembeli bears it", () => {
    expect(rekberFees(100000, "pembeli")).toEqual({ fee: 1000, buyerPays: 101000, sellerReceives: 100000 });
  });
  it("seller receives amount minus fee when Penjual bears it", () => {
    expect(rekberFees(100000, "penjual")).toEqual({ fee: 1000, buyerPays: 100000, sellerReceives: 99000 });
  });
  it("splits the fee, buyer rounding up, when Dibagi dua", () => {
    expect(rekberFees(10100, "dibagi")).toEqual({ fee: 101, buyerPays: 10151, sellerReceives: 10050 });
  });
});
