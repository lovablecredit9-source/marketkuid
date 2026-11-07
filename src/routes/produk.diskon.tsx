import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMarketProducts } from "@/lib/market";
import { pageMeta } from "@/lib/meta";
import { ProductListingPage } from "@/components/marketku/listing-page";

export const Route = createFileRoute("/produk/diskon")({
  staticData: { sitemap: true },
  head: () => pageMeta("Produk Lagi Diskon — Marketku", "Produk digital dengan harga spesial dan promo aktif, diurutkan dari diskon terbesar."),
  component: DiscountProducts,
});

function DiscountProducts() {
  const q = useMarketProducts({ limit: 200 });
  const items = useMemo(
    () => (q.data ?? []).filter((p) => p.basePrice > p.minPrice).sort((a, b) => (1 - b.minPrice / b.basePrice) - (1 - a.minPrice / a.basePrice)),
    [q.data],
  );
  return (
    <ProductListingPage
      title="Produk Lagi Diskon"
      desc="Jelajahi produk digital dengan harga spesial dan promo aktif, diurutkan dari diskon terbesar."
      items={items}
      loading={q.isLoading}
      empty="Belum ada produk yang sedang diskon."
    />
  );
}
