import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/meta";

// marketku.id-style search links (/search?q=&category=&sort=) open the Cari page.
export const Route = createFileRoute("/search")({
  staticData: { sitemap: false },
  beforeLoad: ({ search }) => {
    const s = search as Record<string, unknown>;
    const str = (k: string) => (typeof s[k] === "string" && s[k] ? (s[k] as string) : undefined);
    const q = str("q"), kategori = str("category") ?? str("kategori"), sort = str("sort");
    throw redirect({ to: "/cari", search: { ...(q ? { q } : {}), ...(kategori ? { kategori } : {}), ...(sort ? { sort } : {}) } as never, replace: true });
  },
  head: () => pageMeta("Cari Produk — Marketku", "Cari produk digital di Marketku."),
});
