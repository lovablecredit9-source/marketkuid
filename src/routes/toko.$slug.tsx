import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Package, ShoppingBag, Star, Store, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell, EmptyState } from "@/components/marketku/shell";
import { ProductList, Stars } from "@/components/marketku/product-card";
import { ratingBars, ratingOf, useMarketProducts, useReviews, dbError, fmtDate } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/toko/$slug")({
  head: () => pageMeta("Toko Seller — Marketku", "Lihat produk, rating, dan ulasan pembeli dari toko seller di Marketku."),
  component: Toko,
});

const initials = (n: string) => n.split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase();

function Toko() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const store = useQuery({
    queryKey: ["store_slug", slug],
    queryFn: async () => (await supabase.rpc("store_by_slug", { p_slug: slug })).data?.[0] ?? null,
  });
  const s = store.data;
  const products = useMarketProducts({ owner: s?.owner_id ?? "__none__", limit: 100 });
  const reviews = useReviews({ seller: s?.owner_id ?? "" });
  const follow = useQuery({
    queryKey: ["follow", user?.id, s?.owner_id], enabled: !!user && !!s,
    queryFn: async () => !!(await supabase.from("store_follows").select("seller_id").eq("user_id", user!.id).eq("seller_id", s!.owner_id).maybeSingle()).data,
  });

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
  const toggleFollow = async () => {
    if (!user) { navigate({ to: "/login" }); return; }
    const on = follow.data;
    const { error } = on
      ? await supabase.from("store_follows").delete().eq("user_id", user.id).eq("seller_id", s.owner_id)
      : await supabase.from("store_follows").insert({ user_id: user.id, seller_id: s.owner_id });
    if (error) { toast.error("Gagal memperbarui"); return; }
    toast.success(on ? "Berhenti mengikuti toko" : "Mengikuti toko");
    void qc.invalidateQueries({ queryKey: ["follow", user.id, s.owner_id] });
  };

  return (
    <AppShell>
      <div className="space-y-4 px-3 pt-3">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="h-24 bg-gradient-to-br from-accent to-primary/20" />
          <div className="-mt-10 px-4 pb-4">
            <span className="grid h-20 w-20 place-items-center rounded-full border-4 border-card bg-accent text-2xl font-bold text-primary">{initials(s.store_name)}</span>
            <h1 className="mt-2 text-2xl font-bold">{s.store_name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => void chat()} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition active:scale-95"><MessageCircle className="h-4 w-4" /> Kirim Pesan</button>
              {!own && <button onClick={() => void toggleFollow()} className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition active:scale-95">{follow.data ? <><UserCheck className="h-4 w-4" /> Diikuti</> : <><UserPlus className="h-4 w-4" /> Ikuti</>}</button>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Toko dibuka sejak {since} · {s.is_open ? "Buka" : "Tutup"}</p>
            {s.description && <p className="mt-2 text-sm">{s.description}</p>}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[[Package, list.length, "Produk"], [ShoppingBag, sold, "Terjual"], [Star, r.count ? r.avg : 0, "Rating"]].map(([I, n, l]) => {
                const Icon = I as typeof Package;
                return <div key={l as string} className="flex items-center gap-2 rounded-xl border px-2 py-2"><Icon className="h-4 w-4 text-primary" /><span className="leading-tight"><b className="block text-sm">{n as number}</b><span className="text-xs text-muted-foreground">{l as string}</span></span></div>;
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
              {(reviews.data ?? []).slice(0, 10).map((x) => (
                <div key={x.id} className="rounded-2xl border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-primary">{x.buyer_label.charAt(0).toUpperCase()}</span>
                    <div className="flex-1"><b className="text-sm">{x.buyer_label}</b><Stars n={x.rating} /></div>
                    <span className="text-xs text-muted-foreground">{fmtDate(x.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{x.products?.name}</p>
                  {x.comment && <p className="mt-1 text-sm">{x.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
