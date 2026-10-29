import { createFileRoute } from "@tanstack/react-router";
import { Bullets, LegalCard, LegalPage } from "@/components/marketku/legal";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/syarat")({
  head: () => pageMeta("Syarat & Ketentuan — Marketku", "Ringkasan syarat penggunaan Marketku sebagai pusat marketplace publik."),
  component: Syarat,
});

function Syarat() {
  return (
    <LegalPage badge="Ketentuan" title="Ringkasan syarat penggunaan Marketku"
      intro="Dokumen ini adalah ringkasan operasional untuk penggunaan Marketku sebagai pusat marketplace publik."
      links={[{ label: "Hubungi support", to: "/kontak", primary: true }, { label: "Kebijakan privasi", to: "/privasi" }]}>
      <LegalCard title="Akun dan akses">
        <p>Pengguna wajib memberikan data yang akurat saat membuat akun customer atau seller.</p>
        <p>Marketku berhak menunda, membatasi, atau menghentikan akses jika terdeteksi penyalahgunaan, penipuan, atau pelanggaran keamanan.</p>
      </LegalCard>
      <LegalCard title="Transaksi dan katalog">
        <p>Produk digital yang ditampilkan seller harus sesuai deskripsi, stok, dan kebijakan garansi yang disebutkan di listing.</p>
        <p>Marketku dapat menghapus listing, membekukan penjualan, atau meminta klarifikasi jika ada produk yang melanggar hukum, brand policy, atau menimbulkan risiko sistem.</p>
        <Bullets items={["Harga, stok, dan opsi produk dapat berubah sewaktu-waktu mengikuti update seller atau sistem.", "Transaksi dianggap final sesuai status pembayaran, delivery, dan proses sengketa yang berjalan di sistem."]} />
      </LegalCard>
      <LegalCard title="Pembayaran dan sengketa">
        <p>Pembayaran diproses melalui jalur yang tersedia pada platform dan dapat melibatkan escrow atau verifikasi tambahan sesuai mode transaksi.</p>
        <p>Apabila terjadi sengketa, buyer dan seller wajib memberikan bukti yang relevan agar penyelesaian dapat dilakukan secara adil.</p>
      </LegalCard>
    </LegalPage>
  );
}
