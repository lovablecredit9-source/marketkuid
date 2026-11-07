# Marketku roadmap (from Screenshots1.zip)

## Store profile reference
- [x] Compact store profile, rating, products and reviews; remove store-only support strip; show public reviewer names; verify mobile layout.

## Seller Center
- [x] Menu links for all panel pages (Withdraw, Kontrol Pembayaran, Rekber, Garansi, Bot, Voucher, Broadcast, Panduan, Pengaturan)
- [x] Header: guided tour (?), notifications, theme Light/Dark/System, profile menu with open/close store
- [x] Voucher / Promo Toko with 5-step wizard (real data)
- [x] Pengaturan Seller tabs: Profil Toko, Informasi Akun, Keamanan, Keuangan, Koneksi, Sesi
- [x] Withdraw, Payment Gateway, Rekber, Klaim Garansi, Bot Telegram, Broadcast pages (empty states)
- [x] Panduan Seller with guide articles
- [ ] Real Telegram bot connection, payment gateway, withdraw, rekber, broadcast sending (need external services)
- [ ] Store logo/banner upload

## Buyer
- [x] Wishlist, Laporan & Dispute, Bantuan/Syarat/Privasi/Kontak, Rekber, Pengaturan Akun pages
- [x] Side menu drawer, notification dropdown, dark mode toggle
- [x] Riwayat status picker, home features + blue footer
- [x] Chat search & select mode (UI), account welcome tours
- [x] Seller tours on Dasbor/Produk/Credits/Transaksi; product filter & sort menus; credits top-up panel; Panduan accordion with 21 articles
- [x] Product detail, store page, reviews, real cart & checkout (orders saved; QRIS payment pending gateway)
- [x] Real chat conversations
- [x] Seller Iklan pages, Program Seller, Analitik, Pelanggan
- [x] Seller products on beranda & pencarian
- [x] Home: owner banners (2), category image icons, AI & App Premium brand shortcuts
- [ ] QRIS payment, withdraw, rekber, Telegram bot (need payment gateway / bot credentials)

## Screenshots2.zip (kategori, iklan, bot telegram)
- [x] Halaman Semua Kategori (/kategori) + jumlah produk + Semua Produk; tombol "Lihat semua" di beranda
- [x] Iklan: Dashboard, Performa, Saldo (Top Up QRIS + Klaim Voucher + riwayat), Buat Iklan (kata kunci, mode pencocokan, durasi, perkiraan biaya), Campaign (filter status)
- [x] Produk bersponsor tampil di beranda & pencarian (impresi/klik tercatat)
- [x] Bot Telegram nyata: hubungkan token, aktif/nonaktif, refresh webhook, edit, menu selector, wajib join, hapus
- [x] Bot menjawab di Telegram: /start, kategori, produk, promo, referral, bantuan, garansi, top up/tarik saldo (info)
- [ ] Top up saldo iklan via QRIS & saldo/top up di bot (butuh payment gateway)

## Screenshots4.zip (kategori produk seller)
- [x] Pilih kategori produk bertingkat (breadcrumb, jumlah sub-kategori, ikon, cari)
- [x] Kategori induk ikut menampilkan produk sub-kategori di pencarian & halaman Kategori
- [x] Animasi muat ikon refresh berputar di Seller Center
- [x] Kolom Detail Lanjutan dengan label naik saat diketik

## Admin & deposit
- [x] Admin Panel /admin (ringkasan, deposit, QRIS, pengguna, toko, produk, pesanan)
- [x] Top up saldo manual via QRIS + bukti transfer (/topup), disetujui admin
- [x] Login admin terpisah (/admin/login) + tampilan Admin Console baru
- [x] Blokir akun & toko (1/3/7/14/30 hari, custom, permanen), turunkan produk, atur saldo manual, log aktivitas
- [x] Top up via QRIS, DANA, GoPay, OVO, ShopeePay, LinkAja, bank (diatur admin)
- [x] Bayar pesanan pakai Saldo Marketku atau QRIS/e-wallet (bukti dicek admin di tab Bayar Order); produk berstok terkirim otomatis, seller dapat saldo saat pesanan selesai
- [x] Tarik saldo seller (reguler Rp2.000 / same day Rp3.000, riwayat, detail, pendapatan, auto withdraw, diproses admin)
- [x] Top Up Credits seller (QRIS/e-wallet + bukti, disetujui admin di tab Deposit, saldo & riwayat credits)
- [ ] Pengajuan PG pribadi di Kontrol Pembayaran (masih "segera hadir")

- [x] Laporan/dispute pesanan: pembeli lapor, Dispute Room, seller refund/tolak/selesai, admin putuskan

## Seller Center tap & garansi (Nov 5)
- [x] Efek tekan/garis biru tombol Seller Center, kotak saldo bisa diklik, panduan 15 langkah gaya marketku.id
- [x] Saldo Tertahan Non-Garansi vs Saldo Menunggu Masa Garansi (maks 3 hari)
- [ ] Bandingkan hasil dana garansi dengan tes bayar nyata di marketku.id (menunggu pembayaran QRIS dari user)
- [x] Ajukan kategori baru (seller) + persetujuan admin
- [x] Klaim garansi pembeli + setujui/tolak seller
- [ ] Uji klaim garansi sungguhan di marketku.id (butuh QRIS dibayar user + akun pembeli baru)
- [ ] Bot Telegram & broadcast di marketku.id (user hubungkan token sendiri)
- [ ] Upload 9 jenis produk uji di marketku.id + tampilan pembeli
- [x] Animasi ikon & tulisan navigasi bawah Seller Center saat pindah halaman
- [x] Bot @MARKETKUIDR_bot terhubung ke toko Tambas; broadcast nyata (pratinjau, tes ke saya, kirim, riwayat, gambar)
- [ ] Tes broadcast ke @jepangges lewat @MARKETKUIDR_bot (menunggu jepangges tekan /start di bot)
- [x] Form 9 jenis produk marketku.id dicek ulang (hanya Code punya subtype di langkah Info)
- [ ] Tes klaim garansi nyata di marketku.id (menunggu pembayaran QRIS Rp100 dari user)

## Bot Telegram seperti RUMAH KAYU STORE / @seller_panelbot (Nov 6)
- [x] Bot toko: kartu sambutan + tombol kategori, menu Top Up/Referral/Promo/Garansi/Tarik Saldo/Bantuan dengan tombol Kembali/Menu Utama
- [x] Menu seller di bot toko sendiri: hubungkan Telegram pemilik, notifikasi otomatis (pesanan baru/dibayar/selesai/laporan/stok menipis), Dashboard/Produk on-off/Pesanan/Keuangan/Lainnya, pilih jumlah beli +/-, menu perintah /
- [ ] Bot Seller Panel terpisah untuk semua seller (seperti @seller_panelbot) — menunggu token bot baru dari user
- [ ] Gambar kartu sambutan otomatis (profil toko, saldo, poin, referral, transaksi) dan saldo/poin di bot — butuh sistem poin & saldo bot
- [x] Bot admin Marketku Center (@MarketkuCenterAdmin_bot): tab Bot di Admin Console, hubungkan Telegram admin, ringkasan + banner, tombol Deposit/Bayar/Withdraw/Dispute/Kategori/Toko, notifikasi otomatis

## Bot ke-3: Marketku Seller Center (Nov 6)
- [x] Bot platform untuk semua seller: hubungkan dari Seller Center → Bot Telegram, menu Dashboard/Produk/Pesanan/Keuangan/Voucher/Garansi/Profil/Broadcast/Lainnya
- [x] Notifikasi bergambar otomatis (bukan AI): pesanan baru belum dibayar, dibayar, selesai, dibatalkan, habis waktu, chat pembeli, deposit
- [x] Bot @MarketkuSellerCenter_bot dibuat di BotFather & dipasang di Admin → Bot (webhook aktif)
- [x] Seller Tambas terhubung ke bot; semua tombol menu + kartu Dashboard bergambar diuji di Telegram
- [x] Pembeli uji chat + pesan + batal → 3 notifikasi terkirim ke Telegram seller
- [ ] Publish agar notifikasi otomatis tiap menit memakai versi baru (tunggu persetujuan user)
- [ ] Lihat langsung gambar notifikasi chat/pesanan/batal di Telegram (sesi Telegram hilang saat sistem restart)

## Bot ke-4: Auth Marketku + login Seller Center (Nov 6)
- [x] Halaman masuk Seller Center seperti panel.marketku.id: email → password, atau Telegram (username → kode 6 angka / link Login Otomatis)
- [x] Bot Auth: /start mencatat username, kirim kode login (5 menit, maks 5 percobaan, kirim ulang 60 detik), pesan "Login Berhasil" (IP, device, browser, waktu WIB)
- [x] Mini App Seller Center masuk otomatis dari Telegram (tetap masuk walau logout); tombol menu Mini App di bot Seller Center
- [x] Kartu pasang bot Auth Marketku di Admin → Bot
- [x] Avatar + deskripsi untuk bot admin, bot toko, bot Seller Center
- [x] Bot @AuthMarketkuID_bot dibuat di BotFather, dipasang lewat Admin → Bot, avatar + deskripsi
- [x] Uji login via kode (2x) & link otomatis, Mini App masuk otomatis + tetap masuk setelah logout
- [ ] Publish agar Mini App & link Login Otomatis di HP memakai versi baru (alamat preview tidak bisa dibuka dari Telegram)
- [x] Login Telegram di panel.marketku.id dicoba (jbapppremandpanelsosmed) dan langkah kode disamakan

## Cek bug seluruh web (Nov 6)
- [x] Daftar seller (nama toko + username Telegram) diperbaiki
- [x] 50+ halaman pembeli, Seller Center, admin dibuka tanpa login & sebagai seller Tambas — tanpa error tampilan
- [x] Tautan produk/ulasan/pesanan/bayar/chat yang salah kini tampil "tidak ditemukan" (sebelumnya error/macet "Memuat pembayaran...")
- [x] Halaman 404/error berbahasa Indonesia; admin tidak memanggil data sebelum masuk
- [x] Riwayat sesi login seller (perangkat, versi Android, baterai, WiFi/data, IP, lokasi, provider kartu) — tes live di HP belum

## Cek ulang marketku.id (Nov 7)
- [x] Halaman Produk Baru (/produk/baru), Produk Lagi Diskon (/produk/diskon), Flash Sale (/flash-sale) + tautan "Lihat semua" & footer
- [x] Jadwal Flash Sale oleh seller (Seller Center → Flash Sale; harga flash dipakai di checkout, kuota, hitung mundur)
- [x] Bandingkan menu Seller Center panel.marketku.id (20 menu sama; dasbor grup WA + checklist sudah ada)
- [ ] Tautan Grup WhatsApp seller di menu (menunggu link grup dari user)
