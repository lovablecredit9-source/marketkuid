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

/* ---------------- seller notifications & seller menu ---------------- */

/** Stock at or below this triggers a "Stok Menipis" message after a paid order. */
export const LOW_STOCK = 2;
export type NotifyKind = "order_new" | "order_paid" | "order_completed" | "order_cancelled" | "order_refunded" | "dispute_new";
export type NotifyData = {
  orderNo: number; total: number; gross: number; method: string | null; buyer: string | null; note: string | null;
  items: { name: string; variant: string; qty: number; price: number }[];
};
const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const METHOD_LABEL: Record<string, string> = { saldo: "Saldo Marketku", wallet: "Saldo Marketku", qris: "QRIS", ewallet: "E-Wallet" };
/** Seller receives the sale minus the 3% admin fee (mirrors credit_seller_for_order). */
export const sellerNet = (gross: number) => Math.max(0, gross - Math.ceil(gross * 0.03));

export function notifyText(kind: NotifyKind, d: NotifyData) {
  const id = `M-${d.orderNo}`;
  const lines = d.items.map((i) => `      •  ${escH(i.name)}\n         ${escH(i.variant)} · ${i.qty}x ${rupiah(i.price)}`).join("\n");
  const method = d.method ? METHOD_LABEL[d.method] ?? d.method.toUpperCase() : "-";
  const first = d.items[0]?.name ? escH(d.items[0].name) : "Pesanan";
  switch (kind) {
    case "order_new":
      return `🛒 <b>Pesanan Baru</b>\n\nPembeli membuat pesanan dan sedang <b>menunggu pembayaran</b>.\n\n📦 <b>Detail</b>\n${lines}\n\n💰 Total: <b>${rupiah(d.total)}</b>\n🧾 Order ID: <code>${id}</code>`;
    case "order_paid":
      return `✅ <b>Pembayaran Dikonfirmasi</b>\n\nTransaksi telah berhasil diproses oleh sistem.\n\n📦 <b>Detail Transaksi</b>\n${lines}\n      •  Metode : ${escH(method)}\n      •  Pembeli : ${escH(d.buyer ?? "-")}${d.note ? `\n\n📝 Catatan pembeli:\n<i>${escH(d.note)}</i>` : ""}\n\n💰 Total: <b>${rupiah(d.total)}</b>\n🧾 Order ID: <code>${id}</code>`;
    case "order_completed":
      return `🎉 <b>Pesanan Selesai</b>\n\n📦 ${first}\n💵 Dana untuk kamu: <b>${rupiah(sellerNet(d.gross))}</b> (potongan admin 3%)\n🧾 Order: <code>${id}</code>\n\nSaldo masuk ke dompet setelah masa tahan selesai.`;
    case "order_cancelled":
      return `❌ <b>Pesanan Dibatalkan</b>\n\n📦 ${first}\n💰 ${rupiah(d.total)}\n🧾 Order: <code>${id}</code>`;
    case "order_refunded":
      return `↩️ <b>Pesanan Direfund</b>\n\n📦 ${first}\n💰 ${rupiah(d.total)} dikembalikan ke pembeli.\n🧾 Order: <code>${id}</code>`;
    case "dispute_new":
      return `⚠️ <b>Laporan Masalah Pesanan</b>\n\n📦 ${first}\n🧾 Order: <code>${id}</code>\n\nPembeli melaporkan masalah dengan pesanan ini.\n🔒 Dana ditahan hingga admin menyelesaikan tinjauan.`;
  }
}

/** Seller menu shown in the store bot to the linked owner. `style` colours the buttons. */
export const SELLER_ACTIONS = {
  s_dash: { text: "📊 Dashboard", style: "primary" },
  s_prod: { text: "📦 Produk", style: "primary" },
  s_order: { text: "🧾 Pesanan", style: "primary" },
  s_fin: { text: "💰 Keuangan", style: "success" },
  s_buyer: { text: "🛍 Mode Pembeli", style: undefined },
  s_help: { text: "⚙️ Lainnya", style: undefined },
} as const;
export type SellerAction = keyof typeof SELLER_ACTIONS;
export const SELLER_KEYBOARD: SellerAction[][] = [["s_dash", "s_prod", "s_order"], ["s_fin", "s_help"], ["s_buyer"]];
export function sellerActionFromText(text: string): SellerAction | null {
  const t = text.trim();
  for (const k of Object.keys(SELLER_ACTIONS) as SellerAction[]) if (SELLER_ACTIONS[k].text === t) return k;
  return null;
}

/** Deep-link parameter that links the seller's Telegram account: own_<code>. */
export const ownerLinkParam = (code: string) => `own_${code}`;
export const parseOwnerLink = (startParam: string) => {
  const m = /^own_([A-Za-z0-9]{16,40})$/.exec(startParam.trim());
  return m ? m[1]! : null;
};

/** Quantity picker bounds in the bot order card. */
export const MAX_BOT_QTY = 20;
export const clampQty = (n: number, stock: number | null) => Math.max(1, Math.min(MAX_BOT_QTY, stock == null ? MAX_BOT_QTY : Math.max(1, stock), Math.floor(n) || 1));
