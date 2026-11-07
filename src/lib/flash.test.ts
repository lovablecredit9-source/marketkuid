import { describe, expect, it } from "vitest";
import { applyFlash, countdown, flashPhase, liveFlashPercent, validateFlash, type FlashSale } from "./flash";
import { unitPrice } from "./market";

const now = Date.parse("2026-11-07T10:00:00Z");
const sale = (o: Partial<FlashSale>): FlashSale => ({ id: "f", product_id: "p", percent: 50, starts_at: "2026-11-07T09:00:00Z", ends_at: "2026-11-07T12:00:00Z", quota: null, sold: 0, ...o });

describe("flash sale rules", () => {
  it("phases: live, upcoming, ended, sold out", () => {
    expect(flashPhase(sale({}), now)).toBe("live");
    expect(flashPhase(sale({ starts_at: "2026-11-07T11:00:00Z" }), now)).toBe("upcoming");
    expect(flashPhase(sale({ ends_at: "2026-11-07T10:00:00Z" }), now)).toBe("ended");
    expect(flashPhase(sale({ quota: 5, sold: 5 }), now)).toBe("soldout");
  });
  it("flash applies after the variant discount, floored like checkout", () => {
    expect(applyFlash(15000, 50)).toBe(7500);
    expect(unitPrice(10000, 1, { percent: 10, min_order: 1 }, 50)).toBe(4500);
    expect(unitPrice(999, 1, null, 33)).toBe(670);
  });
  it("only live sales count for a product price", () => {
    const list = [sale({ percent: 20 }), sale({ id: "g", percent: 60, starts_at: "2026-11-07T11:00:00Z" }), sale({ id: "h", product_id: "x", percent: 80 })];
    expect(liveFlashPercent(list, "p", now)).toBe(20);
  });
  it("quota must cover the whole quantity (3 kuota, 2 terjual: beli 2 = harga normal)", () => {
    const q = [sale({ quota: 3, sold: 2 })];
    expect(liveFlashPercent(q, "p", now, 1)).toBe(50);
    expect(liveFlashPercent(q, "p", now, 2)).toBe(0);
  });
  it("seller limits: 1–90%, 1–72 jam, start ≤30 hari", () => {
    const ok = { productId: "p", percent: 50, startsAt: new Date(now), hours: 24, quota: null };
    expect(validateFlash(ok, now)).toBeNull();
    expect(validateFlash({ ...ok, percent: 91 }, now)).toMatch(/1–90/);
    expect(validateFlash({ ...ok, hours: 73 }, now)).toMatch(/1–72/);
    expect(validateFlash({ ...ok, startsAt: new Date(now + 31 * 86400_000) }, now)).toMatch(/30 hari/);
  });
  it("countdown format", () => {
    expect(countdown(3_723_000)).toBe("01:02:03");
    expect(countdown(90_000_000)).toBe("1h 01:00:00");
  });
});
