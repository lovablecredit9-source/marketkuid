import { describe, expect, it } from "vitest";
import { viewsLabel } from "./views";

describe("viewsLabel", () => {
  it("shows exact counts below 1.000", () => expect(viewsLabel(57)).toBe("57 dilihat"));
  it("rounds thousands down to rb+", () => expect(viewsLabel(2480)).toBe("2 rb+ dilihat"));
  it("uses jt+ from one million", () => expect(viewsLabel(1_200_000)).toBe("1 jt+ dilihat"));
});
