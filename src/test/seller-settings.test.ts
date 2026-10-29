import { describe, expect, it } from "vitest";
import { passwordRules, slugify, validateBank, validateStoreProfile } from "@/lib/seller-settings";

const base = { store_name: "Toko Kita", slug: "toko-kita", description: "", contact_phone: "", telegram_username: "" };

describe("seller settings rules", () => {
  it("slugifies store names", () => expect(slugify("Toko  Kita!! ")).toBe("toko-kita"));
  it("rejects WhatsApp numbers not starting with 628", () => {
    expect(validateStoreProfile({ ...base, contact_phone: "0812345678" })).toContain("Nomor WhatsApp harus diawali 628");
    expect(validateStoreProfile({ ...base, contact_phone: "62812345678" })).toEqual([]);
  });
  it("requires store name of 3-40 chars", () => expect(validateStoreProfile({ ...base, store_name: "ab" }).length).toBe(1));
  it("new password must differ from the old one", () => {
    const r = passwordRules("Abcdef1!", "Abcdef1!", "Abcdef1!");
    expect(r.find((x) => x.label === "Beda dari password lama")?.ok).toBe(false);
  });
  it("bank number must be 8-20 digits", () => {
    expect(validateBank({ provider: "BCA", number: "1234567", holder: "Budi" })).toContain("Nomor rekening 8–20 digit");
    expect(validateBank({ provider: "BCA", number: "12345678", holder: "Budi" })).toEqual([]);
  });
});
