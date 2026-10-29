import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, Package, ChevronDown } from "lucide-react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/riwayat")({
  head: () => pageMeta("Riwayat Pesanan — Marketku", "Lihat daftar riwayat pesananmu di Marketku."),
  component: Riwayat,
});

export const ORDER_STATUSES = ["Semua", "Proses", "Berhasil", "Refund Diproses", "Tidak Berhasil", "Garansi Aktif", "Dikomplain"] as const;

function Riwayat() {
  const [status, setStatus] = useState<(typeof ORDER_STATUSES)[number]>("Semua");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  return (
    <AppShell>
      <div className="space-y-4 px-3 pt-3">
        <div className="rounded-2xl bg-accent/50 p-4">
          <h1 className="mb-3 text-lg font-bold">Daftar Riwayat Pesanan</h1>
          <div className="overflow-hidden rounded-xl border bg-card">
            <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between border-b px-4 py-3 font-semibold">
              {status} <ChevronDown className="h-4 w-4" />
            </button>
            <label className="flex items-center gap-2 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pesanan" className="w-full bg-transparent outline-none" />
            </label>
          </div>
        </div>
        <EmptyState icon={Package} title="Belum ada pesanan" desc="Pesanan baru akan muncul di sini setelah kamu membuat pesanan." action={<PrimaryLink to="/cari">Jelajahi produk</PrimaryLink>} />
        <Link to="/" className="block text-center font-semibold text-primary">← Kembali ke Beranda</Link>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-3 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 overflow-hidden rounded-2xl bg-foreground text-background shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <Dialog.Title className="sr-only">Pilih status pesanan</Dialog.Title>
            {ORDER_STATUSES.map((s) => (
              <button key={s} onClick={() => { setStatus(s); setOpen(false); }} className="flex w-full items-center justify-between border-b border-background/10 px-4 py-4 text-left text-lg last:border-b-0 transition active:bg-background/10">
                {s}
                <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${status === s ? "border-primary" : "border-background/60"}`}>{status === s && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span>
              </button>
            ))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}
