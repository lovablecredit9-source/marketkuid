import { describe, expect, it } from "vitest";
import { ADMIN_TAB, adminActionFromText, adminLinkParam, adminNotifyText, parseAdminLink } from "@/lib/admin-bot";

describe("Marketku Center admin bot", () => {
  it("round-trips the admin link code and rejects seller links", () => {
    const code = "0123456789abcdef01234567";
    expect(parseAdminLink(adminLinkParam(code))).toBe(code);
    expect(parseAdminLink(`own_${code}`)).toBeNull();
    expect(parseAdminLink("adm_short")).toBeNull();
  });
  it("maps commands and keyboard buttons to menu actions", () => {
    expect(adminActionFromText("/start")).toBe("home");
    expect(adminActionFromText("/withdraw@MarketkuCenterAdmin_bot")).toBe("withdraw");
    expect(adminActionFromText("🧾 Bayar Order")).toBe("bayar");
    expect(adminActionFromText("🏪 Toko Baru")).toBe("toko");
    expect(adminActionFromText("halo")).toBeNull();
  });
  it("notification opens the matching admin tab and shows the amount", () => {
    expect(ADMIN_TAB.order_payment).toBe("bayar");
    expect(adminNotifyText("deposit", 50000, "QRIS")).toContain("Rp50.000");
    expect(adminNotifyText("category", null, "<Game>")).toContain("&lt;Game&gt;");
  });
});
