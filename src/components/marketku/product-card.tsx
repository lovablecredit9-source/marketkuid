import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Heart, ShoppingCart, Star, Package, ShoppingBag, Store } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useImageUrls } from "@/lib/products";
import type { CardProduct } from "@/lib/market";

export const rpBuyer = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

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

/** Long press (touch, 450ms) shows the seller peek like marketku.id; the tap that ends a long press doesn't open the product. */
export function useSellerPeek() {
  const [peek, setPeek] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  return {
    peek,
    bind: {
      onPointerDown: (e: PointerEvent) => { if (e.pointerType === "mouse") return; clear(); timer.current = setTimeout(() => { setPeek(true); pressed.current = true; timer.current = null; }, 450); },
      onPointerUp: () => { clear(); if (peek || pressed.current) window.setTimeout(() => setPeek(false), 900); },
      onPointerCancel: () => { clear(); if (peek || pressed.current) window.setTimeout(() => setPeek(false), 900); },
      onPointerLeave: () => { clear(); if (peek) setPeek(false); },
      onContextMenu: (e: MouseEvent) => { if (pressed.current || peek) e.preventDefault(); },
      onClickCapture: (e: MouseEvent) => { if (pressed.current) { e.preventDefault(); e.stopPropagation(); pressed.current = false; } },
    },
  };
}

/** Store name + store rating over the bottom of the product photo (hover / long press). */
export function SellerPeek({ p }: { p: CardProduct }) {
  const name = p.storeName.trim();
  if (!name) return null;
  const r = p.storeRating ?? p.rating;
  return (
    <div className="mk-seller-peek" aria-hidden="true">
      <div className="flex min-w-0 items-center gap-[5px]">
        <span className="mk-seller-peek__avatar"><Store className="h-[13px] w-[13px]" /></span>
        <span className="truncate text-[12px] font-bold">{name}</span>
      </div>
      <div className="inline-flex items-center gap-1 text-[11px] font-semibold">
        <Star className="h-3 w-3 fill-warning text-warning" />
        <span>{r.count > 0 ? r.avg.toFixed(1) : "Baru"}</span>
        {r.count > 0 && <span className="mk-seller-peek__reviews">({r.count.toLocaleString("id-ID")})</span>}
      </div>
    </div>
  );
}

/** "-50%" + "FLASH" badges on the image while a flash sale is live (like marketku.id). */
export function FlashBadges({ p }: { p: CardProduct }) {
  const off = p.basePrice > p.minPrice ? Math.round(((p.basePrice - p.minPrice) / p.basePrice) * 100) : 0;
  return (
    <span className="absolute left-2 top-2 flex items-center gap-1">
      {off > 0 && <span className="rounded-md bg-destructive px-1.5 py-0.5 text-[11px] font-bold text-destructive-foreground">-{off}%</span>}
      <span className="rounded-md bg-warning px-1.5 py-0.5 text-[11px] font-bold text-warning-foreground">FLASH</span>
    </span>
  );
}

/** Large card used on beranda, pencarian, and store pages (matches the screenshot list layout). */
export function ProductCard({ p, url, wished, onWish, compact = false, simple = false }: { p: CardProduct; url?: string | undefined; wished: boolean; onWish: () => void; compact?: boolean; simple?: boolean }) {
  const navigate = useNavigate();
  const { peek, bind } = useSellerPeek();
  const closed = !p.storeOpen;
  const out = p.product_type !== "preorder" && p.stock <= 0;
  if (simple) {
    // Store page card: bigger photo, discount + wishlist on the image, rating and sold count, detail button.
    const off = p.basePrice > p.minPrice ? Math.round(((p.basePrice - p.minPrice) / p.basePrice) * 100) : 0;
    return (
      <article className="store-card group relative flex flex-col overflow-hidden rounded-xl border bg-card">
        <Link to="/produk/$id" params={{ id: p.id }} className="relative block overflow-hidden" aria-label={p.name}>
          <ProductImage url={url} alt={p.name} className="store-card__img aspect-square" />
          {off > 0 && !closed && <span className="absolute left-2 top-2 rounded-md bg-destructive px-1.5 py-0.5 text-[11px] font-bold text-destructive-foreground">-{off}%</span>}
          {(closed || out) && <span className="absolute inset-x-2 bottom-2 rounded-md bg-foreground/80 py-1 text-center text-[10px] font-bold tracking-wider text-background">{closed ? "TOKO TUTUP" : "STOK HABIS"}</span>}
        </Link>
        <button type="button" aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"} aria-pressed={wished} onClick={onWish}
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-card/95 shadow-sm transition active:scale-90">
          <Heart className={`h-3.5 w-3.5 ${wished ? "fill-destructive text-destructive" : "text-foreground/70"}`} />
        </button>
        <div className="flex flex-1 flex-col p-2.5">
          {p.category && <p className="truncate text-[10.5px] font-semibold text-store-electric">{p.category}</p>}
          <Link to="/produk/$id" params={{ id: p.id }} className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[12px] font-semibold leading-snug hover:text-store-electric">{p.name}</Link>
          <p className="mt-1 text-[13.5px] font-bold leading-tight text-store-electric">{rpBuyer(p.minPrice)}</p>
          {off > 0 && <p className="text-[11px] text-muted-foreground line-through">{rpBuyer(p.basePrice)}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
            {p.rating.count > 0 && <span className="flex items-center gap-0.5 font-semibold text-foreground"><Star className="h-3 w-3 fill-warning text-warning" />{p.rating.avg.toFixed(1)}</span>}
            <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3" />{p.sold_count > 0 ? `${p.sold_count.toLocaleString("id-ID")} terjual` : "Belum terjual"}</span>
          </p>
          <div className="mt-auto pt-2">
            <Link to="/produk/$id" params={{ id: p.id }} className="flex h-8 items-center justify-center rounded-lg border text-[11.5px] font-semibold text-store-electric transition hover:bg-store-electric/10">
              Lihat detail
            </Link>
          </div>
        </div>
      </article>
    );
  }
  return (
    <article {...bind} className={`mk-peek-card overflow-hidden rounded-[20px] border bg-card shadow-sm ${peek ? "is-seller-peek" : ""}`}>
      <Link to="/produk/$id" params={{ id: p.id }} className="block p-1.5 pb-0">
        <div className="relative overflow-hidden rounded-[14px]">
          <ProductImage url={url} alt={p.name} className={compact ? "aspect-square" : "aspect-[16/10]"} />
          <SellerPeek p={p} />
          <button type="button" aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWish(); }} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-sm transition active:scale-90">
            <Heart className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : ""}`} />
          </button>
          {!closed && p.flash && <FlashBadges p={p} />}
          {(closed || out) && (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-foreground/80 px-3 py-1 text-xs font-bold tracking-wider text-background">
              {closed ? "TOKO TUTUP" : "STOK HABIS"}
            </span>
          )}
        </div>
      </Link>
      <div className="p-3">
        {p.category && <span className="inline-block rounded-full border bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{p.category}</span>}
        <Link to="/produk/$id" params={{ id: p.id }} className={`mt-2 block font-semibold uppercase leading-snug ${compact ? "line-clamp-2 text-[12px]" : "line-clamp-2 text-[13px]"}`}>{p.name}</Link>
        <PriceLine p={p} className="mt-2 text-[15px] font-bold" />
        <div className="mt-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{p.rating.count ? p.rating.avg.toFixed(1) : "0"}</span>
            {p.sold_count > 0 ? `${p.sold_count}+ terjual` : "Belum terjual"}
          </span>
          <div className="flex gap-1.5">
            <button aria-label="Lihat dan beli" onClick={() => navigate({ to: "/produk/$id", params: { id: p.id } })} className="grid h-8 w-8 place-items-center rounded-lg border bg-card text-muted-foreground transition active:scale-90">
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
    <div className={simple ? "grid grid-cols-2 gap-3 @xl:grid-cols-3 @3xl:grid-cols-4" : compact ? "grid grid-cols-2 gap-3" : "space-y-3"}>
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
