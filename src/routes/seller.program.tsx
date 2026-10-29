import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gem, Check, Lock, Trophy, Star, ShieldCheck, Wallet, CircleHelp, BadgeCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SellerCard } from "@/components/marketku/seller-ui";
import { SELLER_TIERS, tierFor, useSellerOrders } from "@/lib/seller-orders";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/program")({
  head: () => pageMeta("Program Seller — Seller Center Marketku", "Paket level seller, Marketku Star, dan Verified Seller Marketku."),
  component: Program,
});

type Tab = "paket" | "star" | "verif";
const TABS: { id: Tab; label: string; icon: typeof Gem }[] = [
  { id: "paket", label: "Paket", icon: Gem },
  { id: "star", label: "Marketku Star", icon: Star },
  { id: "verif", label: "Verifikasi", icon: ShieldCheck },
];

function Program() {
  const [tab, setTab] = useState<Tab>("paket");
  return (
    <>
      <div className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 [scrollbar-width:none]">
        {TABS.map(({ id, label, icon: I }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${tab === id ? "border-primary bg-background text-primary" : "border-transparent text-muted-foreground"}`}>
            <I className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <div className="border-t" />
      {tab === "paket" && <Paket />}
      {tab === "star" && <MarketkuStar />}
      {tab === "verif" && <Verifikasi />}
    </>
  );
}

function useSales() {
  const { user } = useAuth();
  const orders = useSellerOrders(user?.id);
  return (orders.data ?? []).filter((o) => o.status === "completed").length;
}

function Paket() {
  const sales = useSales();
  const t = tierFor(sales);
  return (
    <>
      <SellerCard className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/30 to-transparent p-5">
          <p className="text-xs font-bold tracking-widest text-muted-foreground">LEVEL KAMU</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-bold"><Trophy className="h-7 w-7 text-warning" /> {t.tier.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{sales} transaksi selesai</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${t.progress}%` }} /></div>
          <p className="mt-2 text-sm">{t.next ? <>Butuh <b>{t.toNext}</b> transaksi lagi untuk naik ke <b>{t.next.name}</b></> : "Kamu sudah di level tertinggi"}</p>
        </div>
      </SellerCard>
      {SELLER_TIERS.map((x) => {
        const reached = sales >= x.min;
        return (
          <SellerCard key={x.name} className={`p-4 ${x.name === t.tier.name ? "border-primary ring-1 ring-primary" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="font-bold">{x.name}</p>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${reached ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{reached ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{x.min}+ transaksi</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{x.perks.map((p) => <li key={p}>• {p}</li>)}</ul>
          </SellerCard>
        );
      })}
    </>
  );
}

function Bullets({ items }: { items: string[] }) {
  return <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}

function MarketkuStar() {
  const sales = useSales();
  return (
    <>
      <p className="text-[15px] text-muted-foreground">Marketku Star adalah label toko pilihan yang tampil lebih menonjol di Marketku.</p>
      <SellerCard className="border-warning/40 bg-warning/5 p-5">
        <Star className="h-6 w-6 text-warning" />
        <p className="mt-3 text-sm text-muted-foreground">Status</p>
        <p className="text-xl font-bold">Belum terdaftar</p>
        <p className="mt-1 text-sm text-muted-foreground">{sales} transaksi selesai di tokomu</p>
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-warning">Pendaftaran Marketku Star sedang ditutup.</div>
      </SellerCard>
      <SellerCard className="border-tone-purple/40 bg-tone-purple/5 p-5">
        <p className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-tone-purple" /> Benefit Marketku Star</p>
        <Bullets items={["Lencana Marketku Star di halaman toko dan produk.", "Kesempatan tampil di kurasi beranda.", "Benefit lainnya akan datang."]} />
      </SellerCard>
    </>
  );
}

function Verifikasi() {
  return (
    <>
      <p className="text-[15px] text-muted-foreground">Dapatkan badge Verified otomatis setelah deposit jaminan berhasil dibayar.</p>
      <SellerCard className="border-success/40 bg-success/5 p-5">
        <ShieldCheck className="h-6 w-6 text-success" />
        <p className="mt-3 text-sm text-muted-foreground">Status</p>
        <p className="text-xl font-bold">Belum diajukan</p>
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-warning">Pendaftaran Verified Seller sedang ditutup.</div>
      </SellerCard>
      <SellerCard className="border-tone-cyan/40 bg-tone-cyan/5 p-5">
        <Wallet className="h-6 w-6 text-tone-cyan" />
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">Deposit jaminan <CircleHelp className="h-4 w-4 text-primary" /></p>
        <p className="text-xl font-bold">Rp 200.000</p>
        <p className="mt-2 text-[15px] leading-relaxed">Deposit dapat ditarik setelah 30 hari. Dana tidak dipakai untuk komisi, transaksi, iklan, atau saldo operasional.</p>
      </SellerCard>
      <SellerCard className="p-5">
        <p className="text-lg font-bold">Ketentuan utama</p>
        <Bullets items={[
          "Verified aktif otomatis setelah pembayaran Rp200.000 terkonfirmasi.",
          "Deposit tersimpan terpisah dan tetap utuh.",
          "Penarikan deposit tersedia setelah status Verified aktif minimal 30 hari.",
          "Saat refund diajukan, badge Verified langsung dicabut.",
          "Refund diproses admin ke rekening yang terdaftar di Pengaturan Toko.",
        ]} />
      </SellerCard>
      <SellerCard className="border-tone-purple/40 bg-tone-purple/5 p-5">
        <p className="flex items-center gap-2 text-lg font-bold"><BadgeCheck className="h-5 w-5 text-tone-purple" /> Benefit Verified Seller</p>
        <Bullets items={[
          "Lencana Verified Seller.",
          "Settle tetap 5 jam meskipun garansi aktif.",
          "Fee transaksi khusus 2,5%.",
          "Bonus saldo iklan promo Rp60.000 satu kali.",
          "Benefit lainnya akan datang.",
        ]} />
      </SellerCard>
    </>
  );
}
