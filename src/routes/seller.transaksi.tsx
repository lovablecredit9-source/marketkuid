import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingBag, Clock, ClipboardCheck, CircleCheck, CircleX, DollarSign, BarChart3, SlidersHorizontal } from "lucide-react";
import { soon } from "@/components/marketku/shell";
import { SellerCard, SellerEmpty, StatCell, rpSeller } from "@/components/marketku/seller-ui";

export const Route = createFileRoute("/seller/transaksi")({
  head: () => ({
    meta: [
      { title: "Transaksi — Seller Center Marketku" },
      { name: "description", content: "Pantau dan proses pesanan pembeli di toko Marketku kamu." },
      { property: "og:title", content: "Transaksi — Seller Center Marketku" },
      { property: "og:description", content: "Pesanan toko di Seller Center Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Transaksi,
});

const filters = [
  { k: "semua", label: "Semua Pesanan", icon: ShoppingBag },
  { k: "pending", label: "Pre-order Belum Diproses", icon: Clock },
  { k: "diproses", label: "Pre-order Diproses", icon: ClipboardCheck },
] as const;

function Transaksi() {
  const [f, setF] = useState<(typeof filters)[number]["k"]>("semua");
  const [q, setQ] = useState("");
  return (
    <>
      <div className="flex items-center gap-4 px-1">
        <ShoppingBag className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Pesanan Saya</h2>
          <p className="text-muted-foreground">0 transaksi ditemukan</p>
        </div>
      </div>

      <SellerCard className="flex gap-1 overflow-x-auto p-1.5">
        {filters.map(({ k, label, icon: I }) => (
          <button key={k} onClick={() => setF(k)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${f === k ? "bg-primary text-primary-foreground" : "text-foreground/80"}`}>
            <I className="h-4 w-4" /> {label}
          </button>
        ))}
      </SellerCard>

      <SellerCard className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell icon={CircleCheck} label="Selesai" value="0" />
        <StatCell icon={CircleX} label="Dibatalkan" value="0" />
        <StatCell icon={DollarSign} label="Nilai Selesai" value={rpSeller(0)} />
        <StatCell icon={BarChart3} label="Jenis Produk" value="0" />
      </SellerCard>

      <SellerCard className="flex items-stretch overflow-hidden">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari order ID, produk, pelanggan..."
          className="min-w-0 flex-1 border-r bg-background/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
        <button aria-label="Filter" onClick={() => soon("Filter pesanan")} className="grid w-14 place-items-center transition active:scale-90"><SlidersHorizontal className="h-5 w-5" /></button>
      </SellerCard>

      <SellerCard>
        <SellerEmpty icon={ShoppingBag} title="Belum ada pesanan" desc="Pesanan dari pembeli akan muncul di sini." />
      </SellerCard>
    </>
  );
}
