import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Loader2, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BEARER_LABEL, VIEW_LABEL, errText, fmtRekberDate, rekberLink, rekberView, type FeeBearer, type RekberDeal } from "@/lib/rekber";

const rp = (n: number) => `Rp. ${n.toLocaleString("id-ID")},-`;

export function RekberStatusPill({ d }: { d: RekberDeal }) {
  const [l, cls] = VIEW_LABEL[rekberView(d)];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{l}</span>;
}

export function RekberCard({ d, uid, onOpen }: { d: RekberDeal; uid?: string; onOpen: () => void }) {
  const role = d.seller_id === uid ? "Penjual" : "Pembeli";
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{d.title}</p>
          <p className="text-xs text-muted-foreground">{d.code}</p>
        </div>
        <RekberStatusPill d={d} />
      </div>
      <p className="mt-2 text-lg font-bold">{rp(d.amount)}</p>
      <p className="text-xs text-muted-foreground">Peran Anda: {role} · Biaya {rp(d.fee)}</p>
      <p className="text-xs text-muted-foreground">Dibuat {fmtRekberDate(d.created_at)}</p>
      <button onClick={onOpen} className="mt-3 w-full rounded-xl border py-2 text-sm font-semibold transition active:scale-[0.98]">Lihat detail</button>
    </div>
  );
}

/** Detail body shared by Seller Center and buyer pages; actions are decided by the viewer's role. */
export function RekberDetail({ d, uid, onDone }: { d: RekberDeal; uid?: string; onDone?: () => void }) {
  const qc = useQueryClient();
  const v = rekberView(d);
  const isSeller = d.seller_id === uid;
  const isBuyer = d.buyer_id === uid;
  const [busy, setBusy] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");

  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(errText(error)); return; }
    toast.success(ok);
    void qc.invalidateQueries({ queryKey: ["rekber"] });
    void qc.invalidateQueries({ queryKey: ["wallet"] });
    onDone?.();
  };

  const copyLink = () => { void navigator.clipboard.writeText(rekberLink(d.share_token)); toast.success("Link rekber disalin"); };
  const frozen = v === "sengketa" ? d.amount : 0;
  const held = v === "ditahan" ? d.amount : 0;

  const Row = ({ k, val }: { k: string; val: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right font-semibold">{val}</span></div>
  );
  const Step = ({ on, label }: { on: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className={`grid h-5 w-5 place-items-center rounded-full ${on ? "bg-emerald-500 text-primary-foreground" : "border-2 border-muted-foreground/40"}`}>{on && <Check className="h-3 w-3" />}</span>
      <span className={on ? "font-semibold" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-bold">{d.title}</p>
        <p className="text-xs text-muted-foreground">{d.code} · {fmtRekberDate(d.created_at)}</p>
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Nilai kesepakatan</p>
        <p className="text-2xl font-bold">{rp(d.amount)}</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Peran Anda: {isSeller ? "Penjual" : "Pembeli"}</p>
          <RekberStatusPill d={d} />
        </div>
      </div>
      <div className="rounded-2xl border bg-card px-4 py-2">
        <Row k="Biaya layanan" val={rp(d.fee)} />
        <Row k="Penanggung biaya" val={BEARER_LABEL[d.fee_bearer as FeeBearer]} />
        <Row k="Dibayar pembeli" val={rp(d.buyer_pays)} />
        <Row k="Diterima penjual" val={rp(d.seller_receives)} />
        <Row k="Dana ditahan" val={rp(held)} />
        <Row k="Dana dibekukan" val={rp(frozen)} />
        <Row k="Batas deposit" val={fmtRekberDate(d.deposit_deadline)} />
      </div>
      <div className="space-y-2 rounded-2xl border bg-card p-4">
        <Step on={!!d.funded_at} label="Didanai" />
        <Step on={v === "selesai"} label="Selesai" />
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">Rincian kesepakatan</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{d.details || "Tidak ada rincian."}</p>
      </div>
      {d.dispute_reason && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Alasan sengketa</p>
          <p className="mt-1 text-muted-foreground">{d.dispute_reason}</p>
          {v === "sengketa" && <p className="mt-1 text-xs text-muted-foreground">Admin Marketku sedang memeriksa. Dana dibekukan sampai ada keputusan.</p>}
        </div>
      )}
      {d.admin_note && <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">Catatan admin: {d.admin_note}</p>}

      {isSeller && v === "deposit" && (
        <div className="space-y-2">
          <button onClick={copyLink} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition active:scale-95"><Copy className="h-4 w-4" /> Salin link untuk pembeli</button>
          <p className="text-center text-xs text-muted-foreground">Kirim link ini ke pembeli. Dana ditahan setelah pembeli membayar deposit.</p>
          <button disabled={busy} onClick={() => run(() => supabase.rpc("cancel_rekber", { p_id: d.id }), "Rekber dibatalkan")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive disabled:opacity-50"><X className="h-4 w-4" /> Batalkan rekber</button>
        </div>
      )}
      {isBuyer && v === "ditahan" && (
        <button disabled={busy} onClick={() => { if (window.confirm("Konfirmasi selesai? Dana akan diteruskan ke penjual dan tidak bisa dibatalkan.")) void run(() => supabase.rpc("confirm_rekber", { p_id: d.id }), "Rekber selesai, dana diteruskan ke penjual"); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Konfirmasi selesai
        </button>
      )}
      {(isBuyer || isSeller) && v === "ditahan" && (
        disputing ? (
          <div className="space-y-2 rounded-2xl border p-3">
            <textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Jelaskan masalahnya" className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDisputing(false)} className="rounded-xl border py-2 text-sm font-semibold">Batal</button>
              <button disabled={busy || reason.trim().length < 5} onClick={() => run(() => supabase.rpc("dispute_rekber", { p_id: d.id, p_reason: reason }), "Sengketa diajukan ke admin")} className="rounded-xl bg-destructive py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50">Ajukan</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setDisputing(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Ajukan sengketa</button>
        )
      )}
    </div>
  );
}
