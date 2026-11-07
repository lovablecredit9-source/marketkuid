import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgePercent, Bot, CheckCircle2, LayoutDashboard, ShieldCheck, Store, Upload, Wallet, Zap, Megaphone, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/meta";
import { FEE_REGULAR, FEE_SAME_DAY, MIN_WITHDRAW } from "@/lib/withdraw";

export const Route = createFileRoute("/jadi-seller")({
  head: () => pageMeta("Jadi Seller — Jual Produk Digital di Marketku", "Buka toko gratis di Marketku: komisi 3% per transaksi sukses, dana aman lewat escrow, dan Seller Center lengkap."),
  component: JadiSeller,
});

const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

const WHY: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: BadgePercent, title: "Komisi rendah", desc: "Hanya 3% per transaksi sukses. Gratis daftar & upload." },
  { icon: ShieldCheck, title: "Transaksi aman", desc: "Dana pembeli ditahan sistem sampai pesanan selesai." },
  { icon: Wallet, title: "Pencairan mudah", desc: `Tarik saldo mulai ${rp(MIN_WITHDRAW)} ke rekening atau e-wallet.` },
  { icon: Zap, title: "Kirim otomatis", desc: "Stok akun, kode, link, atau file terkirim begitu pembeli bayar." },
  { icon: Bot, title: "Notifikasi Telegram", desc: "Pesanan, chat, dan saldo masuk langsung ke Telegram kamu." },
  { icon: LayoutDashboard, title: "Seller Center lengkap", desc: "Produk, voucher, flash sale, iklan, analitik dalam satu tempat." },
];

const STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Store, title: "Daftar akun seller", desc: "Masuk akun Marketku, isi nama toko dan username Telegram." },
  { icon: Upload, title: "Unggah produk digital", desc: "Tambahkan foto, deskripsi, varian harga, dan stok siap kirim." },
  { icon: Megaphone, title: "Promosi & jual", desc: "Pasang voucher, jadwalkan flash sale, atau aktifkan iklan." },
  { icon: Wallet, title: "Cairkan saldo", desc: "Saldo bisa ditarik setelah masa tahan pesanan selesai." },
];

const PERKS = [
  "Tanpa biaya pendaftaran",
  "Komisi 3% hanya saat terjual",
  "Saldo cair 5 jam setelah pesanan (tanpa garansi)",
  "Produk bergaransi: saldo cair setelah masa garansi (maks 3 hari)",
  `Biaya tarik ${rp(FEE_REGULAR)} (kilat ${rp(FEE_SAME_DAY)})`,
  "Chat langsung dengan pembeli",
];

function JadiSeller() {
  const { user } = useAuth();
  const start = user
    ? <Link to="/akun" search={{ jualan: 1 }} className="mk-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition active:scale-95">Mulai Jualan Sekarang <ArrowRight className="h-4 w-4" /></Link>
    : <Link to="/register" className="mk-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition active:scale-95">Daftar & Mulai Jualan <ArrowRight className="h-4 w-4" /></Link>;

  return (
    <AppShell>
      <div className="space-y-4 px-3 pb-6 pt-3">
        <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
          <div aria-hidden className="mk-grid-bg pointer-events-none absolute inset-0 -z-0 opacity-60" />
          <div className="relative">
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-primary">Untuk kreator & seller Indonesia</span>
            <h1 className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">Jual produk digitalmu dan raih cuan tanpa batas</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Jual akun premium, kode lisensi, template, script, e-book, hingga jasa digital ke pembeli Marketku secara aman dan mudah.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {start}
              <a href="#langkah" className="inline-flex h-11 items-center rounded-xl border bg-card px-4 text-sm font-semibold transition active:scale-95">Lihat cara kerja</a>
            </div>
          </div>
        </section>

        <section>
          <h2 className="px-1 text-lg font-extrabold tracking-[-0.02em]">Kenapa jualan di Marketku?</h2>
          <p className="px-1 text-[13px] text-muted-foreground">Fokus berkarya, sisanya kami urus.</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {WHY.map(({ icon: I, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-3 shadow-sm">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-primary"><I className="h-4 w-4" /></span>
                <h3 className="mt-2 text-[13.5px] font-bold">{title}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="langkah" className="scroll-mt-28 rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-extrabold tracking-[-0.02em]">4 langkah mulai jualan</h2>
          <p className="text-[13px] text-muted-foreground">Dari daftar sampai cair, cukup hitungan menit.</p>
          <ol className="mt-3 space-y-3">
            {STEPS.map(({ icon: I, title, desc }, i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-[14px] font-bold"><I className="h-4 w-4 text-primary" />{title}</h3>
                  <p className="text-[12.5px] text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border bg-accent/60 p-4">
          <h2 className="text-lg font-extrabold tracking-[-0.02em]">Siap mulai jualan hari ini?</h2>
          <p className="text-[13px] text-muted-foreground">Gratis daftar, gratis upload produk. Bayar hanya saat ada penjualan.</p>
          <ul className="mt-3 space-y-1.5">
            {PERKS.map((t) => <li key={t} className="flex items-start gap-2 text-[13px]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{t}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {start}
            <Link to="/syarat" className="inline-flex h-11 items-center rounded-xl border bg-card px-4 text-sm font-semibold transition active:scale-95">Pelajari biaya</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
