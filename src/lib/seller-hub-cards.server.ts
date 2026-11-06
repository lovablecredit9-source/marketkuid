/** Auto-generated (non-AI) image cards for the Marketku Seller Center bot. */
import { Canvas, hex, hgrad, measure, text, vgrad, wrap, type RGBA } from "@/lib/card-image.server";

const W = 1000, H = 560;
const C = {
  ink: hex("#0f172a"), sub: hex("#64748b"), line: hex("#e2e8f0"), blue: hex("#2563eb"), blueSoft: hex("#eff6ff"),
  white: hex("#ffffff"), green: hex("#16a34a"), orange: hex("#ea580c"), red: hex("#dc2626"), gray: hex("#64748b"), violet: hex("#7c3aed"),
};
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const wib = (d: Date) => d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB";

export type Tone = "blue" | "green" | "orange" | "red" | "gray" | "violet";
const toneColor = (t: Tone): RGBA => C[t];

async function frame(title: string, subtitle: string, badge: { label: string; tone: Tone }, store: string) {
  const c = new Canvas(W, H);
  c.rect(0, 0, W, H, vgrad(0, H, hex("#dbeafe"), hex("#fde7d3")));
  c.rect(24, 24, W - 48, H - 48, C.white, 26);
  // header
  c.rect(24, 24, W - 48, 54, hgrad(24, W - 24, hex("#1d4ed8"), hex("#3b82f6")), 26);
  c.rect(24, 52, W - 48, 26, hgrad(24, W - 24, hex("#1d4ed8"), hex("#3b82f6")));
  await text(c, `Marketku Seller Center · ${store}`, W / 2, 59, { size: 20, color: C.white, weight: "bold", align: "center", maxWidth: W - 120 });
  // avatar + title
  c.circle(84, 128, 30, hex("#dbeafe"));
  await text(c, (store.trim()[0] ?? "M").toUpperCase(), 84, 140, { size: 30, color: C.blue, weight: "bold", align: "center" });
  await text(c, title, 128, 124, { size: 30, color: C.ink, weight: "bold", maxWidth: 560 });
  await text(c, subtitle, 128, 152, { size: 17, color: C.sub, maxWidth: 560 });
  // badge
  const col = toneColor(badge.tone);
  const bw = Math.min(280, Math.ceil(await measure(badge.label, { size: 18, weight: "bold" })) + 56);
  c.rect(W - 48 - bw, 104, bw, 40, [col[0], col[1], col[2], 0.12], 20);
  c.circle(W - 48 - bw + 22, 124, 6, col);
  await text(c, badge.label, W - 48 - bw + 36, 131, { size: 18, color: col, weight: "bold" });
  c.rect(48, 176, W - 96, 2, C.line);
  return c;
}

async function field(c: Canvas, x: number, y: number, label: string, value: string, maxWidth = 200, color = C.ink) {
  await text(c, label.toUpperCase(), x, y, { size: 13, color: C.sub, weight: "bold" });
  await text(c, value, x, y + 30, { size: 21, color, weight: "bold", maxWidth });
}

async function footer(c: Canvas, left: string, at: Date) {
  c.rect(48, H - 86, W - 96, 2, C.line);
  c.circle(60, H - 56, 5, C.blue);
  await text(c, left, 74, H - 50, { size: 16, color: C.sub, maxWidth: 560 });
  await text(c, wib(at), W - 52, H - 50, { size: 16, color: C.sub, align: "right" });
}

export type OrderCardKind = "order_new" | "order_paid" | "order_cancelled" | "order_expired" | "order_completed";
export const ORDER_BADGE: Record<OrderCardKind, { title: string; label: string; tone: Tone }> = {
  order_new: { title: "Pesanan Baru Masuk", label: "Belum Dibayar", tone: "orange" },
  order_paid: { title: "Pembayaran Berhasil", label: "Sudah Dibayar", tone: "green" },
  order_completed: { title: "Pesanan Selesai", label: "Selesai", tone: "blue" },
  order_cancelled: { title: "Pesanan Dibatalkan", label: "Dibatalkan", tone: "red" },
  order_expired: { title: "Pesanan Habis Waktu", label: "Habis Waktu", tone: "gray" },
};

export async function orderCard(d: {
  kind: OrderCardKind; store: string; orderNo: number; product: string; variant: string; qty: number; unit: number;
  total: number; method: string | null; buyer: string | null; note: string | null; at: Date; expiresAt?: Date | null;
}) {
  const b = ORDER_BADGE[d.kind];
  const c = await frame(b.title, `Order M-${d.orderNo} · ${d.product}`, b, d.store);
  const L = 56;
  await field(c, L, 214, "Produk", d.product, 280);
  await field(c, L + 300, 214, "Varian", d.variant, 260);
  await field(c, L, 290, "Jumlah", `${d.qty}x`, 120);
  await field(c, L + 150, 290, "Harga Satuan", rp(d.unit), 150);
  await field(c, L + 300, 290, "Metode", d.method ? d.method.toUpperCase() : "Belum dipilih", 260);
  await field(c, L, 366, "Pembeli", d.buyer ?? "Pembeli", 280);
  if (d.kind === "order_new" && d.expiresAt) await field(c, L + 300, 366, "Batas Bayar", wib(d.expiresAt), 270, C.orange);
  else await field(c, L + 300, 366, "Catatan", d.note?.trim() || "-", 260);
  // total box
  const tone = toneColor(b.tone);
  c.rect(640, 204, 304, 190, C.blueSoft, 18);
  c.stroke(640, 204, 304, 190, hex("#bfdbfe"), 18, 2);
  await text(c, "TOTAL BAYAR", 792, 252, { size: 15, color: C.sub, weight: "bold", align: "center" });
  await text(c, rp(d.total), 792, 310, { size: 42, color: C.blue, weight: "bold", align: "center", maxWidth: 280 });
  c.rect(700, 336, 184, 36, [tone[0], tone[1], tone[2], 0.14], 18);
  await text(c, b.label, 792, 361, { size: 17, color: tone, weight: "bold", align: "center" });
  await footer(c, d.kind === "order_paid" ? "Stok otomatis dikirim · saldo masuk setelah masa tahan" : "Kelola pesanan di Seller Center", d.at);
  return c.png();
}

export async function chatCard(d: { store: string; buyer: string; message: string; product?: string | null; photo: boolean; at: Date }) {
  const c = await frame("Pesan Baru dari Pembeli", `${d.buyer} mengirim pesan`, { label: "Chat Masuk", tone: "violet" }, d.store);
  c.rect(56, 206, 640, 230, hex("#f5f3ff"), 22);
  c.circle(96, 248, 22, hex("#ddd6fe"));
  await text(c, (d.buyer.trim()[0] ?? "P").toUpperCase(), 96, 257, { size: 22, color: C.violet, weight: "bold", align: "center" });
  await text(c, d.buyer, 130, 256, { size: 21, color: C.ink, weight: "bold", maxWidth: 540 });
  const msg = d.message.trim() || (d.photo ? "📷 Mengirim foto" : "(pesan kosong)");
  const lines = await wrap(msg.replace(/[^\p{L}\p{N}\p{P}\p{Zs}+=<>^$|~`]/gu, ""), 580, { size: 21 }, 4);
  let y = 304;
  for (const ln of lines) { await text(c, ln, 84, y, { size: 21, color: C.ink }); y += 32; }
  c.rect(720, 206, 224, 230, C.blueSoft, 22);
  await field(c, 744, 252, "Produk", d.product ?? "Chat umum", 180);
  await field(c, 744, 330, "Lampiran", d.photo ? "Foto" : "Tidak ada", 180);
  await footer(c, "Balas cepat agar pembeli tidak menunggu", d.at);
  return c.png();
}

export async function depositCard(d: { store: string; amount: number; method: string | null; purpose: string; status: string; at: Date }) {
  const map: Record<string, { title: string; label: string; tone: Tone }> = {
    pending: { title: "Deposit Diajukan", label: "Menunggu Admin", tone: "orange" },
    approved: { title: "Deposit Berhasil", label: "Disetujui", tone: "green" },
    rejected: { title: "Deposit Ditolak", label: "Ditolak", tone: "red" },
  };
  const b = map[d.status] ?? map["pending"]!;
  const c = await frame(b.title, d.purpose === "credits" ? "Top up Seller Credits" : "Top up Saldo Marketku", b, d.store);
  await field(c, 56, 230, "Metode", d.method ?? "-", 260);
  await field(c, 356, 230, "Tujuan", d.purpose === "credits" ? "Seller Credits" : "Saldo Marketku", 260);
  await field(c, 56, 320, "Status", b.label, 260, toneColor(b.tone));
  c.rect(640, 204, 304, 190, C.blueSoft, 18);
  await text(c, "NOMINAL", 792, 256, { size: 15, color: C.sub, weight: "bold", align: "center" });
  await text(c, rp(d.amount), 792, 318, { size: 42, color: C.blue, weight: "bold", align: "center", maxWidth: 280 });
  await footer(c, d.status === "pending" ? "Admin akan memeriksa bukti pembayaran" : "Saldo sudah diperbarui", d.at);
  return c.png();
}

export async function dashboardCard(d: {
  store: string; today: [number, number]; week: [number, number]; month: [number, number];
  available: number; held: number; credits: number; products: string; stock: number; views: number; at: Date;
}) {
  const c = await frame("Dashboard Toko", "Ringkasan penjualan & saldo", { label: "Live", tone: "green" }, d.store);
  const box = async (x: number, label: string, v: [number, number], tone: RGBA) => {
    c.rect(x, 198, 284, 110, hex("#f8fafc"), 18);
    c.stroke(x, 198, 284, 110, C.line, 18, 1.5);
    c.circle(x + 26, 226, 7, tone);
    await text(c, label.toUpperCase(), x + 42, 232, { size: 14, color: C.sub, weight: "bold" });
    await text(c, `${v[0]} pesanan`, x + 20, 268, { size: 22, color: C.ink, weight: "bold" });
    await text(c, rp(v[1]), x + 20, 296, { size: 18, color: tone, weight: "bold", maxWidth: 250 });
  };
  await box(56, "Hari Ini", d.today, C.blue);
  await box(358, "7 Hari", d.week, C.violet);
  await box(660, "Bulan Ini", d.month, C.orange);
  const kpi = async (x: number, label: string, v: string, tone: RGBA) => {
    c.rect(x, 326, 206, 96, C.white, 16);
    c.stroke(x, 326, 206, 96, C.line, 16, 1.5);
    await text(c, label.toUpperCase(), x + 18, 356, { size: 13, color: C.sub, weight: "bold" });
    await text(c, v, x + 18, 398, { size: 22, color: tone, weight: "bold", maxWidth: 176 });
  };
  await kpi(56, "Saldo Tersedia", rp(d.available), C.green);
  await kpi(278, "Tertahan", rp(d.held), C.orange);
  await kpi(500, "Credits", rp(d.credits), C.blue);
  await kpi(722, "Dilihat", `${d.views.toLocaleString("id-ID")}x`, C.violet);
  await footer(c, `${d.products} produk aktif · ${d.stock.toLocaleString("id-ID")} stok`, d.at);
  return c.png();
}
