import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSellerOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["seller_orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("seller_id", userId!).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}
export type SellerOrder = NonNullable<ReturnType<typeof useSellerOrders>["data"]>[number];

type O = { status: string; total: number; subtotal: number; discount: number; buyer_id: string; created_at: string; order_items: { product_id: string | null; product_name: string; qty: number; line_total: number; product_type?: string | null }[] };

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Seller dashboard / analytics numbers derived from real orders only. */
export function sellerStats(orders: O[], now = new Date()) {
  const done = orders.filter((o) => o.status === "completed");
  const revenue = done.reduce((a, o) => a + Number(o.subtotal) - Number(o.discount), 0);
  const today = done.filter((o) => sameDay(new Date(o.created_at), now)).reduce((a, o) => a + Number(o.subtotal) - Number(o.discount), 0);
  const buyers = new Set(orders.map((o) => o.buyer_id)).size;
  const paidLike = orders.filter((o) => ["paid", "processing", "completed"].includes(o.status));
  const conversion = orders.length ? Math.round((paidLike.length / orders.length) * 100) : 0;
  const best = new Map<string, { id: string | null; name: string; qty: number; revenue: number }>();
  for (const o of done) for (const i of o.order_items) {
    const k = i.product_id ?? i.product_name;
    const cur = best.get(k) ?? { id: i.product_id, name: i.product_name, qty: 0, revenue: 0 };
    best.set(k, { id: cur.id, name: cur.name, qty: cur.qty + i.qty, revenue: cur.revenue + Number(i.line_total) });
  }
  return {
    revenue, today, buyers, conversion,
    total: orders.length,
    completed: done.length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    waiting: orders.filter((o) => o.status === "pending").length,
    preorderTodo: orders.filter((o) => o.status === "paid" && o.order_items.some((i) => i.product_type === "preorder")).length,
    preorderDoing: orders.filter((o) => o.status === "processing").length,
    avgOrder: done.length ? Math.round(revenue / done.length) : 0,
    productKinds: new Set(orders.flatMap((o) => o.order_items.map((i) => i.product_id ?? i.product_name))).size,
    bestSellers: [...best.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
  };
}

/** Revenue of completed orders per day for the last `days` days (oldest first). */
export function dailyRevenue(orders: O[], days = 7, now = new Date()) {
  const out: { label: string; value: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const day = orders.filter((o) => sameDay(new Date(o.created_at), d));
    out.push({
      label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      value: day.filter((o) => o.status === "completed").reduce((a, o) => a + Number(o.subtotal) - Number(o.discount), 0),
      orders: day.length,
    });
  }
  return out;
}

/** Seller program tier from completed sales count. */
export const SELLER_TIERS = [
  { name: "Bronze", min: 0, perks: ["Akses semua fitur dasar toko", "Panduan seller lengkap"] },
  { name: "Silver", min: 50, perks: ["Badge Silver di halaman toko", "Prioritas review produk baru"] },
  { name: "Gold", min: 250, perks: ["Badge Gold di halaman toko", "Prioritas dukungan seller"] },
  { name: "Platinum", min: 1000, perks: ["Badge Platinum di halaman toko", "Kesempatan tampil di kurasi beranda"] },
] as const;
export function tierFor(sales: number) {
  let idx = 0;
  SELLER_TIERS.forEach((t, i) => { if (sales >= t.min) idx = i; });
  const next = SELLER_TIERS[idx + 1] ?? null;
  return { tier: SELLER_TIERS[idx]!, next, toNext: next ? next.min - sales : 0, progress: next ? Math.min(100, Math.round(((sales - SELLER_TIERS[idx]!.min) / (next.min - SELLER_TIERS[idx]!.min)) * 100)) : 100 };
}
