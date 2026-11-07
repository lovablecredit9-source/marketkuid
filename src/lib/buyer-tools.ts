/** Browser-only buyer helpers kept on this device: compare list, search history, wishlist price snapshots. */

export const COMPARE_KEY = "mk-compare";
export const COMPARE_MAX = 3;
export const SEARCH_KEY = "mk-search-history";
export const SEARCH_MAX = 8;
export const PRICE_KEY = "mk-price-watch";

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try { const v = JSON.parse(window.localStorage.getItem(key) ?? "null"); return v ?? fallback; } catch { return fallback; }
};
const write = (key: string, v: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(v)); window.dispatchEvent(new Event(`${key}:change`)); } catch { /* storage penuh */ }
};

/* ---------- Bandingkan produk ---------- */

/** Toggle an id in the compare list; returns the new list and whether it was rejected for being full. */
export function toggleCompareList(list: string[], id: string, max = COMPARE_MAX): { list: string[]; full: boolean } {
  if (list.includes(id)) return { list: list.filter((x) => x !== id), full: false };
  if (list.length >= max) return { list, full: true };
  return { list: [...list, id], full: false };
}
export const readCompare = () => read<string[]>(COMPARE_KEY, []).filter((x) => typeof x === "string").slice(0, COMPARE_MAX);
export const writeCompare = (ids: string[]) => write(COMPARE_KEY, ids.slice(0, COMPARE_MAX));

/* ---------- Riwayat pencarian ---------- */

/** Newest first, case-insensitive de-duplicate, trimmed, capped. Blank terms are ignored. */
export function pushSearch(list: string[], term: string, max = SEARCH_MAX): string[] {
  const t = term.trim().replace(/\s+/g, " ");
  if (!t) return list;
  return [t, ...list.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, max);
}
export const readSearches = () => read<string[]>(SEARCH_KEY, []).filter((x) => typeof x === "string").slice(0, SEARCH_MAX);
export const rememberSearch = (term: string) => write(SEARCH_KEY, pushSearch(readSearches(), term));
export const removeSearch = (term: string) => write(SEARCH_KEY, readSearches().filter((x) => x !== term));
export const clearSearches = () => write(SEARCH_KEY, []);

/* ---------- Pantau harga wishlist ---------- */

/** Price the buyer first saw for each wishlisted product. */
export type PriceSnap = Record<string, number>;
export const readPriceSnap = () => read<PriceSnap>(PRICE_KEY, {});

/** Store the first-seen price only (later visits must not hide a drop). */
export function snapPrices(snap: PriceSnap, items: { id: string; price: number }[]): PriceSnap {
  const next = { ...snap };
  for (const i of items) if (next[i.id] == null && i.price > 0) next[i.id] = i.price;
  return next;
}
export const savePriceSnap = (s: PriceSnap) => write(PRICE_KEY, s);

/** Drop vs. the saved price: amount and whole percent, or null when not cheaper. */
export function priceDrop(saved: number | undefined, now: number): { amount: number; percent: number } | null {
  if (!saved || now <= 0 || now >= saved) return null;
  return { amount: saved - now, percent: Math.round(((saved - now) / saved) * 100) };
}
