import { describe, expect, it } from "vitest";
import { depositAmountError } from "@/lib/wallet";

describe("deposit amount rules", () => {
  it("rejects below the minimum deposit", () => {
    expect(depositAmountError(9_999, 10_000)).not.toBeNull();
  });
  it("accepts the minimum deposit", () => {
    expect(depositAmountError(10_000, 10_000)).toBeNull();
  });
  it("rejects above Rp10.000.000", () => {
    expect(depositAmountError(10_000_001)).not.toBeNull();
  });
});
