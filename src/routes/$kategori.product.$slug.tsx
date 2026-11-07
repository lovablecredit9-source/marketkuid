import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { idFromProductSlug } from "@/lib/product-link";
import { pageMeta } from "@/lib/meta";

// Opens marketku.id-style links (/gemini/product/gemini-pro-3-bulan-<id>) on the product page.
export const Route = createFileRoute("/$kategori/product/$slug")({
  staticData: { sitemap: false },
  beforeLoad: ({ params }) => {
    const id = idFromProductSlug(params.slug);
    if (!id) throw notFound();
    throw redirect({ to: "/produk/$id", params: { id }, replace: true });
  },
  head: () => pageMeta("Produk — Marketku", "Lihat detail produk digital di Marketku."),
});
