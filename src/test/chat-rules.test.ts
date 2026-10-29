import { describe, expect, it } from "vitest";
import { lastSeenLabel } from "@/components/marketku/chat-avatar";
import { canDeleteForAll, tickState, unreadTotals } from "@/lib/chat";

const now = new Date(2026, 9, 29, 15, 0).getTime();
const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).toISOString();

describe("chat last seen", () => {
  it("shows Online within 2 minutes", () => expect(lastSeenLabel(new Date(now - 60_000).toISOString(), now)).toBe("Online"));
  it("today shows jam only", () => expect(lastSeenLabel(at(29, 9, 5), now)).toBe("Terakhir dilihat 09.05"));
  it("yesterday shows kemarin + jam", () => expect(lastSeenLabel(at(28, 21, 40), now)).toBe("Terakhir dilihat kemarin 21.40"));
  it("2 days ago shows date + jam", () => expect(lastSeenLabel(at(27, 8, 0), now)).toBe("Terakhir dilihat 27 Okt 2026 08.00"));
  it("handles never seen", () => expect(lastSeenLabel(null, now)).toBe("Belum pernah online"));
});

describe("message ticks", () => {
  it("1 tick when recipient not online yet", () => expect(tickState({ delivered_at: null, read_at: null })).toBe("sent"));
  it("2 ticks when delivered but not read", () => expect(tickState({ delivered_at: at(29, 9, 0), read_at: null })).toBe("delivered"));
  it("blue when read", () => expect(tickState({ delivered_at: at(29, 9, 0), read_at: at(29, 9, 1) })).toBe("read"));
});

describe("unread totals", () => {
  const base = { buyer_hidden: false, seller_hidden: false };
  it("splits buyer and seller unread for the nav badge", () => {
    const r = unreadTotals([
      { ...base, buyer_id: "me", seller_id: "s1", buyer_unread: 2, seller_unread: 5 },
      { ...base, buyer_id: "b1", seller_id: "me", buyer_unread: 9, seller_unread: 1 },
    ], "me");
    expect(r).toEqual({ buyer: 2, seller: 1, total: 3 });
  });
});

import { stampLabel } from "@/components/marketku/chat-avatar";
describe("stampLabel", () => {
  const now = new Date(2026, 9, 29, 10, 0).getTime();
  it("today shows jam only", () => expect(stampLabel(new Date(2026, 9, 29, 9, 5).toISOString(), now)).toBe("09.05"));
  it("yesterday shows Kemarin + jam", () => expect(stampLabel(new Date(2026, 9, 28, 21, 40).toISOString(), now)).toBe("Kemarin 21.40"));
  it("older shows tanggal + jam", () => expect(stampLabel(new Date(2026, 9, 26, 8, 0).toISOString(), now)).toBe("26 Okt 08.00"));
});

describe("hapus pesan untuk semua orang", () => {
  const now = new Date(2026, 9, 29, 10, 0).getTime();
  it("allowed for own message within 1 hour", () => expect(canDeleteForAll({ mine: true, created_at: new Date(2026, 9, 29, 9, 1).toISOString(), deleted_at: null }, now)).toBe(true));
  it("blocked after more than 1 hour", () => expect(canDeleteForAll({ mine: true, created_at: new Date(2026, 9, 29, 8, 59).toISOString(), deleted_at: null }, now)).toBe(false));
  it("blocked for the other person's message", () => expect(canDeleteForAll({ mine: false, created_at: new Date(2026, 9, 29, 9, 50).toISOString(), deleted_at: null }, now)).toBe(false));
});
