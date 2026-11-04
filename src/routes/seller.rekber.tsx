import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Plus, ShieldCheck, Wallet, Inbox, Loader2 } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Chips, SellerCard, SellerInput, SellerSheet, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { RekberCard, RekberDetail } from "@/components/marketku/rekber-detail";
import { REKBER_MAX, REKBER_MIN, errText, rekberFees, rekberLink, rekberStats, rekberView, useMyRekber, type FeeBearer, type RekberDeal } from "@/lib/rekber";

export const Route = createFileRoute("/seller/rekber")({
  head: () => pageMeta("Rekber Marketku — Seller Center", "Titipkan dana ke Marketku sampai kedua pihak selesai bertransaksi."),
  component: Rekber,
});

const tour = [
  { title: "Buat rekber", desc: "Buat rekening bersama untuk transaksi di luar katalog.", target: "rk-create" },
  { title: "Ringkasan dana", desc: "Pantau dana ditahan, saldo rekber, dan yang perlu tindakan.", target: "rk-stats" },
  { title: "Selesai", desc: "Pencairan saldo rekber selalu diperiksa admin." },
];

type Tab = "semua" | "deposit" | "ditahan" | "sengketa" | "selesai";

function Rekber() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id;
  const list = useMyRekber(uid);
  const rows = list.data ?? [];
  const stats = useMemo(() => rekberStats(rows, uid), [rows, uid]);
  const [tab, setTab] = useState<Tab>("semua");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", detail: "", amount: "", payer: "pembeli" as FeeBearer });
  const amount = Number(f.amount || "0");
  const fees = rekberFees(amount, f.payer);
  const shown = rows.filter((d) => tab === "semua" || rekberView(d) === tab);
  const current = rows.find((d) => d.id === detail) ?? null;

  const submit = async () => {
    if (f.title.trim().length < 3) { toast.error("Judul kesepakatan minimal 3 karakter"); return; }
    if (amount < REKBER_MIN || amount > REKBER_MAX) { toast.error(`Nominal ${rpSeller(REKBER_MIN)} – ${rpSeller(REKBER_MAX)}`); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_rekber", { p_title: f.title, p_details: f.detail, p_amount: amount, p_fee_bearer: f.payer });
    setBusy(false);
    if (error) { toast.error(errText(error)); return; }
    const d = data as unknown as RekberDeal;
    void navigator.clipboard?.writeText(rekberLink(d.share_token)).catch(() => {});
    toast.success(`Rekber ${d.code} dibuat. Link untuk pembeli sudah disalin.`);
    setF({ title: "", detail: "", amount: "", payer: "pembeli" });
    setOpen(false);
    await qc.invalidateQueries({ queryKey: ["rekber"] });
    setDetail(d.id);
  };

  return (
    <>
      <div><h2 className="text-2xl font-bold">Rekber Marketku</h2><p className="mt-1 text-sm text-muted-foreground">Titipkan dana ke Marketku sampai kedua pihak selesai. Pencairan saldo rekber selalu diperiksa admin.</p></div>
      <div className="flex gap-2">
        <button onClick={() => { void list.refetch(); toast("Dimuat ulang"); }} className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} /> Muat ulang</button>
        <button data-tour="rk-create" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-95"><Plus className="h-4 w-4" /> Buat rekber</button>
      </div>
      <div data-tour="rk-stats" className="space-y-3">
        <Stat icon={ShieldCheck} t="Dana ditahan" v={rpSeller(stats.held)} d="Total nilai rekber yang sedang dititipkan" />
        <Stat icon={Wallet} t="Saldo rekber" v={rpSeller(stats.saldo)} d="Pencairan diperiksa admin" />
        <Stat icon={Inbox} t="Perlu tindakan" v={String(stats.action)} d="Rekber yang menunggu langkah Anda" />
      </div>
      <SellerCard className="p-3">
        <Chips value={tab} onChange={setTab} items={[{ value: "semua", label: "Semua" }, { value: "deposit", label: "Perlu deposit" }, { value: "ditahan", label: "Ditahan" }, { value: "sengketa", label: "Sengketa" }, { value: "selesai", label: "Selesai" }]} />
      </SellerCard>
      {list.isPending ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <SellerCard className="px-6 py-10 text-center">
          <p className="font-bold">Belum ada rekber</p>
          <p className="mt-1 text-sm text-muted-foreground">Buat rekber untuk transaksi di luar katalog, lalu bagikan link ke pihak lain.</p>
        </SellerCard>
      ) : (
        <div className="space-y-3">{shown.map((d) => <RekberCard key={d.id} d={d} uid={uid} onOpen={() => setDetail(d.id)} />)}</div>
      )}

      <SellerSheet open={open} onOpenChange={setOpen} title={<span>Buat rekber<span className="block text-xs font-normal text-muted-foreground">Dana baru ditahan setelah deposit dibayar.</span></span>}>
        <div className="space-y-3">
          <SellerInput value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Judul kesepakatan" />
          <textarea value={f.detail} maxLength={500} onChange={(e) => setF({ ...f, detail: e.target.value })} rows={3} placeholder="Rincian (opsional)" className="w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary" />
          <SellerInput inputMode="numeric" value={f.amount ? amount.toLocaleString("id-ID") : ""} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="Nominal" />
          <p className="text-xs text-muted-foreground">Minimal {rpSeller(REKBER_MIN)} · maksimal {rpSeller(REKBER_MAX)}</p>
          <p className="pt-1 text-sm font-semibold">Penanggung biaya</p>
          {([["pembeli", "Pembeli", "Biaya ditambahkan ke nominal yang Anda bayar"], ["penjual", "Penjual", "Biaya dipotong dari dana yang diterima penjual"], ["dibagi", "Dibagi dua", "Biaya dibagi rata antara pembeli dan penjual"]] as const).map(([k, l, d]) => (
            <button key={k} onClick={() => setF({ ...f, payer: k })} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${f.payer === k ? "border-primary bg-accent/50" : ""}`}>
              <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${f.payer === k ? "border-primary bg-primary ring-2 ring-inset ring-card" : "border-muted-foreground"}`} />
              <span><span className="block text-sm font-semibold">{l}</span><span className="text-xs text-muted-foreground">{d}</span></span>
            </button>
          ))}
          {amount >= REKBER_MIN && (
            <div className="rounded-xl bg-muted/40 p-3 text-xs">
              <p className="flex justify-between"><span className="text-muted-foreground">Biaya layanan (1%)</span><b>{rpSeller(fees.fee)}</b></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Dibayar pembeli</span><b>{rpSeller(fees.buyerPays)}</b></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Diterima penjual</span><b>{rpSeller(fees.sellerReceives)}</b></p>
            </div>
          )}
          <button disabled={busy} onClick={() => void submit()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Buat rekber</button>
        </div>
      </SellerSheet>

      <SellerSheet open={!!current} onOpenChange={(v) => !v && setDetail(null)} title="Detail rekber">
        {current && <RekberDetail d={current} uid={uid} />}
      </SellerSheet>
      <PageTour id="seller-rekber" steps={tour} panel />
    </>
  );
}

function Stat({ icon: I, t, v, d }: { icon: typeof Wallet; t: string; v: string; d: string }) {
  return (
    <SellerCard className="p-4">
      <p className="flex items-center gap-2 text-sm"><I className="h-4 w-4" /> {t}</p>
      <p className="mt-1 text-lg font-bold">{v}</p>
      <p className="mt-1 text-xs text-muted-foreground">{d}</p>
    </SellerCard>
  );
}
