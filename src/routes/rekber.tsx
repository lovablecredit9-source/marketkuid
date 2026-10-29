import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Handshake, ShieldCheck, Wallet, Inbox } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/rekber")({
  head: () => pageMeta("Rekber Marketku — Rekening Bersama", "Titipkan dana ke Marketku sampai pembeli dan penjual selesai bertransaksi."),
  component: Rekber,
});

const TABS = ["Semua", "Perlu deposit", "Ditahan", "Sengketa", "Selesai"] as const;

function Rekber() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Semua");
  return (
    <AppShell>
      <div className="space-y-3 px-3 pt-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Handshake className="h-6 w-6 text-primary" /> Rekber Marketku</h1>
          <p className="mt-1 text-sm text-muted-foreground">Titipkan dana ke Marketku sampai kedua pihak selesai. Pencairan saldo rekber selalu diperiksa admin.</p>
        </div>
        {([[ShieldCheck, "Dana ditahan", "Rp0", "Total nilai rekber yang sedang dititipkan"], [Wallet, "Saldo rekber", "Rp0", "Pencairan diperiksa admin"], [Inbox, "Perlu tindakan", "0", "Rekber yang menunggu langkah Anda"]] as const).map(([I, t, v, d]) => (
          <div key={t} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm"><I className="h-4 w-4 text-primary" /> {t}</p>
            <p className="mt-1 text-lg font-bold">{v}</p>
            <p className="text-xs text-muted-foreground">{d}</p>
          </div>
        ))}
        <div className="flex gap-1.5 overflow-x-auto rounded-2xl border bg-card p-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition active:scale-95 ${tab === t ? "bg-primary text-primary-foreground" : ""}`}>{t}</button>
          ))}
        </div>
        <div className="rounded-2xl border bg-card px-6 py-10 text-center">
          <p className="font-bold">Belum ada rekber</p>
          <p className="mt-1 text-sm text-muted-foreground">Rekber yang dibagikan seller kepadamu akan muncul di sini.</p>
        </div>
      </div>
    </AppShell>
  );
}
