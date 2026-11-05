import { describe, expect, it } from "vitest";
import { creditTopupError } from "./credits";

describe("top up credits limits", () => {
  it("rejects below Rp1.000", () => expect(creditTopupError(999)).toBe("Minimal top up credits Rp1.000"));
  it("accepts Rp1.000", () => expect(creditTopupError(1000)).toBeNull());
  it("accepts Rp10.000.000", () => expect(creditTopupError(10_000_000)).toBeNull());
  it("rejects above Rp10.000.000", () => expect(creditTopupError(10_000_001)).toBe("Maksimal top up credits Rp10.000.000"));
});
