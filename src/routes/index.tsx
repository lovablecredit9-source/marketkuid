import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Store, Zap, ShieldCheck, Headphones, Package } from "lucide-react";
import { AppShell, EmptyState, Logo, soon } from "@/components/marketku/shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marketku — Belanja Produk Digital" },
      { name: "description", content: "Beranda Marketku: cari dan beli produk digital dengan aman." },
      { property: "og:title", content: "Marketku — Belanja Produk Digital" },
      { property: "og:description", content: "Cari dan beli produk digital dengan aman di Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  return (
    <AppShell>
      <form
        className="px-3 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/cari", search: { q } });
        }}
      >
        <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk digital..." className="w-full bg-transparent text-sm outline-none" />
        </label>
      </form>

      <div className="space-y-4 px-3 pt-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Pilihan Untukmu</h2>
            <Link to="/cari" className="text-sm font-semibold text-primary">Lihat semua</Link>
          </div>
          <EmptyState icon={Package} title="Belum ada produk" desc="Produk akan tampil di sini setelah seller menambahkannya." />
        </section>

        <section className="space-y-2">
          {[
            { icon: Store, t: "Mulai Jualan", d: "Buka toko digitalmu gratis" },
            { icon: Zap, t: "Transaksi Instan", d: "Pembayaran via QRIS Marketku" },
            { icon: ShieldCheck, t: "Dijamin Aman", d: "Dana ditahan sampai pesanan selesai" },
            { icon: Headphones, t: "Support 24/7", d: "Siap bantu kapan saja" },
          ].map(({ icon: I, t, d }) => (
            <button key={t} onClick={() => soon(t)} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><I className="h-5 w-5" /></span>
              <span><span className="block text-sm font-bold">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
            </button>
          ))}
        </section>

        <footer className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <div className="inline-block rounded-lg bg-card px-2 py-1"><Logo className="h-7" /></div>
          <p className="mt-3 text-sm opacity-90">Marketplace produk digital yang aman, cepat, dan terpercaya.</p>
        </footer>
      </div>
    </AppShell>
  );
}
