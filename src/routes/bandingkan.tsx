import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitCompareArrows, Star, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { ProductImage, rpBuyer } from "@/components/marketku/product-card";
import { useCompare } from "@/components/marketku/compare";
import { productTypeText } from "@/components/marketku/product-sheet";
import { useMarketProducts, type CardProduct } from "@/lib/market";
import { useImageUrls } from "@/lib/products";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/bandingkan")({
  staticData: { sitemap: false },
  head: () => pageMeta("Bandingkan Produk — Marketku", "Bandingkan harga, rating, stok, dan penjualan hingga 3 produk digital sekaligus."),
  component: Bandingkan,
});

type Row = { label: string; get: (p: CardProduct) => string; best?: (ps: CardProduct[]) => string | null };
const minBy = (ps: CardProduct[], f: (p: CardProduct) => number) => (ps.length > 1 ? ps.reduce((a, b) => (f(b) < f(a) ? b : a)).id : null);
const maxBy = (ps: CardProduct[], f: (p: CardProduct) => number) => (ps.length > 1 && ps.some((p) => f(p) > 0) ? ps.reduce((a, b) => (f(b) > f(a) ? b : a)).id : null);

const rows: Row[] = [
  { label: "Harga mulai", get: (p) => rpBuyer(p.minPrice), best: (ps) => minBy(ps, (p) => p.minPrice) },
  { label: "Harga normal", get: (p) => (p.basePrice > p.minPrice ? rpBuyer(p.basePrice) : "-") },
  { label: "Rating", get: (p) => (p.rating.count ? `${p.rating.avg.toFixed(1)} ★ (${p.rating.count})` : "Belum ada"), best: (ps) => maxBy(ps, (p) => p.rating.avg) },
  { label: "Terjual", get: (p) => `${p.sold_count}`, best: (ps) => maxBy(ps, (p) => p.sold_count) },
  { label: "Stok", get: (p) => (p.stock > 0 ? `${p.stock}` : "Habis"), best: (ps) => maxBy(ps, (p) => p.stock) },
  { label: "Disukai", get: (p) => `${p.likes}`, best: (ps) => maxBy(ps, (p) => p.likes) },
  { label: "Jenis", get: (p) => productTypeText(p.product_type) },
  { label: "Kategori", get: (p) => p.category ?? "-" },
  { label: "Toko", get: (p) => `${p.storeName}${p.storeOpen ? "" : " (tutup)"}` },
];

function Bandingkan() {
  const { ids, toggle, clear } = useCompare();
  const q = useMarketProducts({ ids, limit: 3 });
  const items = ids.length ? ids.map((id) => q.data?.find((p) => p.id === id)).filter((p): p is CardProduct => !!p) : [];
  const urls = useImageUrls(items.map((p) => p.images[0] ?? "").filter(Boolean));

  return (
    <AppShell wide>
      <div className="px-3 pt-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="flex items-center gap-1 text-xs font-bold tracking-wider text-primary"><GitCompareArrows className="h-3.5 w-3.5" /> BANDINGKAN</p>
            <h1 className="mt-0.5 text-[19px] font-bold">Bandingkan Produk</h1>
            <p className="text-xs text-muted-foreground">Pilih hingga 3 produk dari halaman detail produk.</p>
          </div>
          {items.length > 0 && <button onClick={clear} className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold text-destructive transition active:scale-95"><Trash2 className="h-3.5 w-3.5" /> Hapus semua</button>}
        </div>

        {ids.length === 0 || (!q.isLoading && items.length === 0) ? (
          <div className="flex flex-col items-center pb-10 pt-16 text-center">
            <span className="grid h-28 w-28 place-items-center rounded-full bg-accent text-primary"><GitCompareArrows className="h-12 w-12" /></span>
            <h2 className="mt-6 text-xl font-bold">Belum ada produk dibandingkan</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">Buka produk, lalu ketuk tombol <b>Bandingkan</b> untuk melihat harga & rating berdampingan.</p>
            <Link to="/cari" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95">Cari Produk <ArrowRight className="h-4 w-4" /></Link>
          </div>
        ) : q.isLoading ? (
          <div className="mt-4 h-80 animate-pulse rounded-2xl border bg-card" />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border bg-card shadow-sm">
            <table className="w-full min-w-[340px] table-fixed text-xs">
              <thead>
                <tr>
                  <th className="w-[84px] border-b p-2" />
                  {items.map((p) => (
                    <th key={p.id} className="border-b border-l p-2 align-top font-normal">
                      <div className="relative">
                        <button aria-label={`Hapus ${p.name}`} onClick={() => toggle(p.id)} className="absolute -right-1 -top-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-card shadow transition active:scale-90"><X className="h-3.5 w-3.5" /></button>
                        <Link to="/produk/$id" params={{ id: p.id }}>
                          <ProductImage url={p.images[0] ? urls.data?.[p.images[0]] : undefined} alt={p.name} className="aspect-square w-full rounded-xl" />
                          <p className="mt-1.5 line-clamp-2 text-left text-[12px] font-bold leading-snug">{p.name}</p>
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const best = r.best?.(items) ?? null;
                  return (
                    <tr key={r.label} className="even:bg-muted/30">
                      <td className="p-2 font-semibold text-muted-foreground">{r.label}</td>
                      {items.map((p) => (
                        <td key={p.id} className={`border-l p-2 ${best === p.id ? "font-bold text-tone-green" : ""}`}>
                          {r.get(p)}{best === p.id && <Star className="ml-1 inline h-3 w-3 fill-current" />}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td className="p-2" />
                  {items.map((p) => (
                    <td key={p.id} className="border-l p-2">
                      <Link to="/produk/$id" params={{ id: p.id }} className="block rounded-lg bg-primary py-2 text-center text-[11px] font-bold text-primary-foreground transition active:scale-95">Lihat</Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {items.length > 0 && items.length < 3 && <p className="mt-3 text-center text-xs text-muted-foreground">Kamu masih bisa menambah {3 - items.length} produk lagi.</p>}
      </div>
    </AppShell>
  );
}
