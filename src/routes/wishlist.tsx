import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/wishlist")({
  head: () => pageMeta("Wishlist — Marketku", "Produk digital yang kamu simpan untuk dibeli nanti."),
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
  return (
    <AppShell title="Wishlist">
      <div className="space-y-3 px-3 pt-3">
        <h1 className="text-lg font-bold">Wishlist <span className="text-sm font-normal text-muted-foreground">{rows.length} produk</span></h1>
        {ready && !user ? (
          <EmptyState icon={Heart} title="Masuk untuk melihat wishlist" desc="Simpan produk favoritmu setelah masuk." action={<Link to="/login" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Masuk</Link>} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Heart} title="Wishlist masih kosong" desc="Tekan ikon hati di produk untuk menyimpannya di sini." action={<PrimaryLink to="/cari">Jelajahi produk</PrimaryLink>} />
        ) : rows.map((r) => (
          <div key={r.product_id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Heart className="h-4 w-4 fill-destructive text-destructive" />
            <span className="font-semibold">{(r.products as { name: string } | null)?.name ?? "Produk"}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
