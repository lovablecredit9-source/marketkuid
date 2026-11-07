import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

export const SITE_URL = "https://marketkuid.lovable.app";

/** Session-free publishable client: only data the public storefront can already read. */
async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };

export type ProductSeo = { name: string; description: string; store: string; minPrice: number; maxPrice: number; ratingAvg: number; ratingCount: number; inStock: boolean } | null;

/** Title/description/price/rating for a product's head() and JSON-LD (real data only). */
export const getProductSeo = createServerFn({ method: "GET" })
  .inputValidator((id: string) => { if (typeof id !== "string") throw new Error("bad id"); return id; })
  .handler(async ({ data: id }): Promise<ProductSeo> => {
    if (!UUID.test(id)) return null;
    try {
      const sb = await publicClient();
      const { data: p } = await sb.from("products").select("id, name, description, owner_id, product_type, product_variants(id, price)").eq("id", id).eq("status", "active").maybeSingle();
      if (!p) return null;
      const variants = (p.product_variants ?? []) as { id: string; price: number }[];
      const prices = variants.map((v) => Number(v.price));
      const [stores, reviews, stock] = await Promise.all([
        sb.rpc("public_stores", { p_ids: [p.owner_id] }),
        sb.from("product_reviews").select("rating").eq("product_id", id).limit(2000),
        sb.rpc("variant_stock", { p_product_ids: [id] }),
      ]);
      const rs = (reviews.data ?? []).map((r) => Number(r.rating));
      const avail = (stock.data ?? []).reduce((a, s) => a + Number(s.available ?? 0), 0);
      return {
        name: p.name,
        description: clip(p.description || p.name, 155),
        store: stores.data?.[0]?.store_name ?? "Marketku",
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        ratingAvg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0,
        ratingCount: rs.length,
        inStock: p.product_type === "preorder" || avail > 0,
      };
    } catch {
      return null;
    }
  });

export type StoreSeo = { name: string; description: string; slug: string } | null;

export const getStoreSeo = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => { if (typeof slug !== "string" || slug.length > 120) throw new Error("bad slug"); return slug; })
  .handler(async ({ data: slug }): Promise<StoreSeo> => {
    try {
      const sb = await publicClient();
      let row: { store_name: string; description: string | null; slug: string | null } | undefined;
      if (UUID.test(slug)) row = (await sb.rpc("public_stores", { p_ids: [slug] })).data?.[0];
      else row = (await sb.rpc("store_by_slug", { p_slug: slug })).data?.[0];
      if (!row) return null;
      return { name: row.store_name, description: clip(row.description || `Produk digital dari ${row.store_name} di Marketku.`, 155), slug: row.slug || slug };
    } catch {
      return null;
    }
  });
