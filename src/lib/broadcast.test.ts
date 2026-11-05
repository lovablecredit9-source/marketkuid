import { describe, expect, it } from "vitest";
import { cleanBroadcastHtml } from "./broadcast";

describe("cleanBroadcastHtml", () => {
  it("keeps b, i and https links", () => {
    expect(cleanBroadcastHtml('<b>Promo</b> <i>hari ini</i> <a href="https://marketku.id">buka</a>'))
      .toBe('<b>Promo</b> <i>hari ini</i> <a href="https://marketku.id">buka</a>');
  });
  it("escapes other tags", () => {
    expect(cleanBroadcastHtml("<script>x</script>")).toBe("&lt;script&gt;x&lt;/script&gt;");
  });
  it("escapes links without http(s)", () => {
    expect(cleanBroadcastHtml('<a href="javascript:x">y</a>')).toBe('&lt;a href="javascript:x"&gt;y</a>');
  });
});
