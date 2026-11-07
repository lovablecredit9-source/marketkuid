import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Zap, Clock } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { ProductImage, rpBuyer } from "@/components/marketku/product-card";
import { useNow } from "@/components/marketku/flash-strip";
import { useMarketProducts, type CardProduct } from "@/lib/market";
import { useImageUrls } from "@/lib/products";
import { applyFlash, countdown, flashPhase, useFlashSales, type FlashSale } from "@/lib/flash";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/flash-sale")({
  head: () => pageMeta("Flash Sale — Marketku", "Promo flash sale terjadwal dari seller Marketku: diskon terbatas waktu dan kuota."),
  component: FlashSalePage,
});

type Tab = "live" | "upcoming";

function FlashSalePage() {
  const now = useNow();
  const [tab, setTab] = useState<Tab>("live");
  const sales = useFlashSales();
  const all = sales.data ?? [];
  const ids = useMemo(() => [...new Set(all.map((f) => f.product_id))], [all]);
  const products = useMarketProducts({ ids, limit: 200 });
  const byId = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);
  const visible = all.filter((f) => byId.get(f.product_id)?.storeOpen);
  const live = visible.filter((f) => ["live", "soldout"].includes(flashPhase(f, now))).sort((a, b) => b.percent - a.percent);
  const upcoming = visible.filter((f) => flashPhase(f, now) === "upcoming");
  const list = tab === "live" ? live : upcoming;
  const urls = useImageUrls([...new Set(list.map((f) => byId.get(f.product_id)?.images[0] ?? "").filter(Boolean))]);
  const loading = sales.isLoading || (ids.length > 0 && products.isLoading);

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
          <span className="rounded-full border bg-card px-4 py-2 text-[14px] font-bold text-foreground shadow-sm">{loading ? "…" : live.length + upcoming.length} promo</span>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-1">
          {([["live", `Berlangsung (${live.length})`], ["upcoming", `Akan Datang (${upcoming.length})`]] as [Tab, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={`rounded-lg py-2 text-[13px] font-bold transition ${tab === v ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : list.length ? (
          <div className="space-y-3">
            {list.map((f) => { const p = byId.get(f.product_id); return p ? <FlashRow key={f.id} f={f} p={p} url={urls.data?.[p.images[0] ?? ""]} now={now} /> : null; })}
          </div>
        ) : (
          <div className="rounded-xl border bg-card px-6 py-6 text-center">
            <p className="text-[15px] font-bold text-muted-foreground">{tab === "live" ? "Belum ada produk flash sale yang cocok." : "Belum ada flash sale terjadwal."}</p>
            <p className="mt-3 text-[14px] leading-snug text-muted-foreground">Kembali lagi saat seller menjadwalkan promo baru.</p>
            <Link to="/" className="mt-3 inline-block text-[14px] text-muted-foreground">Kembali ke Beranda</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FlashRow({ f, p, url, now }: { f: FlashSale; p: CardProduct; url: string | undefined; now: number }) {
  const phase = flashPhase(f, now);
  // Card prices already include a live flash; an upcoming one is previewed on the regular price.
  const flashPrice = phase === "upcoming" ? applyFlash(p.minPrice, f.percent) : p.minPrice;
  const pct = f.quota ? Math.min(100, Math.round((f.sold / f.quota) * 100)) : null;
  return (
    <Link to="/produk/$id" params={{ id: p.id }} className="flex gap-3 rounded-2xl border bg-card p-2.5 shadow-sm active:scale-[0.99]">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
        <ProductImage url={url} alt={p.name} className="h-full w-full" />
        <span className="absolute left-1 top-1 rounded-md bg-destructive px-1.5 py-0.5 text-[10.5px] font-bold text-destructive-foreground">-{f.percent}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold uppercase leading-snug">{p.name}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[15px] font-bold text-destructive">{rpBuyer(flashPrice)}</span>
          {p.basePrice > flashPrice && <span className="text-[11px] text-muted-foreground line-through">{rpBuyer(p.basePrice)}</span>}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {phase === "upcoming" ? "Mulai dalam" : phase === "soldout" ? "Kuota habis · berakhir" : "Berakhir dalam"}
          <b className="font-mono text-foreground">{countdown(+new Date(phase === "upcoming" ? f.starts_at : f.ends_at) - now)}</b>
        </p>
        {pct !== null && (
          <div className="mt-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-destructive" style={{ width: `${pct}%` }} /></div>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">{f.sold}/{f.quota} terjual</p>
          </div>
        )}
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.storeName}</p>
      </div>
    </Link>
  );
}
