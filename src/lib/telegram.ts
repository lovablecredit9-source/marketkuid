/** Client-safe Telegram bot rules shared by the Seller Center and the bot webhook. */
export const MAX_BOTS = 5;
export const isBotToken = (t: string) => /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(t.trim());
export const isAdminWa = (s: string) => /^62\d{8,13}$/.test(s);
export const isAdminUsername = (s: string) => /^[A-Za-z0-9_]{3,32}$/.test(s);

export const BOT_ACTIONS = {
  pesanan: "📋 Pesanan Saya",
  renew: "🔄 Renew Akun",
  kurir: "✅ Cek Koneksi Kurir",
  kategori: "🛍 Beli Produk / Kategori",
  promo: "🎫 Promo",
  referral: "🎁 Referral",
  bantuan: "📞 Bantuan / Kontak",
  topup: "💰 Top Up",
  garansi: "🛡 Garansi",
  tarik: "💸 Tarik Saldo",
  start: "/start",
} as const;
export type BotAction = keyof typeof BOT_ACTIONS;
export const BOT_ACTION_KEYS = Object.keys(BOT_ACTIONS) as BotAction[];

/** Reply keyboard used when the seller has not designed one. */
export const DEFAULT_KEYBOARD: BotAction[][] = [["topup", "referral"], ["promo", "garansi"], ["tarik", "bantuan"], ["start"]];
export const MAX_ROWS = 8;
export const MAX_PER_ROW = 3;

/** Keeps only known actions, max 3 per row and 8 rows, drops empty rows. */
export function cleanKeyboard(raw: unknown): BotAction[][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => (Array.isArray(row) ? row.filter((a): a is BotAction => typeof a === "string" && a in BOT_ACTIONS).slice(0, MAX_PER_ROW) : []))
    .filter((row) => row.length > 0)
    .slice(0, MAX_ROWS);
}
export const keyboardOrDefault = (raw: unknown) => {
  const k = cleanKeyboard(raw);
  return k.length ? k : DEFAULT_KEYBOARD;
};
/** Text a buyer taps on the reply keyboard → action (also accepts the plain word, e.g. "promo"). */
export function actionFromText(text: string): BotAction | null {
  const t = text.trim();
  for (const k of BOT_ACTION_KEYS) if (BOT_ACTIONS[k] === t) return k;
  const plain = t.toLowerCase().replace(/^\//, "");
  return plain in BOT_ACTIONS ? (plain as BotAction) : null;
}

export const BUYER_MODES = [
  { value: 1, label: "Mode 1", desc: "Banner sambutan + tombol kategori" },
  { value: 2, label: "Mode 2", desc: "Langsung tombol produk" },
  { value: 3, label: "Mode 3", desc: "Daftar produk bernomor" },
] as const;

export type ForceJoin = { enabled?: boolean; chat?: string; invite?: string; title?: string; message?: string };
export const isChatRef = (s: string) => /^@[A-Za-z0-9_]{5,32}$/.test(s) || /^-100\d{6,15}$/.test(s);
/** Fills {nama} {username} {channel} {bot} in the gate message. */
export function fillGate(tpl: string, v: { nama: string; username: string; channel: string; bot: string }) {
  return tpl.replace(/\{(nama|username|channel|bot)\}/g, (_, k: keyof typeof v) => v[k]);
}
export const DEFAULT_GATE = "Halo {nama}! Untuk memakai {bot}, join dulu ke {channel} lalu tekan tombol di bawah.";

/** Referral code shown in the bot (hex of the Telegram user id). */
export const referralCode = (tgUserId: number) => tgUserId.toString(16).toUpperCase();
export const parseReferral = (startParam: string) => {
  const m = /^ref_([0-9A-F]{1,16})$/i.exec(startParam.trim());
  return m ? parseInt(m[1]!, 16) : null;
};
