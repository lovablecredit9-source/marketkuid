import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/dispute")({
  head: () => pageMeta("Dispute Pesanan — Marketku", "Ajukan dan pantau sengketa pesanan di Marketku."),
  component: Dispute,
});

const TABS = ["Semua", "Terbuka", "Ditinjau", "Selesai"] as const;

function Dispute() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Semua");
  return (
    <AppShell title="Dispute">
      <div className="space-y-4 px-3 pt-3">
        <div className="rounded-2xl bg-accent/50 p-4">
          <h1 className="text-lg font-bold">Dispute Pesanan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ajukan sengketa jika produk tidak sesuai. Dana ditahan sampai masalah selesai.</p>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${tab === t ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{t}</button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border bg-card px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input placeholder="Cari kode pesanan" className="w-full bg-transparent outline-none" />
          </label>
        </div>
        <EmptyState icon={AlertTriangle} title="Belum ada dispute" desc="Sengketa pesanan akan muncul di sini." action={<PrimaryLink to="/cari">Jelajahi produk</PrimaryLink>} />
      </div>
    </AppShell>
  );
}
