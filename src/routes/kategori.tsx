import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { AppShell, EmptyState } from "@/components/marketku/shell";
import { ProductList } from "@/components/marketku/product-card";
import { useCategories, descendantIds } from "@/lib/products";
import { useCategoryCounts, useMarketProducts } from "@/lib/market";
import { categoryIcon } from "@/lib/category-icons";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/kategori")({
  head: () => pageMeta("Semua Kategori — Marketku", "Jelajahi semua kategori produk digital yang tersedia di Marketku."),
  component: KategoriPage,
});


function Tile({ name, count, img, to }: { name: string; count: number; img?: string | undefined; to: { kategori?: string } }) {
  return (
    <Link to="/cari" search={to} className="flex flex-col items-center rounded-xl border bg-card px-2 py-4 text-center shadow-sm transition active:scale-95">
      {img ? (
        <img src={img} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-border" />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-lg font-semibold text-primary">{name.charAt(0).toUpperCase()}</span>
      )}
      <span className="mt-2 line-clamp-2 text-sm font-medium leading-tight">{name}</span>
      <span className="mt-1 text-xs text-muted-foreground">{count}</span>
    </Link>
  );
}

function KategoriPage() {
  const router = useRouter();
  const cats = useCategories();
  const counts = useCategoryCounts();
  const products = useMarketProducts({ limit: 200 });
  const list = products.data ?? [];
  // A parent tile counts the products of all its sub-categories too.
  const tally = useMemo(() => {
    const all = cats.data ?? [];
    return new Map(all.map((c) => [c.id, descendantIds(all, c.id).reduce((n, id) => n + (counts.data?.get(id) ?? 0), 0)]));
  }, [cats.data, counts.data]);
  const sorted = useMemo(
    () => [...(cats.data ?? [])].sort((a, b) => (tally.get(b.id) ?? 0) - (tally.get(a.id) ?? 0) || a.sort - b.sort),
    [cats.data, tally],
  );
  const total = useMemo(() => [...(counts.data?.values() ?? [])].reduce((a, n) => a + n, 0), [counts.data]);

  return (
    <AppShell>
      <div className="space-y-4 px-3 pb-6 pt-3">
        <button onClick={() => router.history.back()} className="flex items-center gap-1.5 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" /> Kembali</button>
        <div>
          <h1 className="text-xl font-bold">Semua Kategori</h1>
          <p className="mt-1 text-sm text-muted-foreground">Jelajahi {sorted.length} kategori produk digital yang tersedia di Marketku.</p>
        </div>

        {cats.isLoading ? (
          <div className="grid grid-cols-3 gap-3">{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border bg-card" />)}</div>
        ) : (
          <div className="grid grid-cols-3 gap-3" data-tour="kategori-grid">
            <Tile name="Semua" count={total} to={{}} />
            {sorted.map((c) => <Tile key={c.id} name={c.name} count={tally.get(c.id) ?? 0} img={categoryIcon(c.name)} to={{ kategori: c.id }} />)}
          </div>
        )}

        <div className="flex items-baseline gap-2 pt-2">
          <h2 className="text-lg font-bold">Semua Produk</h2>
          <span className="text-sm text-muted-foreground">{list.length} produk</span>
        </div>
        {products.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : list.length ? <ProductList items={list} compact /> : (
          <EmptyState icon={PackageSearch} title="Belum ada produk" desc="Produk akan tampil di sini setelah seller menambahkannya." />
        )}
      </div>
    </AppShell>
  );
}
