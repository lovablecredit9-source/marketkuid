/** Client-safe rules for the Marketku Center admin Telegram bot. */

export type AdminNotifyKind = "deposit" | "withdraw" | "order_payment" | "dispute" | "category" | "store";

export const ADMIN_LINK_MINUTES = 15;
export const adminLinkParam = (code: string) => `adm_${code}`;
export const parseAdminLink = (startParam: string) => {
  const m = /^adm_([A-Za-z0-9]{16,40})$/.exec(startParam.trim());
  return m ? m[1]! : null;
};

/** Admin panel tab opened by each notification / menu button. */
export const ADMIN_TAB: Record<AdminNotifyKind, string> = {
  deposit: "deposit", withdraw: "withdraw", order_payment: "bayar", dispute: "dispute", category: "kategori", store: "toko",
};

export type AdminMenuAction = "home" | "deposit" | "bayar" | "withdraw" | "dispute" | "kategori" | "toko" | "help";

/** Reply-keyboard / command text → menu action. */
export function adminActionFromText(text: string): AdminMenuAction | null {
  const t = text.trim().toLowerCase().replace(/^\//, "").split(/[@\s]/)[0] ?? "";
  const map: Record<string, AdminMenuAction> = {
    start: "home", menu: "home", ringkasan: "home", dashboard: "home",
    deposit: "deposit", bayar: "bayar", withdraw: "withdraw", dispute: "dispute", kategori: "kategori", toko: "toko",
    bantuan: "help", help: "help",
  };
  if (map[t]) return map[t]!;
  const label = text.replace(/^[^\p{L}]+/u, "").trim().toLowerCase();
  const byLabel: Record<string, AdminMenuAction> = {
    ringkasan: "home", deposit: "deposit", "bayar order": "bayar", withdraw: "withdraw", dispute: "dispute",
    kategori: "kategori", "toko baru": "toko", bantuan: "help",
  };
  return byLabel[label] ?? null;
}

export const ADMIN_KEYBOARD = [
  ["📊 Ringkasan", "💰 Deposit"],
  ["🧾 Bayar Order", "🏦 Withdraw"],
  ["⚠️ Dispute", "🗂 Kategori"],
  ["🏪 Toko Baru", "❓ Bantuan"],
];

export const ADMIN_COMMANDS = [
  { command: "start", description: "Menu utama & ringkasan" },
  { command: "deposit", description: "Deposit menunggu dicek" },
  { command: "bayar", description: "Bukti bayar order menunggu" },
  { command: "withdraw", description: "Penarikan saldo menunggu" },
  { command: "dispute", description: "Dispute aktif" },
  { command: "kategori", description: "Pengajuan kategori baru" },
  { command: "toko", description: "Toko terbaru" },
  { command: "bantuan", description: "Bantuan bot admin" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

export function adminNotifyText(kind: AdminNotifyKind, amount: number | null, label: string | null) {
  const l = label ? esc(label) : "-";
  switch (kind) {
    case "deposit": return `💰 <b>Deposit Baru</b>\n\n💵 Jumlah: <b>${rp(amount ?? 0)}</b>\n🏷 ${l}\n\nCek bukti transfer lalu setujui/tolak di Admin Console.`;
    case "withdraw": return `🏦 <b>Penarikan Saldo Baru</b>\n\n💵 Jumlah: <b>${rp(amount ?? 0)}</b>\n🏷 ${l}\n\nProses transfer lalu tandai selesai di Admin Console.`;
    case "order_payment": return `🧾 <b>Bukti Bayar Order</b>\n\n💵 Jumlah: <b>${rp(amount ?? 0)}</b>\n🏷 ${l}\n\nCocokkan pembayaran lalu setujui agar pesanan diproses.`;
    case "dispute": return `⚠️ <b>Dispute Baru</b>\n\n🆔 Kode: <b>${l}</b>\n\nPantau Dispute Room dan putuskan bila perlu.`;
    case "category": return `🗂 <b>Pengajuan Kategori</b>\n\n📁 Nama: <b>${l}</b>\n\nSetujui atau tolak di tab Kategori.`;
    case "store": return `🏪 <b>Toko Baru Dibuka</b>\n\n🛍 ${l}\n\nCek toko di tab Toko.`;
  }
}

/** Shown when someone other than a linked admin opens the Marketku Center Mini App. */
export const ADMIN_MINI_DENIED = "Maaf, Mini App ini hanya khusus admin Marketku. Kamu tidak punya akses.";
/** Mini App sign-in is allowed only for a Telegram account linked to an account that still has the admin role. */
export function canOpenAdminMiniApp(linkedUserId: string | null | undefined, stillAdmin: boolean) {
  return !!linkedUserId && stillAdmin;
}
