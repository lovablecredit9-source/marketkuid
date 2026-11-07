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

/* ---------- Filter cepat pencarian ---------- */

export type QuickFilter = { inStock: boolean; onSale: boolean };
/** Keep products that have stock and/or are cheaper than their normal price. */
export function quickFilter<T extends { stock: number; minPrice: number; basePrice: number }>(list: T[], f: QuickFilter): T[] {
  return list.filter((p) => (!f.inStock || p.stock > 0) && (!f.onSale || (p.basePrice > 0 && p.minPrice < p.basePrice)));
}

/* ---------- Ringkasan belanja ---------- */

export const PAID_STATUSES = ["paid", "processing", "completed"];
/** Spending from paid orders: this calendar month and all time. Unpaid/cancelled orders are ignored. */
export function spendSummary(orders: { status: string; total: number | string; created_at: string }[], now = new Date()) {
  let month = 0, monthCount = 0, all = 0, allCount = 0;
  for (const o of orders) {
    if (!PAID_STATUSES.includes(o.status)) continue;
    const t = Number(o.total) || 0;
    all += t; allCount++;
    const d = new Date(o.created_at);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) { month += t; monthCount++; }
  }
  return { month, monthCount, all, allCount };
}

/* ---------- Ingatkan saat stok tersedia ---------- */

export const RESTOCK_KEY = "mk-restock-watch";
export const RESTOCK_MAX = 20;
/** Toggle a sold-out product in the restock reminder list (newest first, capped). */
export function toggleRestock(list: string[], id: string, max = RESTOCK_MAX): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list].slice(0, max);
}
export const readRestock = () => read<string[]>(RESTOCK_KEY, []).filter((x) => typeof x === "string").slice(0, RESTOCK_MAX);
export const writeRestock = (ids: string[]) => write(RESTOCK_KEY, ids.slice(0, RESTOCK_MAX));
/** Watched products that have stock again. */
export function restocked<T extends { id: string; stock: number }>(watch: string[], products: T[]): T[] {
  return products.filter((p) => watch.includes(p.id) && p.stock > 0);
}

/* ---------- Catatan cepat checkout ---------- */

export const NOTE_KEY = "mk-note-templates";
export const NOTE_MAX = 5;
/** Remember a checkout note (newest first, de-duplicated, 3–200 chars, capped). */
export function pushNote(list: string[], note: string, max = NOTE_MAX): string[] {
  const t = note.trim().replace(/\s+/g, " ");
  if (t.length < 3 || t.length > 200) return list;
  return [t, ...list.filter((x) => x !== t)].slice(0, max);
}
export const readNotes = () => read<string[]>(NOTE_KEY, []).filter((x) => typeof x === "string").slice(0, NOTE_MAX);
export const rememberNote = (note: string) => write(NOTE_KEY, pushNote(readNotes(), note));
export const removeNote = (note: string) => write(NOTE_KEY, readNotes().filter((x) => x !== note));

/* ---------- Unduh riwayat pesanan ---------- */

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV of the buyer's own orders (one row per order). */
export function ordersCsv(orders: { order_no: number | string; created_at: string; store_name: string | null; status: string; total: number | string; order_items: { product_name: string; qty: number }[] }[], label: (s: string) => string = (s) => s): string {
  const head = ["No Pesanan", "Tanggal", "Toko", "Produk", "Status", "Total"];
  const rows = orders.map((o) => [
    `M-${o.order_no}`, o.created_at.slice(0, 10), o.store_name ?? "-",
    o.order_items.map((i) => `${i.product_name} x${i.qty}`).join("; "), label(o.status), Number(o.total) || 0,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
