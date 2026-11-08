import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/marketku/shell";
import { ProductList } from "@/components/marketku/product-card";
import type { CardProduct } from "@/lib/market";

/** Full product listing page like marketku.id /produk/baru and /produk/diskon. */
export function ProductListingPage({ title, desc, items, loading, empty }: { title: string; desc: string; items: CardProduct[]; loading: boolean; empty: string }) {
  return (
    <AppShell showSupport={false} wide>
      <div className="px-4 pt-5 lg:px-0">
        <h1 className="text-[22px] font-bold leading-tight text-foreground">{title}</h1>
        <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{desc}</p>
        <p className="mb-3 mt-5 text-[15px] font-bold text-foreground">{loading ? "Memuat…" : `${items.length} produk`}</p>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : items.length ? (
          <ProductList items={items} compact />
        ) : (
          <div className="rounded-2xl border bg-card px-5 py-6 text-center">
            <p className="text-[15px] font-bold text-muted-foreground">{empty}</p>
            <Link to="/" className="mt-3 inline-block text-[14px] text-muted-foreground">Kembali ke Beranda</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
