import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Repeat, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SellerCard, SellerEmpty, SellerInput, SellerPageTitle, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { fmtDate } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/pelanggan")({
  head: () => pageMeta("Pelanggan — Seller Center Marketku", "Daftar pembeli yang pernah bertransaksi di toko kamu."),
  component: Pelanggan,
});

function Pelanggan() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["seller_customers", user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.rpc("seller_customers"); if (error) throw error; return data ?? []; },
  });
  const rows = list.data ?? [];
  const ql = q.trim().toLowerCase();
  const shown = rows.filter((r) => !ql || (r.buyer_name ?? "").toLowerCase().includes(ql));
  const repeat = rows.filter((r) => r.completed > 1).length;
  return (
    <>
      <SellerPageTitle icon={Users} title="Pelanggan" desc={`${rows.length} pelanggan unik bertransaksi`} />
      <SellerCard className="grid grid-cols-2 divide-x overflow-hidden">
        <StatCell icon={UserPlus} label="Total pelanggan" value={String(rows.length)} />
        <StatCell icon={Repeat} label="Pelanggan setia" value={String(repeat)} sub="belanja lebih dari 1x" />
      </SellerCard>
      <label className="relative block">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <SellerInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pelanggan..." className="pl-10" />
      </label>
      <SellerCard className="divide-y overflow-hidden">
        {shown.length === 0 ? <SellerEmpty icon={Users} title="Belum ada pelanggan" desc="Pembeli yang membuat pesanan di tokomu akan muncul di sini." /> : shown.map((r) => (
          <div key={r.buyer_id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 font-bold text-primary">{(r.buyer_name ?? "P").charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><b className="block truncate">{r.buyer_name ?? "Pembeli"}</b><span className="text-xs text-muted-foreground">{r.orders} pesanan · terakhir {fmtDate(r.last_order)}</span></span>
            <span className="text-right text-sm"><b className="block">{rpSeller(Number(r.spent))}</b><span className="text-xs text-muted-foreground">{r.completed} selesai</span></span>
          </div>
        ))}
      </SellerCard>
    </>
  );
}
