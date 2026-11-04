import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins, Clock, CheckCircle2, Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Chips, SellerCard, SellerEmpty, SellerPageTitle, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { useSellerOrders } from "@/lib/seller-orders";
import { fmtDate } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/pendapatan")({
  head: () => pageMeta("Pendapatan Saya — Seller Center Marketku", "Pantau dana pending dan dana yang sudah dilepas dari setiap transaksi toko."),
  component: Pendapatan,
});

type Filter = "pending" | "dilepas" | "semua";
type Period = "7" | "30" | "90" | "365";
const ADMIN_FEE = 0.03;

function Pendapatan() {
  const { user } = useAuth();
  const orders = useSellerOrders(user?.id);
  const ledger = useQuery({
    queryKey: ["seller_sale_ledger", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_ledger").select("ref_id, amount, created_at").eq("user_id", user!.id).eq("kind", "sale").limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [filter, setFilter] = useState<Filter>("semua");
  const [period, setPeriod] = useState<Period>("30");

  const rows = useMemo(() => {
    const paid = new Map((ledger.data ?? []).map((l) => [l.ref_id, l]));
    return (orders.data ?? []).filter((o) => o.status === "completed").map((o) => {
      const l = paid.get(o.id);
      const gross = Number(o.subtotal) - Number(o.discount);
      const net = l ? Number(l.amount) : Math.round(gross * (1 - ADMIN_FEE));
      return { id: o.id, no: o.order_no, buyer: o.buyer_name ?? "Pembeli", date: o.completed_at ?? o.created_at, released: l?.created_at ?? null, gross, net };
    });
  }, [orders.data, ledger.data]);

  const pending = rows.filter((r) => !r.released);
  const released = rows.filter((r) => r.released);
  const shown = filter === "pending" ? pending : filter === "dilepas" ? released : rows;
  const since = Date.now() - Number(period) * 86400_000;
  const inPeriod = released.filter((r) => +new Date(r.released!) >= since);

  const exportCsv = () => {
    if (!shown.length) { toast("Belum ada data untuk diekspor"); return; }
    const head = "order,pembeli,tanggal,kotor,bersih,status\n";
    const body = shown.map((r) => [`M-${r.no}`, `"${r.buyer.replace(/"/g, "'")}"`, r.date, r.gross, r.net, r.released ? "dilepas" : "pending"].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "pendapatan-marketku.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const loading = orders.isLoading || ledger.isLoading;
  return (
    <div className="space-y-3 p-3">
      <SellerPageTitle icon={Coins} title="Pendapatan Saya" desc="Pantau status dan rincian dana setiap transaksi." />
      <SellerCard className="grid grid-cols-2 divide-x">
        <StatCell icon={Clock} label="Pending" value={rpSeller(pending.reduce((a, r) => a + r.net, 0))} sub="Menunggu konfirmasi pesanan diterima" valueClass="text-warning" />
        <StatCell icon={CheckCircle2} label="Sudah dilepas" value={rpSeller(released.reduce((a, r) => a + r.net, 0))} sub={`${released.length} transaksi selesai`} valueClass="text-success" />
      </SellerCard>

      <SellerCard className="p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Keuangan seller</p>
        <p className="mt-0.5 text-sm font-semibold">Riwayat pendapatan <span className="font-normal text-muted-foreground">· {shown.length} transaksi</span></p>
        <div className="mt-2"><Chips value={filter} onChange={setFilter} items={[{ value: "pending", label: "Pending" }, { value: "dilepas", label: "Sudah dilepas" }, { value: "semua", label: "Semua" }]} /></div>
        {loading ? <div className="mt-3 h-24 animate-pulse rounded-lg bg-muted" /> : shown.length === 0
          ? <SellerEmpty icon={Receipt} title="Belum ada pendapatan" desc="Data akan muncul setelah transaksi seller tercatat." />
          : <ul className="mt-2 divide-y">
              {shown.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0"><p className="font-semibold">M-{r.no} · <span className="font-normal">{r.buyer}</span></p><p className="text-muted-foreground">{fmtDate(r.date)} · kotor {rpSeller(r.gross)}</p></div>
                  <div className="text-right"><p className="font-semibold">{rpSeller(r.net)}</p><p className={r.released ? "text-success" : "text-warning"}>{r.released ? "Dilepas" : "Pending"}</p></div>
                </li>
              ))}
            </ul>}
      </SellerCard>

      <SellerCard className="p-3">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold">Catatan transaksi</p>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-95"><Download className="h-3.5 w-3.5" /> Export CSV</button></div>
        <div className="mt-2"><Chips value={period} onChange={setPeriod} items={[{ value: "7", label: "7 hari" }, { value: "30", label: "30 hari" }, { value: "90", label: "90 hari" }, { value: "365", label: "1 tahun" }]} /></div>
        {inPeriod.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Belum ada catatan pada periode ini.</p>
          : <p className="mt-3 text-xs">Dana dilepas: <b>{rpSeller(inPeriod.reduce((a, r) => a + r.net, 0))}</b> dari {inPeriod.length} transaksi.</p>}
      </SellerCard>
    </div>
  );
}
