/** Seller dashboard insights computed from the seller's own real data only. */

type O = { status: string; subtotal: number; discount: number; created_at: string };
type P = {
  id: string; name: string; status: string; product_type: string;
  images: string[] | null; description: string | null;
  product_stock?: { status: string }[] | null;
};

const net = (o: O) => Number(o.subtotal) - Number(o.discount);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Completed revenue + order count today vs yesterday; `change` is null when yesterday had nothing. */
export function todayVsYesterday(orders: O[], now = new Date()) {
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const done = orders.filter((o) => o.status === "completed");
  const today = done.filter((o) => sameDay(new Date(o.created_at), now)).reduce((a, o) => a + net(o), 0);
  const yesterday = done.filter((o) => sameDay(new Date(o.created_at), y)).reduce((a, o) => a + net(o), 0);
  const ordersToday = orders.filter((o) => sameDay(new Date(o.created_at), now)).length;
  const change = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : null;
  return { today, yesterday, ordersToday, change };
}

/** Completed revenue in the calendar month of `now`. */
export function monthRevenue(orders: O[], now = new Date()) {
  return orders
    .filter((o) => o.status === "completed")
    .filter((o) => { const d = new Date(o.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
    .reduce((a, o) => a + net(o), 0);
}

/** Progress toward a monthly target, with days left (incl. today) and the daily pace still needed. */
export function targetProgress(revenue: number, target: number, now = new Date()) {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate() + 1;
  if (target <= 0) return { pct: 0, remaining: 0, daysLeft, perDay: 0, reached: false };
  const remaining = Math.max(0, target - revenue);
  return {
    pct: Math.min(100, Math.round((revenue / target) * 100)),
    remaining,
    daysLeft,
    perDay: remaining > 0 ? Math.ceil(remaining / daysLeft) : 0,
    reached: revenue >= target,
  };
}

export const LOW_STOCK = 3;
export type ProductAlertKind = "habis" | "menipis" | "foto" | "deskripsi";
export type ProductAlert = { id: string; name: string; kind: ProductAlertKind; stock?: number };

/** Active products that need the seller's attention; empty stock first. */
export function productAlerts(products: P[]): ProductAlert[] {
  const out: ProductAlert[] = [];
  for (const p of products) {
    if (p.status !== "active") continue;
    if (p.product_type !== "preorder") {
      const stock = (p.product_stock ?? []).filter((s) => s.status === "available").length;
      if (stock === 0) out.push({ id: p.id, name: p.name, kind: "habis", stock });
      else if (stock <= LOW_STOCK) out.push({ id: p.id, name: p.name, kind: "menipis", stock });
    }
    if (!p.images?.length) out.push({ id: p.id, name: p.name, kind: "foto" });
    if ((p.description ?? "").trim().length < 30) out.push({ id: p.id, name: p.name, kind: "deskripsi" });
  }
  const rank: Record<ProductAlertKind, number> = { habis: 0, menipis: 1, foto: 2, deskripsi: 3 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Parse a rupiah amount typed by the seller ("1.500.000", "Rp 2jt" not supported → digits only). */
export function parseRupiah(input: string) {
  const digits = input.replace(/\D/g, "");
  return digits ? Math.min(Number(digits), 999_999_999_999) : 0;
}
