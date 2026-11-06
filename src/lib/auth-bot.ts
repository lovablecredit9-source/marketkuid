/** Client-safe helpers for the "Auth Marketku" Telegram login bot (Seller Center sign-in by Telegram code). */
export const AUTH_CODE_MINUTES = 5;
export const AUTH_MAX_ATTEMPTS = 5;
export const AUTH_RESEND_SECONDS = 60;
/** Mini App initData older than this is refused. */
export const INIT_DATA_MAX_AGE_S = 24 * 3600;

/** Accepts "@name", "name", "t.me/name" or "https://t.me/name"; returns lowercase username or null. */
export function normalizeTgUsername(raw: string): string | null {
  const s = String(raw ?? "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?(t|telegram)\.me\//i, "").replace(/^@/, "").replace(/\/+$/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(s) ? s.toLowerCase() : null;
}

export const isLoginCode = (s: string) => /^\d{6}$/.test(String(s ?? "").trim());
export const isMagic = (s: string) => /^[0-9a-f]{64}$/.test(String(s ?? "").trim());

/** Short "Device" + "Browser" labels from a user agent, e.g. Android 10 / Mobile Chrome 153.0.0.0. */
export function describeUA(ua: string): { device: string; browser: string } {
  const u = String(ua ?? "");
  let device = "Tidak diketahui";
  const android = /Android\s([\d.]+)/.exec(u);
  const ios = /(?:iPhone|iPad|iPod).*?OS\s([\d_]+)/.exec(u);
  if (android) device = `Android ${android[1]}`;
  else if (ios) device = `iOS ${ios[1]!.replace(/_/g, ".")}`;
  else if (/Windows NT/.test(u)) device = "Windows";
  else if (/Mac OS X/.test(u)) device = "macOS";
  else if (/Linux/.test(u)) device = "Linux";
  const mobile = /Mobile|Android|iPhone/.test(u) ? "Mobile " : "";
  const pick = (re: RegExp, name: string) => { const m = re.exec(u); return m ? `${mobile}${name} ${m[1]}` : null; };
  const browser = (/Telegram/i.test(u) ? `${mobile}Telegram` : null)
    ?? pick(/Edg\/([\d.]+)/, "Edge") ?? pick(/OPR\/([\d.]+)/, "Opera") ?? pick(/SamsungBrowser\/([\d.]+)/, "Samsung Internet")
    ?? pick(/Firefox\/([\d.]+)/, "Firefox") ?? pick(/Chrome\/([\d.]+)/, "Chrome") ?? pick(/Version\/([\d.]+).*Safari/, "Safari") ?? "Tidak diketahui";
  return { device, browser };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function loginCodeText(code: string) {
  return `🔐 <b>Kode Login Website</b>\n\nKode login Anda: <code>${code}</code>\n\nAtau tekan tombol <b>Login Otomatis</b> di bawah untuk login langsung.\n\n⏳ Berlaku selama <b>${AUTH_CODE_MINUTES} menit</b>.\n⚠️ Jangan bagikan kode/link ini kepada siapapun.`;
}

export function loginOkText(d: { account: string; ip: string; device: string; browser: string; at: Date; via: string }) {
  const time = d.at.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  return `✅ <b>Login Berhasil</b>\n\n👤 <b>Akun:</b> ${esc(d.account)}\n🌐 <b>IP:</b> <code>${esc(d.ip)}</code>\n📍 <b>Lokasi:</b> Tidak diketahui\n💻 <b>Device:</b> ${esc(d.device)}\n🔍 <b>Browser:</b> ${esc(d.browser)}\n🔑 <b>Metode:</b> ${esc(d.via)}\n🕐 <b>Waktu:</b> ${time} WIB\n\n⚠️ Jika ini bukan Anda, segera ubah password!`;
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
}

/** Verifies Telegram Mini App initData for one bot token; returns the Telegram user or null. */
export async function verifyInitData(initData: string, botToken: string, nowS = Math.floor(Date.now() / 1000)) {
  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), botToken);
  const expected = hex(await hmac(secret, check));
  if (expected.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff) return null;
  const authDate = Number(p.get("auth_date"));
  if (!authDate || nowS - authDate > INIT_DATA_MAX_AGE_S) return null;
  try {
    const user = JSON.parse(p.get("user") ?? "") as { id?: number; username?: string; first_name?: string };
    return typeof user.id === "number" ? { id: user.id, username: user.username ?? null, first_name: user.first_name ?? null } : null;
  } catch { return null; }
}
