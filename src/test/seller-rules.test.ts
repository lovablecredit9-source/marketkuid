import { describe, expect, it } from "vitest";
import { normalizeTelegram, validStoreName, validTelegram } from "@/components/marketku/seller-sheet";

describe("seller registration rules", () => {
  it("requires a store name of 3–40 characters", () => {
    expect(validStoreName("ab")).toBe(false);
    expect(validStoreName("Jihan Store")).toBe(true);
    expect(validStoreName("x".repeat(41))).toBe(false);
  });

  it("telegram username is optional and written without @", () => {
    expect(validTelegram("")).toBe(true);
    expect(normalizeTelegram("@jihan_store")).toBe("jihan_store");
    expect(validTelegram(normalizeTelegram("@jihan_store"))).toBe(true);
    expect(validTelegram("ab")).toBe(false);
  });
});
