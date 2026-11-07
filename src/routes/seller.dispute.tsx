import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Undo2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Chips, SellerCard, SellerEmpty, SellerPageTitle, SellerSheet } from "@/components/marketku/seller-ui";
import { DisputeThread } from "@/components/marketku/dispute-thread";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DISPUTE_STATUS, disputeStats, isDisputeActive, useDispute, useDisputes, type DisputeStatus } from "@/lib/disputes";
import { dbError, fmtDateTime } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/dispute")({
  staticData: { sitemap: false },
  head: () => pageMeta("Dispute Pesanan — Seller Center Marketku", "Pantau komplain pembeli atas pesanan toko kamu."),
  component: SellerDispute,
});

type F = "semua" | DisputeStatus;
const toneCls = (t: string) => (t === "warn" ? "bg-warning/15 text-warning" : t === "ok" ? "bg-success/15 text-success" : t === "bad" ? "bg-destructive/10 text-destructive" : t === "info" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground");

function SellerDispute() {
  const { user } = useAuth();
  const [f, setF] = useState<F>("semua");
  const [open, setOpen] = useState<string | null>(null);
  const list = useDisputes("seller", user?.id);
  const all = list.data ?? [];
  const s = disputeStats(all);
  const rows = f === "semua" ? all : all.filter((d) => d.status === f);
  const stats: [string, number][] = [["Total", s.total], ["Aktif", s.aktif], ["Terbuka", s.terbuka], ["Sedang ditinjau", s.ditinjau], ["Selesai", s.selesai]];
  return (
    <div className="space-y-3 p-3">
      <SellerPageTitle icon={AlertTriangle} title="Dispute" desc="Komplain pembeli atas pesanan toko kamu."
        right={<button aria-label="Muat ulang dispute" onClick={() => void list.refetch()} className="grid h-9 w-9 place-items-center rounded-xl border"><RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} /></button>} />
      <SellerCard className="grid grid-cols-5 divide-x text-center">
        {stats.map(([l, n]) => <div key={l} className="px-1 py-2.5"><p className="truncate text-[9.5px] font-semibold uppercase text-muted-foreground">{l}</p><p className="mt-0.5 text-base font-semibold">{n}</p></div>)}
      </SellerCard>
      <Chips value={f} onChange={setF} items={[{ value: "semua", label: "Semua" }, { value: "terbuka", label: "Terbuka" }, { value: "ditinjau", label: "Sedang ditinjau" }, { value: "dilepas", label: "Dana dilepas" }, { value: "refund", label: "Refund" }, { value: "ditutup", label: "Ditutup" }]} />
      {rows.length === 0 ? (
        <SellerCard><SellerEmpty icon={ShieldCheck} title={list.isLoading ? "Memuat dispute..." : "Belum ada dispute"} desc="Komplain dari pembeli akan tampil di sini." /></SellerCard>
      ) : (
        <SellerCard className="divide-y">
          {rows.map((d) => {
            const st = DISPUTE_STATUS[d.status as DisputeStatus] ?? DISPUTE_STATUS.ditutup;
            return (
              <button key={d.id} onClick={() => setOpen(d.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-muted-foreground">M-{d.orders?.order_no} · {fmtDateTime(d.updated_at)}</p>
                  <p className="truncate text-sm font-semibold">{d.orders?.order_items.map((i) => i.product_name).join(", ")}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.orders?.buyer_name ?? "Pembeli"} · {d.reasons[0]}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneCls(st.tone)}`}>{st.label}</span>
              </button>
            );
          })}
        </SellerCard>
      )}
      <DisputeSheet id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function DisputeSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useDispute(id ?? undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const d = q.data?.dispute;
  const act = async (action: "refund" | "tolak" | "selesai") => {
    if (!d) return;
    if (action === "refund" && !window.confirm(`Setujui refund? Dana pesanan dikembalikan ke Saldo Marketku pembeli.`)) return;
    setBusy(action);
    const { error } = await supabase.rpc("seller_respond_dispute", { p_id: d.id, p_action: action });
    setBusy(null);
    if (error) { toast.error(dbError(error)); return; }
    toast.success(action === "refund" ? "Refund disetujui" : action === "tolak" ? "Diteruskan ke admin" : "Masalah ditandai selesai");
    void qc.invalidateQueries({ queryKey: ["dispute", d.id] });
    void qc.invalidateQueries({ queryKey: ["disputes"] });
  };
  const st = d ? DISPUTE_STATUS[d.status as DisputeStatus] ?? DISPUTE_STATUS.ditutup : null;
  return (
    <SellerSheet open={!!id} onOpenChange={(v) => !v && onClose()} title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Detail dispute</span>}>
      {!d ? <div className="h-60 animate-pulse rounded-xl bg-muted" /> : (
        <div className="space-y-3">
          <div className="flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneCls(st!.tone)}`}>{st!.label}</span><span className="font-mono text-xs text-muted-foreground">M-{d.orders?.order_no}</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info a="Produk" b={d.orders?.order_items.map((i) => i.product_name).join(", ") ?? "-"} />
            <Info a="Pembeli" b={d.orders?.buyer_name ?? "Pembeli"} />
            <Info a="Dibuat" b={fmtDateTime(d.created_at)} />
            <Info a="Diperbarui" b={fmtDateTime(d.updated_at)} />
          </div>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-[11px] font-semibold uppercase text-muted-foreground">Alasan pembeli</p><p className="mt-1">{d.reasons.join(", ")}{d.note ? ` · Keterangan: ${d.note}` : ""}</p></div>
          <div className="rounded-xl border p-2.5">
            <p className="mb-2 px-1 text-sm font-semibold">Ruang penyelesaian</p>
            <DisputeThread disputeId={d.id} status={d.status} messages={q.data?.messages ?? []} uid={user?.id} compact />
          </div>
          {isDisputeActive(d.status) && (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">Pengajuan refund pembeli harus kamu setujui atau tolak. Jika disetujui, dana otomatis kembali ke saldo pembeli. Jika ditolak, dispute diteruskan ke admin.</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={!!busy} onClick={() => void act("refund")} className="flex items-center justify-center gap-1.5 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive">{busy === "refund" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}Setujui refund</button>
                <button disabled={!!busy || d.status === "ditinjau"} onClick={() => void act("tolak")} className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold disabled:opacity-40">{busy === "tolak" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}Tolak, ke admin</button>
              </div>
              <button disabled={!!busy} onClick={() => void act("selesai")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">{busy === "selesai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Tandai masalah selesai</button>
            </>
          )}
          {d.resolution_note && !isDisputeActive(d.status) && <p className="rounded-xl bg-muted/60 p-2.5 text-xs">Hasil: <b>{d.resolution_note}</b></p>}
        </div>
      )}
    </SellerSheet>
  );
}

const Info = ({ a, b }: { a: string; b: string }) => <div className="rounded-xl border p-2.5"><p className="text-muted-foreground">{a}</p><p className="mt-0.5 line-clamp-2 font-semibold">{b}</p></div>;
