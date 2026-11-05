// Checklist "Siapkan toko kamu" di Dasbor Seller — 3 langkah wajib + 1 opsional.
export const SELLER_WA_ADMIN = "https://wa.me/6285769302532";
export const SELLER_WA_GROUP = "https://wa.me/6285769302532?text=" + encodeURIComponent("Halo admin, saya seller baru Marketku dan ingin gabung grup seller.");

type StoreLike = { description: string | null; avatar_path: string | null; bank_number: string | null };
export type SetupKey = "profil" | "bank" | "produk" | "bot";
export type SetupStep = { key: SetupKey; title: string; desc: string; done: boolean; optional?: boolean };

export function storeSetupSteps({ store, hasProduct, botCount }: { store: StoreLike; hasProduct: boolean; botCount: number }): SetupStep[] {
  return [
    { key: "profil", title: "Lengkapi profil toko", desc: "Nama, logo, dan deskripsi toko tampil di halaman toko.", done: !!store.avatar_path && !!store.description?.trim() },
    { key: "bank", title: "Isi rekening pencairan", desc: "Dibutuhkan agar saldo penjualan bisa ditarik.", done: !!store.bank_number?.trim() },
    { key: "produk", title: "Tambah produk pertama", desc: "Produk aktif langsung bisa dibeli di Marketku.", done: hasProduct },
    { key: "bot", title: "Hubungkan bot Telegram", desc: "Opsional. Jual juga lewat bot milik toko.", done: botCount > 0, optional: true },
  ];
}
