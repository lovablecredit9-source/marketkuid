import { describe, expect, it } from "vitest";
import { AUTH_CODE_MINUTES, AUTH_MAX_ATTEMPTS, describeUA, isLoginCode, normalizeTgUsername, verifyInitData } from "./auth-bot";

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
async function hmac(key: BufferSource, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
}
async function signInit(token: string, fields: Record<string, string>) {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), token);
  return new URLSearchParams({ ...fields, hash: hex(await hmac(secret, check)) }).toString();
}

describe("Auth Marketku login rules", () => {
  it("login code is valid for 5 minutes with max 5 tries", () => {
    expect(AUTH_CODE_MINUTES).toBe(5);
    expect(AUTH_MAX_ATTEMPTS).toBe(5);
  });
  it("accepts @username, t.me links and plain names", () => {
    expect(normalizeTgUsername("@JbAppPremAndPanelSosmed")).toBe("jbapppremandpanelsosmed");
    expect(normalizeTgUsername("https://t.me/jepangges")).toBe("jepangges");
    expect(normalizeTgUsername("abc")).toBeNull();
    expect(normalizeTgUsername("bad name!")).toBeNull();
  });
  it("login code must be exactly 6 digits", () => {
    expect(isLoginCode("510971")).toBe(true);
    expect(isLoginCode("51097")).toBe(false);
  });
  it("describes Android Chrome like the login notice", () => {
    const ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36";
    expect(describeUA(ua)).toEqual({ device: "Android 10", browser: "Mobile Chrome 153.0.0.0" });
  });
  it("Mini App data signed by the bot is accepted; tampered or other-bot data is refused", async () => {
    const now = 1_800_000_000;
    const data = await signInit("111:AAA", { auth_date: String(now - 60), user: JSON.stringify({ id: 42, username: "jepangges" }) });
    expect(await verifyInitData(data, "111:AAA", now)).toEqual({ id: 42, username: "jepangges", first_name: null });
    expect(await verifyInitData(data, "222:BBB", now)).toBeNull();
    expect(await verifyInitData(data.replace("42", "43"), "111:AAA", now)).toBeNull();
    expect(await verifyInitData(data, "111:AAA", now + 2 * 86400)).toBeNull();
  });
});
