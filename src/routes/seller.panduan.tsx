import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { GUIDE_ICONS as ICONS } from "@/components/marketku/guide-icons";
import { pageMeta } from "@/lib/meta";
import { CATEGORIES, GUIDES, searchGuides } from "@/lib/panduan";
import { PageTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/panduan")({
  head: () => pageMeta("Panduan Seller — Marketku", "Panduan lengkap fitur Seller Center Marketku, dari setup bot sampai withdraw."),
  component: Panduan,
});


const tour = [
  { title: "Cari panduan", desc: "Cari panduan apa pun lewat kata kunci di sini.", target: "g-search" },
  { title: "Telusuri topik", desc: "Telusuri panduan per topik, dari setup bot sampai withdraw.", target: "g-list" },
  { title: "Selesai", desc: "Buka halaman ini kapan saja saat butuh bantuan." },
];

function Panduan() {
  const match = useMatchRoute();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  if (match({ to: "/seller/panduan/$slug" })) return <Outlet />;
  const found = searchGuides(q);
  const cats = CATEGORIES.map((c) => ({ ...c, items: found.filter((g) => g.category === c.key) })).filter((c) => c.items.length);
  return (
    <>
      <div className="flex items-start gap-3">
        <BookOpen className="mt-1 h-6 w-6 text-primary" />
        <div><h2 className="text-2xl font-bold">Panduan Seller</h2><p className="text-sm text-muted-foreground">{GUIDES.length} panduan lengkap fitur Marketku</p></div>
      </div>
      <input data-tour="g-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari panduan... (contoh: bot telegram, withdraw, stok)"
        className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" />
      <div data-tour="g-list" className="space-y-3">
        {cats.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Panduan tidak ditemukan.</p>}
        {cats.map((c) => {
          const I = ICONS[c.icon];
          const isOpen = open === c.key || !!q.trim();
          return (
            <div key={c.key} className={`overflow-hidden rounded-xl border bg-card ${isOpen ? "border-primary" : ""}`}>
              <button onClick={() => setOpen(open === c.key ? null : c.key)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-left">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${c.tone}`}><I className="h-4 w-4" /></span>
                <span className="flex-1"><span className="block font-semibold">{c.title}</span><span className="text-xs text-muted-foreground">{c.items.length} panduan</span></span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t py-1">
                  {c.items.map((g) => (
                    <Link key={g.slug} to="/seller/panduan/$slug" params={{ slug: g.slug }} className="block px-4 py-3 text-center text-sm text-foreground/90 transition active:bg-accent">{g.title}</Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <PageTour id="seller-panduan" steps={tour} panel />
    </>
  );
}
