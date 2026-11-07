import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { descendantIds } from "@/lib/products";
import { applyFlash, fetchFlashSales, liveFlashPercent } from "@/lib/flash";

/* ---------- pure rules (unit-tested) ---------- */

export type Discount = { min_order?: number; percent?: number } | null;

/** Unit price after the variant's quantity discount (same rule as the checkout function). */
export function unitPrice(price: number, qty: number, discount: Discount, flashPercent = 0) {
  const pct = Math.min(Number(discount?.percent ?? 0), 100);
  const p = pct > 0 && qty >= Number(discount?.min_order ?? 1) ? price - Math.floor((price * pct) / 100) : price;
  return applyFlash(p, flashPercent);
}

export type SortKey = "relevan" | "terbaru" | "termurah" | "termahal" | "terlaris";
export const SORTS: { value: SortKey; label: string }[] = [
  { value: "relevan", label: "Paling Relevan" },
  { value: "terbaru", label: "Terbaru" },
  { value: "terlaris", label: "Terlaris" },
  { value: "termurah", label: "Termurah" },
  { value: "termahal", label: "Termahal" },
];

export type Rating = { avg: number; count: number };
export function ratingOf(rows: { rating: number }[]): Rating {
  if (!rows.length) return { avg: 0, count: 0 };
  const sum = rows.reduce((a, r) => a + r.rating, 0);
  return { avg: Math.round((sum / rows.length) * 10) / 10, count: rows.length };
}
export function ratingBars(rows: { rating: number }[]) {
  return [5, 4, 3, 2, 1].map((s) => ({ star: s, n: rows.filter((r) => r.rating === s).length }));
}

export type CardProduct = {
  id: string; name: string; owner_id: string; images: string[]; sold_count: number; created_at: string;
  product_type: string; category: string | null; minPrice: number; basePrice: number; maxPrice: number; stock: number;
  storeName: string; storeOpen: boolean; rating: Rating; likes: number;
  /** Live flash-sale percent (0 = none) and when it ends. */
  flash?: { percent: number; ends_at: string } | null;
};

export function sortProducts(list: CardProduct[], sort: SortKey, q = "") {
  const out = [...list];
  const ql = q.trim().toLowerCase();
  if (sort === "terbaru") out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  else if (sort === "termurah") out.sort((a, b) => a.minPrice - b.minPrice);
  else if (sort === "termahal") out.sort((a, b) => b.minPrice - a.minPrice);
  else if (sort === "terlaris") out.sort((a, b) => b.sold_count - a.sold_count);
  else if (ql) out.sort((a, b) => Number(b.name.toLowerCase().startsWith(ql)) - Number(a.name.toLowerCase().startsWith(ql)));
  return out;
}

/** Order status → buyer-facing label and history filter group. */
export const ORDER_LABEL: Record<string, string> = {
  pending: "Menunggu Pembayaran", paid: "Dibayar", processing: "Diproses", completed: "Berhasil",
  cancelled: "Dibatalkan", refunded: "Refund", failed: "Gagal",
};
export const BUYER_FILTER: Record<string, string[]> = {
  Semua: [], Proses: ["pending", "paid", "processing"], Berhasil: ["completed"], "Refund Diproses": ["refunded"],
  "Tidak Berhasil": ["cancelled", "failed"], "Garansi Aktif": [], Dikomplain: [],
};
export const SELLER_FILTER: Record<string, string[]> = {
  Semua: [], Menunggu: ["pending"], Dibayar: ["paid", "processing"], Selesai: ["completed"], Dibatalkan: ["cancelled"], Refund: ["refunded"], Gagal: ["failed"],
};

/** "variantId:qty,variantId:qty" → list (invalid parts dropped, qty clamped 1..1000). */
export function parseItems(s: string | undefined) {
  return (s ?? "").split(",").map((x) => x.split(":")).filter(([v, q]) => v && /^[0-9a-f-]{36}$/i.test(v) && Number(q) > 0)
    .map(([v, q]) => ({ variant_id: v!, qty: Math.min(1000, Math.floor(Number(q))) }));
}


/* ---------- data hooks ---------- */

type RawProduct = {
  id: string; name: string; owner_id: string; images: string[]; sold_count: number; created_at: string; product_type: string;
  product_categories: { name: string } | null;
  product_variants: { id: string; price: number; discount?: unknown }[];
};

async function decorate(rows: RawProduct[]): Promise<CardProduct[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const owners = [...new Set(rows.map((r) => r.owner_id))];
  const [stores, stock, reviews, likes, flashes] = await Promise.all([
    supabase.rpc("public_stores", { p_ids: owners }),
    supabase.rpc("variant_stock", { p_product_ids: ids }),
    supabase.from("product_reviews").select("product_id, rating").in("product_id", ids),
    supabase.rpc("product_like_counts", { p_ids: ids }),
    fetchFlashSales(ids),
  ]);
  const lk = new Map((likes.data ?? []).map((l) => [l.product_id, Number(l.likes)]));
  const sm = new Map((stores.data ?? []).map((s) => [s.owner_id, s]));
  const st = new Map((stock.data ?? []).map((s) => [s.variant_id, s.available]));
  return rows.map((r) => {
    const base = r.product_variants.map((v) => Number(v.price));
    const fp = liveFlashPercent(flashes, r.id);
    const fl = fp ? flashes.filter((f) => f.product_id === r.id && f.percent === fp)[0] : undefined;
    const prices = r.product_variants.map((v) => unitPrice(Number(v.price), 1, v.discount as Discount, fp));
    const s = sm.get(r.owner_id);
    return {
      id: r.id, name: r.name, owner_id: r.owner_id, images: r.images ?? [], sold_count: r.sold_count, created_at: r.created_at,
      product_type: r.product_type, category: r.product_categories?.name ?? null,
      minPrice: prices.length ? Math.min(...prices) : 0, basePrice: base.length ? Math.min(...base) : 0, maxPrice: prices.length ? Math.max(...prices) : 0,
      stock: r.product_variants.reduce((a, v) => a + (st.get(v.id) ?? 0), 0),
      storeName: s?.store_name ?? "Toko", storeOpen: s?.is_open ?? false,
      rating: ratingOf((reviews.data ?? []).filter((x) => x.product_id === r.id)),
      likes: lk.get(r.id) ?? 0,
      flash: fl ? { percent: fp, ends_at: fl.ends_at } : null,
    };
  });
}

/** True for a well-formed UUID; invalid ids in a link must show "not found", not a server error. */
export const isUuid = (v: string | null | undefined) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const CARD_SELECT = "id, name, owner_id, images, sold_count, created_at, product_type, product_categories(name), product_variants(id, price, discount)";

export function useMarketProducts(opts: { q?: string; category?: string | null; owner?: string; limit?: number; ids?: string[] } = {}) {
  const { q = "", category = null, owner, limit = 60, ids } = opts;
  return useQuery({
    queryKey: ["market_products", q, category, owner, limit, ids ? [...ids].sort().join(",") : null],
    enabled: !ids || ids.length > 0,
    queryFn: async () => {
      let query = supabase.from("products").select(CARD_SELECT).eq("status", "active").order("created_at", { ascending: false }).limit(limit);
      if (ids) query = query.in("id", ids.filter(isUuid));
      const term = q.trim().replace(/[%,()]/g, " ");
      if (term) query = query.ilike("name", `%${term}%`);
      if (category) {
        // A parent category (e.g. "AI Tools") also shows products filed under its sub-categories.
        const { data: cats } = await supabase.from("product_categories").select("id, parent_id");
        query = query.in("category_id", descendantIds(cats ?? [], category));
      }
      if (owner !== undefined) {
        if (!isUuid(owner)) return [];
        query = query.eq("owner_id", owner);
      }
      const { data, error } = await query;
      if (error) throw error;
      return decorate((data ?? []) as unknown as RawProduct[]);
    },
  });
}

export function useProductDetail(id: string) {
  return useQuery({
    queryKey: ["product_detail", id],
    queryFn: async () => {
      if (!isUuid(id)) return null;
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name), product_variants(id, name, price, lifetime, duration_value, duration_unit, warranty, discount, bonus, preorder_quota, image_url, sort)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [store, stock] = await Promise.all([
        supabase.rpc("public_stores", { p_ids: [data.owner_id] }),
        supabase.rpc("variant_stock", { p_product_ids: [id] }),
      ]);
      const st = new Map((stock.data ?? []).map((s) => [s.variant_id, s.available]));
      const variants = [...data.product_variants].sort((a, b) => a.sort - b.sort).map((v) => ({ ...v, stock: st.get(v.id) ?? 0 }));
      return { ...data, variants, store: store.data?.[0] ?? null };
    },
  });
}
export type ProductDetail = NonNullable<NonNullable<ReturnType<typeof useProductDetail>["data"]>>;

export function useReviews(filter: { product?: string; seller?: string }) {
  return useQuery({
    queryKey: ["reviews", filter.product ?? null, filter.seller ?? null],
    enabled: !!(filter.product || filter.seller),
    queryFn: async () => {
      if ((filter.product && !isUuid(filter.product)) || (filter.seller && !isUuid(filter.seller))) return [];
      let q = supabase.from("product_reviews").select("id, product_id, rating, comment, topic, buyer_label, helpful_count, created_at, products(name, images)").order("created_at", { ascending: false }).limit(200);
      if (filter.product) q = q.eq("product_id", filter.product);
      if (filter.seller) q = q.eq("seller_id", filter.seller);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
export type ReviewRow = NonNullable<ReturnType<typeof useReviews>["data"]>[number];

/* ---------- cart ---------- */

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("variant_id, product_id, qty, created_at, product_variants(name, price, discount, image_url), products(name, images, owner_id, status, product_type, product_categories(name))")
        .eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const owners = [...new Set(rows.map((r) => r.products?.owner_id).filter(Boolean) as string[])];
      const stores = owners.length ? (await supabase.rpc("public_stores", { p_ids: owners })).data ?? [] : [];
      const sm = new Map(stores.map((s) => [s.owner_id, s]));
      return rows.map((r) => ({ ...r, store: r.products ? sm.get(r.products.owner_id) ?? null : null }));
    },
  });
}
export type CartRow = NonNullable<ReturnType<typeof useCart>["data"]>[number];

export function useCartActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["cart", user?.id] });
  return {
    add: async (productId: string, variantId: string, qty: number) => {
      if (!user) { toast("Masuk dulu untuk menambah ke keranjang"); return false; }
      const { data: cur } = await supabase.from("cart_items").select("qty").eq("user_id", user.id).eq("variant_id", variantId).maybeSingle();
      const { error } = await supabase.from("cart_items").upsert({ user_id: user.id, product_id: productId, variant_id: variantId, qty: Math.min((cur?.qty ?? 0) + qty, 1000) });
      if (error) { toast.error("Gagal menambah ke keranjang"); return false; }
      await refresh();
      return true;
    },
    setQty: async (variantId: string, qty: number) => {
      if (!user) return;
      const { error } = await supabase.from("cart_items").update({ qty: Math.max(1, Math.min(qty, 1000)) }).eq("user_id", user.id).eq("variant_id", variantId);
      if (error) toast.error("Gagal mengubah jumlah");
      await refresh();
    },
    remove: async (variantIds: string[]) => {
      if (!user || !variantIds.length) return;
      const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id).in("variant_id", variantIds);
      if (error) toast.error("Gagal menghapus item");
      await refresh();
    },
  };
}

/** Readable message from a database/function error. */
export const dbError = (e: unknown) => {
  const m = (e as { message?: string } | null)?.message ?? "";
  return m && !/^(JWT|permission|new row)/i.test(m) ? m : "Terjadi kesalahan, coba lagi";
};

export const maskName = (n: string) => (n.length <= 2 ? `${n.charAt(0)}***` : `${n.charAt(0)}***${n.charAt(n.length - 1)}`);
export const fmtDate = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (s: string) => new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* ---------- sponsored products & category counts ---------- */

export type SponsoredProduct = CardProduct & { campaignId: string };

/** Active sponsored products; empty query = beranda, otherwise matched against campaign keywords. */
export function useSponsored(q = "", limit = 6) {
  return useQuery({
    queryKey: ["sponsored", q.trim().toLowerCase(), limit],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SponsoredProduct[]> => {
      const { data, error } = await supabase.rpc("sponsored_products", { p_query: q, p_limit: limit });
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];
      const { data: prods, error: e2 } = await supabase.from("products").select(CARD_SELECT).eq("status", "active").in("id", rows.map((r) => r.product_id));
      if (e2) throw e2;
      const cards = await decorate((prods ?? []) as unknown as RawProduct[]);
      const byId = new Map(cards.map((c) => [c.id, c]));
      return rows.flatMap((r) => { const c = byId.get(r.product_id); return c ? [{ ...c, campaignId: r.campaign_id }] : []; });
    },
  });
}
export const trackAdClick = (campaignId: string) => { supabase.rpc("track_ad_click", { p_campaign: campaignId }).then(() => {}, () => {}); };

export function useCategoryCounts() {
  return useQuery({
    queryKey: ["category_counts"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("category_product_counts");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.category_id, r.products]));
    },
  });
}
