import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Chips, SellerCard, SellerEmpty, SellerPageTitle } from "@/components/marketku/seller-ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/dispute")({
  head: () => pageMeta("Dispute Pesanan — Seller Center Marketku", "Pantau komplain pembeli atas pesanan toko kamu."),
  component: SellerDispute,
});

type F = "semua" | "terbuka" | "ditinjau" | "dilepas" | "refund" | "ditutup";

function SellerDispute() {
  const [f, setF] = useState<F>("semua");
  const stats: [string, number][] = [["Total", 0], ["Aktif", 0], ["Terbuka", 0], ["Sedang ditinjau", 0], ["Selesai", 0]];
  return (
    <div className="space-y-3 p-3">
      <SellerPageTitle icon={AlertTriangle} title="Dispute" desc="Komplain pembeli atas pesanan toko kamu." />
      <SellerCard className="grid grid-cols-5 divide-x text-center">
        {stats.map(([l, n]) => <div key={l} className="px-1 py-2.5"><p className="truncate text-[9.5px] font-semibold uppercase text-muted-foreground">{l}</p><p className="mt-0.5 text-base font-semibold">{n}</p></div>)}
      </SellerCard>
      <Chips value={f} onChange={setF} items={[{ value: "semua", label: "Semua" }, { value: "terbuka", label: "Terbuka" }, { value: "ditinjau", label: "Sedang ditinjau" }, { value: "dilepas", label: "Dana dilepas" }, { value: "refund", label: "Refund" }, { value: "ditutup", label: "Ditutup" }]} />
      <SellerCard><SellerEmpty icon={ShieldCheck} title="Belum ada dispute" desc="Komplain dari pembeli akan tampil di sini." /></SellerCard>
    </div>
  );
}
