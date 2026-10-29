import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Package, ShoppingBag, Star, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell, EmptyState } from "@/components/marketku/shell";
import { ProductList, Stars } from "@/components/marketku/product-card";
import { ratingBars, ratingOf, useMarketProducts, useReviews, dbError, fmtDate } from "@/lib/market";
import { pageMeta } from "@/lib/meta";
import { useImageUrls, useStoreMedia } from "@/lib/products";

export const Route = createFileRoute("/toko/$slug")({
  head: () => pageMeta("Toko Seller — Marketku", "Lihat produk, rating, dan ulasan pembeli dari toko seller di Marketku."),
  component: Toko,
});

const initials = (n: string) => n.split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase();

function Toko() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const store = useQuery({
    queryKey: ["store_slug", slug],
    queryFn: async () => (await supabase.rpc("store_by_slug", { p_slug: slug })).data?.[0] ?? null,
  });
  const s = store.data;
  const products = useMarketProducts({ owner: s?.owner_id ?? "__none__", limit: 100 });
  const reviews = useReviews({ seller: s?.owner_id ?? "" });
  const media = useStoreMedia(s?.owner_id ? [s.owner_id] : []);
  const m = s?.owner_id ? media.data?.[s.owner_id] : undefined;
  const mediaUrls = useImageUrls([m?.avatar_path ?? "", m?.banner_path ?? ""]);
  const avatarUrl = m?.avatar_path ? mediaUrls.data?.[m.avatar_path] : undefined;
  const bannerUrl = m?.banner_path ? mediaUrls.data?.[m.banner_path] : undefined;
  const reviewImgs = useImageUrls([...new Set((reviews.data ?? []).map((x) => x.products?.images?.[0] ?? "").filter(Boolean))]);


  if (store.isLoading) return <AppShell><div className="m-3 h-72 animate-pulse rounded-2xl border bg-card" /></AppShell>;
  if (!s) return <AppShell><div className="p-3"><EmptyState icon={Store} title="Toko tidak ditemukan" desc="Link toko ini tidak tersedia." /></div></AppShell>;

  const list = s.owner_id ? products.data ?? [] : [];
  const sold = list.reduce((a, p) => a + p.sold_count, 0);
  const r = ratingOf(reviews.data ?? []);
  const own = user?.id === s.owner_id;
  const since = new Date(s.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const chat = async () => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (own) { toast("Ini toko kamu sendiri"); return; }
    const { data, error } = await supabase.rpc("start_conversation", { p_seller: s.owner_id });
    if (error || !data) { toast.error(dbError(error)); return; }
    navigate({ to: "/chat/$id", params: { id: data } });
  };

  return (
    <AppShell>
      <div className="space-y-4 px-3 pt-3">
        <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          {bannerUrl
            ? <img src={bannerUrl} alt={`Banner ${s.store_name}`} className="aspect-[4/1] min-h-28 w-full object-cover" />
            : (
              <div className="relative grid aspect-[4/1] min-h-28 place-items-center overflow-hidden bg-gradient-to-b from-accent to-card">
                <svg aria-hidden className="absolute inset-0 h-full w-full text-primary/15" preserveAspectRatio="none" viewBox="0 0 400 100"><path d="M0 0 L60 50 L0 100 M400 0 L340 50 L400 100" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                <p className="relative text-xs text-muted-foreground">Ukuran banner rekomendasi 1600 × 400 px</p>
              </div>
            )}
          <div className="-mt-10 px-5 pb-4">
            {avatarUrl
              ? <img src={avatarUrl} alt={`Foto ${s.store_name}`} className="relative h-20 w-20 rounded-full border-4 border-card bg-card object-cover shadow" />
              : <span className="relative grid h-20 w-20 place-items-center rounded-full border-4 border-card bg-accent text-2xl font-bold text-primary shadow">{initials(s.store_name)}</span>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{s.store_name}</h1>
              <button onClick={() => void chat()} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition active:scale-95"><MessageCircle className="h-3.5 w-3.5" /> Kirim Pesan</button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Toko dibuka sejak {since}{s.is_open ? "" : " · Sedang tutup"}</p>
            {s.description && <p className="mt-2 text-sm">{s.description}</p>}
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {[[Package, list.length, "Produk"], [ShoppingBag, sold, "Terjual"], [Star, `${(r.count ? r.avg : 0).toFixed(1)} ★`, "Rating"]].map(([I, n, l]) => {
                const Icon = I as typeof Package;
                return <div key={l as string} className="flex min-w-[96px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2"><Icon className={`h-4 w-4 ${l === "Rating" ? "text-warning" : "text-muted-foreground"}`} /><span className="leading-tight"><b className="block text-sm">{n as number | string}</b><span className="text-xs text-muted-foreground">{l as string}</span></span></div>;
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <p className="text-center text-4xl font-bold">{r.avg || 0}</p>
          <p className="text-center text-xs text-muted-foreground">/5.0</p>
          <div className="mt-1 flex justify-center"><Stars n={Math.round(r.avg)} size="h-4 w-4" /></div>
          <p className="text-center text-sm text-muted-foreground">{r.count} ulasan</p>
          <div className="mt-3 space-y-1">
            {ratingBars(reviews.data ?? []).map((b) => (
              <div key={b.star} className="flex items-center gap-2 text-xs">{b.star}<Star className="h-3 w-3 fill-warning text-warning" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-warning" style={{ width: r.count ? `${(b.n / r.count) * 100}%` : 0 }} /></span>{b.n}</div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex justify-between"><h2 className="font-bold">Tampilkan semua produk</h2><span className="text-sm text-muted-foreground">Produk ({list.length})</span></div>
          {list.length ? <ProductList items={list} compact /> : <EmptyState icon={Package} title="Belum ada produk" desc="Toko ini belum punya produk aktif." />}
        </section>

        <section>
          <h2 className="mb-2 font-bold">Ulasan pembeli</h2>
          {(reviews.data ?? []).length === 0 ? <p className="rounded-2xl border bg-card p-4 text-center text-sm text-muted-foreground">Belum ada ulasan untuk toko ini.</p> : (
            <div className="space-y-2">
              {(reviews.data ?? []).slice(0, 20).map((x) => {
                const img = x.products?.images?.[0];
                return (
                  <div key={x.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">{initials(x.buyer_label || "?")}</span>
                      <div className="min-w-0 flex-1"><b className="block truncate text-sm">{x.buyer_label}</b><Stars n={x.rating} /></div>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(x.created_at)}</span>
                    </div>
                    {x.comment && <p className="mt-3 text-sm">{x.comment}</p>}
                    {x.products?.name && (
                      <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-muted/60 px-2 py-1.5">
                        {img && reviewImgs.data?.[img] ? <img src={reviewImgs.data[img]} alt="" className="h-6 w-6 shrink-0 rounded object-cover" /> : <Package className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="truncate text-xs">{x.products.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
