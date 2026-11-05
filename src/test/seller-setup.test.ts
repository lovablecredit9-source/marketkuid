import { describe, expect, it } from "vitest";
import { storeSetupSteps } from "@/lib/seller-setup";
import { defaultStoreName } from "@/components/marketku/seller-sheet";

const empty = { description: null, avatar_path: null, bank_number: null };

describe("Siapkan toko kamu", () => {
  it("toko baru: 0 dari 3 langkah wajib, bot opsional", () => {
    const s = storeSetupSteps({ store: empty, hasProduct: false, botCount: 0 });
    expect(s.filter((x) => !x.optional)).toHaveLength(3);
    expect(s.filter((x) => !x.optional && x.done)).toHaveLength(0);
    expect(s.find((x) => x.key === "bot")?.optional).toBe(true);
  });
  it("profil selesai hanya jika logo dan deskripsi terisi", () => {
    expect(storeSetupSteps({ store: { ...empty, avatar_path: "a.png" }, hasProduct: false, botCount: 0 })[0]?.done).toBe(false);
    expect(storeSetupSteps({ store: { ...empty, avatar_path: "a.png", description: "Toko" }, hasProduct: false, botCount: 0 })[0]?.done).toBe(true);
  });
  it("rekening dan produk aktif", () => {
    const s = storeSetupSteps({ store: { ...empty, bank_number: "123" }, hasProduct: true, botCount: 1 });
    expect(s.map((x) => x.done)).toEqual([false, true, true, true]);
  });
  it("nama toko default = nama akun + Store", () => {
    expect(defaultStoreName("ALDO")).toBe("ALDO Store");
    expect(defaultStoreName("")).toBe("");
  });
});
