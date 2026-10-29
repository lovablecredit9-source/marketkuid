import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, QrCode, ArrowDownLeft, ArrowUpRight, CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SellerCard, SellerEmpty, SellerInput, SellerSheet, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";

export const TOPUP_MIN = 1000;
export const TOPUP_MAX = 10000000;
const PRESETS = [10000, 25000, 50000, 100000, 250000, 500000];
const tour = [
  { title: "Saldo & credits", desc: "Pantau credits, saldo penjualan, dan saldo tertahan di kartu ini.", target: "c-hero" },
  { title: "Isi credits", desc: "Top up credits lewat QRIS dari sini.", target: "c-topup" },
  { title: "Kenapa perlu credits", desc: "Credits dipakai otomatis untuk komisi dan markup tiap transaksi.", target: "c-why" },
  { title: "Selesai", desc: "Jaga credits tetap positif agar QRIS pribadimu terus aktif." },
];

export const Route = createFileRoute("/seller/saldo")({
  head: () => ({
    meta: [
      { title: "Saldo & Credits — Seller Center Marketku" },
      { name: "description", content: "Pantau saldo credits, top up, dan riwayat potongan biaya toko." },
      { property: "og:title", content: "Saldo & Credits — Seller Center Marketku" },
      { property: "og:description", content: "Saldo credits toko Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Saldo,
});

function Saldo() {
  const [tab, setTab] = useState<"semua" | "masuk" | "keluar">("semua");
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const n = Number(amt || "0");
  const pay = () => {
    if (n < TOPUP_MIN || n > TOPUP_MAX) { toast.error(`Nominal ${rpSeller(TOPUP_MIN)} – ${rpSeller(TOPUP_MAX)}`); return; }
    toast("Pembayaran QRIS segera hadir. Credits belum ditambahkan.");
    setOpen(false);
  };
  return (
    <>
      <div>
        <h2 className="text-xl font-semibold">Credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">Saldo untuk potongan komisi dan markup transaksi PG pribadi</p>
      </div>

      <SellerCard data-tour="c-hero" className="overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
          <Coins aria-hidden className="pointer-events-none absolute -right-6 -top-4 h-48 w-48 opacity-15" />
          <p className="relative flex items-center gap-2.5 text-sm font-medium"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground/15"><Coins className="h-4 w-4" strokeWidth={1.75} /></span> Saldo credits</p>
          <p className="relative mt-3 text-2xl font-semibold">{rpSeller(0)}</p>
          <button data-tour="c-topup" onClick={() => setOpen(true)} className="relative mt-3 flex items-center gap-2 rounded-xl bg-background px-3.5 py-2 text-sm font-medium text-primary shadow-lg transition active:scale-95">
            <QrCode className="h-4 w-4" /> Top Up Credits
          </button>
        </div>
        <div className="grid grid-cols-3 divide-x bg-accent/60">
          <Mini icon={ArrowDownLeft} label="Masuk" value={rpSeller(0)} sub="90 hari terakhir" />
          <Mini icon={ArrowUpRight} label="Terpakai" value={rpSeller(0)} sub="90 hari terakhir" />
          <Mini icon={CreditCard} label="PG KlikQRIS pribadi" value="Tidak aktif" sub="Memakai QRIS Marketku" />
        </div>
      </SellerCard>

      <SellerCard>
        <div className="flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Coins className="h-4 w-4" strokeWidth={1.75} /></span>
          <div>
            <h3 className="text-base font-semibold">Riwayat credits</h3>
            <p className="text-sm text-muted-foreground">Top up dan potongan biaya 90 hari terakhir.</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="inline-flex rounded-xl border bg-background/60 p-1">
            {(["semua", "masuk", "keluar"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition ${tab === k ? "bg-primary text-primary-foreground" : "text-foreground/80"}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="border-t">
          <SellerEmpty icon={Coins} title="Belum ada mutasi" desc="Top up dan potongan credits akan tercatat di sini." />
        </div>
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">0 mutasi</p>
      </SellerCard>

      <SellerCard data-tour="c-why" className="flex gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><ShieldCheck className="h-4 w-4" strokeWidth={1.75} /></span>
        <div className="space-y-2 text-sm text-muted-foreground">
          <h3 className="text-sm font-semibold text-foreground">Kapan credits dipakai?</h3>
          <p>Saat pembeli membayar lewat PG pribadi, uang langsung masuk ke merchant kamu. Komisi platform dan markup lalu dipotong dari credits.</p>
          <p>Jika credits tidak cukup menutup potongan sebuah transaksi, checkout otomatis memakai QRIS Marketku dan dana masuk lewat escrow seperti biasa.</p>
        </div>
      </SellerCard>
      <SellerSheet open={open} onOpenChange={setOpen} title={<span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-primary"><Coins className="h-4 w-4" /></span>Top Up Credits</span>}
        footer={<button onClick={pay} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-95"><QrCode className="h-4 w-4" /> Bayar via QRIS</button>}>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((v) => (
            <button key={v} onClick={() => setAmt(String(v))} className={`rounded-xl border py-3 text-sm transition active:scale-95 ${n === v ? "border-primary bg-accent font-semibold text-primary" : "bg-background/40"}`}>{rpSeller(v)}</button>
          ))}
        </div>
        <p className="mb-2 mt-4 text-sm">Nominal top up</p>
        <SellerInput inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Contoh: 50000" />
        <p className="mt-3 text-xs text-muted-foreground">Min {rpSeller(TOPUP_MIN)} · Maks {rpSeller(TOPUP_MAX)}. Dibayar lewat QRIS Marketku, credits masuk otomatis setelah pembayaran berhasil.</p>
      </SellerSheet>
      <PageTour id="seller-saldo" steps={tour} panel />
    </>
  );
}

function Mini({ icon: I, label, value, sub }: { icon: typeof Coins; label: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1.5 py-3.5 text-center">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary/50 bg-background/60 text-primary"><I className="h-3.5 w-3.5" strokeWidth={1.75} /></span>
      <p className="mt-2 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{sub}</p>
    </div>
  );
}
