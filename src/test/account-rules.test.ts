import { describe, expect, it } from "vitest";
import { validateAccountProfile } from "@/lib/account";
import { CREDIT_TOPUP_MAX as TOPUP_MAX, CREDIT_TOPUP_MIN as TOPUP_MIN } from "@/lib/credits";

describe("account & credits rules", () => {
  it("phone must start with 08 or 628", () => {
    expect(validateAccountProfile({ full_name: "Dani", username: "", whatsapp: "0812345678" })).toEqual([]);
    expect(validateAccountProfile({ full_name: "Dani", username: "", whatsapp: "12345678" }).length).toBe(1);
  });
  it("credit top up is Rp1.000 – Rp10.000.000", () => {
    expect(TOPUP_MIN).toBe(1000);
    expect(TOPUP_MAX).toBe(10000000);
  });
});
