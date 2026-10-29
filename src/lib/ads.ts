export const MIN_DAILY_BUDGET = 5000;
/** Price of one sponsored slot per day (same value the create_ad_campaign function charges). */
export const AD_PRICE_PER_DAY = 5000;
export const AD_MIN_DAYS = 1;
export const AD_MAX_DAYS = 90;
export const AD_MAX_KEYWORDS = 10;
export const AD_MIN_TOPUP = 5000;

/** Legacy validation for the old "Buat Iklan" form; empty array means valid. */
export function validateCampaign(d: { name: string; product_id: string; budget: number; starts_at: string; ends_at: string }) {
  const e: string[] = [];
  const n = d.name.trim();
  if (n.length < 3 || n.length > 60) e.push("Nama campaign 3–60 karakter");
  if (!d.product_id) e.push("Pilih produk yang diiklankan");
  if (!(d.budget >= MIN_DAILY_BUDGET)) e.push(`Anggaran harian minimal Rp${MIN_DAILY_BUDGET.toLocaleString("id-ID")}`);
  if (d.starts_at && d.ends_at && d.ends_at < d.starts_at) e.push("Tanggal selesai harus setelah tanggal mulai");
  return e;
}

/** "netflix, Akun Premium ,netflix" → ["netflix", "akun premium"] (lowercase, unique, 2–40 chars). */
export function parseKeywords(s: string) {
  const out: string[] = [];
  for (const k of s.split(",").map((x) => x.trim().toLowerCase())) {
    if (k.length >= 2 && k.length <= 40 && !out.includes(k)) out.push(k);
  }
  return out;
}

export const adCost = (days: number) => Math.max(0, Math.floor(days)) * AD_PRICE_PER_DAY;

export type MatchMode = "persis" | "frasa";
/** Same rule as sponsored_products: "persis" = whole query equals a keyword, "frasa" = keyword appears in the query. */
export function adMatches(query: string, keywords: string[], mode: MatchMode) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return mode === "persis" ? keywords.includes(q) : keywords.some((k) => q.includes(k));
}

/** Validation for the "Buat Iklan" form; empty array means valid. */
export function validateAd(d: { product_id: string; keywords: string[]; days: number; balance: number }) {
  const e: string[] = [];
  if (!d.product_id) e.push("Pilih produk yang mau diiklankan");
  if (!d.keywords.length) e.push("Isi minimal 1 kata kunci");
  if (d.keywords.length > AD_MAX_KEYWORDS) e.push(`Maksimal ${AD_MAX_KEYWORDS} kata kunci`);
  if (!Number.isInteger(d.days) || d.days < AD_MIN_DAYS || d.days > AD_MAX_DAYS) e.push(`Durasi ${AD_MIN_DAYS} sampai ${AD_MAX_DAYS} hari`);
  else if (d.balance < adCost(d.days)) e.push("Saldo iklan belum cukup");
  return e;
}

export const AD_STATUS: Record<string, string> = {
  menunggu_saldo: "Menunggu", menunggu: "Menunggu", aktif: "Aktif", dijeda: "Dijeda", selesai: "Selesai", dibatalkan: "Dibatalkan",
};
export const AD_FILTERS = [
  { value: "semua", label: "Semua", statuses: [] as string[] },
  { value: "aktif", label: "Aktif", statuses: ["aktif"] },
  { value: "menunggu", label: "Menunggu", statuses: ["menunggu", "menunggu_saldo", "dijeda"] },
  { value: "selesai", label: "Selesai", statuses: ["selesai"] },
  { value: "dibatalkan", label: "Dibatalkan", statuses: ["dibatalkan"] },
] as const;
