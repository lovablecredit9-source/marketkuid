import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";

export const Route = createFileRoute("/keranjang")({
  head: () => ({
    meta: [
      { title: "Keranjang — Marketku" },
      { name: "description", content: "Keranjang belanja produk digital Marketku." },
      { property: "og:title", content: "Keranjang — Marketku" },
      { property: "og:description", content: "Keranjang belanja Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Keranjang,
});

function Keranjang() {
  return (
    <AppShell>
      <div className="space-y-4 px-3 pt-4">
        <h1 className="text-lg font-bold">Keranjang</h1>
        <EmptyState icon={ShoppingCart} title="Keranjang masih kosong" desc="Produk yang kamu tambahkan akan muncul di sini." action={<PrimaryLink to="/cari">Mulai belanja</PrimaryLink>} />
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total (0 item)</span><span className="font-bold">Rp0</span></div>
          <button disabled className="mt-3 w-full rounded-xl bg-primary/50 py-3 font-bold text-primary-foreground">Checkout</button>
        </div>
      </div>
    </AppShell>
  );
}
