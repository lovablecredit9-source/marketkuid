import { describe, expect, it } from "vitest";
import { isUuid } from "./market";

describe("isUuid (broken links show 'tidak ditemukan' instead of an error)", () => {
  it("accepts a real id", () => {
    expect(isUuid("84bdc029-1e3e-4717-93da-e3c64937fdb1")).toBe(true);
  });
  it("rejects typed or cut-off links", () => {
    expect(isUuid("xxx")).toBe(false);
    expect(isUuid("84bdc029-1e3e-4717-93da")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
