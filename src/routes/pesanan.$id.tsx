import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type React from "react";
import { Clock, Copy, XCircle, Package, Star, Loader2, MessageCircle, ReceiptText, BadgeCheck, Check, Headphones, Flag, Download } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dbError, fmtDateTime } from "@/lib/market";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { rpBuyer } from "@/components/marketku/product-card";
import { pageMeta } from "@/lib/meta";
import { canReportOrder, isDisputeActive } from "@/lib/disputes";
import { ReportSheet } from "@/components/marketku/report-sheet";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/pesanan/$id")({
  head: () => pageMeta("Detail Pesanan — Marketku", "Status pembayaran, produk, dan pengiriman pesananmu di Marketku."),
  component: Pesanan,
});


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
      const reviewed = itemIds.length ? (await supabase.from("product_reviews").select("id, order_item_id, rating, comment, created_at, edited_at").in("order_item_id", itemIds)).data ?? [] : [];
      const orderIds = (data ?? []).map((o) => o.id);
      const disputes = orderIds.length ? (await supabase.from("order_disputes").select("id, order_id, status").in("order_id", orderIds).order("created_at", { ascending: false })).data ?? [] : [];
      return { orders: data ?? [], reviewed: new Map(reviewed.map((r) => [r.order_item_id, r] as const)), disputes };
    },
  });
  const orders = q.data?.orders ?? [];
  const pending = orders.filter((o) => o.status === "pending");


  const cd = useCountdown(pending[0]?.expires_at);
  const [busy, setBusy] = useState(false);
  const [allSteps, setAllSteps] = useState(false);
  const [reportFor, setReportFor] = useState<{ id: string; no: number } | null>(null);
  const disputes = q.data?.disputes ?? [];
  const activeDispute = (orderId: string) => disputes.find((x) => x.order_id === orderId && isDisputeActive(x.status));
  const report = (o: { id: string; order_no: number; status: string; paid_at: string | null; buyer_confirmed_at: string | null }) => {
    const act = activeDispute(o.id);
    if (act) { navigate({ to: "/dispute/$id", params: { id: act.id } }); return; }
    if (!canReportOrder(o)) { toast.info("Pesanan sudah dikonfirmasi selesai. Hubungi seller jika masih ada kendala."); return; }
    setReportFor({ id: o.id, no: o.order_no });
  };
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
    // Same as marketku.id: opening chat from an order sends a first message naming the order.
    const no = orders.find((x) => x.seller_id === seller)?.order_no;
    if (no && user) await supabase.from("messages").insert({ conversation_id: data, sender_id: user.id, body: `Halo, saya ingin menanyakan pesanan M-${no}.` });
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
  const done = orders.every((o) => o.status === "completed");
  const jump = (el: string) => { const n = document.getElementById(el); if (n) n.scrollIntoView({ behavior: "smooth", block: "start" }); else toast.info(el === "data-akses" ? "Data akses dikirim seller lewat chat" : ""); };
  const shown: { t: string; d: string; at: string | null; done: boolean; fail?: boolean; label?: string }[] = cancelled
    ? [{ t: "Pesanan dibuat", d: "Pesanan berhasil tercatat di Marketku.", at: first.created_at, done: true, label: "Selesai" }, { t: "Pembayaran tidak diselesaikan", d: "Batas pembayaran berakhir atau pesanan dibatalkan.", at: null, done: false, fail: true, label: "Dibatalkan" }]
    : allSteps ? steps : steps.filter((s, i) => !s.done || i === steps.filter((x) => x.done).length - 1).slice(0, 2);

  return (
    <AppShell showSupport={!cancelled}>
      <div className="space-y-3 px-3 pb-6 pt-3">
        {pending.length > 0 && (
          <section className="rounded-xl border bg-card p-3">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/20 text-warning"><Clock className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-bold">Selesaikan pembayaran</p>
                <p className="text-xs text-muted-foreground">Pesanan diproses setelah pembayaran berhasil dikonfirmasi.</p>
                {cd && <p className={`mt-1 text-xs font-semibold ${cd.ms ? "text-warning" : "text-destructive"}`}>{cd.ms ? `Bayar dalam ${cd.text}` : "Waktu bayar habis"}</p>}
              </div>
            </div>
            <Link to="/bayar/$id" params={{ id: pending[0]!.checkout_id }} className="mt-3 block w-full rounded-lg bg-primary py-2 text-sm text-center font-semibold text-primary-foreground transition active:scale-[0.98]">Bayar sekarang</Link>
            <button disabled={busy} onClick={() => void cancel()} className="mt-2 flex w-full items-center justify-center gap-2 py-1.5 text-xs font-semibold text-destructive">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Batalkan pesanan
            </button>
          </section>
        )}

        {cancelled && (
          <section className="rounded-xl border bg-card p-3">
            <div className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground"><ReceiptText className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-bold">Pesanan telah dibatalkan</p>
                <p className="text-xs leading-relaxed text-muted-foreground">Pesanan ini tidak dilanjutkan. Instruksi pembayaran lama tidak boleh digunakan kembali.</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <p className="flex-1 text-center text-xs leading-relaxed text-muted-foreground">Anda tidak perlu melakukan apa pun saat ini.</p>
              <Link to="/bantuan" className="flex-1 rounded-lg border bg-card py-2 text-center text-xs font-semibold transition active:scale-[0.98]">Pusat bantuan</Link>
            </div>
          </section>
        )}

        {orders.some((o) => o.status === "refunded") && (
          <section className="rounded-xl border bg-card p-3">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Undo2 className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-bold">Dana sudah dikembalikan</p>
                <p className="text-xs text-muted-foreground">Refund dari laporan pesanan ini sudah masuk ke Saldo Marketku kamu.</p>
              </div>
            </div>
            <Link to="/saldo" className="mt-3 block rounded-xl border py-2 text-center text-xs font-semibold">Lihat Saldo Marketku</Link>
          </section>
        )}

        {done && (
          <section className="rounded-xl border bg-card p-3">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success/15 text-success"><BadgeCheck className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-bold">Pesanan telah selesai</p>
                <p className="text-xs text-muted-foreground">Produk telah diterima dan transaksi dinyatakan selesai.</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => jump("ulasan")} className="rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground transition active:scale-[0.98]">Berikan ulasan</button>
              <button onClick={() => jump("data-akses")} className="rounded-xl border py-2 text-xs font-semibold transition active:scale-[0.98]">Lihat data akses</button>
            </div>
          </section>
        )}

        {orders.filter((o) => o.paid_at && ["paid", "processing", "completed"].includes(o.status)).map((o) => (
          <Received key={`r-${o.id}`} order={o} disputed={!!activeDispute(o.id)} onDone={() => void refresh()} onReport={() => report(o)} />
        ))}
        {disputes.filter((x) => isDisputeActive(x.status)).map((x) => (
          <Link key={x.id} to="/dispute/$id" params={{ id: x.id }} className="flex items-center gap-3 rounded-xl border border-warning/50 bg-warning/10 p-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1"><p className="text-sm font-bold">Laporan sedang diproses</p><p className="text-xs text-muted-foreground">Dana pesanan diamankan. Buka Dispute Room untuk berdiskusi dengan seller &amp; admin.</p></div>
            <span className="text-xs font-bold text-primary">Buka</span>
          </Link>
        ))}

        <SecHead icon={ReceiptText} t="Detail transaksi" d="Produk dan rincian pembayaran pesanan." />
        {orders.map((o) => (
          <section key={o.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="space-y-2 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold">{o.store_name}<BadgeCheck className="h-4 w-4 text-primary" /></p>
              {o.order_items.map((i) => (
                <div key={i.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><Link to="/produk/$id" params={{ id: i.product_id ?? "" }} className="text-sm font-bold leading-snug">{i.product_name}</Link><p className="text-xs text-muted-foreground">{i.variant_name}{i.qty > 1 ? ` · ${i.qty}x` : ""}</p></div>
                    <b className="shrink-0 text-sm">{rpBuyer(Number(i.line_total))}</b>
                  </div>
                  {i.delivered.length > 0 && (
                    <div id="data-akses" className="scroll-mt-24 rounded-xl bg-accent p-3 text-sm">
                      <p className="mb-1 font-semibold text-primary">Produk kamu</p>
                      {i.delivered.map((d, n) => <p key={n} className="whitespace-pre-wrap break-all font-mono text-xs">{d}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2 bg-muted/40 p-3 text-xs">
              <Row a="Status pembayaran" b={o.paid_at ? <span className="text-success">lunas</span> : ["cancelled", "failed"].includes(o.status) ? <span className="text-destructive">dibatalkan</span> : "pending"} />
              <Row a="Metode pembayaran" b={(o.payment_method ?? "QRIS").toUpperCase()} />
              {Number(o.discount) > 0 && <Row a={`Voucher ${o.voucher_code ?? ""}`} b={`-${rpBuyer(Number(o.discount))}`} />}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <button onClick={() => { void navigator.clipboard.writeText(`M-${o.order_no}`); toast.success("Order ID disalin"); }} className="flex items-center overflow-hidden rounded-lg border font-mono text-sm"><span className="px-2 py-1">#M-{o.order_no}</span><span className="border-l px-2 py-1"><Copy className="h-3.5 w-3.5" /></span></button>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm"><span className="text-muted-foreground">Total pembayaran</span><b>{rpBuyer(Number(o.total))}</b></div>
            </div>
          </section>
        ))}

        <SecHead icon={Clock} t="Aktivitas pesanan" d="Perjalanan pesanan berdasarkan status transaksi." />
        <section className="rounded-xl border bg-card p-3">
          <ol>
            {shown.map((s, i) => (
              <li key={s.t} className="relative flex gap-3 pb-3 last:pb-0">
                {i < shown.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px ${cancelled ? "bg-success/60" : "bg-border"}`} />}
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${s.fail ? "border-destructive/40 bg-destructive/10 text-destructive" : s.done ? "border-success/50 bg-success/15 text-success" : "text-muted-foreground"}`}>{s.fail ? <XCircle className="h-3.5 w-3.5" /> : s.done ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2"><b className="text-xs">{s.t}</b><span className="shrink-0 text-xs text-muted-foreground">{s.label ?? (s.done ? (s.at ? fmtDateTime(s.at) : "Selesai") : "Berikutnya")}</span></div>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                  {s.label && s.at && <p className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(s.at)}</p>}
                </div>
              </li>
            ))}
          </ol>
          {!cancelled && <button onClick={() => setAllSteps(!allSteps)} className="mt-1 pl-10 text-xs font-bold">{allSteps ? "Sembunyikan aktivitas" : "Lihat seluruh aktivitas"}</button>}
        </section>

        {orders.some((o) => o.status === "completed") && (
          <div id="ulasan" className="scroll-mt-24 space-y-3">
            <SecHead icon={Star} t="Ulasan" d="Bagikan pengalaman untuk membantu pembeli lain." />
            {orders.filter((o) => o.status === "completed").flatMap((o) => o.order_items.filter((i) => i.product_id).map((i) => (
              <ReviewCard key={i.id} name={i.product_name} itemId={i.id} productId={i.product_id!} sellerId={o.seller_id} review={q.data?.reviewed.get(i.id)} onDone={() => void refresh()} />
            )))}
          </div>
        )}

        <SecHead icon={Headphones} t="Bantuan pesanan" d="Semua komunikasi dengan seller dilakukan melalui Marketku." />
        <button onClick={() => void chat(first.seller_id)} className="flex w-full items-center justify-between rounded-xl border bg-card px-3 py-2.5 text-left text-sm font-bold transition active:scale-[0.98]">Hubungi seller <MessageCircle className="h-4 w-4 text-muted-foreground" /></button>
        {!cancelled && st >= 1 && <button onClick={() => report(orders.find((o) => o.paid_at) ?? first)} className="flex w-full items-center gap-2 rounded-xl bg-destructive px-3 py-2.5 text-left text-sm font-bold text-destructive-foreground transition active:scale-[0.98]"><Flag className="h-4 w-4" /> Laporkan masalah</button>}
        <Link to="/riwayat" className="block text-center text-sm font-semibold text-primary">Lihat semua pesanan</Link>
      </div>
      {reportFor && <ReportSheet orderId={reportFor.id} orderNo={reportFor.no} onClose={() => setReportFor(null)} />}
    </AppShell>
  );
}

const SecHead = ({ icon: I, t, d }: { icon: typeof Clock; t: string; d: string }) => (
  <div className="flex gap-2 px-1 pt-1"><I className="mt-0.5 h-4 w-4 shrink-0" /><div><h2 className="text-sm font-bold">{t}</h2><p className="text-xs text-muted-foreground">{d}</p></div></div>
);
const Row = ({ a, b }: { a: string; b: React.ReactNode }) => <div className="flex justify-between gap-3"><span className="text-muted-foreground">{a}</span><b className="text-right">{b}</b></div>;

type OrderRow = { id: string; order_no: number; created_at: string; paid_at: string | null; buyer_confirmed_at: string | null; status: string; order_items: { id: string; product_name: string; variant_name: string; delivered: string[] }[] };

function saveFile(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

// Kartu "Pesanan diterima": pembeli konfirmasi → dana diteruskan ke seller; otomatis selesai 5 jam setelah dibayar.
function Received({ order: o, onDone, onReport, disputed = false }: { order: OrderRow; onDone: () => void; onReport: () => void; disputed?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const left = Math.max(0, new Date(o.paid_at!).getTime() + 5 * 3600_000 - now);
  const open = left > 0 && !confirmed && !o.buyer_confirmed_at;
  const hh = (n: number) => String(n).padStart(2, "0");
  const timer = `${hh(Math.floor(left / 3600000))}:${hh(Math.floor((left % 3600000) / 60000))}:${hh(Math.floor((left % 60000) / 1000))}`;
  const codes = o.order_items.flatMap((i) => i.delivered.map((d) => ({ p: i.product_name, v: i.variant_name, d })));
  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("buyer_confirm_order", { p_order: o.id });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    setAsk(false); setConfirmed(true);
    toast.success("Pesanan selesai. Terima kasih!");
    onDone();
  };
  const d = new Date(o.created_at);
  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-l-4 border-l-success bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5 text-sm text-muted-foreground">
          <span>{d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}, {d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
          <button onClick={() => { void navigator.clipboard.writeText(`M-${o.order_no}`); toast.success("Order ID disalin"); }} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs"><Copy className="h-3 w-3" />M-{o.order_no}</button>
        </div>
        <div className="space-y-2.5 p-4">
          <p className="font-bold uppercase leading-snug">{o.order_items.map((i) => i.product_name).join(", ")}</p>
          {open ? (
            <button onClick={() => setAsk(true)} className="w-full rounded-xl bg-success py-3 text-sm font-bold text-primary-foreground transition active:scale-[0.98]">Pesanan diterima</button>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-success/15 py-3 text-sm font-bold text-success"><Check className="h-4 w-4" /> Pesanan selesai</p>
          )}
          <button onClick={onReport} className="flex w-full items-center justify-center gap-2 rounded-xl border border-warning/60 py-3 text-sm font-semibold text-warning transition active:scale-[0.98]"><Flag className="h-4 w-4" /> {disputed ? "Lihat laporan" : "Laporkan"}</button>
        </div>
      </section>
      {open && (
        <div className="rounded-2xl bg-warning/10 p-4 text-sm">
          <p className="font-bold text-warning">⏱️ Pesanan akan dikonfirmasi otomatis dalam <span className="font-mono">{timer}</span></p>
          <p className="mt-1 text-warning/80">Jika pesanan tidak dikonfirmasi, pesanan akan otomatis diselesaikan setelah waktu habis.</p>
        </div>
      )}
      {codes.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => saveFile(`M-${o.order_no}.csv`, "produk,varian,kode\n" + codes.map((c) => [c.p, c.v, c.d].map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv")} className="flex items-center justify-center gap-2 rounded-xl border bg-card py-3 text-sm font-semibold"><Download className="h-4 w-4" /> Download CSV</button>
            <button onClick={() => saveFile(`M-${o.order_no}.txt`, codes.map((c) => c.d).join("\n"), "text/plain")} className="flex items-center justify-center gap-2 rounded-xl border bg-card py-3 text-sm font-semibold"><Download className="h-4 w-4" /> Download TXT</button>
          </div>
          <section className="overflow-hidden rounded-2xl border bg-card">
            <p className="border-b px-4 py-3 font-bold">Detail pesanan</p>
            {codes.map((c, n) => (
              <div key={n} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1"><p className="text-xs font-bold tracking-wider text-muted-foreground">KODE</p><p className="mt-1 whitespace-pre-wrap break-all font-mono text-sm">{c.d}</p></div>
                <button aria-label="Salin kode" onClick={() => { void navigator.clipboard.writeText(c.d); toast.success("Kode disalin"); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"><Copy className="h-4 w-4" /></button>
              </div>
            ))}
          </section>
        </>
      )}
      {ask && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-6 backdrop-blur-sm" onClick={() => !busy && setAsk(false)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-5 text-center shadow-2xl animate-in zoom-in-95">
            <p className="text-lg font-bold">Selesaikan pesanan?</p>
            <p className="mt-2 text-sm text-muted-foreground">Jika pesanan diselesaikan, dana akan diteruskan ke seller dan <b className="text-foreground">tidak dapat dibatalkan</b> lagi. Pastikan data akses sudah kamu terima dengan benar.</p>
            <button disabled={busy} onClick={() => setAsk(false)} className="mt-4 w-full rounded-xl border bg-muted/50 py-3 text-sm font-bold">Batal</button>
            <button disabled={busy} onClick={() => void confirm()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3 text-sm font-bold text-primary-foreground">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Ya, Selesaikan</button>
          </div>
        </div>
      )}
    </>
  );
}

const REVIEW_EDIT_DAYS = 7;
function reviewEditDeadline(createdAt: string) { return new Date(new Date(createdAt).getTime() + REVIEW_EDIT_DAYS * 86400_000); }

type Review = { id: string; rating: number; comment: string | null; created_at: string; edited_at: string | null };

function ReviewCard({ name, itemId, productId, sellerId, review, onDone }: { name: string; itemId: string; productId: string; sellerId: string; review?: Review | undefined; onDone: () => void }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const deadline = review ? reviewEditDeadline(review.created_at) : null;
  const canEdit = !!review && !review.edited_at && deadline!.getTime() > Date.now();
  const send = async () => {
    if (!user || rating < 1) { toast.error("Pilih rating dulu"); return; }
    setBusy(true);
    const { error } = review
      ? await supabase.rpc("edit_review", { p_id: review.id, p_rating: rating, p_comment: comment.trim() })
      : await supabase.from("product_reviews").insert({ order_item_id: itemId, product_id: productId, seller_id: sellerId, buyer_id: user.id, rating, comment: comment.trim() || null });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success(review ? "Ulasan diperbarui" : "Terima kasih atas ulasanmu");
    setEditing(false);
    onDone();
  };
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="font-bold uppercase leading-snug">{name}</p>
      {review && !editing ? (
        <>
          <p className="flex items-center gap-2 text-success"><BadgeCheck className="h-5 w-5" /> Ulasan sudah terkirim.</p>
          <p className="text-sm text-muted-foreground">{review.rating} dari 5 bintang{review.comment ? ` · ${review.comment}` : ""}</p>
          {canEdit && <button onClick={() => { setRating(review.rating); setComment(review.comment ?? ""); setEditing(true); }} className="rounded-lg border px-4 py-2 text-sm font-semibold transition active:scale-95">Edit ulasan</button>}
          <p className="text-sm text-muted-foreground">{review.edited_at ? "Ulasan sudah diedit dan tidak dapat diubah lagi." : canEdit ? `Dapat diedit satu kali hingga ${fmtDateTime(deadline!.toISOString())}.` : "Batas waktu edit ulasan sudah lewat."}</p>
        </>
      ) : (
        <>
          <div className="flex gap-4">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} bintang`} onClick={() => setRating(n)} className="transition active:scale-90"><Star className={`h-7 w-7 text-warning ${n <= rating ? "fill-warning" : ""}`} /></button>)}</div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} rows={3} placeholder="Ceritakan pengalamanmu (opsional)" className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => void send()} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{review ? "Simpan ulasan" : "Kirim ulasan"}</button>
            {editing && <button disabled={busy} onClick={() => setEditing(false)} className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Batal</button>}
          </div>
          {editing && <p className="text-xs text-muted-foreground">Ulasan hanya bisa diedit satu kali.</p>}
        </>
      )}
    </section>
  );
}
