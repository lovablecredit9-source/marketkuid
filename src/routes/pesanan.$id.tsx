import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type React from "react";
import { Clock, Copy, XCircle, Package, Star, Loader2, MessageCircle, ReceiptText, BadgeCheck, Check, Headphones } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dbError, fmtDateTime } from "@/lib/market";
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


  const cd = useCountdown(pending[0]?.expires_at);
  const [busy, setBusy] = useState(false);
  const [allSteps, setAllSteps] = useState(false);
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

  const first = orders[0]!;
  const stage = (s: string) => ({ pending: 0, paid: 1, processing: 2, completed: 3 } as Record<string, number>)[s] ?? -1;
  const st = Math.max(...orders.map((o) => stage(o.status)));
  const cancelled = orders.every((o) => ["cancelled", "failed"].includes(o.status));
  const steps = [
    { t: "Pesanan dibuat", d: "Pesanan berhasil dibuat.", at: first.created_at, done: true },
    { t: "Pembayaran berhasil", d: "Pembayaran sudah dikonfirmasi.", at: first.paid_at, done: st >= 1 },
    { t: "Pesanan diproses seller", d: "Seller menyiapkan produk pesanan.", at: null, done: st >= 2 },
    { t: "Konfirmasi penerimaan", d: "Periksa produk sebelum mengonfirmasi penerimaan.", at: first.completed_at, done: st >= 3 },
  ];
  const shown = cancelled ? [steps[0]!, { t: "Pesanan dibatalkan", d: "Pesanan ini tidak dilanjutkan.", at: first.updated_at, done: true }] : allSteps ? steps : steps.filter((s, i) => !s.done || i === steps.filter((x) => x.done).length - 1).slice(0, 2);

  return (
    <AppShell>
      <div className="space-y-5 px-3 pb-6 pt-3">
        {pending.length > 0 && (
          <section className="rounded-2xl border bg-card p-4">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-warning/20 text-warning"><Clock className="h-6 w-6" /></span>
              <div>
                <p className="text-lg font-bold">Selesaikan pembayaran</p>
                <p className="text-sm text-muted-foreground">Pesanan diproses setelah pembayaran berhasil dikonfirmasi.</p>
                {cd && <p className={`mt-1 text-xs font-semibold ${cd.ms ? "text-warning" : "text-destructive"}`}>{cd.ms ? `Bayar dalam ${cd.text}` : "Waktu bayar habis"}</p>}
              </div>
            </div>
            <Link to="/bayar/$id" params={{ id: pending[0]!.checkout_id }} className="mt-4 block w-full rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground transition active:scale-[0.98]">Bayar sekarang</Link>
            <button disabled={busy} onClick={() => void cancel()} className="mt-2 flex w-full items-center justify-center gap-2 py-1.5 text-xs font-semibold text-destructive">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Batalkan pesanan
            </button>
          </section>
        )}

        <SecHead icon={ReceiptText} t="Detail transaksi" d="Produk dan rincian pembayaran pesanan." />
        {orders.map((o) => (
          <section key={o.id} className="overflow-hidden rounded-2xl border bg-card">
            <div className="space-y-3 p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold">{o.store_name}<BadgeCheck className="h-4 w-4 text-primary" /></p>
              {o.order_items.map((i) => (
                <div key={i.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><Link to="/produk/$id" params={{ id: i.product_id ?? "" }} className="font-bold leading-snug">{i.product_name}</Link><p className="text-sm text-muted-foreground">{i.variant_name}{i.qty > 1 ? ` · ${i.qty}x` : ""}</p></div>
                    <b className="shrink-0">{rpBuyer(Number(i.line_total))}</b>
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
            </div>
            <div className="space-y-3 bg-muted/40 p-4 text-sm">
              <Row a="Status pembayaran" b={o.paid_at ? <span className="text-success">lunas</span> : ["cancelled", "failed"].includes(o.status) ? <span className="text-destructive">dibatalkan</span> : "pending"} />
              <Row a="Metode pembayaran" b={(o.payment_method ?? "QRIS").toUpperCase()} />
              {Number(o.discount) > 0 && <Row a={`Voucher ${o.voucher_code ?? ""}`} b={`-${rpBuyer(Number(o.discount))}`} />}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <button onClick={() => { void navigator.clipboard.writeText(`M-${o.order_no}`); toast.success("Order ID disalin"); }} className="flex items-center overflow-hidden rounded-lg border font-mono text-sm"><span className="px-3 py-1.5">#M-{o.order_no}</span><span className="border-l px-2.5 py-1.5"><Copy className="h-3.5 w-3.5" /></span></button>
              </div>
              <div className="flex justify-between border-t pt-3 text-base"><span className="text-muted-foreground">Total pembayaran</span><b>{rpBuyer(Number(o.total))}</b></div>
            </div>
          </section>
        ))}

        <SecHead icon={Clock} t="Aktivitas pesanan" d="Perjalanan pesanan berdasarkan status transaksi." />
        <section className="rounded-2xl border bg-card p-4">
          <ol>
            {shown.map((s, i) => (
              <li key={s.t} className="relative flex gap-3 pb-5 last:pb-1">
                {i < shown.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border" />}
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${s.done ? "border-success/50 bg-success/15 text-success" : "text-muted-foreground"}`}>{s.done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2"><b className="text-sm">{s.t}</b><span className="shrink-0 text-xs text-muted-foreground">{s.done ? (s.at ? fmtDateTime(s.at) : "Selesai") : "Berikutnya"}</span></div>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          {!cancelled && <button onClick={() => setAllSteps(!allSteps)} className="mt-2 pl-11 text-sm font-bold">{allSteps ? "Sembunyikan aktivitas" : "Lihat seluruh aktivitas"}</button>}
        </section>

        <SecHead icon={Headphones} t="Bantuan pesanan" d="Semua komunikasi dengan seller dilakukan melalui Marketku." />
        <button onClick={() => void chat(first.seller_id)} className="flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-3.5 text-left font-bold transition active:scale-[0.98]">Hubungi seller <MessageCircle className="h-4 w-4 text-muted-foreground" /></button>
        <Link to="/riwayat" className="block text-center font-semibold text-primary">Lihat semua pesanan</Link>
      </div>
    </AppShell>
  );
}

const SecHead = ({ icon: I, t, d }: { icon: typeof Clock; t: string; d: string }) => (
  <div className="flex gap-3 px-1"><I className="mt-0.5 h-6 w-6 shrink-0" /><div><h2 className="text-lg font-bold">{t}</h2><p className="text-sm text-muted-foreground">{d}</p></div></div>
);
const Row = ({ a, b }: { a: string; b: React.ReactNode }) => <div className="flex justify-between gap-3"><span className="text-muted-foreground">{a}</span><b className="text-right">{b}</b></div>;

function ReviewForm({ itemId, productId, sellerId, onDone }: { itemId: string; productId: string; sellerId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allSteps, setAllSteps] = useState(false);
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
