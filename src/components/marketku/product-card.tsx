import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingCart, Star, Package, ShoppingBag } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useImageUrls } from "@/lib/products";
import type { CardProduct } from "@/lib/market";

export const rpBuyer = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

export function PriceLine({ p, className }: { p: CardProduct; className: string }) {
  const off = p.basePrice > p.minPrice ? Math.round(((p.basePrice - p.minPrice) / p.basePrice) * 100) : 0;
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 ${className}`}>
      <span className="text-primary">{rpBuyer(p.minPrice)}</span>
      {off > 0 && <><span className="text-[11px] font-normal text-muted-foreground line-through">{rpBuyer(p.basePrice)}</span><span className="rounded bg-destructive/10 px-1 text-[10px] font-bold text-destructive">-{off}%</span></>}
    </p>
  );
}

export function useWishlistIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wishlist_ids", user?.id], enabled: !!user,
    queryFn: async () => new Set(((await supabase.from("wishlists").select("product_id").eq("user_id", user!.id)).data ?? []).map((r) => r.product_id)),
  });
}

export function useToggleWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return async (productId: string, on: boolean) => {
    if (!user) { toast("Masuk dulu untuk menyimpan wishlist"); return; }
    const { error } = on
      ? await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId)
      : await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
    if (error) { toast.error("Gagal memperbarui wishlist"); return; }
    toast.success(on ? "Dihapus dari wishlist" : "Disimpan ke wishlist");
    void qc.invalidateQueries({ queryKey: ["wishlist_ids", user.id] });
    void qc.invalidateQueries({ queryKey: ["wishlist", user.id] });
  };
}

export function ProductImage({ path, url, alt, className = "" }: { path?: string | null | undefined; url?: string | undefined; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      {url ? <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" /> : (
        <div className="grid h-full w-full place-items-center text-muted-foreground"><Package className="h-8 w-8" />{path ? <span className="sr-only">{alt}</span> : null}</div>
      )}
    </div>
  );
}

/** Large card used on beranda, pencarian, and store pages (matches the screenshot list layout). */
export function ProductCard({ p, url, wished, onWish, compact = false, simple = false }: { p: CardProduct; url?: string | undefined; wished: boolean; onWish: () => void; compact?: boolean; simple?: boolean }) {
  const navigate = useNavigate();
  const closed = !p.storeOpen;
  const out = p.product_type !== "preorder" && p.stock <= 0;
  if (simple) return (
    <Link to="/produk/$id" params={{ id: p.id }} className="block overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative">
        <ProductImage url={url} alt={p.name} className="aspect-square" />
        {(closed || out) && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-foreground/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-background">{closed ? "TOKO TUTUP" : "STOK HABIS"}</span>}
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        {p.category && <p className="truncate text-[11px] font-medium uppercase text-primary">{p.category}</p>}
        <p className="mt-1 line-clamp-2 min-h-[2.5em] text-[12px] font-medium uppercase leading-snug">{p.name}</p>
        <PriceLine p={p} className="mt-1.5 text-[13px] font-semibold" />
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><ShoppingBag className="h-3 w-3" />{p.sold_count} terjual</p>
      </div>
    </Link>
  );
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <Link to="/produk/$id" params={{ id: p.id }} className="block">
        <div className="relative">
          <ProductImage url={url} alt={p.name} className={compact ? "aspect-square" : "aspect-[16/10]"} />
          {(closed || out) && (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-foreground/80 px-3 py-1 text-xs font-bold tracking-wider text-background">
              {closed ? "TOKO TUTUP" : "STOK HABIS"}
            </span>
          )}
        </div>
      </Link>
      <div className="p-3">
        {p.category && <span className="inline-block rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">{p.category}</span>}
        <Link to="/produk/$id" params={{ id: p.id }} className={`mt-1.5 block font-semibold leading-snug ${compact ? "line-clamp-2 text-sm" : "line-clamp-2"}`}>{p.name}</Link>
        <PriceLine p={p} className="mt-1.5 font-bold" />
        <div className="mt-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{p.rating.count ? p.rating.avg.toFixed(1) : "0"}</span>
            {p.sold_count > 0 ? `${p.sold_count}+ terjual` : "Belum terjual"}
          </span>
          <div className="flex gap-1.5">
            <button aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"} onClick={onWish} className="grid h-8 w-8 place-items-center rounded-lg border transition active:scale-90">
              <Heart className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : ""}`} />
            </button>
            <button aria-label="Lihat dan beli" onClick={() => navigate({ to: "/produk/$id", params: { id: p.id } })} className="grid h-8 w-10 place-items-center rounded-lg border border-primary/30 bg-accent text-primary transition active:scale-90">
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>
        </div>
        {compact && <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.storeName}</p>}
      </div>
    </article>
  );
}

/** Product grid/list with signed image URLs and wishlist state resolved once. */
export function ProductList({ items, compact = false, simple = false }: { items: CardProduct[]; compact?: boolean; simple?: boolean }) {
  const urls = useImageUrls(items.map((p) => p.images[0] ?? "").filter(Boolean));
  const wish = useWishlistIds();
  const toggle = useToggleWishlist();
  return (
    <div className={compact || simple ? "grid grid-cols-2 gap-3" : "space-y-3"}>
      {items.map((p) => {
        const on = wish.data?.has(p.id) ?? false;
        return <ProductCard key={p.id} p={p} compact={compact} simple={simple} url={p.images[0] ? urls.data?.[p.images[0]] : undefined} wished={on} onWish={() => void toggle(p.id, on)} />;
      })}
    </div>
  );
}

export function Stars({ n, size = "h-3.5 w-3.5" }: { n: number; size?: string }) {
  return <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= n ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />)}</span>;
}
