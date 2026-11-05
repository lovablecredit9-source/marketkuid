import { describe, expect, it } from "vitest";
import { HOLD_HOURS, HOLD_TITLE, WARRANTY_HOLD_MAX_DAYS, holdsOfKind } from "@/components/marketku/seller-holds";

describe("seller held balances", () => {
  it("non-garansi sales are held 5 hours", () => {
    expect(HOLD_HOURS).toBe(5);
  });
  it("garansi sales are held at most 3 days", () => {
    expect(WARRANTY_HOLD_MAX_DAYS).toBe(3);
  });
  it("splits holds into non-garansi and masa garansi", () => {
    const list = [{ kind: "biasa", id: 1 }, { kind: "garansi", id: 2 }, { kind: null, id: 3 }];
    expect(holdsOfKind(list, "garansi").map((h) => h.id)).toEqual([2]);
    expect(holdsOfKind(list, "biasa").map((h) => h.id)).toEqual([1, 3]);
    expect(HOLD_TITLE.biasa).toBe("Saldo Tertahan Non-Garansi");
  });
});
