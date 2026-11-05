import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Clock, ImageIcon, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/market";

export type ClaimStatus = "pending" | "approved" | "rejected";
export const CLAIM_LABEL: Record<ClaimStatus, string> = { pending: "Menunggu seller", approved: "Disetujui", rejected: "Ditolak" };
export const CLAIM_TONE: Record<ClaimStatus, string> = {
  pending: "bg-warning/15 text-warning", approved: "bg-success/15 text-success", rejected: "bg-destructive/15 text-destructive",
};

export async function claimProofUrl(path: string) {
  const { data } = await supabase.storage.from("warranty-evidence").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Buyer block under a delivered order item: warranty status, claims history, and "Klaim garansi" form. */
export function WarrantyClaimBlock({ itemId }: { itemId: string }) {
  const qc = useQueryClient();
  const info = useQuery({
    queryKey: ["warranty_info", itemId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("item_warranty_info", { p_item: itemId });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const claims = useQuery({
    queryKey: ["warranty_claims_item", itemId],
    enabled: !!info.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("warranty_claims").select("*").eq("order_item_id", itemId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const w = info.data;
  if (!w) return null;
  const list = claims.data ?? [];
  const pending = list.some((c) => c.status === "pending");
  const left = Math.max(0, w.max_claims - w.used);
  const canClaim = w.active && !pending && left > 0;

  const submit = async () => {
    if (reason.trim().length < 5) { toast.error("Jelaskan masalah minimal 5 karakter"); return; }
    setBusy(true);
    let proof: string | null = null;
    if (file) {
      const path = `${itemId}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
      const up = await supabase.storage.from("warranty-evidence").upload(path, file, { contentType: file.type });
      if (up.error) { setBusy(false); toast.error("Gagal unggah bukti"); return; }
      proof = path;
    }
    const { error } = await supabase.rpc("open_warranty_claim", { p_item: itemId, p_reason: reason.trim(), ...(proof ? { p_proof: proof } : {}) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Klaim garansi dikirim. Menunggu persetujuan seller.");
    setOpen(false); setReason(""); setFile(null);
    void qc.invalidateQueries({ queryKey: ["warranty_info", itemId] });
    void qc.invalidateQueries({ queryKey: ["warranty_claims_item", itemId] });
  };

  return (
    <div className="rounded-xl border p-3 text-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="flex-1 font-semibold">Garansi</p>
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${w.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{w.active ? "Aktif" : "Berakhir"}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Berlaku sampai {fmtDateTime(w.ends_at)} · sisa klaim {left}/{w.max_claims}</p>

      {list.map((c) => {
        const s = c.status as ClaimStatus;
        const I = s === "approved" ? CircleCheck : s === "rejected" ? CircleX : Clock;
        return (
          <div key={c.id} className="mt-2 rounded-lg bg-muted/50 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold">{c.code}</span>
              <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${CLAIM_TONE[s]}`}><I className="h-3 w-3" />{CLAIM_LABEL[s]}</span>
            </div>
            <p className="mt-1 text-muted-foreground">{c.reason}</p>
            {c.seller_note && <p className="mt-1"><b>Seller:</b> {c.seller_note}</p>}
            {c.replacement.length > 0 && (
              <div className="mt-1.5 rounded-md bg-accent p-2"><p className="mb-0.5 font-semibold text-primary">Pengganti</p>
                {c.replacement.map((d, n) => <p key={n} className="whitespace-pre-wrap break-all font-mono">{d}</p>)}</div>
            )}
          </div>
        );
      })}

      {canClaim && !open && (
        <button onClick={() => setOpen(true)} className="mt-2 w-full rounded-lg border border-primary/50 py-2 text-sm font-semibold text-primary transition active:scale-[0.98]">Klaim garansi</button>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="Jelaskan masalahnya, misal: akun tidak bisa login"
            className="w-full resize-none rounded-lg border bg-background p-2.5 text-sm outline-none focus:border-primary" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"><ImageIcon className="h-3.5 w-3.5" />{file ? "Ganti foto" : "Foto bukti (opsional)"}</button>
            {file && <button onClick={() => setFile(null)} className="flex items-center gap-1 truncate text-xs text-muted-foreground"><X className="h-3 w-3" />{file.name}</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border py-2 text-sm font-semibold">Batal</button>
            <button disabled={busy} onClick={submit} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Kirim klaim</button>
          </div>
        </div>
      )}
    </div>
  );
}
