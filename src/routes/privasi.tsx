import { createFileRoute } from "@tanstack/react-router";
import { LegalCard, LegalPage } from "@/components/marketku/legal";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/privasi")({
  staticData: { sitemap: true },
  head: () => pageMeta("Kebijakan Privasi — Marketku", "Cara Marketku menggunakan dan melindungi data pengguna."),
  component: Privasi,
});

function Privasi() {
  return (
    <LegalPage badge="Privasi" title="Cara Marketku menggunakan data pengguna"
      intro="Marketku hanya mengumpulkan data yang dibutuhkan untuk autentikasi, transaksi, keamanan akun, dan dukungan operasional marketplace."
      links={[{ label: "Lihat syarat penggunaan", to: "/syarat", primary: true }, { label: "Hubungi support", to: "/kontak" }]}>
      <LegalCard title="Data yang diproses">
        <p>Kami dapat memproses data seperti email, nama akun, username Telegram, histori transaksi, metadata perangkat, dan log keamanan.</p>
        <p>Data sensitif diproses hanya sejauh dibutuhkan untuk autentikasi, pencegahan fraud, verifikasi pembayaran, dan penyelesaian sengketa.</p>
      </LegalCard>
      <LegalCard title="Tujuan penggunaan data">
        <p>Data digunakan untuk membuat akun, memproses transaksi, mengirim notifikasi, dan menjaga performa layanan.</p>
        <p>Sebagian data juga digunakan untuk audit internal, analitik operasional, dan peningkatan kualitas produk.</p>
      </LegalCard>
      <LegalCard title="Retensi dan keamanan">
        <p>Data disimpan selama masih dibutuhkan untuk operasional, rekonsiliasi transaksi, investigasi fraud, atau kewajiban hukum yang berlaku.</p>
        <p>Kami menerapkan kontrol akses, pencatatan keamanan, dan pemisahan area akun untuk melindungi data pengguna.</p>
      </LegalCard>
    </LegalPage>
  );
}
