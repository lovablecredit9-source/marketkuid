import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Bullets, LegalCard, LegalPage } from "@/components/marketku/legal";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/bantuan")({
  head: () => pageMeta("Pusat Bantuan — Marketku", "Bantuan cepat untuk buyer dan seller Marketku."),
  component: Bantuan,
});

const FAQ = [
  ["Bagaimana cara membeli produk?", "Pilih produk, masukkan ke keranjang, lalu bayar lewat QRIS di halaman checkout. Produk digital dikirim otomatis setelah pembayaran berhasil."],
  ["Berapa lama produk dikirim?", "Produk dengan stok otomatis dikirim instan. Produk pre-order mengikuti estimasi dari penjual."],
  ["Bagaimana jika produk bermasalah?", "Ajukan klaim garansi atau dispute dari halaman pesanan. Dana ditahan sampai masalah selesai."],
  ["Bagaimana menarik saldo penjualan?", "Daftarkan rekening di Pengaturan Seller → Keuangan, lalu tarik dana dari menu Withdraw (minimal Rp50.000)."],
] as const;

function Bantuan() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <LegalPage badge="Pusat Bantuan" title="Bantuan cepat untuk buyer dan seller Marketku"
      intro="Semua halaman bantuan publik sekarang dipusatkan di Marketku agar buyer, seller, dan tim support memakai jalur yang sama."
      links={[{ label: "Hubungi support", to: "/kontak", primary: true }, { label: "Syarat & Ketentuan", to: "/syarat" }]}>
      <LegalCard title="Kalau kamu pembeli">
        <p>Pastikan email login, detail produk, dan metode pembayaran yang dipilih sudah sesuai sebelum checkout.</p>
        <p>Untuk kendala transaksi, sertakan nomor invoice, email akun, dan screenshot kendala agar tim bisa melacak lebih cepat.</p>
        <Bullets items={["Gunakan halaman login Marketku yang sama untuk semua flow auth publik.", "Kalau produk berasal dari seller tertentu, kamu bisa lanjutkan checkout lewat storefront seller terkait agar stok tetap sinkron."]} />
      </LegalCard>
      <LegalCard title="Kalau kamu seller">
        <p>Gunakan Seller Center untuk onboarding toko, pengelolaan produk, wallet, dan operasional after-sales.</p>
        <p>Marketku diposisikan sebagai hub publik marketplace buyer, sedangkan Seller Center tetap jadi cockpit operasional seller.</p>
        <Bullets items={["Pastikan slug toko, banner, dan katalog seller sudah siap sebelum campaign publik diarahkan ke Marketku.", "Jika butuh bantuan migrasi produk atau wallet, hubungi support dengan detail toko."]} />
      </LegalCard>
      <LegalCard title="Pertanyaan umum">
        {FAQ.map(([q, a], i) => (
          <div key={q} className="rounded-xl border">
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 p-3 text-left font-semibold text-foreground">
              <span className="flex-1">{q}</span><ChevronDown className={`h-4 w-4 transition ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-3 pb-3">{a}</p>}
          </div>
        ))}
      </LegalCard>
    </LegalPage>
  );
}
