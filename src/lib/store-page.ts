import type { CardProduct } from "@/lib/market";

/** Store page product sorting (subset of the search sorts that make sense inside one store). */
export type StoreSort = "terbaru" | "termurah" | "termahal" | "terlaris";
export const STORE_SORTS: { value: StoreSort; label: string }[] = [
  { value: "terbaru", label: "Terbaru" },
  { value: "terlaris", label: "Terlaris" },
  { value: "termurah", label: "Harga termurah" },
  { value: "termahal", label: "Harga tertinggi" },
];

/** Only this store's products (owner check), filtered by name + category and sorted. */
export function filterStoreProducts(list: CardProduct[], owner: string, f: { q: string; category: string | null; sort: StoreSort }) {
  const q = f.q.trim().toLowerCase();
  const out = list.filter((p) => p.owner_id === owner && (!q || p.name.toLowerCase().includes(q)) && (!f.category || p.category === f.category));
  if (f.sort === "terbaru") out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  else if (f.sort === "termurah") out.sort((a, b) => a.minPrice - b.minPrice);
  else if (f.sort === "termahal") out.sort((a, b) => b.minPrice - a.minPrice);
  else out.sort((a, b) => b.sold_count - a.sold_count || b.created_at.localeCompare(a.created_at));
  return out;
}

/** Categories used by the store's products, most products first. */
export function storeCategories(list: CardProduct[]) {
  const m = new Map<string, number>();
  for (const p of list) if (p.category) m.set(p.category, (m.get(p.category) ?? 0) + 1);
  return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export type PublicVoucher = { code: string; name: string; kind: string; value: number; value_type: string; max_discount: number | null; min_spend: number | null };

/** "Diskon 10%" / "Potongan Rp 5.000". */
export function voucherValue(v: Pick<PublicVoucher, "value" | "value_type">) {
  return v.value_type === "percent" ? `Diskon ${Number(v.value)}%` : `Potongan ${rp(Number(v.value))}`;
}

/** Terms line: minimum spend and (percent only) the max discount. */
export function voucherTerms(v: PublicVoucher) {
  const parts: string[] = [];
  const min = Number(v.min_spend ?? 0);
  parts.push(min > 0 ? `Min. belanja ${rp(min)}` : "Tanpa minimal belanja");
  const max = Number(v.max_discount ?? 0);
  if (v.value_type === "percent" && max > 0) parts.push(`Maks. ${rp(max)}`);
  return parts.join(" · ");
}

/** Star distribution with whole-number percentages. */
export function reviewBreakdown(rows: { rating: number }[]) {
  const total = rows.length;
  return [5, 4, 3, 2, 1].map((star) => {
    const n = rows.filter((r) => r.rating === star).length;
    return { star, n, pct: total ? Math.round((n / total) * 100) : 0 };
  });
}

export function filterReviews<T extends { rating: number }>(rows: T[], star: number | null) {
  return star ? rows.filter((r) => r.rating === star) : rows;
}

export type StoreBadge = { key: "rating" | "laris" | "baru" | "lengkap"; label: string; hint: string };

/** Earned store badges — every one is computed from real store data, never assigned by hand. */
export function storeBadges(i: { avg: number; reviews: number; sold: number; products: number; createdAt: string; now?: Date }): StoreBadge[] {
  const out: StoreBadge[] = [];
  if (i.reviews >= 5 && i.avg >= 4.5) out.push({ key: "rating", label: "Rating Tinggi", hint: `Rata-rata ${i.avg.toFixed(1)} dari ${i.reviews} ulasan` });
  if (i.sold >= 50) out.push({ key: "laris", label: "Toko Laris", hint: `${i.sold.toLocaleString("id-ID")} produk terjual` });
  if (i.products >= 20) out.push({ key: "lengkap", label: "Koleksi Lengkap", hint: `${i.products} produk aktif` });
  const days = ((i.now ?? new Date()).getTime() - new Date(i.createdAt).getTime()) / 86_400_000;
  if (days >= 0 && days <= 30) out.push({ key: "baru", label: "Toko Baru", hint: "Bergabung dalam 30 hari terakhir" });
  return out;
}

/** Up to `n` best sellers that actually sold something, most sold first. */
export function topSellers(list: CardProduct[], n = 3) {
  return list.filter((p) => p.sold_count > 0).sort((a, b) => b.sold_count - a.sold_count || b.created_at.localeCompare(a.created_at)).slice(0, n);
}

/** Short count: 950, 1,2 rb, 3 jt. */
export function shortCount(n: number) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")} jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")} rb`;
  return String(v);
}

const VISITOR_KEY = "mk_visitor_id";
/** Anonymous per-device id so one device counts as one store visit per day (no personal data). */
export function storeVisitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem(VISITOR_KEY, id); }
    return id;
  } catch { return null; }
}
