import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShoppingBag, Clock, ClipboardCheck, CircleCheck, CircleX, DollarSign, BarChart3, SlidersHorizontal, Check, ChevronDown, QrCode, MessageCircle, Copy, Loader2,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageTour } from "@/components/marketku/tour";
import { SellerCard, SellerEmpty, SellerSheet, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { ORDER_LABEL, SELLER_FILTER, dbError, fmtDateTime } from "@/lib/market";
import { sellerStats, useSellerOrders, type SellerOrder } from "@/lib/seller-orders";
import { pageMeta } from "@/lib/meta";

const STATUS = Object.keys(SELLER_FILTER);
const tour = [
  { title: "Ringkasan", desc: "Pesanan selesai, dibatalkan, dan nilai penjualan sekilas.", target: "t-stats" },
  { title: "Cari & saring", desc: "Cari order ID, produk, atau pelanggan, lalu saring status.", target: "t-search" },
  { title: "Daftar transaksi", desc: "Pesanan masuk tampil di sini secara real-time. Klik untuk detail.", target: "t-list" },
  { title: "Selesai", desc: "Pesanan baru otomatis muncul saat ada pembelian." },
];

export const Route = createFileRoute("/seller/transaksi")({
  head: () => pageMeta("Transaksi — Seller Center Marketku", "Pantau dan proses pesanan pembeli di toko Marketku kamu."),
  component: Transaksi,
});

const filters = [
  { k: "semua", label: "Semua Pesanan", icon: ShoppingBag },
  { k: "pending", label: "Pre-order Belum Diproses", icon: Clock },
  { k: "diproses", label: "Pre-order Diproses", icon: ClipboardCheck },
] as const;

const tone = (s: string) => (["completed", "paid"].includes(s) ? "text-success border-success/40" : s === "pending" ? "text-warning border-warning/40" : ["cancelled", "failed"].includes(s) ? "text-destructive border-destructive/40" : "text-primary border-primary/40");

function Transaksi() {
  const { user } = useAuth();
  const orders = useSellerOrders(user?.id);
  const [f, setF] = useState<(typeof filters)[number]["k"]>("semua");
  const [q, setQ] = useState("");
  const [st, setSt] = useState("Semua");
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<SellerOrder | null>(null);
  const navigate = useNavigate();
  const all = orders.data ?? [];
  const s = sellerStats(all);
  const want = SELLER_FILTER[st] ?? [];
  const ql = q.trim().toLowerCase();
  const list = all.filter((o) => {
    const pre = o.order_items.some((i) => i.product_type === "preorder");
    if (f === "pending" && !(pre && o.status === "paid")) return false;
    if (f === "diproses" && !(pre && o.status === "processing")) return false;
    if (want.length && !want.includes(o.status)) return false;
    return !ql || `m-${o.order_no} ${o.buyer_name ?? ""} ${o.order_items.map((i) => i.product_name).join(" ")}`.toLowerCase().includes(ql);
  });

  const openChat = async (o: SellerOrder) => {
    const { data } = await supabase.from("conversations").select("id").eq("buyer_id", o.buyer_id).eq("seller_id", o.seller_id).maybeSingle();
    if (!data) { toast("Pembeli belum memulai chat dengan tokomu"); return; }
    navigate({ to: "/chat/$id", params: { id: data.id } });
  };

  return (
    <>
      <div className="flex items-center gap-4 px-1">
        <ShoppingBag className="h-5 w-5 text-primary" strokeWidth={1.75} />
        <div>
          <h2 className="text-xl font-semibold">Pesanan Saya</h2>
          <p className="text-sm text-muted-foreground">{list.length} transaksi ditemukan</p>
        </div>
      </div>

      <SellerCard className="flex gap-1 overflow-x-auto p-1.5">
        {filters.map(({ k, label, icon: I }) => (
          <button key={k} onClick={() => setF(k)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition active:scale-95 ${f === k ? "bg-primary text-primary-foreground" : "text-foreground/80"}`}>
            <I className="h-4 w-4" strokeWidth={1.75} /> {label}
          </button>
        ))}
      </SellerCard>

      <SellerCard data-tour="t-stats" className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell icon={CircleCheck} label="Selesai" value={String(s.completed)} />
        <StatCell icon={CircleX} label="Dibatalkan" value={String(s.cancelled)} />
        <StatCell icon={DollarSign} label="Nilai Selesai" value={rpSeller(s.revenue)} />
        <StatCell icon={BarChart3} label="Jenis Produk" value={String(s.productKinds)} />
      </SellerCard>

      <div className="relative">
        <SellerCard data-tour="t-search" className="flex items-stretch overflow-hidden">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari order ID, produk, pelanggan..."
            className="min-w-0 flex-1 border-r bg-background/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
          <button aria-label={`Filter: ${st}`} onClick={() => setMenu(!menu)} className={`grid w-12 place-items-center transition active:scale-90 ${menu || st !== "Semua" ? "text-primary ring-2 ring-inset ring-primary" : ""}`}><SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} /></button>
        </SellerCard>
        {menu && (
          <>
            <button aria-label="Tutup menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border bg-popover py-1 shadow-2xl animate-in fade-in-0 zoom-in-95">
              {STATUS.map((x) => (
                <button key={x} onClick={() => { setSt(x); setMenu(false); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition active:bg-accent ${st === x ? "font-semibold text-primary" : "text-foreground/90"}`}>
                  {x} {st === x && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <SellerCard data-tour="t-list" className="divide-y overflow-hidden">
        {list.length === 0 ? <SellerEmpty icon={ShoppingBag} title="Belum ada pesanan" desc="Pesanan dari pembeli akan muncul di sini." /> : list.map((o) => (
          <div key={o.id} role="button" tabIndex={0} onClick={() => setOpen(o)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(o); }} className="block w-full cursor-pointer px-3.5 py-3 text-left transition active:bg-accent/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium uppercase">{o.order_items[0]?.product_name}{o.order_items.length > 1 ? ` +${o.order_items.length - 1}` : ""}</p><p className="mt-0.5 font-mono text-xs tracking-wider text-muted-foreground">M-{o.order_no}</p></div>
              <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone(o.status)}`}>{o.status === "completed" ? <CircleCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{ORDER_LABEL[o.status]}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm"><span className="text-muted-foreground">{o.buyer_name}</span><span className="font-semibold">{rpSeller(Number(o.subtotal) - Number(o.discount))}</span></div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <span className="mr-auto text-muted-foreground">{fmtDateTime(o.created_at)}</span>
              <span className="flex items-center gap-1 rounded-full border border-primary/60 px-2 py-1 text-primary"><QrCode className="h-3 w-3" /> QRIS Marketku</span>
              <button onClick={(e) => { e.stopPropagation(); void openChat(o); }} className="flex items-center gap-1 rounded-lg border px-2 py-1 font-medium transition active:scale-95"><MessageCircle className="h-3 w-3" /> Chat</button>
            </div>
          </div>
        ))}
      </SellerCard>
      <OrderSheet order={open} onClose={() => setOpen(null)} />
      <PageTour id="seller-transaksi" steps={tour} panel />
    </>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b">
      <button onClick={() => setOpen(!open)} className={`flex w-full items-center justify-between px-1 py-3 text-xs font-bold tracking-widest ${open ? "text-primary" : "text-muted-foreground"}`}>{title}<ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button>
      {open && <div className="space-y-2 pb-3">{children}</div>}
    </div>
  );
}
const Line = ({ a, b }: { a: string; b: ReactNode }) => <div className="flex justify-between gap-3 rounded-lg border bg-background/40 px-3 py-2 text-sm"><span className="text-muted-foreground">{a}</span><span className="text-right font-semibold">{b}</span></div>;

function OrderSheet({ order: o, onClose }: { order: SellerOrder | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState("");
  const [busy, setBusy] = useState(false);
  if (!o) return null;
  const advance = async (status: "processing" | "completed") => {
    // Pre-order: data pesanan boleh dikirim via chat, kolom ini opsional.
    setBusy(true);
    const { error } = await supabase.rpc("seller_advance_order", { p_order: o.id, p_status: status, p_delivery: delivery });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success(status === "processing" ? "Pesanan diproses" : "Pesanan diselesaikan");
    void qc.invalidateQueries({ queryKey: ["seller_orders", user?.id] });
    onClose();
  };
  const chat = async () => {
    const { data } = await supabase.from("conversations").select("id").eq("buyer_id", o.buyer_id).eq("seller_id", o.seller_id).maybeSingle();
    if (!data) { toast("Pembeli belum memulai chat dengan tokomu"); return; }
    onClose(); navigate({ to: "/chat/$id", params: { id: data.id } });
  };
  const done = o.status === "completed";
  return (
    <SellerSheet open onOpenChange={(v) => !v && onClose()} title={<span>Ringkasan Pembayaran<span className="block text-xs font-normal text-muted-foreground">M-{o.order_no}</span></span>}
      footer={<>
        <button onClick={() => { void navigator.clipboard.writeText(`M-${o.order_no}`); toast.success("Order ID disalin"); }} className="flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-semibold"><Copy className="h-4 w-4" /> Salin Order ID</button>
        <button onClick={onClose} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"><Check className="mr-1 inline h-4 w-4" />Tutup</button>
      </>}>
      <div className={`mb-3 rounded-xl border p-3 ${done ? "border-success/40 bg-success/10" : "bg-background/40"}`}>
        <p className={`text-sm font-bold ${done ? "text-success" : ""}`}>{done ? "TRANSAKSI BERHASIL" : ORDER_LABEL[o.status]?.toUpperCase()}</p>
        <p className="text-xs text-muted-foreground">{fmtDateTime(o.updated_at)}</p>
      </div>
      <Section title="IDENTITAS TRANSAKSI" defaultOpen>
        {o.order_items.map((i) => <Line key={i.id} a={`${i.variant_name} ×${i.qty}`} b={i.product_name} />)}
        <Line a="Tipe item" b={o.order_items[0]?.product_type === "preorder" ? "Pre-Order" : "Instan"} />
        {o.order_items.flatMap((i) => i.delivered).map((d, n) => <Line key={n} a="Data terkirim" b={<span className="break-all font-mono text-xs">{d}</span>} />)}
      </Section>
      <Section title="INFORMASI PELANGGAN">
        <Line a="Pelanggan" b={o.buyer_name ?? "-"} />
        <Line a="WhatsApp" b={o.buyer_whatsapp ?? "-"} />
        <Line a="Catatan pembeli" b={o.buyer_note ?? "-"} />
        <button onClick={() => void chat()} className="flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" /> Chat pembeli</button>
      </Section>
      <Section title="PEMBAYARAN">
        <Line a="Metode bayar" b="QRIS Marketku" />
        <Line a="Subtotal" b={rpSeller(Number(o.subtotal))} />
        {Number(o.discount) > 0 && <Line a={`Voucher ${o.voucher_code ?? ""}`} b={`-${rpSeller(Number(o.discount))}`} />}
        <Line a="Kode unik" b={`+Rp ${o.unique_code}`} />
        <Line a="Total dibayar" b={rpSeller(Number(o.total))} />
        <Line a="Seller receives" b={<span className="text-success">{rpSeller(Number(o.subtotal) - Number(o.discount))}</span>} />
      </Section>
      <Section title="RIWAYAT WAKTU">
        <Line a="Dibuat" b={fmtDateTime(o.created_at)} />
        <Line a="Diperbarui" b={fmtDateTime(o.updated_at)} />
        {o.paid_at && <Line a="Dibayar" b={fmtDateTime(o.paid_at)} />}
        {o.completed_at && <Line a="Selesai" b={fmtDateTime(o.completed_at)} />}
      </Section>
      {(o.status === "paid" || o.status === "processing") && (
        <div className="mt-4 space-y-2">
          <textarea value={delivery} onChange={(e) => setDelivery(e.target.value)} rows={3} placeholder="Opsional — data pesanan bisa juga dikirim via chat" className="w-full rounded-xl border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2">
            {o.status === "paid" && <button disabled={busy} onClick={() => void advance("processing")} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold">Tandai Diproses</button>}
            <button disabled={busy} onClick={() => void advance("completed")} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-success py-2.5 text-sm font-bold text-primary-foreground">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Selesaikan</button>
          </div>
        </div>
      )}
    </SellerSheet>
  );
}
