/** Pure rules for checkout without an account (mirrored by guest_place_order). */
export const GUEST_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const WA_RE = /^(\+?62|0)8\d{7,12}$/;
export const TG_RE = /^@?[A-Za-z0-9_]{5,32}$/;

export type GuestContact = { email: string; whatsapp: string; telegram: string };

/** Returns an Indonesian error message, or null when the guest contact is valid. */
export function guestContactError(c: GuestContact): string | null {
  const email = c.email.trim();
  if (!email) return "Email wajib diisi";
  if (email.length > 120 || !GUEST_EMAIL_RE.test(email)) return "Email tidak valid";
  const wa = c.whatsapp.trim(), tg = c.telegram.trim();
  if (!wa && !tg) return "Isi nomor WhatsApp atau username Telegram untuk pengiriman";
  if (wa && !WA_RE.test(wa)) return "Nomor WhatsApp tidak valid";
  if (tg && !TG_RE.test(tg)) return "Username Telegram tidak valid (5–32 huruf, angka, _)";
  return null;
}

const KEY = "marketku_guest_orders";
export type SavedGuestOrder = { token: string; at: number };

/** Guest order links remembered on this device (newest first, max 20). */
export function savedGuestOrders(): SavedGuestOrder[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedGuestOrder[];
    return Array.isArray(v) ? v.filter((x) => typeof x?.token === "string") : [];
  } catch { return []; }
}
export function rememberGuestOrder(token: string) {
  const list = [{ token, at: Date.now() }, ...savedGuestOrders().filter((x) => x.token !== token)].slice(0, 20);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full */ }
}
