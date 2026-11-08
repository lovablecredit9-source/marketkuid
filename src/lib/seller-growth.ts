/** More seller dashboard insights — all derived from the seller's own real orders/products. */

type O = { status: string; subtotal: number; discount: number; created_at: string; buyer_id: string; buyer_name?: string | null };

const PAID = ["paid", "processing", "completed"];
const net = (o: O) => Number(o.subtotal) - Number(o.discount);

/** Paid-like orders per hour of day (0–23) and per weekday (0=Min … 6=Sab). */
export function peakTimes(orders: O[]) {
  const hours = Array.from({ length: 24 }, () => 0);
  const days = Array.from({ length: 7 }, () => 0);
  for (const o of orders) {
    if (!PAID.includes(o.status)) continue;
    const d = new Date(o.created_at);
    hours[d.getHours()]! += 1;
    days[d.getDay()]! += 1;
  }
  const total = days.reduce((a, b) => a + b, 0);
  const bestHour = total ? hours.indexOf(Math.max(...hours)) : null;
  const bestDay = total ? days.indexOf(Math.max(...days)) : null;
  return { hours, days, total, bestHour, bestDay };
}
export const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Buyers with ≥2 completed orders, by order count then spend. */
export function loyalBuyers(orders: O[], limit = 5) {
  const m = new Map<string, { id: string; name: string; orders: number; spend: number; last: string }>();
  for (const o of orders) {
    if (o.status !== "completed") continue;
    const cur = m.get(o.buyer_id) ?? { id: o.buyer_id, name: o.buyer_name || "Pelanggan", orders: 0, spend: 0, last: o.created_at };
    cur.orders += 1; cur.spend += net(o);
    if (o.created_at > cur.last) cur.last = o.created_at;
    if (o.buyer_name) cur.name = o.buyer_name;
    m.set(o.buyer_id, cur);
  }
  return [...m.values()].filter((b) => b.orders >= 2).sort((a, b) => b.orders - a.orders || b.spend - a.spend).slice(0, limit);
}

/** Order counts grouped for a status bar. */
export function statusBreakdown(orders: { status: string }[]) {
  const g = { selesai: 0, proses: 0, menunggu: 0, batal: 0 };
  for (const o of orders) {
    if (o.status === "completed") g.selesai++;
    else if (o.status === "paid" || o.status === "processing") g.proses++;
    else if (o.status === "pending") g.menunggu++;
    else g.batal++;
  }
  return { ...g, total: orders.length };
}

/** Profit after the platform fee (fee rounded up like the real payout). */
export function profitCalc(price: number, cost: number, feePercent: number) {
  const fee = price > 0 ? Math.ceil((price * feePercent) / 100) : 0;
  const received = Math.max(0, price - fee);
  const profit = received - cost;
  const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
  return { fee, received, profit, margin };
}

export type Achievement = { key: string; title: string; desc: string; current: number; goal: number; done: boolean };

/** Milestones unlocked from real numbers only. */
export function achievements(x: { completed: number; revenue: number; activeProducts: number; buyers: number; loyal: number }): Achievement[] {
  const a = (key: string, title: string, desc: string, current: number, goal: number) => ({ key, title, desc, current: Math.min(current, goal), goal, done: current >= goal });
  return [
    a("first", "Penjualan Pertama", "Selesaikan 1 pesanan", x.completed, 1),
    a("p5", "Etalase Siap", "Punya 5 produk aktif", x.activeProducts, 5),
    a("o10", "Mulai Laris", "10 pesanan selesai", x.completed, 10),
    a("b10", "10 Pelanggan", "10 pembeli berbeda", x.buyers, 10),
    a("loyal", "Dipercaya Pelanggan", "3 pembeli belanja lagi", x.loyal, 3),
    a("r1m", "Omzet 1 Juta", "Pendapatan Rp1.000.000", x.revenue, 1_000_000),
    a("o100", "Seller Andalan", "100 pesanan selesai", x.completed, 100),
    a("r10m", "Omzet 10 Juta", "Pendapatan Rp10.000.000", x.revenue, 10_000_000),
  ];
}

/** Ready-to-share promo caption for a product. */
export function promoCaption(p: { name: string; price: number; store: string; url: string; tone: "santai" | "promo" | "singkat" }) {
  const harga = `Rp${p.price.toLocaleString("id-ID")}`;
  if (p.tone === "singkat") return `${p.name} — ${harga}\nBeli di ${p.store}: ${p.url}`;
  if (p.tone === "promo") return `🔥 READY! ${p.name.toUpperCase()} 🔥\n\n💰 Cuma ${harga}\n⚡ Proses cepat & aman lewat Marketku\n🛡️ Dana ditahan sampai pesanan beres\n\nOrder sekarang di ${p.store} 👇\n${p.url}`;
  return `Lagi cari ${p.name}? Ada di toko ${p.store} 😊\nHarganya ${harga}, bayarnya aman lewat Marketku.\n\nCek di sini: ${p.url}`;
}
