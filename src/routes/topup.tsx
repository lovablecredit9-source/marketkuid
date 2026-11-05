import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ImagePlus, Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell, rupiah } from "@/components/marketku/shell";
import { LoadingLine } from "@/components/marketku/loading";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/meta";
import { KIND_LABEL, providerColor, usePaymentMethods, type PaymentKind } from "@/lib/admin";
import { DEFAULT_MIN_DEPOSIT, depositStatus, depositAmountError, uploadPaymentImage, usePaymentSettings, usePaymentUrls, useWallet } from "@/lib/wallet";

export const Route = createFileRoute("/topup")({
  head: () => pageMeta("Top Up Saldo — Marketku", "Isi Saldo Marketku lewat QRIS, DANA, GoPay, OVO, ShopeePay, atau transfer bank."),
  component: TopUp,
});

const PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000];
const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const KIND_ORDER: PaymentKind[] = ["qris", "ewallet", "bank"];

function TopUp() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const settings = usePaymentSettings(!!user);
  const methods = usePaymentMethods(!!user);
  const wallet = useWallet(user?.id);
  const active = (methods.data ?? []).filter((m) => m.is_active);
  const qrUrls = usePaymentUrls(active.map((m) => m.qr_path));
  const history = useQuery({
    queryKey: ["my_deposits", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("deposit_requests").select("id, amount, status, admin_note, created_at, method_label").eq("user_id", user!.id).eq("purpose", "wallet").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!methodId && active[0]) setMethodId(active[0].id); }, [active, methodId]);

  if (!ready) return <AppShell title="Top Up Saldo"><LoadingLine label="Memuat..." className="py-24" /></AppShell>;
  if (!user) return (
    <AppShell title="Top Up Saldo">
      <div className="px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">Masuk dulu untuk top up saldo.</p>
        <Link to="/login" className="mt-4 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">Masuk</Link>
      </div>
    </AppShell>
  );

  const min = settings.data?.min_deposit ?? DEFAULT_MIN_DEPOSIT;
  const n = Number(amount.replace(/\D/g, "") || "0");
  const method = active.find((m) => m.id === methodId);
  const qr = method?.qr_path ? qrUrls.data?.[method.qr_path] : undefined;

  const submit = async () => {
    if (!method) { toast.error("Pilih metode pembayaran"); return; }
    const err = depositAmountError(n, min);
    if (err) { toast.error(err); return; }
    if (!file) { toast.error("Upload bukti transfer dulu"); return; }
    setBusy(true);
    try {
      const path = await uploadPaymentImage(user.id, file);
      const { error } = await supabase.rpc("create_deposit", { p_amount: n, p_proof: path, p_method: method.id });
      if (error) throw error;
      toast.success("Deposit dikirim. Admin akan mengecek bukti transfermu.");
      setAmount(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["my_deposits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Gagal mengirim deposit");
    } finally { setBusy(false); }
  };
  const copy = (v: string) => { void navigator.clipboard.writeText(v.replace(/\s/g, "")); toast.success("Nomor disalin"); };

  return (
    <AppShell title="Top Up Saldo">
      <div className="space-y-4 px-4 pb-8 pt-3">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-glow p-4 text-primary-foreground shadow-lg shadow-primary/25">
          <div aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary-foreground/15" />
          <p className="flex items-center gap-2 text-xs font-bold tracking-widest opacity-90"><Wallet className="h-4 w-4" /> SALDO MARKETKU</p>
          <p className="mk-acc-mono mt-2 text-2xl">{rupiah(wallet.data ?? 0)}</p>
          <p className="mt-1 text-xs opacity-90">Top up via QRIS, e-wallet, atau bank • dicek manual oleh admin</p>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">1. Pilih metode pembayaran</h2>
          {methods.isPending ? <LoadingLine label="Memuat metode..." className="py-8" /> : active.length === 0 ? (
            <p className="mt-3 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">Metode top up belum tersedia. Admin belum menambahkan QRIS / e-wallet.</p>
          ) : KIND_ORDER.filter((k) => active.some((m) => m.kind === k)).map((k) => (
            <div key={k} className="mt-3">
              <p className="mb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground">{KIND_LABEL[k].toUpperCase()}</p>
              <div className="grid grid-cols-3 gap-2">
                {active.filter((m) => m.kind === k).map((m) => (
                  <button key={m.id} onClick={() => setMethodId(m.id)} className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition active:scale-95 ${methodId === m.id ? "border-primary bg-accent ring-2 ring-primary/20" : "bg-background"}`}>
                    <span className="grid h-9 w-9 place-items-center rounded-lg text-[10px] font-black text-white" style={{ background: providerColor(m.provider) }}>{m.provider.slice(0, 3)}</span>
                    {m.provider}
                    {methodId === m.id && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {method && (
            <div className="mk-fade-in mt-4 rounded-xl border bg-background p-3" key={method.id}>
              {qr && (
                <div className="flex flex-col items-center">
                  <img src={qr} alt={`QR ${method.provider}`} className="w-full max-w-[240px] rounded-xl border bg-white p-2" />
                  <a href={qr} download className="mt-2 text-xs font-semibold text-primary">Simpan gambar QR</a>
                </div>
              )}
              {method.account_number && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{method.kind === "bank" ? `Rekening ${method.provider}` : `Nomor ${method.provider}`}</p>
                    <p className="mk-acc-mono truncate text-base">{method.account_number}</p>
                  </div>
                  <button onClick={() => copy(method.account_number!)} className="flex shrink-0 items-center gap-1 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> Salin</button>
                </div>
              )}
              {method.account_name && <p className="mt-2 text-center text-sm">a.n. <b>{method.account_name}</b></p>}
            </div>
          )}
          {settings.data?.instructions && <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">{settings.data.instructions}</p>}
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">2. Nominal yang ditransfer</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setAmount(p.toLocaleString("id-ID"))} className={`rounded-xl border py-2 text-xs font-semibold transition active:scale-95 ${n === p ? "border-primary bg-accent text-primary" : "bg-background"}`}>{rupiah(p)}</button>
            ))}
          </div>
          <input inputMode="numeric" value={amount} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setAmount(d ? Number(d).toLocaleString("id-ID") : ""); }} placeholder={`Minimal ${rupiah(min)}`} className="mt-3 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">3. Upload bukti transfer</h2>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()} className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-accent/30 py-6 text-sm text-muted-foreground">
            <ImagePlus className="h-6 w-6 text-primary" />
            {file ? <span className="font-semibold text-foreground">{file.name}</span> : "Pilih foto bukti (JPG/PNG/WebP, maks 5 MB)"}
          </button>
          <button disabled={busy || !method} onClick={submit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Mengirim..." : method ? `Kirim Deposit via ${method.provider}` : "Kirim Deposit"}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Saldo masuk setelah admin mengecek bukti transfer.</p>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Riwayat Deposit</h2>
            <button aria-label="Muat ulang" onClick={() => { history.refetch(); wallet.refetch(); }} className="grid h-8 w-8 place-items-center rounded-lg border"><RefreshCw className={`h-4 w-4 ${history.isFetching ? "animate-spin" : ""}`} /></button>
          </div>
          {history.isPending ? <LoadingLine label="Memuat riwayat..." className="py-6" /> : (history.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada deposit.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {history.data!.map((d) => { const s = depositStatus(d.status); return (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="mk-acc-mono text-sm">{rupiah(d.amount)} <span className="font-sans text-xs text-muted-foreground">• {d.method_label ?? "QRIS"}</span></p>
                    <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}{d.admin_note ? ` • ${d.admin_note}` : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                </li>
              ); })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
