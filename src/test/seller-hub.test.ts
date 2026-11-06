import { describe, expect, it } from "vitest";
import { ORDER_PAGE_SIZE, hubActionFromText, hubChatCaption, hubDisputeCaption, hubLinkParam, hubOrderCaption, hubReleasedCaption, pageCount, parseHubLink, parseOrderCb } from "@/lib/seller-hub";

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
    expect(hubOrderCaption("order_new", d)).toContain("Pesanan Menunggu Pembayaran!");
    expect(hubOrderCaption("order_paid", d)).toContain("Pembayaran Dikonfirmasi");
    expect(hubOrderCaption("order_expired", d)).toContain("Habis Waktu");
    expect(hubOrderCaption("order_new", d)).toContain("Rp200");
    expect(hubOrderCaption("order_new", d)).toContain("Metode: QRIS");
  });
  it("pages orders 5 per page with status filters", () => {
    expect(ORDER_PAGE_SIZE).toBe(5);
    expect(pageCount(52)).toBe(11);
    expect(pageCount(0)).toBe(1);
    expect(parseOrderCb("o:paid:3")).toEqual({ filter: "paid", page: 3 });
    expect(parseOrderCb("o:hack:1")).toBeNull();
  });
  it("formats escrow release and dispute refund notices", () => {
    expect(hubReleasedCaption({ product: "AKUN FF", amount: 97, orderNo: 1, byBuyer: false })).toContain("Dana dirilis: Rp97");
    expect(hubDisputeCaption("dispute_done", { product: "X", orderNo: 1, status: "refund", amount: 100 })).toContain("Refund Pembeli");
    expect(hubChatCaption({ store: "Tambas", buyer: "Eko", product: null, body: "halo" })).toContain("Balas pesan ini");
  });
});
