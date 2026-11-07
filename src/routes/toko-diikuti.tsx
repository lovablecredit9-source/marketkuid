import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Store, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/marketku/shell";
import { useImageUrls, useStoreMedia } from "@/lib/products";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/toko-diikuti")({
  staticData: { sitemap: false },
  head: () => pageMeta("Toko Diikuti — Marketku", "Daftar toko produk digital favorit yang kamu ikuti di Marketku."),
  component: TokoDiikuti,
});

const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function TokoDiikuti() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["followed_stores", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: f, error } = await supabase.from("store_follows").select("seller_id, created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (f ?? []).map((r) => r.seller_id);
      if (!ids.length) return [];
      const { data: stores } = await supabase.rpc("public_stores", { p_ids: ids });
      const m = new Map((stores ?? []).map((s) => [s.owner_id, s]));
      return (f ?? []).map((r) => ({ ...r, store: m.get(r.seller_id) ?? null })).filter((r) => r.store);
    },
  });
  const rows = list.data ?? [];
  const media = useStoreMedia(rows.map((r) => r.seller_id));
  const urls = useImageUrls(rows.map((r) => media.data?.[r.seller_id]?.avatar_path ?? "").filter(Boolean));

  const unfollow = async (seller: string) => {
    if (!user) return;
    const { error } = await supabase.from("store_follows").delete().eq("user_id", user.id).eq("seller_id", seller);
    if (error) { toast.error("Gagal berhenti mengikuti"); return; }
    toast.success("Berhenti mengikuti toko");
    void qc.invalidateQueries({ queryKey: ["followed_stores", user.id] });
    void qc.invalidateQueries({ queryKey: ["follow"] });
  };

  const guest = ready && !user;
  return (
    <AppShell>
      <div className="px-3 pt-3">
        <p className="flex items-center gap-1 text-xs font-bold tracking-wider text-primary"><Store className="h-3.5 w-3.5" /> FAVORIT</p>
        <h1 className="mt-0.5 text-[19px] font-bold">Toko Diikuti {rows.length > 0 && <span className="text-sm font-normal text-muted-foreground">{rows.length} toko</span>}</h1>
        {list.isLoading && user ? (
          <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center pb-10 pt-16 text-center">
            <span className="grid h-28 w-28 place-items-center rounded-full bg-accent text-primary"><Store className="h-12 w-12" /></span>
            <h2 className="mt-6 text-xl font-bold">{guest ? "Masuk untuk melihat toko diikuti" : "Belum ada toko yang diikuti"}</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{guest ? "Ikuti toko favoritmu setelah masuk ke akun." : "Buka halaman toko lalu ketuk Ikuti supaya toko favoritmu mudah ditemukan lagi."}</p>
            <Link to={guest ? "/login" : "/cari"} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95">{guest ? "Masuk" : "Jelajahi Produk"} <ArrowRight className="h-4 w-4" /></Link>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((r) => {
              const s = r.store!;
              const av = media.data?.[r.seller_id]?.avatar_path;
              return (
                <div key={r.seller_id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
                  <Link to="/toko/$slug" params={{ slug: s.slug }} className="flex min-w-0 flex-1 items-center gap-3">
                    {av && urls.data?.[av] ? <img src={urls.data[av]} alt={s.store_name} className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-primary">{initials(s.store_name)}</span>}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{s.store_name}</span>
                      <span className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${s.is_open ? "text-tone-green" : "text-muted-foreground"}`}><span className={`h-1.5 w-1.5 rounded-full ${s.is_open ? "bg-tone-green" : "bg-muted-foreground"}`} />{s.is_open ? "Buka" : "Sedang tutup"}</span>
                    </span>
                  </Link>
                  <button aria-label={`Berhenti mengikuti ${s.store_name}`} onClick={() => void unfollow(r.seller_id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-muted-foreground transition active:scale-90"><UserMinus className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
