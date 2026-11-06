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
