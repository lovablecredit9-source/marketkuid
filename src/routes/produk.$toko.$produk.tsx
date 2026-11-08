import { createFileRoute, redirect } from "@tanstack/react-router";
import { productHead } from "@/lib/meta";
import { getProductSeo } from "@/lib/seo.functions";
import { ProdukDetail } from "@/components/marketku/product-detail";

export const Route = createFileRoute("/produk/$toko/$produk")({
  staticData: { sitemap: true },
  loader: async ({ params }) => {
    const seo = await getProductSeo({ data: params.produk });
    // Wrong store name or an old product name in the link → move to the current one.
    if (seo && (seo.storeSlug !== params.toko || (seo.slug ?? seo.id) !== params.produk)) {
      throw redirect({ to: "/produk/$toko/$produk", params: { toko: seo.storeSlug, produk: seo.slug ?? seo.id }, replace: true });
    }
    return seo;
  },
  head: ({ params, loaderData }) => productHead(`/produk/${params.toko}/${params.produk}`, loaderData),
  component: ProductPage,
});

function ProductPage() {
  const { produk } = Route.useParams();
  return <ProdukDetail param={produk} seo={Route.useLoaderData()} />;
}
