import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMarketProducts } from "@/lib/market";
import { pageMeta } from "@/lib/meta";
import { ProductListingPage } from "@/components/marketku/listing-page";

export const Route = createFileRoute("/produk/baru")({
  head: () => pageMeta("Produk Baru — Marketku", "Produk digital terbaru dari seller Marketku, diurutkan dari yang paling baru."),
  component: NewProducts,
});

function NewProducts() {
  const q = useMarketProducts({ limit: 200 });
  const items = useMemo(() => [...(q.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)), [q.data]);
  return (
    <ProductListingPage
      title="Produk Baru"
      desc="Temukan produk digital terbaru dari seller Marketku, diurutkan dari yang paling baru ditambahkan."
      items={items}
      loading={q.isLoading}
      empty="Belum ada produk baru."
    />
  );
}
