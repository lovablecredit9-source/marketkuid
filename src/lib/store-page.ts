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
