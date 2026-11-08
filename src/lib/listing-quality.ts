// Listing quality score for the product upload wizard: tells sellers what makes a listing clearer.
export type ListingInput = {
  name: string;
  description: string;
  photos: number;
  hasCategory: boolean;
  pricedVariants: number;
  stockCount: number;
  unlimitedStock: boolean;
  hasGuide: boolean;
};

export type QualityItem = { key: string; label: string; done: boolean; weight: number };

export function listingChecklist(i: ListingInput): QualityItem[] {
  const name = i.name.trim();
  return [
    { key: "name", label: "Nama produk jelas (minimal 10 huruf)", done: name.length >= 10, weight: 20 },
    { key: "desc", label: "Deskripsi minimal 60 huruf", done: i.description.trim().length >= 60, weight: 20 },
    { key: "photos", label: "Minimal 3 foto produk", done: i.photos >= 3, weight: 20 },
    { key: "category", label: "Kategori dipilih", done: i.hasCategory, weight: 10 },
    { key: "price", label: "Semua varian punya harga", done: i.pricedVariants > 0, weight: 15 },
    { key: "stock", label: "Stok siap dijual", done: i.unlimitedStock || i.stockCount > 0, weight: 10 },
    { key: "guide", label: "Panduan penggunaan", done: i.hasGuide, weight: 5 },
  ];
}

export function listingScore(i: ListingInput): number {
  return listingChecklist(i).reduce((s, it) => s + (it.done ? it.weight : 0), 0);
}

export function scoreTone(score: number): { label: string; tone: "low" | "mid" | "high" } {
  if (score >= 80) return { label: "Sangat baik", tone: "high" };
  if (score >= 50) return { label: "Cukup", tone: "mid" };
  return { label: "Perlu dilengkapi", tone: "low" };
}

/** Move an item inside a list (used to reorder product photos). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it as T);
  return next;
}
