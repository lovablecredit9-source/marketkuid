import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/flash-sale")({
  head: () => pageMeta("Flash Sale — Marketku", "Promo flash sale terjadwal dari seller Marketku."),
  component: FlashSale,
});

// Flash sale promos are scheduled by sellers; there is no scheduling yet, so the page shows
// the same empty state as marketku.id instead of demo products.
function FlashSale() {
  const promos = 0;
  return (
    <AppShell showSupport={false}>
      <div className="space-y-4 px-4 pt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-[14px] font-bold text-foreground shadow-sm active:scale-95">
            <ArrowLeft className="h-4 w-4" /> Beranda
          </Link>
          <span className="flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-[14px] font-bold text-destructive-foreground shadow-sm">
            <Zap className="h-4 w-4" /> Flash Sale
          </span>
          <span className="rounded-full border bg-card px-4 py-2 text-[14px] font-bold text-foreground shadow-sm">{promos} promo</span>
        </div>
        <div className="rounded-xl border bg-card px-6 py-6 text-center">
          <p className="text-[15px] font-bold text-muted-foreground">Belum ada produk flash sale yang cocok.</p>
          <p className="mt-3 text-[14px] leading-snug text-muted-foreground">Kembali lagi saat seller menjadwalkan promo baru.</p>
          <Link to="/" className="mt-3 inline-block text-[14px] text-muted-foreground">Kembali ke Beranda</Link>
        </div>
      </div>
    </AppShell>
  );
}
