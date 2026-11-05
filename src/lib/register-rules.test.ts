import { describe, expect, it } from "vitest";
import { normalizeUsername, passwordStrength, usernameError } from "./register-rules";

describe("sign-up rules", () => {
  it("password under 8 characters only reaches the first (red) level", () => {
    expect(passwordStrength("abcdefg")).toBe(1);
    expect(passwordStrength("abcdefgh")).toBe(2);
  });
  it("12+ characters with upper, lower, digit and symbol is the strongest level", () => {
    expect(passwordStrength("Abcdefghijk1")).toBe(3);
    expect(passwordStrength("Abcdefghijk1!")).toBe(4);
    expect(passwordStrength("ABCDEFGH1!")).toBe(2);
  });
  it("username is lowercased, stripped of symbols and capped at 30", () => {
    expect(normalizeUsername("ABC_Def")).toBe("abc_def");
    expect(normalizeUsername("ab cd!")).toBe("abcd");
    expect(normalizeUsername("a".repeat(31))).toHaveLength(30);
  });
  it("username needs at least 3 characters", () => {
    expect(usernameError("ab")).toBe("Gunakan 3-30 karakter: huruf kecil, angka, atau underscore.");
    expect(usernameError("")).toBe("Username wajib diisi.");
    expect(usernameError("abc")).toBe("");
  });
});
