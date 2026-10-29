import { createFileRoute } from "@tanstack/react-router";
import { Gem, Check, Lock, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SellerCard, SellerPageTitle } from "@/components/marketku/seller-ui";
import { SELLER_TIERS, tierFor, useSellerOrders } from "@/lib/seller-orders";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/program")({
  head: () => pageMeta("Program Seller — Seller Center Marketku", "Level seller Marketku dan keuntungan tiap level berdasarkan penjualan."),
  component: Program,
});

function Program() {
  const { user } = useAuth();
  const orders = useSellerOrders(user?.id);
  const sales = (orders.data ?? []).filter((o) => o.status === "completed").length;
  const t = tierFor(sales);
  return (
    <>
      <SellerPageTitle icon={Gem} title="Program Seller" desc="Naik level dengan menyelesaikan lebih banyak transaksi." />
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
