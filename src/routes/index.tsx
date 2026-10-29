import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Zap, ShieldCheck, Headphones, Package, BadgePercent, Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import logo from "@/assets/logo-marketku.png.asset.json";
import { AppShell, EmptyState, soon } from "@/components/marketku/shell";

type FLink = { label: string; to?: "/cari" | "/akun" | "/seller" | "/seller/panduan" | "/bantuan" | "/syarat" | "/privasi" | "/kontak" };
const FOOTER: { title: string; links: FLink[] }[] = [
  { title: "Marketplace", links: [{ label: "Semua Produk", to: "/cari" }, { label: "Flash Sale" }, { label: "Best Seller" }, { label: "Kategori", to: "/cari" }] },
  { title: "Seller", links: [{ label: "Mulai Jualan", to: "/akun" }, { label: "Seller Center", to: "/seller" }, { label: "Panduan Seller", to: "/seller/panduan" }, { label: "Biaya Layanan", to: "/syarat" }] },
  { title: "Bantuan", links: [{ label: "Pusat Bantuan", to: "/bantuan" }, { label: "Syarat & Ketentuan", to: "/syarat" }, { label: "Kebijakan Privasi", to: "/privasi" }, { label: "Hubungi Kami", to: "/kontak" }] },
];

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

        <section className="space-y-1 rounded-2xl border bg-card p-2">
          {[
            { icon: Zap, t: "Kirim Instan", d: "Otomatis setelah bayar" },
            { icon: ShieldCheck, t: "Transaksi Aman", d: "Terenkripsi SSL" },
            { icon: BadgePercent, t: "Diskon Tiap Hari", d: "Promo eksklusif" },
            { icon: Headphones, t: "Support 24/7", d: "Selalu siap bantu" },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="flex items-center gap-3 p-2">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><I className="h-5 w-5" /></span>
              <span><span className="block text-sm font-bold">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
            </div>
          ))}
        </section>
      </div>

      <footer className="mt-6 bg-primary px-5 pb-8 pt-8 text-primary-foreground">
        <img src={logo.url} alt="Marketku" className="h-9 w-auto brightness-0 invert" />
        <p className="mt-4 text-sm leading-relaxed opacity-90">Marketplace untuk beli dan jual produk digital dengan mudah dan cepat.</p>
        <div className="mt-4 flex gap-2">
          {[Facebook, Instagram, Twitter, Youtube].map((I, n) => (
            <button key={n} aria-label="Media sosial" onClick={() => soon("Media sosial Marketku")} className="grid h-9 w-9 place-items-center rounded-lg border border-primary-foreground/30 transition active:scale-90"><I className="h-4 w-4" /></button>
          ))}
        </div>
        {FOOTER.map((col) => (
          <div key={col.title} className="mt-7">
            <h3 className="font-bold">{col.title}</h3>
            <ul className="mt-3 space-y-2.5 text-sm opacity-90">
              {col.links.map((l) => <li key={l.label}>{l.to ? <Link to={l.to}>{l.label}</Link> : <button onClick={() => soon(l.label)}>{l.label}</button>}</li>)}
            </ul>
          </div>
        ))}
        <div className="mt-8 border-t border-primary-foreground/20 pt-5">
          <p className="text-xs font-bold tracking-widest opacity-80">METODE PEMBAYARAN</p>
          <span className="mt-3 inline-block rounded-lg bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold">QRIS — Support ewallet dan bank</span>
        </div>
        <p className="mt-6 text-xs opacity-70">© {new Date().getFullYear()} Marketku. Marketplace produk digital.</p>
      </footer>
    </AppShell>
  );
}
