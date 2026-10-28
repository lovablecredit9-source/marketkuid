import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, QrCode, ArrowDownLeft, ArrowUpRight, CreditCard, ShieldCheck } from "lucide-react";
import { soon } from "@/components/marketku/shell";
import { SellerCard, SellerEmpty, rpSeller } from "@/components/marketku/seller-ui";

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
  return (
    <>
      <div>
        <h2 className="text-2xl font-bold">Credits</h2>
        <p className="mt-1 text-muted-foreground">Saldo untuk potongan komisi dan markup transaksi PG pribadi</p>
      </div>

      <SellerCard className="overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
          <Coins aria-hidden className="pointer-events-none absolute -right-6 -top-4 h-48 w-48 opacity-15" />
          <p className="relative flex items-center gap-3 font-semibold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/15"><Coins className="h-5 w-5" /></span> Saldo credits</p>
          <p className="relative mt-3 text-3xl font-bold">{rpSeller(0)}</p>
          <button onClick={() => soon("Top Up Credits")} className="relative mt-4 flex items-center gap-2 rounded-xl bg-background px-4 py-2.5 font-semibold text-primary shadow-lg transition active:scale-95">
            <QrCode className="h-4 w-4" /> Top Up Credits
          </button>
        </div>
        <div className="grid grid-cols-3 divide-x bg-accent/60">
          <Mini icon={ArrowDownLeft} label="Masuk" value={rpSeller(0)} sub="90 hari terakhir" />
          <Mini icon={ArrowUpRight} label="Terpakai" value={rpSeller(0)} sub="90 hari terakhir" />
          <Mini icon={CreditCard} label="PG pribadi" value="Tidak aktif" sub="Memakai QRIS Marketku" />
        </div>
      </SellerCard>

      <SellerCard>
        <div className="flex items-start gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Coins className="h-5 w-5" /></span>
          <div>
            <h3 className="text-lg font-bold">Riwayat credits</h3>
            <p className="text-sm text-muted-foreground">Top up dan potongan biaya 90 hari terakhir.</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="inline-flex rounded-xl border bg-background/60 p-1">
            {(["semua", "masuk", "keluar"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${tab === k ? "bg-primary text-primary-foreground" : "text-foreground/80"}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="border-t">
          <SellerEmpty icon={Coins} title="Belum ada mutasi" desc="Top up dan potongan credits akan tercatat di sini." />
        </div>
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">0 mutasi</p>
      </SellerCard>

      <SellerCard className="flex gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-primary"><ShieldCheck className="h-5 w-5" /></span>
        <div className="space-y-2 text-sm text-muted-foreground">
          <h3 className="text-base font-bold text-foreground">Kapan credits dipakai?</h3>
          <p>Saat pembeli membayar lewat PG pribadi, uang langsung masuk ke merchant kamu. Komisi platform dan markup lalu dipotong dari credits.</p>
          <p>Jika credits tidak cukup menutup potongan sebuah transaksi, checkout otomatis memakai QRIS Marketku dan dana masuk lewat escrow seperti biasa.</p>
        </div>
      </SellerCard>
    </>
  );
}

function Mini({ icon: I, label, value, sub }: { icon: typeof Coins; label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-4 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-lg border border-primary/50 bg-background/60 text-primary"><I className="h-4 w-4" /></span>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
