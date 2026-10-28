import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Package, Boxes, CheckSquare, FileText, SlidersHorizontal, ArrowUpDown, LayoutGrid, List, Plus } from "lucide-react";
import { soon } from "@/components/marketku/shell";
import { SellerCard, SellerEmpty, StatCell } from "@/components/marketku/seller-ui";

export const Route = createFileRoute("/seller/produk")({
  head: () => ({
    meta: [
      { title: "Produk Saya — Seller Center Marketku" },
      { name: "description", content: "Tambah dan kelola produk digital toko kamu di Marketku." },
      { property: "og:title", content: "Produk Saya — Seller Center Marketku" },
      { property: "og:description", content: "Kelola produk dan stok toko." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Produk,
});

function Produk() {
  const [tab, setTab] = useState<"produk" | "stok">("produk");
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [q, setQ] = useState("");
  return (
    <>
      <SellerCard className="grid grid-cols-2 gap-1 p-2">
        {([["produk", "Produk", Package], ["stok", "Stok", Boxes]] as const).map(([k, label, I]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center justify-center gap-3 rounded-xl py-3.5 font-semibold transition active:scale-95 ${tab === k ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-foreground/80"}`}>
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${tab === k ? "" : "bg-accent"}`}><I className="h-5 w-5" /></span>{label}
          </button>
        ))}
      </SellerCard>

      <SellerCard className="grid grid-cols-3 divide-x overflow-hidden">
        <StatCell icon={Package} label="Total Produk" value="0" />
        <StatCell icon={CheckSquare} label="Aktif" value="0" valueClass="text-success" />
        <StatCell icon={FileText} label="Draft" value="0" valueClass="text-primary" />
      </SellerCard>

      <SellerCard className="flex items-stretch overflow-hidden">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "produk" ? "Cari produk..." : "Cari stok..."}
          className="min-w-0 flex-1 rounded-l-2xl border-r bg-background/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
        <IconCell label="Filter" onClick={() => soon("Filter produk")}><SlidersHorizontal className="h-5 w-5" /></IconCell>
        <IconCell label="Urutkan" onClick={() => soon("Urutkan produk")} active><ArrowUpDown className="h-5 w-5" /></IconCell>
        <IconCell label="Tampilan grid" onClick={() => setLayout("grid")} active={layout === "grid"}><LayoutGrid className="h-5 w-5" /></IconCell>
        <IconCell label="Tampilan list" onClick={() => setLayout("list")} active={layout === "list"}><List className="h-5 w-5" /></IconCell>
      </SellerCard>

      <div className="flex gap-2">
        <span className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background">Semua <span className="text-xs">0</span></span>
      </div>

      <SellerCard>
        <SellerEmpty icon={tab === "produk" ? Package : Boxes}
          title={tab === "produk" ? "Belum ada produk" : "Belum ada stok"}
          desc={tab === "produk" ? "Tambahkan produk pertamamu supaya pembeli bisa mulai belanja." : "Stok akan muncul setelah kamu menambahkan produk."} />
      </SellerCard>

      <button onClick={() => soon("Tambah Produk Baru")}
        className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-xl bg-foreground px-5 py-3.5 font-semibold text-background shadow-2xl transition active:scale-95">
        <Plus className="h-5 w-5" /> Tambah Produk Baru
      </button>
    </>
  );
}

function IconCell({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button aria-label={label} onClick={onClick} className={`grid w-12 place-items-center border-l transition active:scale-90 ${active ? "text-primary" : "text-foreground/80"}`}>
      {children}
    </button>
  );
}
