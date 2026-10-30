import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Copy, ImagePlus, Loader2, QrCode, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dbError } from "@/lib/market";
import { providerColor, usePaymentMethods } from "@/lib/admin";
import { uploadPaymentImage, usePaymentUrls, useWallet } from "@/lib/wallet";
import { rpBuyer } from "@/components/marketku/product-card";

export type PayChoice = "saldo" | "qris";

/** Payment box for a pending checkout: pay with Saldo Marketku or send a QRIS/e-wallet transfer proof. */
export function OrderPayBox({ checkoutId, saldoDue, qrisDue, onPaid, initial = "saldo" }: { checkoutId: string; saldoDue: number; qrisDue: number; onPaid: () => void; initial?: PayChoice }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const wallet = useWallet(user?.id);
  const methods = usePaymentMethods(!!user);
  const active = (methods.data ?? []).filter((m) => m.is_active);
  const qrUrls = usePaymentUrls(active.map((m) => m.qr_path));
  const payments = useQuery({
    queryKey: ["order_payments", checkoutId], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("order_payments").select("id, status, admin_note, amount, method_label, created_at").eq("checkout_id", checkoutId).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });
  const [tab, setTab] = useState<PayChoice>(initial);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (methodId || !active.length) return;
    setMethodId((active.find((m) => m.kind === "qris") ?? active[0]!).id);
  }, [active, methodId]);

  const waiting = payments.data?.find((p) => p.status === "pending");
  const rejected = !waiting ? payments.data?.find((p) => p.status === "rejected") : undefined;
  const bal = wallet.data ?? 0;
  const enough = bal >= saldoDue;
  const method = active.find((m) => m.id === methodId);
  const qr = method?.qr_path ? qrUrls.data?.[method.qr_path] : undefined;

  const payWallet = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("pay_order_with_wallet", { p_checkout: checkoutId });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Pembayaran berhasil dengan Saldo Marketku");
    void qc.invalidateQueries({ queryKey: ["wallet", user?.id] });
    onPaid();
  };
  const sendProof = async () => {
    if (!user || !method) return;
    if (!file) { toast.error("Upload bukti transfer dulu"); return; }
    setBusy(true);
    try {
      const path = await uploadPaymentImage(user.id, file);
      const { error } = await supabase.rpc("submit_order_payment", { p_checkout: checkoutId, p_proof: path, p_method: method.id });
      if (error) throw error;
      toast.success("Bukti dikirim. Admin akan mengecek pembayaranmu.");
      setFile(null);
      void payments.refetch(); onPaid();
    } catch (e) { toast.error(dbError(e)); } finally { setBusy(false); }
  };

  if (waiting) return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-accent/50 p-4 text-left text-sm">
      <p className="flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-primary" /> Menunggu konfirmasi admin</p>
      <p className="mt-1 text-muted-foreground">Bukti {waiting.method_label} sebesar <b className="text-foreground">{rpBuyer(Number(waiting.amount))}</b> sudah dikirim. Pesanan diproses otomatis setelah admin menyetujui.</p>
    </div>
  );

  return (
    <div className="mt-4 text-left">
      <div className="grid grid-cols-2 gap-2">
        {([["saldo", Wallet, "Saldo Marketku"], ["qris", QrCode, "QRIS / E-Wallet"]] as const).map(([k, I, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition active:scale-95 ${tab === k ? "border-primary bg-accent text-primary" : "border-border"}`}>
            <I className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>
      {rejected && <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">Bukti sebelumnya ditolak{rejected.admin_note ? `: ${rejected.admin_note}` : ""}. Silakan kirim ulang.</p>}

      {tab === "saldo" ? (
        <div className="mk-fade-in mt-3 rounded-xl border p-3">
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Saldo kamu</span><span className="font-bold">{rpBuyer(bal)}</span></div>
          <div className="mt-1 flex items-center justify-between text-sm"><span className="text-muted-foreground">Dibayar (tanpa kode unik)</span><span className="font-bold text-primary">{rpBuyer(saldoDue)}</span></div>
          {!enough && <p className="mt-2 text-xs text-destructive">Saldo kurang {rpBuyer(saldoDue - bal)}. <Link to="/topup" className="font-bold underline">Top up dulu</Link></p>}
          <button disabled={busy || !enough} onClick={() => void payWallet()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Bayar {rpBuyer(saldoDue)} dengan Saldo
          </button>
        </div>
      ) : (
        <div className="mk-fade-in mt-3 rounded-xl border p-3">
          {methods.isPending ? <p className="py-6 text-center text-sm text-muted-foreground">Memuat metode...</p> : active.length === 0 ? (
            <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">QRIS belum tersedia. Admin belum mengunggah kode QRIS — pakai Saldo Marketku dulu.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {active.map((m) => (
                  <button key={m.id} onClick={() => setMethodId(m.id)} className={`relative flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${methodId === m.id ? "border-primary bg-accent" : ""}`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: providerColor(m.provider) }} /> {m.provider}
                    {methodId === m.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">Transfer tepat</p>
              <p className="text-center text-2xl font-bold text-primary">{rpBuyer(qrisDue)}</p>
              <p className="text-center text-[11px] text-muted-foreground">Termasuk kode unik agar mudah dicek</p>
              {qr && <img src={qr} alt={`QR ${method?.provider}`} className="mx-auto mt-3 w-full max-w-[230px] rounded-xl border bg-white p-2" />}
              {method?.account_number && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                  <div><p className="text-[11px] text-muted-foreground">{method.provider}</p><p className="font-mono text-sm">{method.account_number}</p></div>
                  <button onClick={() => { void navigator.clipboard.writeText(method.account_number!.replace(/\s/g, "")); toast.success("Nomor disalin"); }} className="flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> Salin</button>
                </div>
              )}
              {method?.account_name && <p className="mt-2 text-center text-sm">a.n. <b>{method.account_name}</b></p>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button onClick={() => fileRef.current?.click()} className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-accent/30 py-4 text-sm text-muted-foreground">
                <ImagePlus className="h-5 w-5 text-primary" /> {file ? <span className="font-semibold text-foreground">{file.name}</span> : "Upload bukti transfer"}
              </button>
              <button disabled={busy || !method} onClick={() => void sendProof()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Kirim Bukti Pembayaran
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
