import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/market";
import { MAX_DISPUTE_PHOTOS, isDisputeActive, uploadDisputePhoto, useDisputeFiles } from "@/lib/disputes";

type Msg = { id: string; sender_id: string | null; sender_role: string; body: string; attachment_path: string | null; created_at: string };

const ROLE: Record<string, { name: string; cls: string; badge: string }> = {
  buyer: { name: "Pembeli", cls: "border-border bg-muted/40", badge: "bg-primary/10 text-primary" },
  seller: { name: "Seller", cls: "border-primary/30 bg-primary/10", badge: "bg-success/15 text-success" },
  admin: { name: "Admin Marketku", cls: "border-primary/40 bg-accent", badge: "bg-primary/15 text-primary" },
  system: { name: "Marketku", cls: "border-dashed border-warning/40 bg-warning/10 text-center", badge: "bg-warning/20 text-warning" },
};
const stamp = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}, ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Shared dispute conversation (buyer room, seller sheet, admin). Messages go only through send_dispute_message. */
export function DisputeThread({ disputeId, status, messages, uid, compact = false }: { disputeId: string; status: string; messages: Msg[]; uid: string | undefined; compact?: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const files = useDisputeFiles(messages.flatMap((m) => (m.attachment_path ? [m.attachment_path] : [])));
  const myPhotos = messages.filter((m) => m.sender_id === uid && m.attachment_path).length;
  const active = isDisputeActive(status);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const send = async (attachment: string | null = null) => {
    const body = text.trim();
    if (!body && !attachment) return;
    setBusy(true);
    const { error } = await supabase.rpc("send_dispute_message", { p_id: disputeId, p_body: body || "📷 Bukti foto", p_attachment: attachment as string });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    setText("");
    void qc.invalidateQueries({ queryKey: ["dispute", disputeId] });
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (myPhotos >= MAX_DISPUTE_PHOTOS) { toast.error(`Maksimal ${MAX_DISPUTE_PHOTOS} bukti foto`); return; }
    setBusy(true);
    try { const p = await uploadDisputePhoto(disputeId, f); setBusy(false); await send(p); }
    catch (e) { setBusy(false); toast.error((e as Error).message); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex-1 space-y-3 overflow-y-auto ${compact ? "max-h-[45vh] p-1" : "px-1 pb-3"}`}>
        {messages.map((m) => {
          const r = ROLE[m.sender_role] ?? ROLE.buyer!;
          const mine = m.sender_id === uid && m.sender_role !== "system";
          return (
            <div key={m.id} className={`max-w-[88%] rounded-2xl border p-3 text-sm ${r.cls} ${m.sender_role === "system" ? "mx-auto" : mine ? "ml-auto" : ""}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-bold">{mine ? "Kamu" : r.name}<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${r.badge}`}>{m.sender_role === "system" ? "Marketku" : r.name.split(" ")[0]}</span></span>
                <span className="text-muted-foreground">{stamp(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
              {m.attachment_path && (files.data?.[m.attachment_path]
                ? <a href={files.data[m.attachment_path]} target="_blank" rel="noreferrer"><img src={files.data[m.attachment_path]} alt="Bukti foto dispute" className="mt-2 max-h-56 rounded-xl border object-cover" /></a>
                : <div className="mt-2 h-32 w-40 animate-pulse rounded-xl bg-muted" />)}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {active ? (
        <div className="border-t pt-2.5">
          <div className="mb-1.5 flex justify-between px-1 text-xs"><span className="text-muted-foreground">Bukti foto</span><b>{myPhotos}/{MAX_DISPUTE_PHOTOS}</b></div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            <button aria-label="Lampirkan bukti foto" disabled={busy || myPhotos >= MAX_DISPUTE_PHOTOS} onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-card disabled:opacity-40"><ImagePlus className="h-5 w-5" /></button>
            <input value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder="Tulis pesan untuk seller dan admin..." className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary" />
            <button aria-label="Kirim pesan dispute" disabled={busy || !text.trim()} onClick={() => void send()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">🔒 Semua pesan di room ini akan dicatat dan dapat dilihat oleh semua pihak.</p>
        </div>
      ) : (
        <p className="rounded-xl bg-muted/60 p-3 text-center text-xs text-muted-foreground">Dispute sudah selesai. Room ini hanya bisa dibaca.</p>
      )}
    </div>
  );
}
