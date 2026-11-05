import { describe, expect, it } from "vitest";
import { canReportOrder, disputeStats, isDisputeActive, DISPUTE_REASONS, MAX_DISPUTE_PHOTOS } from "@/lib/disputes";

const paid = { status: "completed", paid_at: "2026-11-05T07:05:00Z", buyer_confirmed_at: null };

describe("dispute rules", () => {
  it("allows reporting a paid order whose funds are still held", () => {
    expect(canReportOrder(paid)).toBe(true);
  });
  it("blocks reporting an unpaid order", () => {
    expect(canReportOrder({ status: "pending", paid_at: null, buyer_confirmed_at: null })).toBe(false);
  });
  it("blocks reporting after the buyer confirmed receipt", () => {
    expect(canReportOrder({ ...paid, buyer_confirmed_at: "2026-11-05T07:12:00Z" })).toBe(false);
  });
  it("blocks reporting after funds were released to the seller", () => {
    expect(canReportOrder(paid, true)).toBe(false);
  });
  it("only open and in-review disputes are active", () => {
    expect(["terbuka", "ditinjau", "dilepas", "refund", "ditutup"].map(isDisputeActive)).toEqual([true, true, false, false, false]);
  });
  it("counts stats like the seller dashboard", () => {
    expect(disputeStats([{ status: "terbuka" }, { status: "ditinjau" }, { status: "refund" }, { status: "ditutup" }])).toEqual({ total: 4, aktif: 2, terbuka: 1, ditinjau: 1, selesai: 2 });
  });
  it("offers six reasons and max 3 photos", () => {
    expect(DISPUTE_REASONS).toHaveLength(6);
    expect(MAX_DISPUTE_PHOTOS).toBe(3);
  });
});
