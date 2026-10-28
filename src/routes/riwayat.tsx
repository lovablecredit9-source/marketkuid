import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Package } from "lucide-react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat Pesanan — Marketku" },
      { name: "description", content: "Lihat daftar riwayat pesananmu di Marketku." },
      { property: "og:title", content: "Riwayat Pesanan — Marketku" },
      { property: "og:description", content: "Daftar riwayat pesanan Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Riwayat,
});

function Riwayat() {
  return (
    <AppShell>
      <div className="space-y-4 px-3 pt-3">
        <div className="rounded-2xl bg-accent/50 p-4">
          <h1 className="mb-3 text-lg font-bold">Daftar Riwayat Pesanan</h1>
          <div className="overflow-hidden rounded-xl border bg-card">
            <select className="w-full border-b bg-card px-4 py-3 font-semibold outline-none">
              <option>Semua</option><option>Menunggu Bayar</option><option>Diproses</option><option>Selesai</option><option>Dibatalkan</option>
            </select>
            <label className="flex items-center gap-2 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input placeholder="Cari pesanan" className="w-full bg-transparent outline-none" />
            </label>
          </div>
        </div>
        <EmptyState icon={Package} title="Belum ada pesanan" desc="Pesanan baru akan muncul di sini setelah kamu membuat pesanan." action={<PrimaryLink to="/cari">Jelajahi produk</PrimaryLink>} />
        <Link to="/" className="block text-center font-semibold text-primary">← Kembali ke Beranda</Link>
      </div>
    </AppShell>
  );
}
