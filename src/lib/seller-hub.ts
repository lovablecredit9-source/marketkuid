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

export type HubKind = "order_new" | "order_paid" | "order_completed" | "order_cancelled" | "order_expired" | "order_released" | "dispute_open" | "dispute_done" | "chat" | "deposit";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const METHOD: Record<string, string> = { qris: "QRIS", saldo: "Saldo Marketku", wallet: "Saldo Marketku" };
export const hubMethod = (m: string | null) => (m ? METHOD[m.toLowerCase()] ?? m.toUpperCase() : "Belum dipilih");
const wibShort = (d: Date) => d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(/\./g, ".");

export type HubOrderInfo = {
  orderNo: number; total: number; product: string; qty: number; buyer: string | null; method: string | null;
  variant?: string | null; unit?: number; expiresAt?: Date | null; note?: string | null; preorder?: boolean;
};

/** Order notices in the style of the original Marketku seller bot: headline, emoji field list, italic footer. */
export function hubOrderCaption(kind: HubKind, d: HubOrderInfo) {
  const order = `🆔 Order: <code>M-${d.orderNo}</code>`;
  const buyer = `👤 Pembeli: ${esc(d.buyer ?? "Pembeli")}`;
  if (kind === "order_new") {
    return [
      "⏳ <b>Pesanan Menunggu Pembayaran!</b>", "",
      buyer, `📦 ${esc(d.product)}`, ...(d.variant ? [`🏷 Variasi: ${esc(d.variant)}`] : []),
      ...(d.preorder ? ["🚨 Jenis: Pre-Order"] : []),
      `📊 Jumlah: ${d.qty}x`, `💰 Total: ${rp(d.total)}`, `💳 Metode: ${esc(hubMethod(d.method))}`, order,
      ...(d.expiresAt ? [`⏰ Batas bayar: ${wibShort(d.expiresAt)}`] : []),
      ...(d.note ? [`📝 Catatan: ${esc(d.note.slice(0, 200))}`] : []),
      "", "<i>Invoice sudah dibuat. Notifikasi sukses akan dikirim setelah pembayaran diterima.</i>",
    ].join("\n");
  }
  if (kind === "order_paid") {
    return [
      "✅ <b>Pembayaran Dikonfirmasi</b>", "", "Transaksi telah berhasil diproses oleh sistem.", "",
      "🧾 <b>Detail Transaksi</b>",
      `      •  Produk    : ${esc(d.product)}`,
      ...(d.variant ? [`      •  Variasi  : ${esc(d.variant)}`] : []),
      `      •  Jumlah   : ${d.qty}x`,
      `      •  Harga      : ${rp(d.total)}`,
      `      •  Metode   : ${esc(hubMethod(d.method))}`, "",
      `Order ID: <code>M-${d.orderNo}</code>`,
      "<i>Terima kasih telah mempercayakan transaksi anda kepada kami</i> 🙏",
    ].join("\n");
  }
  const head: Record<string, string> = {
    order_completed: "🎉 <b>Pesanan Selesai</b>",
    order_cancelled: "❌ <b>Pesanan Dibatalkan</b>",
    order_expired: "⌛ <b>Pesanan Habis Waktu</b>",
  };
  const tail: Record<string, string> = {
    order_completed: "Pembeli sudah menerima pesanan.",
    order_cancelled: "Stok yang dipesan kembali tersedia.",
    order_expired: "Batas waktu bayar terlewati, pesanan tidak diproses.",
  };
  return `${head[kind] ?? "📋 <b>Pesanan</b>"}\n\n${buyer}\n📦 ${esc(d.product)}\n📊 Jumlah: ${d.qty}x\n💰 Total: ${rp(d.total)}\n${order}\n\n<i>${tail[kind] ?? ""}</i>`;
}

/** "Escrow Otomatis Dirilis" — seller net credited after the hold window. */
export function hubReleasedCaption(d: { product: string; amount: number; orderNo: number; byBuyer: boolean }) {
  return `⏱ <b>Escrow Otomatis Dirilis</b>\n\n📦 ${esc(d.product)}\n💰 Dana dirilis: ${rp(d.amount)}\n🆔 Order: <code>M-${d.orderNo}</code>\n\n<i>${d.byBuyer ? "Pembeli sudah konfirmasi pesanan diterima, dana diteruskan ke saldo kamu." : "Masa tahan selesai tanpa komplain, dana otomatis diteruskan."}</i>`;
}

/** Dispute opened / resolved notices. */
export function hubDisputeCaption(kind: "dispute_open" | "dispute_done", d: { product: string; orderNo: number; status: string; amount: number; note?: string | null }) {
  if (kind === "dispute_open") {
    return `🚨 <b>Laporan Masalah Pesanan</b>\n\n📦 ${esc(d.product)}\n🆔 Order: <code>M-${d.orderNo}</code>\n\n<i>Pembeli membuka laporan. Mohon tanggapi di ruang laporan secepatnya.</i>`;
  }
  const refund = d.status === "refund";
  return `${refund ? "↩️ <b>Dispute Diselesaikan — Refund Pembeli</b>" : "✅ <b>Dispute Diselesaikan — Dana Dirilis</b>"}\n\n📦 ${esc(d.product)}\n${refund ? `💸 Refund: ${rp(d.amount)}` : `💰 Dana dirilis: ${rp(d.amount)}`}\n🆔 Order: <code>M-${d.orderNo}</code>${d.note ? `\n\n📝 Catatan: ${esc(d.note.slice(0, 200))}` : ""}\n\n<i>${refund ? "Dana telah dikembalikan ke pembeli." : "Saldo telah masuk ke dompet Anda."}</i>`;
}

/** Chat notice; the seller replies to this message in Telegram to answer the buyer. */
export function hubChatCaption(d: { store: string; buyer: string; product: string | null; body: string }) {
  return `💬 <b>Pesan baru di ${esc(d.store)}</b>\n👤 <b>Buyer:</b> ${esc(d.buyer)}${d.product ? `\n📦 <b>Produk:</b> ${esc(d.product)}` : ""}\n────────────────────\n${esc(d.body.slice(0, 700))}\n\n<i>Balas pesan ini untuk membalas buyer.</i>`;
}

export type OrderFilter = "all" | "done" | "pending" | "paid";
export const ORDER_PAGE_SIZE = 5;
export const ORDER_FILTER_STATUSES: Record<OrderFilter, string[] | null> = {
  all: null, done: ["completed"], pending: ["pending"], paid: ["paid", "processing"],
};
export const parseOrderCb = (data: string): { filter: OrderFilter; page: number } | null => {
  const m = /^o:(all|done|pending|paid):(\d{1,4})$/.exec(data);
  return m ? { filter: m[1] as OrderFilter, page: Number(m[2]) } : null;
};
export const pageCount = (total: number) => Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));
