import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, QrCode, ArrowDownLeft, ArrowUpRight, CreditCard, ShieldCheck, Check, Copy, ImagePlus, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { SellerCard, SellerEmpty, SellerInput, SellerSheet, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { providerColor, usePaymentMethods } from "@/lib/admin";
import { depositStatus, uploadPaymentImage, usePaymentUrls } from "@/lib/wallet";
import { creditTopupError, CREDIT_TOPUP_MIN, CREDIT_TOPUP_MAX } from "@/lib/credits";

const PRESETS = [10000, 25000, 50000, 100000, 250000, 500000];
const tour = [
  { title: "Saldo & credits", desc: "Pantau credits, saldo penjualan, dan saldo tertahan di kartu ini.", target: "c-hero" },
  { title: "Isi credits", desc: "Top up credits lewat QRIS dari sini.", target: "c-topup" },
  { title: "Kenapa perlu credits", desc: "Credits dipakai otomatis untuk komisi dan markup tiap transaksi.", target: "c-why" },
  { title: "Selesai", desc: "Jaga credits tetap positif agar QRIS pribadimu terus aktif." },
];
const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const DAY90 = () => new Date(Date.now() - 90 * 86400_000).toISOString();

export const Route = createFileRoute("/seller/saldo")({
  head: () => ({
    meta: [
      { title: "Saldo & Credits — Seller Center Marketku" },
      { name: "description", content: "Pantau saldo credits, top up, dan riwayat potongan biaya toko." },
      { property: "og:title", content: "Saldo & Credits — Seller Center Marketku" },
      { property: "og:description", content: "Saldo credits toko Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Saldo,
});

function Saldo() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"semua" | "masuk" | "keluar">("semua");
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [methodId, setMethodId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const n = Number(amt || "0");

  const balance = useQuery({
    queryKey: ["seller_credits", uid], enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_credits").select("balance").eq("owner_id", uid!).maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
    },
  });
  const ledger = useQuery({
    queryKey: ["seller_credit_ledger", uid], enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_credit_ledger").select("id, amount, kind, note, created_at")
        .eq("owner_id", uid!).gte("created_at", DAY90()).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const topups = useQuery({
    queryKey: ["seller_credit_topups", uid], enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("deposit_requests").select("id, amount, status, admin_note, created_at, method_label")
        .eq("user_id", uid!).eq("purpose", "credits").neq("status", "approved").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const methods = usePaymentMethods(!!uid);
  const active = (methods.data ?? []).filter((m) => m.is_active);
  const qrUrls = usePaymentUrls(active.map((m) => m.qr_path));
  useEffect(() => { if (!methodId && active[0]) setMethodId(active[0].id); }, [active, methodId]);
  const method = active.find((m) => m.id === methodId);
  const qr = method?.qr_path ? qrUrls.data?.[method.qr_path] : undefined;

  const rows = ledger.data ?? [];
  const masuk = rows.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0);
  const keluar = rows.filter((r) => r.amount < 0).reduce((a, r) => a - r.amount, 0);
  const shown = rows.filter((r) => tab === "semua" || (tab === "masuk" ? r.amount > 0 : r.amount < 0));

  const pay = async () => {
    if (!uid) return;
    const err = creditTopupError(n);
    if (err) { toast.error(err); return; }
    if (!method) { toast.error("Metode pembayaran belum tersedia"); return; }
    if (!file) { toast.error("Upload bukti transfer dulu"); return; }
    setBusy(true);
    try {
      const path = await uploadPaymentImage(uid, file);
      const { error } = await supabase.rpc("create_credit_topup", { p_amount: n, p_proof: path, p_method: method.id });
      if (error) throw error;
      toast.success("Top up dikirim. Credits masuk setelah admin mengecek bukti transfer.");
      setAmt(""); setFile(null); setOpen(false);
      qc.invalidateQueries({ queryKey: ["seller_credit_topups"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Gagal mengirim top up");
    } finally { setBusy(false); }
  };
  const copy = (v: string) => { void navigator.clipboard.writeText(v.replace(/\s/g, "")); toast.success("Nomor disalin"); };

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold">Credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">Saldo untuk potongan komisi dan markup transaksi PG pribadi</p>
      </div>

      <SellerCard data-tour="c-hero" className="overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
          <Coins aria-hidden className="pointer-events-none absolute -right-6 -top-4 h-48 w-48 opacity-15" />
          <p className="relative flex items-center gap-2.5 text-sm font-medium"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground/15"><Coins className="h-4 w-4" strokeWidth={1.75} /></span> Saldo credits</p>
          <p className="relative mt-3 text-2xl font-semibold">{rpSeller(balance.data ?? 0)}</p>
          <button data-tour="c-topup" onClick={() => setOpen(true)} className="relative mt-3 flex items-center gap-2 rounded-xl bg-background px-3.5 py-2 text-sm font-medium text-primary shadow-lg transition active:scale-95">
            <QrCode className="h-4 w-4" /> Top Up Credits
          </button>
        </div>
        <div className="grid grid-cols-3 divide-x bg-accent/60">
          <Mini icon={ArrowDownLeft} label="Masuk" value={rpSeller(masuk)} sub="90 hari terakhir" />
          <Mini icon={ArrowUpRight} label="Terpakai" value={rpSeller(keluar)} sub="90 hari terakhir" />
          <Mini icon={CreditCard} label="PG KlikQRIS pribadi" value="Tidak aktif" sub="Memakai QRIS Marketku" />
        </div>
      </SellerCard>

      {(topups.data ?? []).length > 0 && (
        <SellerCard>
          <div className="flex items-start gap-3 p-4 pb-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Clock className="h-4 w-4" strokeWidth={1.75} /></span>
            <div>
              <h3 className="text-base font-semibold">Top up diproses</h3>
              <p className="text-sm text-muted-foreground">Menunggu dicek admin atau ditolak.</p>
            </div>
          </div>
          <ul className="divide-y border-t">
            {topups.data!.map((d) => { const s = depositStatus(d.status); return (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{rpSeller(d.amount)} <span className="text-xs font-normal text-muted-foreground">• {d.method_label ?? "QRIS"}</span></p>
                  <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}{d.admin_note ? ` • ${d.admin_note}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
              </li>
            ); })}
          </ul>
        </SellerCard>
      )}

      <SellerCard>
        <div className="flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Coins className="h-4 w-4" strokeWidth={1.75} /></span>
          <div>
            <h3 className="text-base font-semibold">Riwayat credits</h3>
            <p className="text-sm text-muted-foreground">Top up dan potongan biaya 90 hari terakhir.</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="inline-flex rounded-xl border bg-background/60 p-1">
            {(["semua", "masuk", "keluar"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition ${tab === k ? "bg-primary text-primary-foreground" : "text-foreground/80"}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="border-t">
          {shown.length === 0 ? (
            <SellerEmpty icon={Coins} title="Belum ada mutasi" desc="Top up dan potongan credits akan tercatat di sini." />
          ) : (
            <ul className="divide-y">
              {shown.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${r.amount > 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/15 text-destructive"}`}>
                    {r.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.note ?? (r.amount > 0 ? "Top up credits" : "Potongan biaya")}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-semibold ${r.amount > 0 ? "text-emerald-500" : "text-destructive"}`}>{r.amount > 0 ? "+" : "−"}{rpSeller(Math.abs(r.amount))}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">{shown.length} mutasi</p>
      </SellerCard>

      <SellerCard data-tour="c-why" className="flex gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><ShieldCheck className="h-4 w-4" strokeWidth={1.75} /></span>
        <div className="space-y-2 text-sm text-muted-foreground">
          <h3 className="text-sm font-semibold text-foreground">Kapan credits dipakai?</h3>
          <p>Saat pembeli membayar lewat PG pribadi, uang langsung masuk ke merchant kamu. Komisi platform dan markup lalu dipotong dari credits.</p>
          <p>Jika credits tidak cukup menutup potongan sebuah transaksi, checkout otomatis memakai QRIS Marketku dan dana masuk lewat escrow seperti biasa.</p>
        </div>
      </SellerCard>
      <SellerSheet open={open} onOpenChange={setOpen} title={<span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-primary"><Coins className="h-4 w-4" /></span>Top Up Credits</span>}
        footer={<button disabled={busy} onClick={pay} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} {busy ? "Mengirim..." : method ? `Kirim Top Up via ${method.provider}` : "Bayar via QRIS"}</button>}>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((v) => (
            <button key={v} onClick={() => setAmt(String(v))} className={`rounded-xl border py-3 text-sm transition active:scale-95 ${n === v ? "border-primary bg-accent font-semibold text-primary" : "bg-background/40"}`}>{rpSeller(v)}</button>
          ))}
        </div>
        <p className="mb-2 mt-4 text-sm">Nominal top up</p>
        <SellerInput inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Contoh: 50000" />
        <p className="mt-2 text-xs text-muted-foreground">Min {rpSeller(CREDIT_TOPUP_MIN)} · Maks {rpSeller(CREDIT_TOPUP_MAX)}.</p>

        <p className="mb-2 mt-4 text-sm">Metode pembayaran</p>
        {methods.isPending ? <p className="text-xs text-muted-foreground">Memuat metode...</p> : active.length === 0 ? (
          <p className="rounded-xl border bg-background/40 p-3 text-center text-xs text-muted-foreground">Metode pembayaran belum tersedia. Hubungi admin.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {active.map((m) => (
              <button key={m.id} onClick={() => setMethodId(m.id)} className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition active:scale-95 ${methodId === m.id ? "border-primary bg-accent text-primary" : "bg-background/40"}`}>
                <span className="grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black text-white" style={{ background: providerColor(m.provider) }}>{m.provider.slice(0, 3)}</span>
                {m.provider}
                {methodId === m.id && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        )}
        {method && (
          <div key={method.id} className="mk-fade-in mt-3 rounded-xl border bg-background/40 p-3">
            {qr && (
              <div className="flex flex-col items-center">
                <img src={qr} alt={`QR ${method.provider}`} className="w-full max-w-[220px] rounded-xl border bg-white p-2" />
                <a href={qr} download className="mt-2 text-xs font-semibold text-primary">Simpan gambar QR</a>
              </div>
            )}
            {method.account_number && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{method.kind === "bank" ? `Rekening ${method.provider}` : `Nomor ${method.provider}`}</p>
                  <p className="truncate text-sm font-semibold">{method.account_number}</p>
                </div>
                <button onClick={() => copy(method.account_number!)} className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium"><Copy className="h-3.5 w-3.5" /> Salin</button>
              </div>
            )}
            {method.account_name && <p className="mt-2 text-center text-xs">a.n. <b>{method.account_name}</b></p>}
          </div>
        )}

        <p className="mb-2 mt-4 text-sm">Bukti transfer</p>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-accent/30 py-5 text-xs text-muted-foreground">
          <ImagePlus className="h-5 w-5 text-primary" />
          {file ? <span className="font-semibold text-foreground">{file.name}</span> : "Pilih foto bukti (JPG/PNG/WebP, maks 5 MB)"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">Credits masuk setelah admin mengecek bukti transfer.</p>
      </SellerSheet>
      <PageTour id="seller-saldo" steps={tour} panel />
    </>
  );
}

function Mini({ icon: I, label, value, sub }: { icon: typeof Coins; label: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1.5 py-3.5 text-center">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary/50 bg-background/60 text-primary"><I className="h-3.5 w-3.5" strokeWidth={1.75} /></span>
      <p className="mt-2 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{sub}</p>
    </div>
  );
}
