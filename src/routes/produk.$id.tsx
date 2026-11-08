import { createFileRoute, redirect } from "@tanstack/react-router";
import { productHead } from "@/lib/meta";
import { getProductSeo } from "@/lib/seo.functions";
import { ProdukDetail } from "@/components/marketku/product-detail";

export const Route = createFileRoute("/produk/$id")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    const seo = await getProductSeo({ data: params.id });
    // Old /produk/<id> and /produk/<nama-produk> links move to /produk/<nama-toko>/<nama-produk>.
    if (seo) throw redirect({ to: "/produk/$toko/$produk", params: { toko: seo.storeSlug, produk: seo.slug ?? seo.id }, replace: true });
    return seo;
  },
  head: ({ params, loaderData }) => productHead(`/produk/${params.id}`, loaderData),
  component: OldProductLink,
});

/** Non-public products (e.g. a seller previewing a draft) still open by id. */
function OldProductLink() {
  const { id } = Route.useParams();
  return <ProdukDetail param={id} seo={Route.useLoaderData()} />;
}
