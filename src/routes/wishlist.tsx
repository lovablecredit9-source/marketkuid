import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/wishlist")({
  head: () => pageMeta("Wishlist — Marketku", "Produk digital favorit yang kamu simpan untuk dibeli nanti."),
  component: Wishlist,
});

function Wishlist() {
  const { user, ready } = useAuth();
  const list = useQuery({
    queryKey: ["wishlist", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("wishlists").select("product_id, created_at, products(name)").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = list.data ?? [];
  const guest = ready && !user;
  return (
    <AppShell>
      <div className="relative overflow-hidden px-4 pt-3">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-24 h-[26rem] w-[44rem] rounded-[50%] border border-primary/10" />
        <div aria-hidden className="pointer-events-none absolute -left-28 top-40 h-[22rem] w-[40rem] rounded-[50%] border border-primary/10" />
        {rows.length > 0 ? (
          <div className="relative space-y-3">
            <h1 className="text-lg font-bold">Wishlist <span className="text-sm font-normal text-muted-foreground">{rows.length} produk</span></h1>
            {rows.map((r) => (
              <div key={r.product_id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <Heart className="h-4 w-4 fill-destructive text-destructive" />
                <span className="font-semibold">{(r.products as { name: string } | null)?.name ?? "Produk"}</span>
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </div>
    </AppShell>
  );
}
