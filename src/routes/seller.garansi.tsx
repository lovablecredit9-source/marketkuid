import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Clock, CircleCheck, CircleX, RefreshCw, Search } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { SellerCard } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/garansi")({
  head: () => pageMeta("Klaim Garansi — Seller Center Marketku", "Pantau dan proses klaim garansi dari pembeli."),
  component: Garansi,
});

const tour = [
  { title: "Saring status", desc: "Saring klaim garansi berdasarkan statusnya.", target: "g-chips" },
  { title: "Cari klaim", desc: "Cari klaim lewat kode garansi atau nama produk.", target: "g-search" },
  { title: "Selesai", desc: "Klaim yang disetujui otomatis mengirim akun pengganti dari stok." },
];
const STATUS = ["Semua", "Menunggu", "Disetujui", "Ditolak", "Expired"] as const;

function Garansi() {
  const qc = useQueryClient();
  const [s, setS] = useState<(typeof STATUS)[number]>("Semua");
  const [q, setQ] = useState("");
  return (
    <>
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-warning" />
        <h2 className="flex-1 text-2xl font-bold">Klaim Garansi</h2>
        <button aria-label="Muat ulang" onClick={() => void qc.invalidateQueries()} className="grid h-10 w-10 place-items-center rounded-xl border bg-card"><RefreshCw className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {([[Clock, "MENUNGGU", "text-warning bg-warning/15"], [CircleCheck, "DISETUJUI", "text-success bg-success/15"], [CircleX, "DITOLAK", "text-destructive bg-destructive/15"], [Shield, "TOTAL", "text-primary bg-primary/15"]] as const).map(([I, l, c]) => (
          <SellerCard key={l} className="flex items-center gap-3 p-4">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${c}`}><I className="h-5 w-5" /></span>
            <div><p className="text-[11px] font-semibold tracking-widest text-muted-foreground">{l}</p><p className="text-lg font-bold">0</p></div>
          </SellerCard>
        ))}
      </div>
      <div data-tour="g-chips" className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {STATUS.map((x) => (
          <button key={x} onClick={() => setS(x)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${s === x ? "border-warning bg-warning/20 text-warning" : "bg-card text-foreground/80"}`}>{x}</button>
        ))}
      </div>
      <label data-tour="g-search" className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode/produk..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>
      <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
        <Shield className="h-10 w-10" />
        <p className="mt-3">Belum ada klaim garansi</p>
      </div>
      <PageTour id="seller-garansi" steps={tour} panel />
    </>
  );
}
