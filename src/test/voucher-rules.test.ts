import { describe, expect, it } from "vitest";
import { emptyVoucher, normalizeCode, validateVoucherStep } from "@/lib/voucher";

describe("voucher rules", () => {
  it("percent discount cannot exceed 100", () => {
    const d = { ...emptyVoucher(), value_type: "percent" as const, value: "101" };
    expect(validateVoucherStep(3, d)).toContain("Persentase maksimal 100");
    expect(validateVoucherStep(3, { ...d, value: "100" })).toEqual([]);
  });

  it("nominal discount may exceed 100", () => {
    expect(validateVoucherStep(3, { ...emptyVoucher(), value_type: "nominal", value: "5000" })).toEqual([]);
  });

  it("promo code is 3-20 uppercase letters/digits", () => {
    expect(normalizeCode("hemat-50!")).toBe("HEMAT50");
    expect(validateVoucherStep(2, { ...emptyVoucher(), code: "AB", name: "x" })).toContain("Kode promo 3–20 huruf/angka");
    expect(validateVoucherStep(2, { ...emptyVoucher(), code: "HEMAT50", name: "Hemat" })).toEqual([]);
  });

  it("end date must be after start date", () => {
    const d = { ...emptyVoucher(), starts_at: "2026-11-02T10:00", ends_at: "2026-11-01T10:00" };
    expect(validateVoucherStep(4, d)).toContain("Tanggal selesai harus setelah tanggal mulai");
  });
});
