import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BellRing, Heart, TrendingDown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/marketku/shell";
import { PriceLine, ProductImage, rpBuyer, useToggleWishlist } from "@/components/marketku/product-card";
import { useMarketProducts } from "@/lib/market";
import { useImageUrls } from "@/lib/products";
import { priceDrop, readPriceSnap, savePriceSnap, snapPrices, type PriceSnap } from "@/lib/buyer-tools";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/wishlist")({
  staticData: { sitemap: false },
  head: () => pageMeta("Wishlist — Marketku", "Produk digital favorit yang kamu simpan untuk dibeli nanti, lengkap dengan pantau harga turun."),
  component: Wishlist,
});

type Sort = "baru" | "murah" | "turun";

function Wishlist() {
  const { user, ready } = useAuth();
  const list = useQuery({
    queryKey: ["wishlist", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("wishlists").select("product_id, created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const ids = (list.data ?? []).map((r) => r.product_id);
  const products = useMarketProducts({ ids, limit: 200 });
  const toggle = useToggleWishlist();
  const [snap, setSnap] = useState<PriceSnap>({});
  const [sort, setSort] = useState<Sort>("baru");

  // Remember the first price seen for each saved product so a later drop can be shown.
  useEffect(() => {
    if (!products.data) return;
    const prev = readPriceSnap();
    const next = snapPrices(prev, products.data.map((p) => ({ id: p.id, price: p.minPrice })));
    setSnap(prev);
    if (JSON.stringify(next) !== JSON.stringify(prev)) savePriceSnap(next);
  }, [products.data]);

  const order = new Map(ids.map((id, i) => [id, i]));
  const items = useMemo(() => {
    const ps = [...(products.data ?? [])];
    const drop = (id: string, now: number) => priceDrop(snap[id], now)?.amount ?? 0;
    if (sort === "murah") ps.sort((a, b) => a.minPrice - b.minPrice);
    else if (sort === "turun") ps.sort((a, b) => drop(b.id, b.minPrice) - drop(a.id, a.minPrice));
    else ps.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return ps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.data, sort, snap, ids.join(",")]);
  const urls = useImageUrls(items.map((p) => p.images[0] ?? "").filter(Boolean));
  const drops = items.filter((p) => priceDrop(snap[p.id], p.minPrice));
  const total = items.reduce((a, p) => a + p.minPrice, 0);
  const guest = ready && !user;
  const loading = !!user && (list.isLoading || (ids.length > 0 && products.isLoading));

  return (
    <AppShell wide>
      <div className="relative overflow-hidden px-3 pt-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : items.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h1 className="text-lg font-bold">Wishlist <span className="text-sm font-normal text-muted-foreground">{items.length} produk</span></h1>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan wishlist" className="rounded-full border bg-card px-3 py-1.5 text-xs font-bold">
                <option value="baru">Terbaru disimpan</option>
                <option value="murah">Harga termurah</option>
                <option value="turun">Harga turun</option>
              </select>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border bg-gradient-to-r from-accent to-card p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><BellRing className="h-5 w-5" /></span>
              <p className="text-xs leading-snug">
                {drops.length > 0 ? <><b className="text-tone-green">{drops.length} produk turun harga</b> sejak kamu simpan. Buruan sebelum naik lagi!</> : <>Pantau harga aktif — kami tandai produk yang <b>turun harga</b> sejak kamu simpan.</>}
                <span className="mt-0.5 block text-muted-foreground">Total semua mulai {rpBuyer(total)}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 dt:grid-cols-4 xl:grid-cols-5">
              {items.map((p) => {
                const d = priceDrop(snap[p.id], p.minPrice);
                return (
                  <div key={p.id} className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <Link to="/produk/$id" params={{ id: p.id }} className="block">
                      <div className="relative">
                        <ProductImage url={p.images[0] ? urls.data?.[p.images[0]] : undefined} alt={p.name} className="aspect-square" />
                        {d && <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-tone-green px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground"><TrendingDown className="h-3 w-3" /> Turun {d.percent}%</span>}
                        {!p.storeOpen && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-foreground/80 px-2 py-0.5 text-[10px] font-bold text-background">TOKO TUTUP</span>}
                      </div>
                      <div className="px-2.5 pb-2.5 pt-2">
                        {p.category && <p className="truncate text-[11px] font-medium uppercase text-primary">{p.category}</p>}
                        <p className="mt-1 line-clamp-2 min-h-[2.5em] text-[12px] font-medium uppercase leading-snug">{p.name}</p>
                        <PriceLine p={p} className="mt-1.5 text-[13px] font-semibold" />
                        {d && <p className="text-[10.5px] text-muted-foreground">Hemat {rpBuyer(d.amount)} dari {rpBuyer(snap[p.id]!)}</p>}
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.storeName}</p>
                      </div>
                    </Link>
                    <button aria-label={`Hapus ${p.name} dari wishlist`} onClick={() => void toggle(p.id, true)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-sm transition active:scale-90"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div aria-hidden className="pointer-events-none absolute -left-40 top-24 h-[26rem] w-[44rem] rounded-[50%] border border-primary/10" />
            <div aria-hidden className="pointer-events-none absolute -left-28 top-40 h-[22rem] w-[40rem] rounded-[50%] border border-primary/10" />
            <div className="relative flex flex-col items-center pb-10 pt-16 text-center">
              <span className="grid h-32 w-32 place-items-center rounded-full bg-primary shadow-xl shadow-primary/30">
                <Heart className="h-14 w-14 text-tone-pink" strokeWidth={2.5} />
              </span>
              <h1 className="mt-8 text-2xl font-bold">{guest ? "Masuk untuk melihat wishlist" : "Wishlist masih kosong"}</h1>
              <p className="mt-3 max-w-xs text-base text-muted-foreground">{guest ? "Simpan produk favoritmu setelah masuk ke akun." : "Tandai produk favoritmu dengan ikon hati untuk menyimpannya di sini."}</p>
              <Link to={guest ? "/login" : "/cari"} className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95">
                {guest ? "Masuk" : "Jelajahi Produk"} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
