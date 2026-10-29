import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode, Clock, Store, Copy, XCircle, CheckCircle2, Package, Star, Loader2, MessageCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ORDER_LABEL, dbError, fmtDateTime } from "@/lib/market";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { rpBuyer } from "@/components/marketku/product-card";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/pesanan/$id")({
  head: () => pageMeta("Detail Pesanan — Marketku", "Status pembayaran, produk, dan pengiriman pesananmu di Marketku."),
  component: Pesanan,
});

const TOPICS = ["Kualitas Barang", "Kemasan", "Sesuai Deskripsi", "Pengiriman", "Pelayanan Seller"];

function useCountdown(to: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  if (!to) return null;
  const ms = Math.max(0, new Date(to).getTime() - now);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return { ms, text: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

function Pesanan() {
  const { id } = Route.useParams();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["order_view", id, user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").or(`checkout_id.eq.${id},id.eq.${id}`).eq("buyer_id", user!.id).order("created_at");
      if (error) throw error;
      const itemIds = (data ?? []).flatMap((o) => o.order_items.map((i) => i.id));
      const reviewed = itemIds.length ? (await supabase.from("product_reviews").select("order_item_id").in("order_item_id", itemIds)).data ?? [] : [];
      return { orders: data ?? [], reviewed: new Set(reviewed.map((r) => r.order_item_id)) };
    },
  });
  const orders = q.data?.orders ?? [];
  const pending = orders.filter((o) => o.status === "pending");
  const due = pending.reduce((a, o) => a + Number(o.total), 0);
  const cd = useCountdown(pending[0]?.expires_at);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["order_view", id, user?.id] });

  const cancel = async () => {
    setBusy(true);
    for (const o of pending) {
      const { error } = await supabase.rpc("cancel_order", { p_order: o.id });
      if (error) { toast.error(dbError(error)); break; }
    }
    setBusy(false);
    toast.success("Pesanan dibatalkan");
    void refresh();
  };
  const chat = async (seller: string) => {
    const { data, error } = await supabase.rpc("start_conversation", { p_seller: seller });
    if (error || !data) { toast.error(dbError(error)); return; }
    navigate({ to: "/chat/$id", params: { id: data } });
  };

  if (ready && !user) return <AppShell><div className="p-3"><EmptyState icon={Package} title="Masuk untuk melihat pesanan" desc="Pesanan tersimpan di akunmu." action={<PrimaryLink to="/login">Masuk</PrimaryLink>} /></div></AppShell>;
  if (q.isLoading || !ready) return <AppShell><div className="m-3 h-72 animate-pulse rounded-2xl border bg-card" /></AppShell>;
  if (!orders.length) return <AppShell><div className="p-3"><EmptyState icon={Package} title="Pesanan tidak ditemukan" desc="Pesanan ini tidak ada di akunmu." action={<PrimaryLink to="/cari">Belanja</PrimaryLink>} /></div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4 px-3 pt-4">
        {pending.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 text-center">
            <p className="flex items-center justify-center gap-2 font-bold"><QrCode className="h-5 w-5 text-primary" /> Bayar dengan QRIS Marketku</p>
            <p className="mt-3 text-sm text-muted-foreground">Total yang harus dibayar</p>
            <p className="text-3xl font-bold text-primary">{rpBuyer(due)}</p>
            <p className="text-xs text-muted-foreground">Sudah termasuk kode unik QRIS</p>
            {cd && <p className={`mt-2 flex items-center justify-center gap-1 text-sm font-semibold ${cd.ms ? "text-warning" : "text-destructive"}`}><Clock className="h-4 w-4" /> {cd.ms ? `Bayar dalam ${cd.text}` : "Waktu bayar habis"}</p>}
            <div className="mt-4 rounded-xl border border-dashed border-warning/60 bg-warning/10 p-3 text-left text-sm">
              <b>Kode QRIS belum bisa ditampilkan.</b> Layanan pembayaran QRIS Marketku belum terhubung, jadi pesanan ini belum bisa dibayar. Pesananmu tetap tersimpan dan akan otomatis batal bila waktu bayar habis.
            </div>
            <button disabled={busy} onClick={() => void cancel()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive transition active:scale-[0.98]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Batalkan pesanan
            </button>
          </section>
        )}

        {orders.map((o) => (
          <section key={o.id} className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 font-bold"><Store className="h-4 w-4 text-primary" />{o.store_name}</p>
                <button onClick={() => { void navigator.clipboard.writeText(`M-${o.order_no}`); toast.success("Order ID disalin"); }} className="flex items-center gap-1 text-xs text-muted-foreground">M-{o.order_no} <Copy className="h-3 w-3" /></button>
              </div>
              <StatusBadge status={o.status} />
            </div>
            {o.order_items.map((i) => (
              <div key={i.id} className="space-y-2 border-t pt-3">
                <div className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0"><Link to="/produk/$id" params={{ id: i.product_id ?? "" }} className="line-clamp-2 font-semibold">{i.product_name}</Link><p className="text-muted-foreground">{i.variant_name} · {i.qty}x</p></div>
                  <b>{rpBuyer(Number(i.line_total))}</b>
                </div>
                {i.delivered.length > 0 && (
                  <div className="rounded-xl bg-accent p-3 text-sm">
                    <p className="mb-1 font-semibold text-primary">Produk kamu</p>
                    {i.delivered.map((d, n) => <p key={n} className="whitespace-pre-wrap break-all font-mono text-xs">{d}</p>)}
                  </div>
                )}
                {o.status === "completed" && !q.data?.reviewed.has(i.id) && i.product_id && <ReviewForm itemId={i.id} productId={i.product_id} sellerId={o.seller_id} onDone={() => void refresh()} />}
              </div>
            ))}
            <div className="space-y-1 border-t pt-3 text-sm">
              <Row a="Subtotal" b={rpBuyer(Number(o.subtotal))} />
              {Number(o.discount) > 0 && <Row a={`Voucher ${o.voucher_code ?? ""}`} b={`-${rpBuyer(Number(o.discount))}`} />}
              {o.unique_code > 0 && <Row a="Kode unik QRIS" b={rpBuyer(o.unique_code)} />}
              <div className="flex justify-between font-bold"><span>Total</span><span>{rpBuyer(Number(o.total))}</span></div>
              <Row a="Dibuat" b={fmtDateTime(o.created_at)} />
            </div>
            <button onClick={() => void chat(o.seller_id)} className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition active:scale-[0.98]"><MessageCircle className="h-4 w-4" /> Chat seller</button>
          </section>
        ))}
        <Link to="/riwayat" className="block text-center font-semibold text-primary">Lihat semua pesanan</Link>
      </div>
    </AppShell>
  );
}

const Row = ({ a, b }: { a: string; b: string }) => <div className="flex justify-between"><span className="text-muted-foreground">{a}</span><span>{b}</span></div>;

export function StatusBadge({ status }: { status: string }) {
  const cls = status === "completed" ? "bg-success/15 text-success" : status === "pending" ? "bg-warning/20 text-warning" : ["cancelled", "failed"].includes(status) ? "bg-destructive/10 text-destructive" : "bg-accent text-primary";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status === "completed" && <CheckCircle2 className="mr-1 inline h-3 w-3" />}{ORDER_LABEL[status] ?? status}</span>;
}

function ReviewForm({ itemId, productId, sellerId, onDone }: { itemId: string; productId: string; sellerId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!user || rating < 1) { toast.error("Pilih rating dulu"); return; }
    setBusy(true);
    const { error } = await supabase.from("product_reviews").insert({ order_item_id: itemId, product_id: productId, seller_id: sellerId, buyer_id: user.id, rating, comment: comment.trim() || null, topic });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Terima kasih atas ulasanmu");
    onDone();
  };
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-semibold">Beri ulasan</p>
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} bintang`} onClick={() => setRating(n)}><Star className={`h-6 w-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground/40"}`} /></button>)}</div>
      <div className="flex flex-wrap gap-1.5">{TOPICS.map((t) => <button key={t} onClick={() => setTopic(topic === t ? null : t)} className={`rounded-full border px-2.5 py-1 text-xs ${topic === t ? "border-primary bg-accent text-primary" : ""}`}>{t}</button>)}</div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} rows={2} placeholder="Ceritakan pengalamanmu (opsional)" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary" />
      <button disabled={busy} onClick={() => void send()} className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Kirim ulasan</button>
    </div>
  );
}
