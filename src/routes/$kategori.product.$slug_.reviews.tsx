import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { idFromProductSlug } from "@/lib/product-link";
import { pageMeta } from "@/lib/meta";

// marketku.id-style review links (/gemini/product/<slug>-<id>/reviews) open the reviews page.
export const Route = createFileRoute("/$kategori/product/$slug_/reviews")({
  staticData: { sitemap: false },
  beforeLoad: ({ params }) => {
    const id = idFromProductSlug(params.slug);
    if (!id) throw notFound();
    throw redirect({ to: "/ulasan/$id", params: { id }, replace: true });
  },
  head: () => pageMeta("Ulasan Produk — Marketku", "Lihat semua ulasan pembeli produk di Marketku."),
});
