/** Sign-up rules mirrored from marketku.id's "Buat akun" form. */

export const PASSWORD_MIN = 8;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Typing is normalised like the original: lowercase, only a–z, 0–9 and _, max 30 characters. */
export const normalizeUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);

export function usernameError(u: string): string {
  if (!u) return "Username wajib diisi.";
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX || !/^[a-z0-9_]+$/.test(u)) return "Gunakan 3-30 karakter: huruf kecil, angka, atau underscore.";
  return "";
}

export const isEmailFormat = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * Strength bar level 0–4 (each level = 25% width):
 * under 8 chars = 1, 8+ chars = 2, 12+ chars with upper, lower and a digit = 3, plus a symbol = 4.
 */
export function passwordStrength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  if (p.length < PASSWORD_MIN) return 1;
  const mixed = /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
  if (p.length >= 12 && mixed) return /[^A-Za-z0-9]/.test(p) ? 4 : 3;
  return 2;
}
