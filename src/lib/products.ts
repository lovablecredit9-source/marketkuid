import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_TYPES = [
  { value: "link", label: "Link — URL / link akses" },
  { value: "code", label: "Code — Kode lisensi / voucher / serial" },
  { value: "email_2fa", label: "Email:Pass:2FA — Akun dengan 2FA" },
  { value: "email_pin", label: "Email:Pass:Profile:Pin — Akun dengan PIN" },
  { value: "file", label: "File / Script — File digital (terenkripsi)" },
  { value: "preorder", label: "Pre Order — Diproses manual oleh seller" },
  { value: "otp", label: "OTP Service — Jual layanan OTP" },
  { value: "gsuite", label: "GSuite Workspace — Auto-provisioning" },
  { value: "custom", label: "Custom — Field bebas (API key, refresh token, dll)" },
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number]["value"];

export const CODE_SUBTYPES = [
  { value: "lisensi", label: "Kode Lisensi" },
  { value: "voucher", label: "Voucher / Kupon" },
  { value: "serial", label: "Serial Number" },
] as const;
export type CodeSubtype = (typeof CODE_SUBTYPES)[number]["value"];
export type StockMode = "normal" | "unlimited" | "reusable";

/** Stock heading, hint and example per product type — mirrors marketku.id. */
export function stockFormat(type: string, customFields: string[] = []): { title: string; hint: string; example: string } {
  switch (type) {
    case "link": return { title: "Stok — Link", hint: "1 link per baris", example: "https://example.com/akses123" };
    case "code": return { title: "Stok — Code", hint: "1 kode per baris", example: "ABCD-1234-EFGH" };
    case "email_2fa": return { title: "Stok — Email:Pass:2FA", hint: "Format: email:password:2fa (1 akun per baris)", example: "email@contoh.com:password123:2fa_secret" };
    case "email_pin": return { title: "Stok — Email:Pass:Profile:Pin", hint: "Format: email:password:profile:pin (1 akun per baris)", example: "email@contoh.com:password123:ProfileName:1234" };
    case "file": return { title: "Upload File Stok", hint: "1 file = 1 stok. Maks 50MB per file.", example: "" };
    case "otp": return { title: "Input Nomor HP — Stok OTP", hint: "1 nomor per baris = 1 stok.", example: "081234567890" };
    case "custom": {
      const f = customFields.filter((x) => x.trim());
      return { title: "Stok — Custom Field", hint: "1 stok per baris, pisahkan tiap field dengan |", example: f.length ? f.map((x) => x.trim()).join("|") : "value1|value2|value3" };
    }
    default: return { title: "Stok", hint: "1 stok per baris", example: "isi stok" };
  }
}

export type WarrantyMode = "hari" | "login" | "backfree";
export type Warranty = { mode: WarrantyMode; days: number | null; max_claims: number };
export type Discount = { min_order: number; kind: "reguler" | "bulk"; percent: number; max_per_user: number };
export type Bonus = { buy: number; get: number };

export type VariantDraft = {
  id?: string;
  name: string;
  image_url: string | null;
  price: string;
  lifetime: boolean;
  duration_value: string;
  duration_unit: "hari" | "bulan" | "tahun";
  warranty: Warranty | null;
  discount: Discount | null;
  bonus: Bonus | null;
  quota: string;
  stock: string;
};

export const emptyVariant = (): VariantDraft => ({
  name: "", image_url: null, price: "", lifetime: false, duration_value: "", duration_unit: "hari",
  warranty: null, discount: null, bonus: null, quota: "", stock: "",
});

export const digits = (s: string) => s.replace(/\D/g, "");
export const parsePrice = (s: string) => Number(digits(s) || "0");
export const fmtThousands = (s: string) => {
  const d = digits(s);
  return d ? Number(d).toLocaleString("id-ID") : "";
};
export const rp = (n: number) => `Rp. ${n.toLocaleString("id-ID")},-`;

export const MAX_PHOTOS = 6;

export type InfoDraft = { name: string; type: ProductType | ""; category_id: string | null };

export function validateInfo(info: InfoDraft): string[] {
  const errs: string[] = [];
  const n = info.name.trim();
  if (n.length < 3) errs.push("Nama produk minimal 3 karakter");
  if (n.length > 120) errs.push("Nama produk maksimal 120 karakter");
  if (!info.type) errs.push("Pilih jenis produk");
  if (!info.category_id) errs.push("Pilih kategori produk");
  return errs;
}

export function validateDetail(contact: string, estimate: string, needEstimate = true): string[] {
  const errs: string[] = [];
  if (contact.trim().length < 3) errs.push("Kontak seller wajib diisi");
  if (needEstimate && estimate.trim().length < 2) errs.push("Estimasi durasi wajib diisi");
  return errs;
}

/** One message per incomplete variant, e.g. "Varian 2: durasi dan harga belum diisi". */
export function validateVariants(vs: VariantDraft[]): string[] {
  if (vs.length === 0) return ["Tambahkan minimal satu varian"];
  const errs: string[] = [];
  vs.forEach((v, i) => {
    const missing: string[] = [];
    if (!v.name.trim()) missing.push("nama");
    const noDuration = !v.lifetime && !(Number(digits(v.duration_value)) > 0);
    const noPrice = !(parsePrice(v.price) > 0);
    if (noDuration) missing.push("durasi");
    if (noPrice) missing.push("harga");
    if (missing.length) {
      const text = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} dan ${missing[missing.length - 1]}`;
      errs.push(`Varian ${i + 1}: ${text} belum diisi`);
    }
  });
  return errs;
}

/** Each non-empty line in the stock box is one stock item. */
export const stockLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function warrantyLabel(w: Warranty) {
  if (w.mode === "login") return "Garansi Login";
  if (w.mode === "backfree") return `Garansi Backfree ${w.days ?? 0} Hari`;
  return `Garansi ${w.days ?? 0} Hari`;
}

export function priceRange(prices: number[]) {
  if (!prices.length) return rp(0);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  return lo === hi ? rp(lo) : `${rp(lo)} – ${rp(hi)}`;
}

export type CategoryRow = { id: string; name: string; sort: number; parent_id: string | null };

export function useCategories() {
  return useQuery({
    queryKey: ["product_categories"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase.from("product_categories").select("id, name, sort, parent_id").order("sort");
      if (error) throw error;
      return data;
    },
  });
}

/** Direct sub-categories of `parent` (null = top level), alphabetically like the original picker. */
export function childCategories(cats: CategoryRow[], parent: string | null) {
  return cats.filter((c) => (c.parent_id ?? null) === parent).sort((a, b) => a.name.localeCompare(b.name, "id"));
}

/** The category plus every category nested under it. */
export function descendantIds(cats: Pick<CategoryRow, "id" | "parent_id">[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const c of cats) if (c.parent_id === out[i] && !out.includes(c.id)) out.push(c.id);
  return out;
}

/** Top-down chain of categories from the root to `id`, e.g. [Aplikasi, App Premium, Canva]. */
export function categoryPath(cats: CategoryRow[], id: string | null): CategoryRow[] {
  const path: CategoryRow[] = [];
  let cur = id ? cats.find((c) => c.id === id) : undefined;
  while (cur && path.length < 10) { path.unshift(cur); cur = cur.parent_id ? cats.find((c) => c.id === cur!.parent_id) : undefined; }
  return path;
}

export function useCategoryCounts() {
  return useQuery({
    queryKey: ["category_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("category_id").eq("status", "active");
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const r of data) if (r.category_id) m[r.category_id] = (m[r.category_id] ?? 0) + 1;
      return m;
    },
  });
}

export function useMyProducts(userId: string | undefined) {
  return useQuery({
    queryKey: ["my_products", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_variants(id, name, price, lifetime, duration_value, duration_unit, sort), product_stock(status)")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
export type MyProduct = NonNullable<ReturnType<typeof useMyProducts>["data"]>[number];

/** Product images live in a private bucket; resolve paths to short-lived URLs. */
export function useImageUrls(paths: string[]) {
  const key = paths.filter(Boolean);
  return useQuery({
    queryKey: ["img_urls", key],
    enabled: key.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("product-images").createSignedUrls(key, 3600);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of data) if (r.path && r.signedUrl) m[r.path] = r.signedUrl;
      return m;
    },
  });
}

export async function uploadProductImage(userId: string, file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Format harus JPG, PNG, atau WebP");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB");
  const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

/** Store logo / banner go to the same private bucket under `<owner>/store/`. */
export async function uploadStoreImage(userId: string, file: File, kind: "avatar" | "banner") {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Format harus JPG, PNG, atau WebP");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB");
  const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const path = `${userId}/store/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

/** Public logo/banner paths for stores (seller_stores itself is owner-only). */
export function useStoreMedia(ownerIds: string[]) {
  const ids = ownerIds.filter(Boolean);
  return useQuery({
    queryKey: ["store_media", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("store_media", { p_ids: ids });
      if (error) throw error;
      const m: Record<string, { avatar_path: string | null; banner_path: string | null }> = {};
      for (const r of data ?? []) m[r.owner_id] = { avatar_path: r.avatar_path, banner_path: r.banner_path };
      return m;
    },
  });
}

/** File/Script stock: each uploaded file is one stock item stored as `file:<path>`. */
export const FILE_STOCK_PREFIX = "file:";
export const isFileStock = (s: string) => s.startsWith(FILE_STOCK_PREFIX);
export const fileStockName = (s: string) => s.slice(FILE_STOCK_PREFIX.length).split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "") ?? "file";

export async function uploadStockFile(userId: string, file: File) {
  if (file.size > 50 * 1024 * 1024) throw new Error("Ukuran file maksimal 50MB");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
  const path = `${userId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("product-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  return `${FILE_STOCK_PREFIX}${path}`;
}

export async function downloadStockFile(content: string) {
  const path = content.slice(FILE_STOCK_PREFIX.length);
  const { data, error } = await supabase.storage.from("product-files").createSignedUrl(path, 300, { download: fileStockName(content) });
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}
