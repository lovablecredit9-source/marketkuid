import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import { isSitemapRouteIncluded, sitemapPathForLocation, sitemapStaticPaths, sitemapXML, type SitemapEntry } from "@/lib/sitemap";

const BASE_URL = "https://marketkuid.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const router = await getRouterInstance();
        const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path }));

        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            // Opaque sb_ keys are not JWTs; send apikey without the default bearer.
            if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          } },
        });

        const pageSize = 1000;
        const owners = new Set<string>();
        const productRoute = "/produk/$toko/$produk";
        const productRows: { id: string; slug: string | null; owner_id: string; updated_at: string }[] = [];
        // Products: same public filter as the storefront (active, not taken down by admin).
        for (let offset = 0; ; ) {
          const { data, error } = await supabase.from("products").select("id, slug, owner_id, updated_at")
            .eq("status", "active").eq("admin_hidden", false).order("id").range(offset, offset + pageSize - 1);
          if (error) throw error;
          if (data.length === 0) break;
          for (const row of data) {
            owners.add(row.owner_id);
            productRows.push(row);
          }
          offset += data.length;
        }

        // Stores that have public products (their link names are also needed for product links).
        const storeRoute = "/toko/$slug";
        const storeSlug = new Map<string, string>();
        const ids = [...owners].sort();
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await supabase.rpc("public_stores", { p_ids: ids.slice(i, i + 200) });
          if (error) throw error;
          for (const s of data ?? []) storeSlug.set(s.owner_id, s.slug || s.owner_id);
        }
        if (isSitemapRouteIncluded(router.routesById[storeRoute])) {
          for (const slug of storeSlug.values()) {
            const location = router.buildLocation({ to: "/toko/$slug", params: { slug }, search: () => ({}), hash: "" });
            const path = sitemapPathForLocation(router, location, storeRoute);
            if (path) entries.push({ path });
          }
        }
        // Products: /produk/<nama-toko>/<nama-produk>, same link the product page uses.
        if (isSitemapRouteIncluded(router.routesById[productRoute])) {
          for (const row of productRows) {
            const params = { toko: storeSlug.get(row.owner_id) ?? row.owner_id, produk: row.slug ?? row.id };
            const location = router.buildLocation({ to: "/produk/$toko/$produk", params, search: () => ({}), hash: "" });
            const path = sitemapPathForLocation(router, location, productRoute);
            if (path) entries.push({ path, lastmod: row.updated_at });
          }
        }

        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
