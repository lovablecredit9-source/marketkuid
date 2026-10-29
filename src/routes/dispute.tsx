import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/dispute")({
  head: () => pageMeta("Laporan & Dispute — Marketku", "Lihat laporan dan sengketa pesanan sebagai pembeli maupun penjual."),
  component: Dispute,
});

function Dispute() {
  const [role, setRole] = useState<"pembeli" | "penjual">("pembeli");
  return (
    <AppShell>
      <div className="relative overflow-hidden px-4 pt-5">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-48 h-[26rem] w-[44rem] rounded-[50%] border border-primary/10" />
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-primary" /> Laporan &amp; Dispute</h1>
        <p className="mt-2 text-sm text-muted-foreground">Lihat laporan yang sedang berjalan maupun yang sudah selesai. Klik untuk membuka ruang penyelesaian.</p>
        <div className="mt-4 inline-flex rounded-xl border bg-card p-1">
          {(["pembeli", "penjual"] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${role === r ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
              Sebagai {r === "pembeli" ? "Pembeli" : "Penjual"}
            </button>
          ))}
        </div>
        <div className="relative flex flex-col items-center py-24 text-center">
          <ShieldCheck className="h-9 w-9 text-primary" />
          <p className="mt-4 text-lg font-bold">Belum ada laporan dispute</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">Semua transaksimu aman. Laporan yang kamu buat atau terima akan tampil di sini.</p>
        </div>
      </div>
    </AppShell>
  );
}
