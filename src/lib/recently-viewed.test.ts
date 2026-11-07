import { describe, expect, it } from "vitest";
import { orderByRecent, pushRecent, recommendFromViewed } from "./recently-viewed";

describe("recently viewed products", () => {
  it("newest view goes first without duplicates", () => expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]));
  it("keeps at most 20 products", () => {
    const many = Array.from({ length: 20 }, (_, i) => `p${i}`);
    expect(pushRecent(many, "new")).toHaveLength(20);
    expect(pushRecent(many, "new")[19]).toBe("p18");
  });
  it("drops products that no longer exist and keeps view order", () =>
    expect(orderByRecent([{ id: "a" }, { id: "c" }], ["c", "x", "a"]).map((p) => p.id)).toEqual(["c", "a"]));
  it("recommends unseen products from viewed categories only", () => {
    const pool = [
      { id: "1", category: "Game", sold_count: 1 }, { id: "2", category: "AI", sold_count: 9 },
      { id: "3", category: "Streaming", sold_count: 50 }, { id: "4", category: "Game", sold_count: 5 },
    ];
    const viewed = [{ id: "1", category: "Game", sold_count: 1 }, { id: "x", category: "AI", sold_count: 0 }];
    expect(recommendFromViewed(pool, viewed).map((p) => p.id)).toEqual(["4", "2"]);
  });
});
