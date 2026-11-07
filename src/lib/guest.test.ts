import { describe, expect, it } from "vitest";
import { guestContactError } from "./guest";

const base = { email: "tamu@gmail.com", whatsapp: "", telegram: "" };

describe("guest checkout contact", () => {
  it("requires an email", () => {
    expect(guestContactError({ ...base, email: "", whatsapp: "081234567890" })).toBe("Email wajib diisi");
  });
  it("requires WhatsApp or Telegram for delivery", () => {
    expect(guestContactError(base)).toBe("Isi nomor WhatsApp atau username Telegram untuk pengiriman");
  });
  it("accepts WhatsApp only", () => {
    expect(guestContactError({ ...base, whatsapp: "081234567890" })).toBeNull();
  });
  it("accepts Telegram only", () => {
    expect(guestContactError({ ...base, telegram: "@jepangges" })).toBeNull();
  });
  it("rejects a bad WhatsApp number", () => {
    expect(guestContactError({ ...base, whatsapp: "12345" })).toBe("Nomor WhatsApp tidak valid");
  });
  it("rejects a too-short Telegram username", () => {
    expect(guestContactError({ ...base, telegram: "abc" })).toMatch(/Telegram tidak valid/);
  });
});
