export type Guide = { slug: string; title: string; summary: string; steps: string[] };

export const GUIDES: Guide[] = [
  { slug: "memulai", title: "Memulai sebagai seller", summary: "Langkah awal membuka dan menyiapkan toko.", steps: [
    "Lengkapi Profil Toko: nama, slug, dan deskripsi di Pengaturan.", "Daftarkan rekening pencairan di tab Keuangan.", "Tambah produk pertama di menu Produk Saya.", "Isi stok untuk setiap varian agar produk bisa dibeli."] },
  { slug: "produk", title: "Kelola produk & stok", summary: "Membuat produk, varian, dan mengisi stok digital.", steps: [
    "Buka Produk Saya lalu tekan Tambah Produk Baru.", "Isi nama, kategori, gambar, dan deskripsi.", "Tambahkan varian dengan harga masing-masing.", "Masukkan stok akun/kode per varian; stok tidak terlihat pembeli."] },
  { slug: "voucher", title: "Membuat promo voucher", summary: "Buat kode promo untuk menarik pembeli.", steps: [
    "Buka menu Voucher lalu tekan Buat Promo.", "Pilih tipe promo dan isi kode serta nama.", "Atur nilai diskon, batas penggunaan, dan periode.", "Periksa ringkasan lalu simpan."] },
  { slug: "withdraw", title: "Menarik saldo", summary: "Cara mencairkan saldo penjualan.", steps: [
    "Pastikan rekening sudah terdaftar di Pengaturan → Keuangan.", "Saldo minimal Rp50.000 untuk ditarik.", "Tekan Tarik Dana di halaman Withdraw.", "Permintaan diproses admin dan dana dikirim ke rekening."] },
  { slug: "garansi", title: "Menangani klaim garansi", summary: "Memproses klaim garansi dari pembeli.", steps: [
    "Pantau klaim masuk di menu Garansi.", "Periksa bukti dan detail masalah dari pembeli.", "Setujui untuk mengirim pengganti, atau tolak dengan alasan jelas."] },
];

export const findGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);
