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
        const productRoute = "/produk/$id";
        // Products: same public filter as the storefront (active, not taken down by admin).
        for (let offset = 0; ; ) {
          const { data, error } = await supabase.from("products").select("id, owner_id, updated_at")
            .eq("status", "active").eq("admin_hidden", false).order("id").range(offset, offset + pageSize - 1);
          if (error) throw error;
          if (data.length === 0) break;
          for (const row of data) {
            owners.add(row.owner_id);
            if (!isSitemapRouteIncluded(router.routesById[productRoute])) continue;
            const location = router.buildLocation({ to: "/produk/$id", params: { id: row.id }, search: () => ({}), hash: "" });
            const path = sitemapPathForLocation(router, location, productRoute);
            if (path) entries.push({ path, lastmod: row.updated_at });
          }
          offset += data.length;
        }

        // Stores that have public products.
        const storeRoute = "/toko/$slug";
        if (isSitemapRouteIncluded(router.routesById[storeRoute])) {
          const ids = [...owners].sort();
          for (let i = 0; i < ids.length; i += 200) {
            const { data, error } = await supabase.rpc("public_stores", { p_ids: ids.slice(i, i + 200) });
            if (error) throw error;
            for (const s of data ?? []) {
              if (!s.slug) continue;
              const location = router.buildLocation({ to: "/toko/$slug", params: { slug: s.slug }, search: () => ({}), hash: "" });
              const path = sitemapPathForLocation(router, location, storeRoute);
              if (path) entries.push({ path });
            }
          }
        }

        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
