export type Block =
  | { h: string }
  | { p: string }
  | { ol: string[] }
  | { ul: string[] }
  | { code: string }
  | { table: { head: string[]; rows: string[][] } }
  | { tip: string }
  | { warn: string };

export type Guide = { slug: string; title: string; category: string; body: Block[] };
export type GuideCategory = { key: string; title: string; icon: "sparkles" | "bot" | "box" | "bag" | "wallet" | "percent" | "cloud" | "settings" | "help"; tone: string };

export const CATEGORIES: GuideCategory[] = [
  { key: "memulai", title: "Memulai", icon: "sparkles", tone: "text-warning bg-warning/15" },
  { key: "bot", title: "Bot Telegram", icon: "bot", tone: "text-primary bg-primary/15" },
  { key: "produk", title: "Manajemen Produk", icon: "box", tone: "text-success bg-success/15" },
  { key: "transaksi", title: "Transaksi & Order", icon: "bag", tone: "text-tone-purple bg-tone-purple/15" },
  { key: "keuangan", title: "Withdraw & Keuangan", icon: "wallet", tone: "text-success bg-success/15" },
  { key: "promo", title: "Promo & Diskon", icon: "percent", tone: "text-tone-pink bg-tone-pink/15" },
  { key: "workspace", title: "Workspace (Google)", icon: "cloud", tone: "text-tone-cyan bg-tone-cyan/15" },
  { key: "pengaturan", title: "Pengaturan Toko", icon: "settings", tone: "text-muted-foreground bg-muted" },
  { key: "tips", title: "Tips & FAQ", icon: "help", tone: "text-warning bg-warning/15" },
];

export const GUIDES: Guide[] = [
  { slug: "apa-itu-marketku", category: "memulai", title: "Apa itu Marketku?", body: [
    { p: "Marketku adalah platform marketplace digital berbasis web dan Bot Telegram yang memungkinkan kamu menjual produk digital secara otomatis 24/7." },
    { h: "Keunggulan:" },
    { ul: ["Bot Telegram — Pembeli bertransaksi langsung via bot, tanpa perlu website", "Pengiriman Otomatis — Stok dikirim otomatis setelah pembayaran terverifikasi", "QRIS Auto-Detect — Pembayaran QRIS terdeteksi otomatis via webhook", "Escrow System — Dana ditahan hingga pembeli konfirmasi, aman untuk semua pihak", "Dashboard Analytics — Pantau penjualan real-time dari panel seller"] },
    { h: "Alur Kerja:" },
    { ol: ["Anda daftar & setup toko", "Hubungkan bot Telegram", "Tambah produk & stok", "Pembeli beli via bot → bayar QRIS → stok terkirim otomatis", "Dana masuk ke saldo → withdraw ke rekening"] },
  ] },
  { slug: "langkah-pertama", category: "memulai", title: "Langkah Pertama Setup Toko", body: [
    { p: "Setelah mendaftar, ikuti 5 langkah ini untuk mulai jualan:" },
    { h: "Langkah 1: Lengkapi Profil Toko" }, { p: "Buka menu Pengaturan → isi nama toko, deskripsi, dan upload avatar." },
    { h: "Langkah 2: Tambah Rekening Bank" }, { p: "Di Pengaturan → bagian \"Keuangan\", tambahkan nama bank, nomor rekening, dan nama pemilik. Ini dibutuhkan untuk withdraw." },
    { h: "Langkah 3: Hubungkan Bot Telegram" }, { p: "Buka menu Bot Telegram → klik \"Hubungkan Bot\" → masukkan token bot dari @BotFather di Telegram." },
    { h: "Langkah 4: Tambah Produk" }, { p: "Buka menu Produk → klik \"Tambah Produk Baru\" → isi nama, harga, deskripsi, pilih kategori." },
    { h: "Langkah 5: Isi Stok" }, { p: "Buka tab Stok pada produk → masukkan stok satu per baris. Produk siap dijual!" },
  ] },
  { slug: "jenis-produk", category: "memulai", title: "Jenis Produk yang Bisa Dijual", body: [
    { p: "Marketku mendukung berbagai jenis produk digital:" },
    { h: "1. Produk Instan (Auto-Send)" }, { p: "Stok dikirim langsung setelah pembayaran. Cocok untuk:" },
    { ul: ["Game voucher (top-up game)", "Akun streaming (Netflix, Spotify, dll)", "License key software", "Voucher belanja"] },
    { h: "2. Produk Sewa (Rental)" }, { p: "Akun yang disewa dengan durasi tertentu. Durasi bisa dikustomisasi, harga berbeda per durasi, dan otomatis expired setelah masa sewa habis." },
    { h: "3. Produk Manual / Pre-order" }, { p: "Produk yang perlu pengiriman manual oleh seller: jasa custom, produk non-standar, pre-order items." },
    { h: "Tipe Stok:" },
    { table: { head: ["Tipe", "Format", "Contoh"], rows: [["Account", "email|password", "user@mail.com|pass123"], ["Account + Info", "email|password|info", "user@mail.com|pass|Profil 1"], ["Code/Key", "Teks bebas", "XXXX-YYYY-ZZZZ"], ["Link", "URL", "https://example.com"]] } },
  ] },
  { slug: "membuat-bot", category: "bot", title: "Membuat Bot di Telegram", body: [
    { h: "Langkah Membuat Bot Telegram:" },
    { ol: ["Buka @BotFather di Telegram (t.me/BotFather)", "Kirim perintah /newbot", "Beri nama bot — nama tampilan, contoh: Toko Digital Saya", "Beri username bot — harus diakhiri dengan bot, contoh: tokodigitalsaya_bot", "Salin token yang diberikan BotFather", "Paste token di Marketku: menu Bot Telegram → Hubungkan Bot → simpan"] },
    { code: "1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ" },
    { warn: "JANGAN bagikan token ini ke siapapun! Token adalah kunci akses penuh ke bot Anda." },
  ] },
  { slug: "menghubungkan-bot", category: "bot", title: "Menghubungkan Bot ke Marketku", body: [
    { h: "Cara Menghubungkan Bot:" },
    { ol: ["Buka menu Bot Telegram di panel seller", "Klik tombol \"+ Hubungkan Bot\"", "Masukkan Token Bot yang didapat dari @BotFather", "Isi Nama Bot, Username Admin, dan WhatsApp admin (opsional)", "Klik Hubungkan"] },
    { h: "Setelah Terhubung:" },
    { ul: ["Bot akan otomatis aktif dan menerima perintah", "Webhook terpasang otomatis ke server Marketku", "Anda bisa mulai assign produk ke bot ini"] },
    { h: "Troubleshooting:" },
    { table: { head: ["Masalah", "Solusi"], rows: [["\"Token invalid\"", "Pastikan token dari @BotFather, bukan edit-an"], ["Bot tidak merespon", "Cek status \"Active\" di halaman bot"], ["Webhook error", "Klik \"Refresh\" untuk re-setup webhook"]] } },
    { tip: "Anda bisa menghubungkan hingga 5 bot sekaligus, cocok untuk multi-toko." },
  ] },
  { slug: "pengaturan-bot", category: "bot", title: "Pengaturan Bot Lanjutan", body: [
    { h: "Kustomisasi Bot:" },
    { ul: ["Welcome Message — Pesan yang muncul saat user pertama kali membuka bot (mendukung *bold*, _italic_, [teks](url))", "Banner Image — Gambar banner di pesan welcome, rekomendasi 800x400px", "Admin Contacts — Username Telegram yang menerima notifikasi order baru", "Bot Menu — Tombol keyboard: Order, Cek Status, Promo, Bantuan, Link Eksternal"] },
    { h: "Statistik Bot:" }, { ul: ["Jumlah pengguna aktif", "Total order dari bot", "Revenue per bot"] },
  ] },
  { slug: "menambah-produk", category: "produk", title: "Menambah Produk Baru", body: [
    { h: "Cara Menambah Produk:" }, { ol: ["Buka menu Produk → klik \"+ Tambah Produk\"", "Isi form produk lalu klik Simpan"] },
    { table: { head: ["Field", "Keterangan"], rows: [["Nama Produk", "Nama yang tampil di bot (maks 120 karakter)"], ["Deskripsi", "Penjelasan produk, bisa pakai Markdown"], ["Harga", "Harga jual dalam Rupiah"], ["Kategori", "Pilih kategori yang sesuai"], ["Tipe Stok", "Account, Code/Key, atau Link"], ["Status", "Aktif, Draft, atau Nonaktif"]] } },
    { h: "Status Produk:" }, { ul: ["Aktif — Tampil dan bisa dibeli", "Menunggu — Menunggu persetujuan admin", "Ditolak — Ditolak admin (lihat alasan di detail)"] },
    { tip: "Gunakan deskripsi yang jelas dan menarik. Pembeli hanya melihat teks, jadi pastikan informatif." },
  ] },
  { slug: "mengelola-stok", category: "produk", title: "Mengelola Stok", body: [
    { h: "Cara Menambah Stok:" }, { ol: ["Di halaman Produk, buka tab Stok pada produk yang diinginkan", "Masukkan stok baru, satu per baris", "Klik Tambah Stok"] },
    { h: "Format Account:" }, { code: "email1@gmail.com|password1\nemail2@gmail.com|password2" },
    { h: "Format Code/Key:" }, { code: "XXXX-YYYY-ZZZZ-1111\nXXXX-YYYY-ZZZZ-2222" },
    { h: "Informasi Stok:" }, { ul: ["Tersedia: Stok yang siap dijual", "Terjual: Stok yang sudah terkirim ke pembeli", "Total: Semua stok yang pernah ditambahkan"] },
    { warn: "Pastikan stok selalu terisi. Jika stok habis, produk tetap tampil tapi pembeli tidak bisa membeli." },
  ] },
  { slug: "kategori-tampilan", category: "produk", title: "Kategori & Pengaturan Tampilan", body: [
    { h: "Kategori Produk:" }, { p: "Pilih kategori yang sesuai saat membuat produk agar pembeli mudah menemukannya lewat filter kategori." },
    { h: "Tampilan Daftar:" }, { ul: ["Ganti tampilan list atau grid di halaman Produk", "Urutkan berdasarkan terbaru, terlaris, stok tipis, atau harga", "Saring produk berdasarkan status"] },
    { h: "Request Kategori:" }, { p: "Jika kategori yang kamu butuhkan belum ada, hubungi admin untuk mengajukan kategori baru." },
  ] },
  { slug: "alur-order", category: "transaksi", title: "Alur Order dari Pembeli", body: [
    { h: "Alur Transaksi End-to-End:" },
    { code: "1. Pembeli pilih kategori → pilih produk\n2. Pilih metode bayar (QRIS)\n3. Sistem buat order → tampilkan QR code\n4. Pembeli bayar → webhook terima notifikasi\n5. Sistem verifikasi pembayaran\n6. Jika berhasil: stok dikirim, dana masuk escrow\n7. Setelah masa escrow selesai: dana ke saldo seller" },
    { h: "Status Transaksi:" },
    { table: { head: ["Status", "Arti"], rows: [["Pending", "Menunggu pembayaran"], ["Paid", "Pembayaran diterima, sedang proses"], ["Completed", "Stok terkirim, transaksi selesai"], ["Cancelled", "Dibatalkan (timeout/user cancel)"], ["Refunded", "Dana dikembalikan ke pembeli"], ["Failed", "Gagal (stok habis/error sistem)"]] } },
  ] },
  { slug: "sistem-escrow", category: "transaksi", title: "Sistem Escrow", body: [
    { h: "Apa itu Escrow?" }, { p: "Escrow adalah sistem penahanan dana untuk melindungi pembeli dan penjual." },
    { h: "Cara Kerja:" }, { ol: ["Pembeli bayar → Dana masuk ke escrow (ditahan platform)", "Stok terkirim → Status escrow: \"Held\"", "Masa tunggu selesai → Dana di-release ke saldo seller", "Jika ada dispute → Admin review, bisa refund atau release"] },
    { h: "Escrow Status:" }, { ul: ["Held — Dana ditahan, menunggu release", "Released — Dana sudah masuk ke saldo seller", "Refunded — Dana dikembalikan ke pembeli"] },
    { tip: "Masa escrow standar: 24 jam setelah pengiriman. Setelah itu, dana otomatis release." },
  ] },
  { slug: "filter-transaksi", category: "transaksi", title: "Filter & Analisis Transaksi", body: [
    { h: "Summary Cards:" }, { ul: ["Total revenue keseluruhan", "Jumlah refund", "Transaksi pending", "Order hari ini"] },
    { h: "Filter Status:" }, { p: "Semua / Menunggu / Dibayar / Selesai / Dibatalkan / Refund / Gagal" },
    { h: "Detail Transaksi:" }, { ul: ["ID transaksi", "Produk yang dibeli", "Metode pembayaran", "Data stok yang terkirim", "Status escrow", "Timeline pembayaran"] },
  ] },
  { slug: "cara-withdraw", category: "keuangan", title: "Cara Withdraw (Tarik Dana)", body: [
    { h: "Syarat Withdraw:" }, { ul: ["Credits > 0 (untuk membayar biaya platform)", "Rekening bank sudah diisi di Pengaturan", "Tidak ada withdraw yang masih pending"] },
    { h: "Cara Withdraw:" }, { ol: ["Buka menu Withdraw", "Lihat saldo tersedia (Saldo Penjualan bisa ditarik, Saldo Tertahan masih dalam escrow)", "Klik \"Tarik Dana\"", "Konfirmasi rekening tujuan", "Klik Submit"] },
    { code: "Submit → Admin Review → Approved/Rejected" },
    { table: { head: ["Status", "Arti"], rows: [["Pending", "Menunggu review admin"], ["Approved", "Disetujui, dana sedang ditransfer"], ["Rejected", "Ditolak (lihat alasan)"]] } },
    { tip: "Proses withdraw biasanya 1x24 jam kerja. Minimum saldo Rp50.000." },
  ] },
  { slug: "finance-ledger", category: "keuangan", title: "Memahami Finance Ledger", body: [
    { p: "Halaman Withdraw menampilkan ledger lengkap semua transaksi keuangan Anda." },
    { table: { head: ["Tipe", "Keterangan"], rows: [["payment_in", "Dana masuk dari penjualan"], ["escrow_release", "Dana di-release dari escrow ke saldo"], ["commission_deduct", "Potongan komisi platform"], ["markup_deduct", "Potongan markup (jika ada)"], ["withdraw_request", "Pengajuan withdraw"], ["withdraw_approved", "Withdraw disetujui"], ["withdraw_rejected", "Withdraw ditolak"], ["manual_adjustment", "Penyesuaian manual oleh admin"]] } },
    { h: "Membaca Ledger:" }, { ul: ["Angka hijau (+) = dana masuk", "Angka merah (-) = dana keluar", "Klik baris ledger untuk melihat detail"] },
    { tip: "Cek ledger secara berkala untuk memastikan semua transaksi tercatat dengan benar." },
  ] },
  { slug: "kode-promo", category: "promo", title: "Membuat Kode Promo", body: [
    { h: "Jenis Promo yang Tersedia:" },
    { table: { head: ["Tipe", "Keterangan", "Contoh"], rows: [["Diskon", "Potongan harga (% atau nominal)", "Diskon 10%"], ["Diskon Produk", "Diskon khusus produk tertentu", "Produk X diskon 20%"], ["Bonus Pembelian", "Bonus saat beli minimum tertentu", "Beli 2 gratis 1"]] } },
    { h: "Cara Membuat Promo:" }, { ol: ["Buka menu Voucher → klik \"+ Buat Promo\"", "Pilih tipe, isi kode unik (contoh: DISKON10) dan nama", "Atur nilai diskon, batas pemakaian, dan periode berlaku", "Klik Buat Promo"] },
    { h: "Mengelola Promo:" }, { ul: ["Toggle aktif/nonaktif dengan switch", "Copy kode promo untuk dibagikan", "Edit atau hapus promo yang sudah ada"] },
    { tip: "Bagikan kode promo di media sosial atau grup Telegram untuk menarik pembeli baru." },
  ] },
  { slug: "google-workspace", category: "workspace", title: "Setup Google Workspace", body: [
    { h: "Apa itu Workspace?" }, { p: "Fitur Workspace digunakan untuk mengelola akun Google Workspace yang dijual sebagai produk rental." },
    { h: "Cara Setup:" }, { ol: ["Buka menu Workspace", "Klik \"+ Tambah Profil\"", "Isi nama profil dan upload JSON credentials dari Google Console", "Klik Verifikasi lalu Simpan"] },
    { table: { head: ["Status", "Arti"], rows: [["Active", "Akun aktif dan bisa digunakan"], ["Suspended", "Akun di-suspend, perlu tindakan"], ["Grace", "Dalam masa grace period"], ["Deleted", "Akun sudah dihapus"]] } },
    { warn: "Fitur ini hanya untuk seller yang menjual akun Google Workspace. Jika tidak menjual produk ini, abaikan menu ini." },
  ] },
  { slug: "profil-toko", category: "pengaturan", title: "Profil Toko", body: [
    { h: "Mengatur Profil Toko:" }, { p: "Buka menu Pengaturan untuk mengelola:" },
    { ul: ["Nama Toko — tampil di bot dan dashboard. Pilih nama yang mudah diingat", "Avatar Toko — rekomendasi 200x200px", "Deskripsi Toko — tampil di profil bot"] },
    { h: "Rekening Bank:" }, { ul: ["Nama Bank: BCA, BRI, Mandiri, dll", "Nomor Rekening", "Nama Pemilik sesuai buku rekening"] },
    { warn: "Pastikan data rekening benar! Kesalahan data bisa menyebabkan withdraw gagal." },
  ] },
  { slug: "payment-gateway", category: "pengaturan", title: "Payment Gateway Setup", body: [
    { p: "Payment gateway memungkinkan pembeli membayar otomatis via QRIS ke merchant pribadimu." },
    { table: { head: ["Provider", "Tipe", "Fitur"], rows: [["KlikQRIS", "QRIS Auto", "Webhook auto-detect pembayaran"]] } },
    { h: "Cara Setup KlikQRIS:" }, { ol: ["Daftar di KlikQRIS", "Dapatkan API Key dan Merchant ID", "Di Marketku, buka Kontrol Pembayaran → Tambah Gateway", "Masukkan API Key dan Merchant ID", "Ajukan persetujuan admin"] },
    { code: "Pilih QRIS → Sistem generate QR unik → scan & bayar → KlikQRIS kirim webhook → verifikasi → stok terkirim otomatis" },
    { tip: "Kode Unik: sistem menambahkan kode unik (1-99 rupiah) di nominal untuk mengidentifikasi pembayaran. Contoh: Rp 50.000 → Rp 50.037." },
  ] },
  { slug: "keamanan-akun", category: "pengaturan", title: "Keamanan Akun", body: [
    { h: "Ubah Password:" }, { ol: ["Buka Pengaturan → tab Keamanan", "Masukkan password lama", "Masukkan password baru (min 8 karakter, kombinasi huruf + angka + simbol)", "Konfirmasi password baru lalu simpan"] },
    { h: "Tips Keamanan:" }, { ul: ["Gunakan password yang kuat", "Ganti password secara berkala", "Jangan bagikan token bot ke siapapun", "Cek daftar sesi jika ada aktivitas mencurigakan"] },
    { h: "Jika Lupa Password:" }, { ol: ["Di halaman login, klik \"Lupa Kata Sandi\"", "Masukkan email terdaftar", "Ikuti instruksi yang dikirim ke email"] },
  ] },
  { slug: "tips-sukses", category: "tips", title: "Tips Sukses Jualan", body: [
    { h: "10 Tips Sukses di Marketku:" },
    { ol: ["Nama produk yang jelas — \"Netflix Premium 1 Bulan\" bukan \"NF 1M\"", "Deskripsi lengkap — Jelaskan apa yang didapat pembeli", "Stok selalu terisi — Cek stok minimal 2x sehari", "Harga kompetitif — Riset harga kompetitor", "Respon cepat — Aktifkan notifikasi order masuk", "Gunakan promo — Buat promo untuk pembeli pertama", "Multi-bot — Buat bot terpisah per kategori produk", "Kualitas stok — Pastikan semua akun/voucher valid", "Update rutin — Tambah produk baru secara berkala", "Minta review — Pembeli puas = kredibilitas naik"] },
    { h: "Mengoptimalkan Penjualan:" }, { ul: ["Promosikan toko di grup Telegram & media sosial", "Manfaatkan fitur promo untuk campaign", "Pantau analytics untuk tahu produk terlaris"] },
  ] },
  { slug: "faq", category: "tips", title: "FAQ (Pertanyaan Umum)", body: [
    { h: "Berapa biaya platform?" }, { p: "Marketku menggunakan sistem komisi per transaksi. Persentase komisi bisa berbeda tergantung kebijakan admin." },
    { h: "Berapa lama proses withdraw?" }, { p: "Proses withdraw maksimal 1x24 jam kerja setelah disetujui admin." },
    { h: "Bisa jualan apa saja?" }, { p: "Selama produk digital dan legal, Anda bisa menjualnya. Produk ilegal, berbahaya, atau melanggar hukum akan ditolak." },
    { h: "Apa yang terjadi jika stok habis?" }, { p: "Produk tetap tampil tapi pembeli tidak bisa membeli. Anda akan mendapat notifikasi untuk mengisi stok." },
    { h: "Bagaimana jika pembeli komplain?" }, { p: "Sistem dispute tersedia. Pembeli bisa mengajukan komplain, admin akan review, dan dana escrow bisa di-refund atau di-release." },
    { h: "Bisa punya lebih dari 1 bot?" }, { p: "Ya! Anda bisa menghubungkan hingga 5 bot Telegram per akun seller." },
    { h: "Butuh bantuan?" }, { p: "Hubungi admin via Telegram atau email support untuk pertanyaan lebih lanjut." },
  ] },
];

export const findGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);
export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key);
export function searchGuides(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return GUIDES;
  return GUIDES.filter((g) => `${g.title} ${categoryOf(g.category)?.title ?? ""} ${JSON.stringify(g.body)}`.toLowerCase().includes(s));
}
