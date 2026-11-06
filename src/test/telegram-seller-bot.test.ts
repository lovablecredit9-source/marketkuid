import { describe, expect, it } from "vitest";
import { clampQty, notifyText, ownerLinkParam, parseOwnerLink, sellerActionFromText, sellerNet, SELLER_ACTIONS, LOW_STOCK } from "@/lib/telegram";

const base = { orderNo: 120673, total: 101, gross: 100, method: "qris", buyer: "budi", note: null, items: [{ name: "AKUN FF", variant: "AKUN FF 100", qty: 1, price: 100 }] };

describe("seller telegram bot", () => {
  it("seller gets the sale minus the 3% admin fee", () => {
    expect(sellerNet(100)).toBe(97);
    expect(sellerNet(10000)).toBe(9700);
  });
  it("completed-order message shows the seller's net amount", () => {
    expect(notifyText("order_completed", base)).toContain("Rp97");
  });
  it("paid-order message shows the order id and payment method", () => {
    const t = notifyText("order_paid", base);
    expect(t).toContain("M-120673");
    expect(t).toContain("QRIS");
  });
  it("buyer note is escaped in the paid message", () => {
    expect(notifyText("order_paid", { ...base, note: "<b>cepat</b>" })).toContain("&lt;b&gt;cepat&lt;/b&gt;");
  });
  it("owner link round-trips and rejects short codes", () => {
    expect(parseOwnerLink(ownerLinkParam("abcdef0123456789abcd"))).toBe("abcdef0123456789abcd");
    expect(parseOwnerLink("own_short")).toBeNull();
    expect(parseOwnerLink("ref_ABC")).toBeNull();
  });
  it("seller menu text maps back to its action", () => {
    expect(sellerActionFromText(SELLER_ACTIONS.s_fin.text)).toBe("s_fin");
    expect(sellerActionFromText("💰 Top Up")).toBeNull();
  });
  it("bot quantity stays between 1 and available stock (max 20)", () => {
    expect(clampQty(0, 5)).toBe(1);
    expect(clampQty(9, 5)).toBe(5);
    expect(clampQty(50, null)).toBe(20);
  });
  it("low-stock warning threshold is 2", () => {
    expect(LOW_STOCK).toBe(2);
  });
});
