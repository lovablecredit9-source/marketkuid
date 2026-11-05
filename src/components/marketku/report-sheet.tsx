import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/market";
import { DISPUTE_REASONS } from "@/lib/disputes";

/** "Apa kendala pada pesanan ini?" — opens (or reopens) a dispute room for a paid order. */
export function ReportSheet({ orderId, orderNo, onClose }: { orderId: string; orderNo: number; onClose: () => void }) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (r: string) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const submit = async () => {
    if (!picked.length) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("open_dispute", { p_order: orderId, p_reasons: picked, p_note: note.trim() });
    setBusy(false);
    if (error || !data) { toast.error(dbError(error)); return; }
    toast.success("Laporan terkirim. Dana pesanan diamankan sementara.");
    navigate({ to: "/dispute/$id", params: { id: data } });
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Laporkan masalah" onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl animate-in slide-in-from-bottom-8 sm:rounded-3xl">
        <p className="text-lg font-bold">Apa kendala pada pesanan ini?</p>
        <p className="mt-1 text-sm text-muted-foreground">Pilih semua alasan yang sesuai untuk M-{orderNo}.</p>
        <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium text-warning">Dana pesanan akan diamankan sementara selama proses penyelesaian.</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Alasan dispute</p>
        <div className="mt-2 space-y-2">
          {DISPUTE_REASONS.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${picked.includes(r) ? "border-primary bg-accent font-semibold" : ""}`}>
              <input type="checkbox" checked={picked.includes(r)} onChange={() => toggle(r)} className="h-4 w-4 accent-[var(--color-primary)]" />{r}
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold">Tambahkan keterangan (opsional)
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} placeholder="Ceritakan singkat apa yang terjadi…" className="mt-1.5 w-full rounded-xl border bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-primary" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button disabled={busy} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold">Batal</button>
          <button disabled={busy || !picked.length} onClick={() => void submit()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Lanjut</button>
        </div>
      </div>
    </div>
  );
}
