import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ---------- pure rules (unit-tested; mirror place_order) ---------- */

export type FlashSale = {
  id: string; product_id: string; percent: number; starts_at: string; ends_at: string; quota: number | null; sold: number;
};
export type FlashPhase = "live" | "upcoming" | "ended" | "soldout";

export function flashPhase(f: Pick<FlashSale, "starts_at" | "ends_at" | "quota" | "sold">, now = Date.now()): FlashPhase {
  if (+new Date(f.ends_at) <= now) return "ended";
  if (+new Date(f.starts_at) > now) return "upcoming";
  if (f.quota !== null && f.sold >= f.quota) return "soldout";
  return "live";
}

/** Price after a flash-sale percent (applied after the variant's own discount, same as checkout). */
export const applyFlash = (price: number, percent: number) =>
  percent > 0 ? price - Math.floor((price * Math.min(percent, 90)) / 100) : price;

/** Highest live flash percent for a product, or 0. */
export function liveFlashPercent(list: FlashSale[] | undefined, productId: string, now = Date.now()) {
  return (list ?? []).filter((f) => f.product_id === productId && flashPhase(f, now) === "live").reduce((a, f) => Math.max(a, f.percent), 0);
}

/** "02:15:09" countdown (or "1h 02:15:09" when over a day). */
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${d ? `${d}h ` : ""}${hh}:${mm}:${ss}`;
}

/* ---------- data ---------- */

const COLS = "id, product_id, percent, starts_at, ends_at, quota, sold";

/** Live + upcoming public flash sales, optionally for specific products. */
export async function fetchFlashSales(productIds?: string[]): Promise<FlashSale[]> {
  if (productIds && !productIds.length) return [];
  let q = supabase.from("flash_sales").select(COLS).eq("status", "active").gt("ends_at", new Date().toISOString()).order("starts_at");
  if (productIds) q = q.in("product_id", productIds);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as FlashSale[];
}

export function useFlashSales(productIds?: string[]) {
  const key = productIds ? [...productIds].sort().join(",") : "all";
  return useQuery({
    queryKey: ["flash_sales", key],
    queryFn: () => fetchFlashSales(productIds),
    refetchInterval: 60_000,
  });
}
