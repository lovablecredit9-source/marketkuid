import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, Package, ChevronDown, Store, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BUYER_FILTER, fmtDateTime } from "@/lib/market";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { rpBuyer } from "@/components/marketku/product-card";
import { StatusBadge } from "@/components/marketku/order-badge";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/riwayat")({
  head: () => pageMeta("Riwayat Pesanan — Marketku", "Lihat daftar riwayat pesananmu di Marketku."),
  component: Riwayat,
});

const ORDER_STATUSES = Object.keys(BUYER_FILTER);

function Riwayat() {
  const { user, ready } = useAuth();
  const [status, setStatus] = useState("Semua");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const orders = useQuery({
    queryKey: ["my_orders", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("orders").select("id, order_no, checkout_id, store_name, status, total, created_at, order_items(product_name, variant_name, qty)").eq("buyer_id", user!.id).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const want = BUYER_FILTER[status] ?? [];
  const special = status === "Garansi Aktif" || status === "Dikomplain";
  const ql = q.trim().toLowerCase();
  const list = (orders.data ?? []).filter((o) =>
    !special && (want.length === 0 || want.includes(o.status)) &&
    (!ql || `m-${o.order_no} ${o.store_name ?? ""} ${o.order_items.map((i) => i.product_name).join(" ")}`.toLowerCase().includes(ql)));

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
        {ready && !user ? (
          <EmptyState icon={Package} title="Masuk untuk melihat pesanan" desc="Riwayat pesanan tersimpan di akunmu." action={<PrimaryLink to="/login">Masuk</PrimaryLink>} />
        ) : list.length === 0 ? (
          orders.isLoading ? <div className="h-32 animate-pulse rounded-2xl border bg-card" /> :
          <EmptyState icon={Package} title="Belum ada pesanan" desc="Pesanan baru akan muncul di sini setelah kamu membuat pesanan." action={<PrimaryLink to="/cari">Jelajahi produk</PrimaryLink>} />
        ) : (
          <div className="space-y-3">
            {list.map((o) => (
              <Link key={o.id} to="/pesanan/$id" params={{ id: o.id }} className="block rounded-2xl border bg-card p-4 transition active:scale-[0.99]">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="flex items-center gap-1.5 text-sm font-bold"><Store className="h-4 w-4 text-primary" />{o.store_name}</p><p className="text-xs text-muted-foreground">M-{o.order_no} · {fmtDateTime(o.created_at)}</p></div>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-2 line-clamp-1 text-sm">{o.order_items.map((i) => `${i.product_name} (${i.variant_name}) ×${i.qty}`).join(", ")}</p>
                <div className="mt-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="flex items-center gap-1 font-bold">{rpBuyer(Number(o.total))}<ChevronRight className="h-4 w-4 text-muted-foreground" /></span></div>
              </Link>
            ))}
          </div>
        )}
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
