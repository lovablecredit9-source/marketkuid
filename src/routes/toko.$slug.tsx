import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, MessageCircle, Package, ShoppingBag, Star, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell, EmptyState } from "@/components/marketku/shell";
import { ProductList, Stars } from "@/components/marketku/product-card";
import { ratingBars, ratingOf, useMarketProducts, useReviews, dbError, fmtDate } from "@/lib/market";
import { pageMeta } from "@/lib/meta";
import { useImageUrls, useStoreMedia } from "@/lib/products";
import { Button } from "@/components/ui/button";

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
  const banned = useQuery({
    queryKey: ["store_banned", s?.owner_id], enabled: !!s?.owner_id,
    queryFn: async () => s?.owner_id ? !!(await supabase.rpc("store_ban_status", { p_owner: s.owner_id })).data : false,
  });
  const products = useMarketProducts({ owner: s?.owner_id ?? "__none__", limit: 100 });
  const reviews = useReviews({ seller: s?.owner_id ?? "" });
  const media = useStoreMedia(s?.owner_id ? [s.owner_id] : []);
  const m = s?.owner_id ? media.data?.[s.owner_id] : undefined;
  const mediaUrls = useImageUrls([m?.avatar_path ?? "", m?.banner_path ?? ""]);
  const avatarUrl = m?.avatar_path ? mediaUrls.data?.[m.avatar_path] : undefined;
  const bannerUrl = m?.banner_path ? mediaUrls.data?.[m.banner_path] : undefined;
  const reviewImgs = useImageUrls([...new Set((reviews.data ?? []).map((x) => x.products?.images?.[0] ?? "").filter(Boolean))]);


  if (store.isLoading) return <AppShell showSupport={false}><div className="mx-8 mt-4 h-72 animate-pulse rounded-2xl border bg-card" /></AppShell>;
  if (!s) return <AppShell showSupport={false}><div className="p-3"><EmptyState icon={Store} title="Toko tidak ditemukan" desc="Link toko ini tidak tersedia." /></div></AppShell>;

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
    <AppShell showSupport={false} className="store-profile">
      <div className="space-y-5 px-8 pt-4">
        <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          {bannerUrl
            ? <img src={bannerUrl} alt={`Banner ${s.store_name}`} className="h-[120px] w-full object-cover" />
            : (
              <div className="relative h-[120px] overflow-hidden bg-gradient-to-b from-accent to-card">
                <svg aria-hidden className="absolute inset-0 h-full w-full text-primary/20" preserveAspectRatio="none" viewBox="0 0 400 140"><path d="M0 10 L70 60 L0 120 M400 10 L330 60 L400 120" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-medium text-muted-foreground">Ukuran banner rekomendasi 1600 × 400 px</p>
              </div>
            )}
          <div className="-mt-10 px-6 pb-6">
            {avatarUrl
              ? <img src={avatarUrl} alt={`Foto ${s.store_name}`} className="relative h-[90px] w-[90px] rounded-full border-4 border-card bg-card object-cover shadow" />
              : <span className="relative grid h-[90px] w-[90px] place-items-center rounded-full border-4 border-card bg-accent text-2xl font-bold text-primary shadow">{initials(s.store_name)}</span>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-[22px] font-bold leading-tight">{s.store_name}</h1>
              <Button size="sm" onClick={() => void chat()} className="h-7 gap-1 rounded-full px-2.5 text-[10px]"><MessageCircle /> Kirim Pesan</Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Toko dibuka sejak {since}{s.is_open ? "" : " · Sedang tutup"}</p>
            {banned.data && <p className="mt-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">Toko ini sedang diblokir oleh Marketku. Produknya tidak bisa dibeli untuk sementara.</p>}
            {s.description && <p className="mt-2 text-sm">{s.description}</p>}
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[[Package, list.length, "Produk"], [ShoppingBag, sold, "Terjual"], [Star, r.count ? `${r.avg.toFixed(1)} ★` : "-", "Rating"], [MessageSquare, r.count, "Ulasan"]].map(([I, n, l]) => {
                const Icon = I as typeof Package;
                return <div key={l as string} className="flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5"><Icon className={`h-4 w-4 shrink-0 ${l === "Rating" ? "text-warning" : "text-muted-foreground"}`} /><span className="leading-[1.15]"><b className="block text-xs">{n as number | string}</b><span className="block text-[10.5px] text-muted-foreground">{l as string}</span></span></div>;
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-center text-[30px] font-bold leading-tight">{r.avg.toFixed(1)}</p>
          <p className="text-center text-xs text-muted-foreground">/5.0</p>
          <p className="mt-2 text-center text-[12px] leading-none tracking-[0.08em] text-warning">{"★★★★★".slice(0, Math.round(r.avg)) || "-"}<span className="text-muted">{"★★★★★".slice(Math.round(r.avg))}</span></p>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{r.count} ulasan</p>
          <div className="mt-5 space-y-2 border-t pt-5">
            {ratingBars(reviews.data ?? []).map((b) => (
              <div key={b.star} className="flex items-center gap-1 text-[11px]"><span className="flex w-6 items-center gap-0.5 font-semibold">{b.star}<span className="text-[10px] text-warning">★</span></span>
                <span className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-warning" style={{ width: r.count ? `${(b.n / r.count) * 100}%` : 0 }} /></span><span className="w-3 text-right text-muted-foreground">{b.n}</span></div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Tampilkan semua produk</h2><span className="shrink-0 text-[11px] text-muted-foreground">Produk ({list.length})</span></div>
          {list.length ? <ProductList items={list} simple /> : <EmptyState icon={Package} title="Belum ada produk" desc="Toko ini belum punya produk aktif." />}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold">Ulasan pembeli</h2>
          {(reviews.data ?? []).length === 0 ? <p className="rounded-2xl border bg-card p-4 text-center text-sm text-muted-foreground">Belum ada ulasan untuk toko ini.</p> : (
            <div className="space-y-3">
              {(reviews.data ?? []).slice(0, 20).map((x) => {
                const img = x.products?.images?.[0];
                return (
                  <div key={x.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-primary">{initials(x.buyer_label || "?")}</span>
                      <div className="min-w-0 flex-1"><b className="block break-words text-xs">{x.buyer_label}</b><div className="mt-1"><Stars n={x.rating} size="h-3 w-3" /></div></div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(x.created_at)}</span>
                    </div>
                    {x.comment && <p className="mt-3 text-xs">{x.comment}</p>}
                    {x.products?.name && (
                      <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-muted/60 px-2 py-1.5">
                        {img && reviewImgs.data?.[img] ? <img src={reviewImgs.data[img]} alt="" className="h-6 w-6 shrink-0 rounded object-cover" /> : <Package className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="min-w-0 break-words text-[10px]">{x.products.name}</span>
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
