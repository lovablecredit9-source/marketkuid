import { createFileRoute } from "@tanstack/react-router";
import { Bullets, LegalCard, LegalPage } from "@/components/marketku/legal";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/kontak")({
  head: () => pageMeta("Hubungi Kami — Marketku", "Jalur kontak resmi tim support Marketku untuk buyer dan seller."),
  component: Kontak,
});

function Kontak() {
  return (
    <LegalPage badge="Kontak" title="Butuh bantuan langsung dari tim Marketku?"
      intro="Gunakan jalur kontak yang paling sesuai agar tiket masuk ke tim yang tepat tanpa putar-putar."
      links={[{ label: "Pusat Bantuan", to: "/bantuan", primary: true }, { label: "Syarat & Ketentuan", to: "/syarat" }]}>
      <LegalCard title="Jalur kontak utama">
        <p>Support Telegram adalah jalur tercepat untuk buyer yang butuh bantuan transaksi, login, atau kendala pemrosesan pesanan.</p>
        <p>Seller yang butuh bantuan operasional toko, wallet, atau setup onboarding dapat memulai dari Seller Center lalu lanjut ke support jika diperlukan.</p>
        <Bullets items={["Siapkan invoice / email / username Telegram sebelum menghubungi tim support.", "Jelaskan kronologi singkat dan lampirkan screenshot agar penyelesaian lebih cepat."]} />
      </LegalCard>
      <LegalCard title="Jam respons">
        <p>Tim kami berusaha merespons secepat mungkin, tetapi waktu penanganan dapat bervariasi tergantung volume tiket dan tingkat urgensi.</p>
        <p>Untuk isu yang berdampak ke pembayaran atau delivery massal, sertakan penanda urgent agar bisa diprioritaskan.</p>
      </LegalCard>
    </LegalPage>
  );
}
