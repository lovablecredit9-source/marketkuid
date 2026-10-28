import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, SlidersHorizontal, Sparkles, PackageSearch } from "lucide-react";
import { AppShell, EmptyState, soon } from "@/components/marketku/shell";

export const Route = createFileRoute("/cari")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s["q"] === "string" && s["q"] ? { q: s["q"] } : {}),
  head: () => ({
    meta: [
      { title: "Cari Produk — Marketku" },
      { name: "description", content: "Cari produk digital di Marketku." },
      { property: "og:title", content: "Cari Produk — Marketku" },
      { property: "og:description", content: "Temukan produk digital di Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cari,
});

function Cari() {
  const { q = "" } = Route.useSearch();
  const [val, setVal] = useState(q);
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="space-y-3 px-3 pt-3">
        <form onSubmit={(e) => { e.preventDefault(); navigate({ to: "/cari", search: { q: val } }); }}>
          <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Cari produk digital..." className="w-full bg-transparent text-sm outline-none" />
          </label>
        </form>
        <div>
          <p className="flex items-center gap-1 text-xs font-bold tracking-wider text-primary"><Sparkles className="h-3 w-3" /> JELAJAHI MARKETKU</p>
          <h1 className="text-xl font-bold">{q ? `Hasil untuk "${q}"` : "Semua Produk"}</h1>
          <p className="text-sm text-muted-foreground">0 produk ditemukan</p>
        </div>
        <button onClick={() => soon("Filter")} className="flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4" /> Filter
        </button>
        <select className="w-full rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold">
          <option>Paling Relevan</option><option>Terbaru</option><option>Termurah</option><option>Termahal</option>
        </select>
        <EmptyState icon={PackageSearch} title="Produk belum tersedia" desc="Belum ada produk yang cocok. Coba kata kunci lain nanti." />
      </div>
    </AppShell>
  );
}
