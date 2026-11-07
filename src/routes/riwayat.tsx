import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, Package, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BUYER_FILTER, ORDER_LABEL, fmtDateTime } from "@/lib/market";
import { useImageUrls } from "@/lib/products";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { rpBuyer } from "@/components/marketku/product-card";
import { pageMeta } from "@/lib/meta";
import { LoadingLine } from "@/components/marketku/loading";
import { useEffect } from "react";
import { savedGuestOrders, type SavedGuestOrder } from "@/lib/guest";

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
    queryFn: async () => (await supabase.from("orders").select("id, order_no, checkout_id, store_name, status, total, created_at, expires_at, order_items(product_name, variant_name, qty, image_path)").eq("buyer_id", user!.id).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const imgs = useImageUrls((orders.data ?? []).map((o) => o.order_items[0]?.image_path ?? "").filter((p) => p && !p.startsWith("http")));
  const want = BUYER_FILTER[status] ?? [];
  const special = status === "Garansi Aktif" || status === "Dikomplain";
  const ql = q.trim().toLowerCase();
  const list = (orders.data ?? []).filter((o) =>
    !special && (want.length === 0 || want.includes(o.status)) &&
    (!ql || `m-${o.order_no} ${o.store_name ?? ""} ${o.order_items.map((i) => i.product_name).join(" ")}`.toLowerCase().includes(ql)));

  return (
    <AppShell showSupport={false}>
      <div className="space-y-4 px-4">
        <div className="-mx-4 space-y-4 rounded-b-xl bg-gradient-to-b from-accent/70 to-background px-7 pb-4 pt-3">
        <div>
          <h1 className="mb-2 text-base font-bold">Daftar Riwayat Pesanan</h1>
          <div className="overflow-hidden rounded-lg border bg-card">
            <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between border-b px-4 py-2.5 text-[15px] font-semibold">
              {status} <ChevronDown className="h-4 w-4" />
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pesanan" className="w-full bg-transparent text-[15px] outline-none" />
            </label>
          </div>
        </div>
        {!ready || (user && orders.isPending) ? (
          <LoadingLine label="Memuat pesanan..." className="rounded-2xl border bg-card py-12" />
        ) : !user ? (
          <>
            <EmptyState icon={Package} title="Masuk untuk melihat pesanan" desc="Riwayat pesanan tersimpan di akunmu." action={<PrimaryLink to="/login">Masuk</PrimaryLink>} />
            <GuestOrders />
          </>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-5 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><Package className="h-4 w-4" /></div>
            <h3 className="mt-3 text-[13px] font-bold">Belum ada pesanan</h3>
            <p className="mt-3 text-xs leading-relaxed text-foreground/80">Pesanan baru akan muncul di sini setelah kamu membuat pesanan.</p>
            <Link to="/cari" className="mt-4 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition active:scale-95">Jelajahi produk</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((o) => {
              const pend = o.status === "pending";
              const tone = pend ? "text-warning" : ["paid", "processing", "completed"].includes(o.status) ? "text-success" : ["cancelled", "failed"].includes(o.status) ? "text-destructive" : "text-primary";
              const head = pend ? "bg-warning/10" : ["cancelled", "failed"].includes(o.status) ? "bg-destructive/10" : "bg-success/10";
              const img = o.order_items[0]?.image_path;
              const src = img ? (img.startsWith("http") ? img : imgs.data?.[img]) : undefined;
              return (
                <div key={o.id} className="overflow-hidden rounded-xl border bg-card">
                  <div className={`border-b px-3 py-2 ${head}`}>
                    <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{fmtDateTime(o.created_at)}</span><b className={tone}>{ORDER_LABEL[o.status] ?? o.status}</b></div>
                    <p className="mt-0.5 font-mono text-xs tracking-wider text-muted-foreground">#M-{o.order_no}</p>
                  </div>
                  <Link to="/pesanan/$id" params={{ id: o.id }} className="flex items-center gap-2.5 border-b px-3 py-2">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Package className="m-auto mt-2.5 h-4 w-4 text-muted-foreground" />}</span>
                    <span className="line-clamp-2 text-sm font-semibold leading-snug">{o.order_items.map((i) => i.product_name).join(", ")}</span>
                  </Link>
                  <Link to="/pesanan/$id" params={{ id: o.id }} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">TOTAL PEMBAYARAN</span>
                    <span className="flex items-center gap-2"><b className="text-sm">{rpBuyer(Number(o.total))}</b><span className="flex items-center text-xs text-muted-foreground">Detail <ChevronRight className="h-3.5 w-3.5" /></span></span>
                  </Link>
                  {pend && (
                    <div className="border-t px-3 py-2 text-center">
                      <Link to="/bayar/$id" params={{ id: o.checkout_id }} className="block rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]">Lakukan Pembayaran</Link>
                      {o.expires_at && <p className="mt-1.5 text-xs font-medium text-warning">Sebelum {new Date(o.expires_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
        <Link to="/" className="block text-center text-[13px] font-medium text-primary">← Kembali ke Beranda</Link>
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

/** Guest (no account) orders remembered on this device. */
function GuestOrders() {
  const [list, setList] = useState<SavedGuestOrder[]>([]);
  useEffect(() => setList(savedGuestOrders()), []);
  if (!list.length) return null;
  return (
    <section className="rounded-xl border bg-card p-3">
      <p className="text-sm font-bold">Pesanan tanpa akun di HP ini</p>
      {list.map((g) => (
        <Link key={g.token} to="/lacak/$token" params={{ token: g.token }} className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>Pesanan {fmtDateTime(new Date(g.at).toISOString())}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      ))}
    </section>
  );
}
