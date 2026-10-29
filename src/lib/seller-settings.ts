export function slugify(s: string, keepTrailingDash = false) {
  const out = s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-").slice(0, 40);
  return keepTrailingDash ? out : out.replace(/^-+|-+$/g, "");
}

export function validateStoreProfile(f: { store_name: string; slug: string; description: string; contact_phone: string; telegram_username: string }): string[] {
  const e: string[] = [];
  const n = f.store_name.trim();
  if (n.length < 3 || n.length > 40) e.push("Nama toko 3–40 karakter");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug) || f.slug.length < 3) e.push("Slug toko minimal 3 karakter: huruf kecil, angka, dan tanda -");
  if (f.description.length > 500) e.push("Deskripsi maksimal 500 karakter");
  if (f.contact_phone && !/^628\d{7,12}$/.test(f.contact_phone)) e.push("Nomor WhatsApp harus diawali 628");
  const tg = f.telegram_username.replace(/^@/, "");
  if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) e.push("Username Telegram 5–32 karakter (huruf, angka, _)");
  return e;
}

export function passwordRules(old: string, next: string, confirm: string) {
  return [
    { label: "Minimal 8 karakter", ok: next.length >= 8 },
    { label: "Huruf besar & kecil", ok: /[a-z]/.test(next) && /[A-Z]/.test(next) },
    { label: "Mengandung angka", ok: /\d/.test(next) },
    { label: "Mengandung simbol", ok: /[^A-Za-z0-9]/.test(next) },
    { label: "Konfirmasi cocok", ok: next.length > 0 && next === confirm },
    { label: "Beda dari password lama", ok: next.length > 0 && next !== old },
  ];
}

export function validateBank(f: { provider: string; number: string; holder: string }): string[] {
  const e: string[] = [];
  if (!f.provider) e.push("Pilih bank / provider");
  if (!/^\d{8,20}$/.test(f.number)) e.push("Nomor rekening 8–20 digit");
  if (f.holder.trim().length < 3) e.push("Nama pemilik rekening wajib diisi");
  return e;
}
