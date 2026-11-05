import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Clock, CircleCheck, CircleX, RefreshCw, Search, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/market";
import { pageMeta } from "@/lib/meta";
import { SellerCard } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { CLAIM_LABEL, CLAIM_TONE, claimProofUrl, type ClaimStatus } from "@/components/marketku/warranty-claim";

export const Route = createFileRoute("/seller/garansi")({
  head: () => pageMeta("Klaim Garansi — Seller Center Marketku", "Pantau dan proses klaim garansi dari pembeli."),
  component: Garansi,
});

const tour = [
  { title: "Saring status", desc: "Saring klaim garansi berdasarkan statusnya.", target: "g-chips" },
  { title: "Cari klaim", desc: "Cari klaim lewat kode garansi atau nama produk.", target: "g-search" },
  { title: "Selesai", desc: "Klaim yang disetujui otomatis mengirim akun pengganti dari stok." },
];
const STATUS = ["Semua", "Menunggu", "Disetujui", "Ditolak"] as const;
const KEY: Record<(typeof STATUS)[number], ClaimStatus | null> = { Semua: null, Menunggu: "pending", Disetujui: "approved", Ditolak: "rejected" };

function Garansi() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [s, setS] = useState<(typeof STATUS)[number]>("Semua");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const claims = useQuery({
    queryKey: ["seller_warranty_claims", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("warranty_claims").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });
  const all = claims.data ?? [];
  const count = (k: ClaimStatus) => all.filter((c) => c.status === k).length;
  const shown = useMemo(() => {
    const k = KEY[s]; const t = q.trim().toLowerCase();
    return all.filter((c) => (!k || c.status === k) && (!t || c.code.toLowerCase().includes(t) || c.product_name.toLowerCase().includes(t)));
  }, [all, s, q]);

  const review = async (id: string, approve: boolean, n?: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("seller_review_warranty_claim", { p_claim: id, p_approve: approve, ...(n ? { p_note: n } : {}) });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Klaim disetujui, pengganti terkirim ke pembeli" : "Klaim ditolak");
    setRejectFor(null); setNote("");
    void qc.invalidateQueries({ queryKey: ["seller_warranty_claims"] });
  };
  const openProof = async (path: string) => { const u = await claimProofUrl(path); if (u) window.open(u, "_blank", "noopener"); };

  return (
    <>
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-warning" />
        <h2 className="flex-1 text-2xl font-bold">Klaim Garansi</h2>
        <button aria-label="Muat ulang" onClick={() => void claims.refetch()} className="seller-tap grid h-10 w-10 place-items-center rounded-xl border bg-card"><RefreshCw className={`h-4 w-4 ${claims.isFetching ? "animate-spin" : ""}`} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {([[Clock, "MENUNGGU", "text-warning bg-warning/15", count("pending")], [CircleCheck, "DISETUJUI", "text-success bg-success/15", count("approved")], [CircleX, "DITOLAK", "text-destructive bg-destructive/15", count("rejected")], [Shield, "TOTAL", "text-primary bg-primary/15", all.length]] as const).map(([I, l, c, n]) => (
          <SellerCard key={l} className="flex items-center gap-3 p-4">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${c}`}><I className="h-5 w-5" /></span>
            <div><p className="text-[11px] font-semibold tracking-widest text-muted-foreground">{l}</p><p className="text-lg font-bold">{n}</p></div>
          </SellerCard>
        ))}
      </div>
      <div data-tour="g-chips" className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {STATUS.map((x) => (
          <button key={x} onClick={() => setS(x)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${s === x ? "border-warning bg-warning/20 text-warning" : "bg-card text-foreground/80"}`}>{x}</button>
        ))}
      </div>
      <label data-tour="g-search" className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode/produk..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>
      {claims.isPending ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <Shield className="h-10 w-10" />
          <p className="mt-3">Belum ada klaim garansi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((c) => {
            const st = c.status as ClaimStatus;
            return (
              <SellerCard key={c.id} className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold">{c.code}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CLAIM_TONE[st]}`}>{st === "pending" ? "Menunggu" : CLAIM_LABEL[st]}</span>
                </div>
                <p className="font-semibold">{c.product_name}</p>
                <p className="text-muted-foreground">{c.reason}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(c.created_at)}</p>
                {c.proof_path && <button onClick={() => void openProof(c.proof_path!)} className="flex items-center gap-1.5 text-xs font-semibold text-primary"><ImageIcon className="h-3.5 w-3.5" /> Lihat foto bukti</button>}
                {c.seller_note && <p className="text-xs"><b>Catatan:</b> {c.seller_note}</p>}
                {c.replacement.length > 0 && <p className="text-xs text-success">{c.replacement.length} item pengganti terkirim</p>}
                {st === "pending" && (rejectFor === c.id ? (
                  <div className="space-y-2">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder="Alasan penolakan" className="w-full resize-none rounded-lg border bg-background p-2.5 text-sm outline-none focus:border-primary" />
                    <div className="flex gap-2">
                      <button onClick={() => setRejectFor(null)} className="seller-tap flex-1 rounded-lg border py-2 font-semibold">Batal</button>
                      <button disabled={busy === c.id} onClick={() => void review(c.id, false, note)} className="flex-1 rounded-lg bg-destructive py-2 font-semibold text-destructive-foreground disabled:opacity-60">Tolak klaim</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button disabled={busy === c.id} onClick={() => { setRejectFor(c.id); setNote(""); }} className="seller-tap flex-1 rounded-lg border py-2 font-semibold">Tolak</button>
                    <button disabled={busy === c.id} onClick={() => void review(c.id, true)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 font-semibold text-primary-foreground disabled:opacity-60">{busy === c.id && <Loader2 className="h-4 w-4 animate-spin" />}Setujui & kirim pengganti</button>
                  </div>
                ))}
              </SellerCard>
            );
          })}
        </div>
      )}
      <PageTour id="seller-garansi" steps={tour} panel />
    </>
  );
}
