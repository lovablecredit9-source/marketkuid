/** Client-safe helpers for the platform "Marketku Seller Center" Telegram bot. */
export const HUB_LINK_MINUTES = 15;
export const hubLinkParam = (code: string) => `sc_${code}`;
export const parseHubLink = (startParam: string) => {
  const m = /^sc_([A-Za-z0-9]{16,40})$/.exec(startParam.trim());
  return m ? m[1]! : null;
};

export type HubAction = "dash" | "prod" | "order" | "fin" | "voucher" | "garansi" | "profil" | "broadcast" | "more" | "new" | "laris" | "unlink";
type Btn = { text: string; style?: "primary" | "success" | "danger" };
export const HUB_BUTTONS: Record<Exclude<HubAction, "new" | "laris" | "unlink">, Btn> = {
  dash: { text: "📊 Dashboard", style: "primary" },
  prod: { text: "📦 Produk", style: "primary" },
  order: { text: "📋 Pesanan", style: "primary" },
  fin: { text: "💰 Keuangan", style: "success" },
  voucher: { text: "🎟 Voucher", style: "primary" },
  garansi: { text: "🛡 Garansi", style: "danger" },
  profil: { text: "🏪 Profil" },
  broadcast: { text: "📢 Broadcast", style: "success" },
  more: { text: "⚙️ Lainnya" },
};
export const HUB_KEYBOARD: Btn[][] = [
  [HUB_BUTTONS.dash, HUB_BUTTONS.prod],
  [HUB_BUTTONS.order, HUB_BUTTONS.fin],
  [HUB_BUTTONS.voucher, HUB_BUTTONS.garansi],
  [HUB_BUTTONS.profil, HUB_BUTTONS.broadcast],
  [HUB_BUTTONS.more],
];
export const HUB_COMMANDS = [
  { command: "start", description: "Dashboard toko" },
  { command: "pesanan", description: "Pesanan terbaru" },
  { command: "produk", description: "Produk & stok" },
  { command: "keuangan", description: "Saldo & mutasi" },
  { command: "bantuan", description: "Bantuan" },
];

const norm = (s: string) => s.replace(/[^\p{L}\s]/gu, "").trim().toLowerCase();
export function hubActionFromText(text: string): HubAction | null {
  const t = text.trim();
  const cmd = /^\/(\w+)/.exec(t)?.[1]?.toLowerCase();
  if (cmd) {
    const m: Record<string, HubAction> = { start: "dash", dashboard: "dash", pesanan: "order", produk: "prod", keuangan: "fin", bantuan: "more", voucher: "voucher", garansi: "garansi", profil: "profil" };
    return m[cmd] ?? null;
  }
  const n = norm(t);
  for (const [k, b] of Object.entries(HUB_BUTTONS)) if (norm(b.text) === n) return k as HubAction;
  return null;
}

export type HubKind = "order_new" | "order_paid" | "order_completed" | "order_cancelled" | "order_expired" | "chat" | "deposit";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

export function hubOrderCaption(kind: HubKind, d: { orderNo: number; total: number; product: string; qty: number; buyer: string | null; method: string | null }) {
  const head: Record<string, string> = {
    order_new: "🛒 <b>Pesanan Baru — Belum Dibayar</b>",
    order_paid: "✅ <b>Pembayaran Berhasil</b>",
    order_completed: "🎉 <b>Pesanan Selesai</b>",
    order_cancelled: "❌ <b>Pesanan Dibatalkan</b>",
    order_expired: "⌛ <b>Pesanan Habis Waktu</b>",
  };
  const tail: Record<string, string> = {
    order_new: "Menunggu pembeli menyelesaikan pembayaran.",
    order_paid: "Stok dikirim otomatis. Saldo masuk setelah masa tahan.",
    order_completed: "Pembeli sudah menerima pesanan.",
    order_cancelled: "Stok yang dipesan kembali tersedia.",
    order_expired: "Batas waktu bayar terlewati, pesanan tidak diproses.",
  };
  return `${head[kind]}\n\n🧾 <code>M-${d.orderNo}</code>\n📦 ${esc(d.product)} · ${d.qty}x\n👤 ${esc(d.buyer ?? "Pembeli")}\n💳 ${esc(d.method ? d.method.toUpperCase() : "Belum dipilih")}\n💰 <b>${rp(d.total)}</b>\n\n<i>${tail[kind]}</i>`;
}
