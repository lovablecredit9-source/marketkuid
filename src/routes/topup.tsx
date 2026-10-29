import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, QrCode, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell, rupiah } from "@/components/marketku/shell";
import { LoadingLine } from "@/components/marketku/loading";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/meta";
import { DEFAULT_MIN_DEPOSIT, DEPOSIT_STATUS, depositAmountError, uploadPaymentImage, usePaymentSettings, usePaymentUrls, useWallet } from "@/lib/wallet";

export const Route = createFileRoute("/topup")({
  head: () => pageMeta("Top Up Saldo — Marketku", "Isi Saldo Marketku lewat QRIS dan kirim bukti transfer untuk dicek admin."),
  component: TopUp,
});

const PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000];
const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function TopUp() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const settings = usePaymentSettings(!!user);
  const wallet = useWallet(user?.id);
  const qrisUrl = usePaymentUrls([settings.data?.qris_path]);
  const history = useQuery({
    queryKey: ["my_deposits", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("deposit_requests").select("id, amount, status, admin_note, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const qris = settings.data?.qris_path ? qrisUrl.data?.[settings.data.qris_path] : undefined;

  const submit = async () => {
    const err = depositAmountError(n, min);
    if (err) return toast.error(err);
    if (!file) return toast.error("Upload bukti transfer dulu");
    setBusy(true);
    try {
      const path = await uploadPaymentImage(user.id, file);
      const { error } = await supabase.rpc("create_deposit", { p_amount: n, p_proof: path });
      if (error) throw error;
      toast.success("Deposit dikirim. Admin akan mengecek bukti transfermu.");
      setAmount(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["my_deposits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim deposit");
    } finally { setBusy(false); }
  };

  return (
    <AppShell title="Top Up Saldo">
      <div className="space-y-4 px-4 pb-8 pt-3">
        <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-accent/60 to-card p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground"><Wallet className="h-4 w-4" /> SALDO MARKETKU</p>
          <p className="mk-acc-mono mt-2 text-2xl">{rupiah(wallet.data ?? 0)}</p>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><QrCode className="h-4 w-4 text-primary" /> 1. Scan QRIS</h2>
          {settings.isPending ? <LoadingLine label="Memuat QRIS..." className="py-10" /> : qris ? (
            <div className="mt-3 flex flex-col items-center">
              <img src={qris} alt="QRIS Marketku" className="w-full max-w-[260px] rounded-xl border bg-white p-2" />
              {settings.data?.account_name && <p className="mt-2 text-sm font-semibold">{settings.data.account_name}</p>}
              <a href={qris} download className="mt-2 text-xs font-semibold text-primary">Simpan gambar QRIS</a>
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">QRIS belum tersedia. Admin belum mengunggah kode QRIS.</p>
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
          <button disabled={busy} onClick={submit} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-60">
            {busy ? "Mengirim..." : "Kirim Deposit"}
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
              {history.data!.map((d) => { const s = DEPOSIT_STATUS[d.status] ?? DEPOSIT_STATUS.pending!; return (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="mk-acc-mono text-sm">{rupiah(d.amount)}</p>
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
