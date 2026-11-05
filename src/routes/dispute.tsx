import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { useAuth } from "@/lib/auth";
import { DISPUTE_STATUS, useDisputes, type DisputeStatus } from "@/lib/disputes";
import { fmtDateTime } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/dispute")({
  head: () => pageMeta("Laporan & Dispute — Marketku", "Lihat laporan dan sengketa pesanan sebagai pembeli maupun penjual."),
  component: Dispute,
});

function Dispute() {
  const { user } = useAuth();
  const [role, setRole] = useState<"pembeli" | "penjual">("pembeli");
  const list = useDisputes(role === "pembeli" ? "buyer" : "seller", user?.id);
  const rows = list.data ?? [];
  return (
    <AppShell>
      <div className="relative overflow-hidden px-4 pb-6 pt-5">
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
        {rows.length === 0 ? (
          <div className="relative flex flex-col items-center py-24 text-center">
            <ShieldCheck className="h-9 w-9 text-primary" />
            <p className="mt-4 text-lg font-bold">{list.isLoading ? "Memuat laporan..." : "Belum ada laporan dispute"}</p>
            {!list.isLoading && <p className="mt-2 max-w-xs text-sm text-muted-foreground">Semua transaksimu aman. Laporan yang kamu buat atau terima akan tampil di sini.</p>}
          </div>
        ) : (
          <div className="relative mt-4 space-y-2.5">
            {rows.map((d) => {
              const st = DISPUTE_STATUS[d.status as DisputeStatus] ?? DISPUTE_STATUS.ditutup;
              return (
                <Link key={d.id} to="/dispute/$id" params={{ id: d.id }} className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition active:scale-[0.99]">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-mono">M-{d.orders?.order_no}</span>· {fmtDateTime(d.updated_at)}</p>
                    <p className="mt-0.5 truncate text-sm font-bold">{d.orders?.order_items.map((i) => i.product_name).join(", ")}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.reasons.join(", ")}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${st.tone === "warn" ? "bg-warning/15 text-warning" : st.tone === "ok" ? "bg-success/15 text-success" : st.tone === "bad" ? "bg-destructive/10 text-destructive" : st.tone === "info" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{st.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
