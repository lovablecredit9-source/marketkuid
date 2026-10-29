export type VoucherKind = "diskon" | "diskon_produk" | "bonus";
export type ValueType = "percent" | "nominal";

export const VOUCHER_KINDS: { value: VoucherKind; label: string; desc: string }[] = [
  { value: "diskon", label: "Diskon", desc: "Potongan harga persentase atau nominal" },
  { value: "diskon_produk", label: "Diskon Produk", desc: "Diskon khusus untuk produk tertentu" },
  { value: "bonus", label: "Bonus Pembelian", desc: "Beli minimum tertentu, dapat bonus" },
];

export type VoucherDraft = {
  kind: VoucherKind | "";
  code: string;
  name: string;
  description: string;
  value_type: ValueType;
  value: string;
  max_discount: string;
  usage_limit: string;
  per_user_limit: string;
  min_spend: string;
  min_qty: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export const emptyVoucher = (): VoucherDraft => ({
  kind: "", code: "", name: "", description: "", value_type: "percent", value: "", max_discount: "",
  usage_limit: "", per_user_limit: "1", min_spend: "0", min_qty: "1", starts_at: "", ends_at: "", is_active: true,
});

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

export function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** Returns the error messages for one wizard step (1-5). Empty array = step is valid. */
export function validateVoucherStep(step: number, d: VoucherDraft): string[] {
  const e: string[] = [];
  if (step === 1 && !d.kind) e.push("Pilih tipe promo");
  if (step === 2) {
    if (!/^[A-Z0-9]{3,20}$/.test(d.code)) e.push("Kode promo 3–20 huruf/angka");
    if (!d.name.trim()) e.push("Nama promo wajib diisi");
    if (d.name.trim().length > 60) e.push("Nama promo maksimal 60 karakter");
    if (d.description.length > 200) e.push("Deskripsi maksimal 200 karakter");
  }
  if (step === 3) {
    const v = num(d.value);
    if (!(v > 0)) e.push("Nilai diskon harus lebih dari 0");
    else if (d.value_type === "percent" && v > 100) e.push("Persentase maksimal 100");
    if (d.max_discount.trim() && !(num(d.max_discount) > 0)) e.push("Maks diskon harus lebih dari 0");
  }
  if (step === 4) {
    if (d.usage_limit.trim() && !(Number.isInteger(num(d.usage_limit)) && num(d.usage_limit) > 0)) e.push("Total penggunaan harus angka bulat > 0");
    if (!(Number.isInteger(num(d.per_user_limit)) && num(d.per_user_limit) > 0)) e.push("Batas per user minimal 1");
    if (!(num(d.min_spend) >= 0)) e.push("Min belanja tidak boleh negatif");
    if (!(Number.isInteger(num(d.min_qty)) && num(d.min_qty) >= 1)) e.push("Min qty minimal 1");
    if (d.starts_at && d.ends_at && new Date(d.ends_at) <= new Date(d.starts_at)) e.push("Tanggal selesai harus setelah tanggal mulai");
  }
  return e;
}

export function voucherPayload(d: VoucherDraft) {
  const opt = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    kind: d.kind as VoucherKind,
    code: d.code,
    name: d.name.trim(),
    description: d.description.trim() || null,
    value_type: d.value_type,
    value: Number(d.value),
    max_discount: d.value_type === "percent" ? opt(d.max_discount) : null,
    usage_limit: opt(d.usage_limit),
    per_user_limit: Number(d.per_user_limit),
    min_spend: Number(d.min_spend || "0"),
    min_qty: Number(d.min_qty || "1"),
    starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
    ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
    is_active: d.is_active,
  };
}
