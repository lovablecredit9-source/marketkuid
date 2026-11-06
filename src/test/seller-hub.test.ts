import { describe, expect, it } from "vitest";
import { hubActionFromText, hubLinkParam, hubOrderCaption, parseHubLink } from "@/lib/seller-hub";

describe("Marketku Seller Center bot", () => {
  it("round-trips the one-time link code", () => {
    expect(parseHubLink(hubLinkParam("abcdef0123456789abcdef01"))).toBe("abcdef0123456789abcdef01");
    expect(parseHubLink("own_abcdef0123456789")).toBeNull();
  });
  it("maps keyboard buttons and commands to menu sections", () => {
    expect(hubActionFromText("📊 Dashboard")).toBe("dash");
    expect(hubActionFromText("💰 Keuangan")).toBe("fin");
    expect(hubActionFromText("🛡 Garansi")).toBe("garansi");
    expect(hubActionFromText("/pesanan")).toBe("order");
    expect(hubActionFromText("halo")).toBeNull();
  });
  it("labels unpaid, paid and expired order notices", () => {
    const d = { orderNo: 120700, total: 200, product: "AKUN FF", qty: 2, buyer: "Eko", method: "qris" };
    expect(hubOrderCaption("order_new", d)).toContain("Belum Dibayar");
    expect(hubOrderCaption("order_paid", d)).toContain("Pembayaran Berhasil");
    expect(hubOrderCaption("order_expired", d)).toContain("Habis Waktu");
    expect(hubOrderCaption("order_new", d)).toContain("Rp200");
  });
});
