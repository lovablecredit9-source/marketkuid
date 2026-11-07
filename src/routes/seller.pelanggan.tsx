import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Search, ShoppingBag, Send, RefreshCw, MessageCircle, Copy, ChevronDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SellerCard, SellerEmpty, StatCell } from "@/components/marketku/seller-ui";
import { useSellerOrders } from "@/lib/seller-orders";
import { fmtDate } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/pelanggan")({
  staticData: { sitemap: false },
  head: () => pageMeta("Pelanggan — Seller Center Marketku", "Daftar pembeli yang pernah bertransaksi di toko kamu."),
  component: Pelanggan,
});

type Sort = "terakhir" | "belanja" | "transaksi" | "nama";
const SORTS: [Sort, string][] = [["terakhir", "Terakhir"], ["belanja", "Belanja"], ["transaksi", "Transaksi"], ["nama", "Nama"]];
const rp = (n: number) => `Rp. ${n.toLocaleString("id-ID")},-`;

function Pelanggan() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("terakhir");
  const [spin, setSpin] = useState(false);
  const list = useQuery({
    queryKey: ["seller_customers", user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.rpc("seller_customers"); if (error) throw error; return data ?? []; },
  });
  const orders = useSellerOrders(user?.id);
  const wa = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders.data ?? []) if (o.buyer_whatsapp && !m.has(o.buyer_id)) m.set(o.buyer_id, o.buyer_whatsapp);
    return m;
  }, [orders.data]);
  const rows = list.data ?? [];
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const f = rows.filter((r) => !ql || (r.buyer_name ?? "").toLowerCase().includes(ql) || (wa.get(r.buyer_id) ?? "").includes(ql));
    const by: Record<Sort, (a: (typeof f)[number], b: (typeof f)[number]) => number> = {
      terakhir: (a, b) => +new Date(b.last_order) - +new Date(a.last_order),
      belanja: (a, b) => Number(b.spent) - Number(a.spent),
      transaksi: (a, b) => b.orders - a.orders,
      nama: (a, b) => (a.buyer_name ?? "").localeCompare(b.buyer_name ?? ""),
    };
    return [...f].sort(by[sort]);
  }, [rows, ql, sort, wa]);
  const totalTx = rows.reduce((a, r) => a + r.orders, 0);
  const totalSpent = rows.reduce((a, r) => a + Number(r.spent), 0);

  const refresh = async () => {
    setSpin(true);
    await Promise.all([qc.invalidateQueries({ queryKey: ["seller_customers"] }), qc.invalidateQueries({ queryKey: ["seller_orders"] })]);
    setTimeout(() => setSpin(false), 500);
  };
  const copy = (t: string) => { void navigator.clipboard?.writeText(t); toast.success("Disalin"); };

  return (
    <>
      <SellerCard className="grid grid-cols-3 divide-x overflow-hidden">
        <StatCell icon={Users} label="Pelanggan" value={String(rows.length)} />
        <StatCell icon={ShoppingBag} label="Transaksi" value={String(totalTx)} />
        <StatCell icon={Send} label="Belanja" value={rp(totalSpent)} />
      </SellerCard>
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / username pelanggan..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
        <button aria-label="Muat ulang" onClick={refresh} className="grid w-12 place-items-center rounded-xl border bg-card transition active:scale-95">
          <RefreshCw className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
        {SORTS.map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${sort === k ? "border-primary/60 text-primary" : "bg-card text-foreground/80"}`}>
            {l} {sort === k ? <ChevronDown className="h-4 w-4" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        ))}
      </div>
      {list.isPending ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl border bg-card" />)}</div>
      ) : shown.length === 0 ? (
        <SellerCard><SellerEmpty icon={Users} title="Belum ada pelanggan" desc="Pembeli yang membuat pesanan di tokomu akan muncul di sini." /></SellerCard>
      ) : shown.map((r) => {
        const phone = wa.get(r.buyer_id);
        return (
          <SellerCard key={r.buyer_id} className="px-5 pt-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-8 place-items-center font-bold text-primary">{(r.buyer_name ?? "P").charAt(0).toUpperCase()}</span>
              <b className="min-w-0 flex-1 truncate text-lg">{r.buyer_name ?? "Pembeli"}</b>
              <span className="text-right"><b className="block text-lg">{rp(Number(r.spent))}</b><span className="text-sm text-muted-foreground">{r.orders} transaksi</span></span>
            </div>
            {phone && (
              <button onClick={() => copy(phone)} className="mt-3 flex items-center gap-2 pl-3 text-[15px]">
                <MessageCircle className="h-4 w-4 text-success" /> {phone} <Copy className="h-4 w-4" />
              </button>
            )}
            <div className="mt-4 flex justify-between border-t py-3 text-sm text-muted-foreground">
              <span>Transaksi terakhir</span><span>{fmtDate(r.last_order)}</span>
            </div>
          </SellerCard>
        );
      })}
    </>
  );
}
