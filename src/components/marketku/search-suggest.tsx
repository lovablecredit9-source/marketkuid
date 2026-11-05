import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { unitPrice, type Discount } from "@/lib/market";
import { useImageUrls, useStoreMedia } from "@/lib/products";
import { rpBuyer } from "@/components/marketku/product-card";

/** Debounced copy of a value (keeps live suggestions from querying on every keystroke). */
export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const clean = (q: string) => q.trim().replace(/[%,()_]/g, " ").trim();

/** Stores whose name matches the search term (public info only, via `search_stores`). */
export function useStoreSearch(q: string, limit = 5) {
  const term = clean(q);
  return useQuery({
    queryKey: ["search_stores", term, limit],
    enabled: term.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_stores", { p_q: term, p_limit: limit });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useProductSuggest(q: string) {
  const term = clean(q);
  return useQuery({
    queryKey: ["search_suggest", term],
    enabled: term.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("id, name, images, product_categories(name), product_variants(price, discount)")
        .eq("status", "active").ilike("name", `%${term}%`).order("sold_count", { ascending: false }).limit(6);
      if (error) throw error;
      return (data ?? []).map((p) => {
        const prices = (p.product_variants ?? []).map((v) => unitPrice(Number(v.price), 1, v.discount as Discount));
        return { id: p.id, name: p.name, image: (p.images ?? [])[0] ?? null, category: (p.product_categories as { name: string } | null)?.name ?? "Lainnya", price: prices.length ? Math.min(...prices) : 0 };
      });
    },
  });
}

/** Live dropdown under a search box: matching products and sellers, plus "Lihat semua hasil". */
export function SearchSuggest({ q, onPick, onAll, className = "" }: { q: string; onPick: () => void; onAll: () => void; className?: string }) {
  const term = useDebounced(q);
  const products = useProductSuggest(term);
  const stores = useStoreSearch(term);
  const prods = products.data ?? [];
  const sellers = stores.data ?? [];
  const imgs = useImageUrls(prods.map((p) => p.image ?? "").filter(Boolean));
  const media = useStoreMedia(sellers.map((s) => s.owner_id));
  const avatarPaths = sellers.map((s) => media.data?.[s.owner_id]?.avatar_path ?? "").filter(Boolean);
  const avatars = useImageUrls(avatarPaths);
  if (!clean(term)) return null;
  const loading = products.isLoading || stores.isLoading;
  const empty = !loading && !prods.length && !sellers.length;

  return (
    <div role="listbox" aria-label="Saran pencarian" onMouseDown={(e) => e.preventDefault()}
      className={`z-40 max-h-[70vh] overflow-y-auto rounded-xl border bg-card py-2 shadow-lg animate-in fade-in-0 slide-in-from-top-1 ${className}`}>
      {loading && !prods.length && !sellers.length && <p className="px-4 py-3 text-[13px] text-muted-foreground">Mencari…</p>}
      {empty && <p className="px-4 py-3 text-[13px] text-muted-foreground">Tidak ada produk atau seller yang cocok</p>}
      {prods.length > 0 && (
        <div>
          <p className="px-4 pb-1 pt-1.5 text-[11px] font-bold tracking-wider text-muted-foreground">PRODUK</p>
          {prods.map((p) => {
            const url = p.image ? imgs.data?.[p.image] : undefined;
            return (
              <Link key={p.id} to="/produk/$id" params={{ id: p.id }} onClick={onPick} className="flex items-center gap-3 px-4 py-2 transition active:bg-accent">
                {url ? <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                  : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-[13px] font-bold text-primary">{p.name.charAt(0).toUpperCase()}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{p.category} · {rpBuyer(p.price)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {sellers.length > 0 && (
        <div className={prods.length ? "mx-3 mt-1 border-t pt-1" : ""}>
          <p className={`${prods.length ? "px-1" : "px-4"} pb-1 pt-1.5 text-[11px] font-bold tracking-wider text-muted-foreground`}>SELLER</p>
          {sellers.map((s) => {
            const path = media.data?.[s.owner_id]?.avatar_path;
            const url = path ? avatars.data?.[path] : undefined;
            return (
              <Link key={s.owner_id} to="/toko/$slug" params={{ slug: s.slug }} onClick={onPick} className={`flex items-center gap-3 ${prods.length ? "px-1" : "px-4"} py-2 transition active:bg-accent`}>
                {url ? <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                  : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Store className="h-4 w-4" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{s.store_name}</span>
                  <span className="block text-[12px] text-muted-foreground">{Number(s.product_count)} produk{!s.is_open && " · Toko tutup"}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {!empty && (
        <button type="button" onClick={onAll} className="mt-1 flex w-full items-center justify-center gap-1.5 py-2.5 text-[13.5px] font-bold text-primary">
          Lihat semua hasil <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
