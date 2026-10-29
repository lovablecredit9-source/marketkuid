export const MIN_DAILY_BUDGET = 5000;

/** Validation for the seller "Buat Iklan" form; empty array means valid. */
export function validateCampaign(d: { name: string; product_id: string; budget: number; starts_at: string; ends_at: string }) {
  const e: string[] = [];
  const n = d.name.trim();
  if (n.length < 3 || n.length > 60) e.push("Nama campaign 3–60 karakter");
  if (!d.product_id) e.push("Pilih produk yang diiklankan");
  if (!(d.budget >= MIN_DAILY_BUDGET)) e.push(`Anggaran harian minimal Rp${MIN_DAILY_BUDGET.toLocaleString("id-ID")}`);
  if (d.starts_at && d.ends_at && d.ends_at < d.starts_at) e.push("Tanggal selesai harus setelah tanggal mulai");
  return e;
}
