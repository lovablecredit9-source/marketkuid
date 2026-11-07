import { describe, expect, it } from "vitest";
import { idFromProductSlug, productSlug, slugify } from "./product-link";

const ID = "0c5800d6-54ff-45f7-b2d1-48e54de146cf";

describe("marketku-style product links", () => {
  it("reads the product id from the end of the link", () =>
    expect(idFromProductSlug(`google-gemini-pro-5tb-12-bulan-${ID}`)).toBe(ID));
  it("rejects a link without a product id", () => expect(idFromProductSlug("google-gemini-pro")).toBeNull());
  it("turns & into dan like marketku.id", () =>
    expect(slugify("CRM WhatsApp & Email")).toBe("crm-whatsapp-dan-email"));
  it("builds title-id slugs that read back to the same id", () =>
    expect(idFromProductSlug(productSlug("Netflix 1 Bulan!", ID))).toBe(ID));
});
