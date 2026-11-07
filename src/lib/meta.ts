/** Builds the per-route head() meta list (title, description, og, twitter). */
export const pageMeta = (title: string, description: string) => ({
  meta: [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});

const SITE = "https://marketkuid.lovable.app";
type SeoProduct = { name: string; description: string; store: string; minPrice: number; maxPrice: number; ratingAvg: number; ratingCount: number; inStock: boolean };

/** schema.org Product JSON-LD from real data; aggregateRating only when real reviews exist. */
export function productJsonLd(id: string, p: SeoProduct) {
  const url = `${SITE}/produk/${id}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    url,
    brand: { "@type": "Brand", name: p.store },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "IDR",
      lowPrice: p.minPrice,
      highPrice: p.maxPrice,
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: p.store },
    },
    ...(p.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(p.ratingAvg.toFixed(1)), reviewCount: p.ratingCount } } : {}),
  };
}

/** Product page head: real name/description, canonical URL and JSON-LD; generic copy when unknown. */
export function productHead(id: string, p: SeoProduct | null | undefined) {
  if (!p) return pageMeta("Detail Produk — Marketku", "Lihat varian, harga, spesifikasi, dan ulasan produk digital di Marketku.");
  const title = `${p.name} — ${p.store} | Marketku`;
  const desc = p.description || `Beli ${p.name} dari ${p.store} di Marketku.`;
  const m = pageMeta(title, desc);
  return {
    meta: [...m.meta, { property: "og:url", content: `${SITE}/produk/${id}` }],
    links: [{ rel: "canonical", href: `${SITE}/produk/${id}` }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(productJsonLd(id, p)) }],
  };
}

export function storeHead(s: { name: string; description: string; slug: string } | null | undefined) {
  if (!s) return pageMeta("Toko Seller — Marketku", "Lihat produk, rating, dan ulasan pembeli dari toko seller di Marketku.");
  const url = `${SITE}/toko/${encodeURIComponent(s.slug)}`;
  const m = pageMeta(`${s.name} — Toko di Marketku`, s.description);
  return {
    meta: [...m.meta, { property: "og:url", content: url }],
    links: [{ rel: "canonical", href: url }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "Store", name: s.name, description: s.description, url }) }],
  };
}
