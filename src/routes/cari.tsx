import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Sparkles, PackageSearch, Star, Megaphone, ArrowRight } from "lucide-react";
import { SearchSuggest, useStoreSearch } from "@/components/marketku/search-suggest";
import { AppShell, EmptyState } from "@/components/marketku/shell";
import { ProductList, rpBuyer } from "@/components/marketku/product-card";
import { useCategories, useImageUrls, useStoreMedia } from "@/lib/products";
import { SORTS, sortProducts, trackAdClick, useMarketProducts, useSponsored, type SortKey } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

type S = { q?: string; kategori?: string };
export const Route = createFileRoute("/cari")({
  validateSearch: (s: Record<string, unknown>): S => ({
    ...(typeof s["q"] === "string" && s["q"] ? { q: s["q"] } : {}),
    ...(typeof s["kategori"] === "string" && s["kategori"] ? { kategori: s["kategori"] } : {}),
  }),
  head: () => pageMeta("Cari Produk — Marketku", "Cari dan saring produk digital di Marketku berdasarkan kategori, harga, dan rating."),
  component: Cari,
});

const RATINGS = [0, 4, 4.5, 4.8];

function Cari() {
  const { q = "", kategori } = Route.useSearch();
  const [val, setVal] = useState(q);
  const [show, setShow] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const [sort, setSort] = useState<SortKey>("relevan");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);
  const navigate = useNavigate();
  const cats = useCategories();
  const catId = kategori ? cats.data?.find((c) => c.id === kategori || c.name.toLowerCase() === kategori.toLowerCase())?.id ?? null : null;
  const products = useMarketProducts({ q, category: catId, limit: 200 });
  const all = products.data ?? [];
  const ceiling = Math.max(50_000, ...all.map((p) => p.minPrice));
  const list = useMemo(
    () => sortProducts(all.filter((p) => (maxPrice == null || p.minPrice <= maxPrice) && p.rating.avg >= minRating), sort, q),
    [all, maxPrice, minRating, sort, q],
  );
  const setCat = (id: string | null) => navigate({ to: "/cari", search: { ...(q ? { q } : {}), ...(id ? { kategori: id } : {}) } });
  const reset = () => { setMaxPrice(null); setMinRating(0); setCat(null); };

  return (
    <AppShell>
      <div className="space-y-3 px-3 pt-3">
        <form className="relative" onSubmit={(e) => { e.preventDefault(); setSuggest(false); navigate({ to: "/cari", search: { ...(val.trim() ? { q: val.trim() } : {}), ...(kategori ? { kategori } : {}) } }); }}>
          <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input type="search" value={val} onChange={(e) => { setVal(e.target.value); setSuggest(true); }} onFocus={() => setSuggest(true)} onBlur={() => setSuggest(false)} placeholder="Cari produk digital..." className="w-full bg-transparent text-sm outline-none" />
          </label>
          {suggest && val.trim() && val.trim() !== q && (
            <SearchSuggest q={val} className="absolute inset-x-0 top-full mt-1"
              onPick={() => setSuggest(false)}
              onAll={() => { setSuggest(false); navigate({ to: "/cari", search: { q: val.trim(), ...(kategori ? { kategori } : {}) } }); }} />
          )}
        </form>
        <div>
          <p className="flex items-center gap-1 text-xs font-bold tracking-wider text-primary"><Sparkles className="h-3 w-3" /> JELAJAHI MARKETKU</p>
          <h1 className="mt-0.5 text-[19px] font-bold">{q ? `Hasil untuk "${q}"` : "Semua Produk"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{list.length} produk ditemukan</p>
        </div>
        <button onClick={() => setShow(!show)} className="flex w-full items-center gap-2 rounded-full border-0 bg-card px-4 py-2.5 text-[13px] font-medium shadow-sm transition active:scale-[0.98]">
          <SlidersHorizontal className="h-4 w-4" /> {show ? "Sembunyikan filter" : "Filter"}
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Urutkan" className="w-full rounded-full border-0 bg-card px-4 py-2.5 text-[15px] font-bold shadow-sm">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {show && (
          <section className="space-y-4 rounded-2xl border bg-card p-4 animate-in fade-in-0 slide-in-from-top-2">
            <div>
              <p className="flex items-center gap-2 font-bold"><SlidersHorizontal className="h-4 w-4" /> Filter</p>
              <p className="mt-1 text-xs font-bold tracking-widest text-muted-foreground">KATEGORI</p>
              <div className="mt-2 space-y-1">
                <button onClick={() => setCat(null)} className={`w-full rounded-lg px-4 py-2 text-left text-sm font-semibold ${!catId ? "bg-primary text-primary-foreground" : ""}`}>Semua</button>
                {(cats.data ?? []).map((c) => (
                  <button key={c.id} onClick={() => setCat(c.id)} className={`w-full rounded-lg px-4 py-2 text-left text-sm ${catId === c.id ? "bg-primary font-semibold text-primary-foreground" : ""}`}>{c.name}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-muted-foreground">HARGA MAKS.</p>
              <input type="range" min={1000} max={ceiling} step={500} value={maxPrice ?? ceiling} onChange={(e) => setMaxPrice(Number(e.target.value))} className="mt-2 w-full accent-primary" aria-label="Harga maksimal" />
              <p className="text-sm">{rpBuyer(0)} – {rpBuyer(maxPrice ?? ceiling)}</p>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-muted-foreground">RATING MINIMUM</p>
              <div className="mt-2 flex gap-2">
                {RATINGS.map((r) => (
                  <button key={r} onClick={() => setMinRating(r)} className={`flex flex-1 flex-col items-center rounded-lg px-2 py-1.5 text-xs font-semibold ${minRating === r ? "bg-primary text-primary-foreground" : ""}`}>
                    {r === 0 ? "Semua" : <><Star className="h-3.5 w-3.5 fill-current" />{r}+</>}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={reset} className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-primary">Reset Filter</button>
          </section>
        )}

        {q && <RelatedSellers q={q} />}
        {q && <SearchAds q={q} />}

        {products.isLoading ? (
          <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : list.length ? <ProductList items={list} /> : (
          <EmptyState icon={PackageSearch} title="Produk belum tersedia" desc="Belum ada produk yang cocok. Coba kata kunci lain." />
        )}
      </div>
    </AppShell>
  );
}

/** "Seller terkait": stores whose name matches the search term, linking to their profile. */
function RelatedSellers({ q }: { q: string }) {
  const stores = useStoreSearch(q, 5);
  const list = stores.data ?? [];
  const media = useStoreMedia(list.map((s) => s.owner_id));
  const avatars = useImageUrls(list.map((s) => media.data?.[s.owner_id]?.avatar_path ?? "").filter(Boolean));
  if (!list.length) return null;
  return (
    <section className="space-y-2 pt-1">
      <h2 className="text-[17px] font-bold">Seller terkait</h2>
      {list.map((s) => {
        const path = media.data?.[s.owner_id]?.avatar_path;
        const url = path ? avatars.data?.[path] : undefined;
        const reviews = Number(s.review_count);
        return (
          <div key={s.owner_id} className="flex items-start gap-3 rounded-2xl border bg-card p-3.5 shadow-sm">
            {url ? <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover shadow-sm" />
              : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary shadow-sm">{s.store_name.charAt(0).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{s.store_name}</p>
              <p className="mt-1 flex items-center gap-1 text-[12.5px] text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-current" />
                {reviews ? <><b className="text-foreground">{Number(s.rating_avg ?? 0).toFixed(1)}</b> · {reviews} ulasan</> : "Belum ada ulasan"}
                <span>· {Number(s.product_count)} produk</span>
              </p>
              {!s.is_open && <p className="mt-1 text-[12px] font-semibold text-destructive">Toko sedang tutup</p>}
              <Link to="/toko/$slug" params={{ slug: s.slug || s.owner_id }} className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-[12.5px] font-bold text-primary transition active:scale-95">
                Lihat profil <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Sponsored products whose campaign keywords match the search term. */
function SearchAds({ q }: { q: string }) {
  const ads = useSponsored(q, 4);
  const items = ads.data ?? [];
  if (!items.length) return null;
  return (
    <section className="space-y-2" onClickCapture={(e) => {
      const id = (e.target as HTMLElement).closest("[data-campaign]")?.getAttribute("data-campaign");
      if (id) trackAdClick(id);
    }}>
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground"><Megaphone className="h-3.5 w-3.5" /> BERSPONSOR</p>
      {items.map((p) => <div key={p.campaignId} data-campaign={p.campaignId}><ProductList items={[p]} /></div>)}
    </section>
  );
}
