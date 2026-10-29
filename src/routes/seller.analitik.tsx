import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, DollarSign, ShoppingBag, Users, Percent, TrendingUp, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Chips, SellerCard, SellerEmpty, SellerPageTitle, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { ORDER_LABEL } from "@/lib/market";
import { dailyRevenue, sellerStats, useSellerOrders } from "@/lib/seller-orders";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/analitik")({
  head: () => pageMeta("Analitik — Seller Center Marketku", "Grafik pendapatan, transaksi, dan produk terlaris toko kamu."),
  component: Analitik,
});

function Analitik() {
  const { user } = useAuth();
  const orders = useSellerOrders(user?.id);
  const [days, setDays] = useState<"7" | "30">("7");
  const n = Number(days);
  const since = Date.now() - n * 86400000;
  const all = orders.data ?? [];
  const inRange = all.filter((o) => new Date(o.created_at).getTime() >= since);
  const st = sellerStats(inRange);
  const series = dailyRevenue(inRange, n);
  const peak = Math.max(1, ...series.map((d) => d.value));
  const byStatus = Object.keys(ORDER_LABEL).map((k) => ({ k, n: inRange.filter((o) => o.status === k).length })).filter((x) => x.n > 0);

  return (
    <>
      <SellerPageTitle icon={BarChart3} title="Analitik" desc="Performa penjualan tokomu dari transaksi asli." />
      <Chips items={[{ value: "7", label: "7 hari" }, { value: "30", label: "30 hari" }]} value={days} onChange={setDays} />
      <SellerCard className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell icon={DollarSign} label="Pendapatan" value={rpSeller(st.revenue)} />
        <StatCell icon={ShoppingBag} label="Transaksi" value={String(st.total)} sub={`${st.completed} selesai`} />
        <StatCell icon={Users} label="Pelanggan" value={String(st.buyers)} sub="unik" />
        <StatCell icon={Percent} label="Konversi" value={`${st.conversion}%`} sub={`avg ${rpSeller(st.avgOrder)}`} />
      </SellerCard>

      <SellerCard className="p-4">
        <h3 className="flex items-center gap-2 font-bold"><TrendingUp className="h-5 w-5" /> Pendapatan harian</h3>
        {st.revenue === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pendapatan pada periode ini.</p> : (
          <div className="mt-4 flex h-40 items-end gap-1">
            {series.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${rpSeller(d.value)}`}>
                <div className="w-full rounded-t bg-primary" style={{ height: `${(d.value / peak) * 100}%`, minHeight: d.value ? 4 : 1 }} />
                {n === 7 && <span className="text-[10px] text-muted-foreground">{d.label}</span>}
              </div>
            ))}
          </div>
        )}
      </SellerCard>

      <SellerCard>
        <h3 className="border-b px-4 py-3 font-bold">Status pesanan</h3>
        {byStatus.length === 0 ? <SellerEmpty icon={ShoppingBag} title="Belum ada pesanan" desc="Status pesanan akan tampil di sini." /> : (
          <div className="space-y-2 p-4">
            {byStatus.map((x) => (
              <div key={x.k} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-muted-foreground">{ORDER_LABEL[x.k]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${(x.n / inRange.length) * 100}%` }} /></span>
                <b className="w-6 text-right">{x.n}</b>
              </div>
            ))}
          </div>
        )}
      </SellerCard>

      <SellerCard>
        <h3 className="border-b px-4 py-3 font-bold">Produk terlaris</h3>
        {st.bestSellers.length === 0 ? <SellerEmpty icon={Package} title="Belum ada produk terjual" desc="Produk terlaris akan tampil setelah ada penjualan." /> : st.bestSellers.map((b, i) => (
          <div key={b.name} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
            <span className="w-5 font-bold text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold uppercase">{b.name}</span>
            <span className="text-right text-sm"><b className="block">{b.qty} terjual</b><span className="text-muted-foreground">{rpSeller(b.revenue)}</span></span>
          </div>
        ))}
      </SellerCard>
    </>
  );
}
