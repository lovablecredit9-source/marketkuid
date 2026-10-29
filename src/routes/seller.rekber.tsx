import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Plus, ShieldCheck, Wallet, Inbox } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { Chips, SellerCard, SellerInput, SellerSheet, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/rekber")({
  head: () => pageMeta("Rekber Marketku — Seller Center", "Titipkan dana ke Marketku sampai kedua pihak selesai bertransaksi."),
  component: Rekber,
});

export const REKBER_MIN = 10000;
export const REKBER_MAX = 50000000;

const tour = [
  { title: "Buat rekber", desc: "Buat rekening bersama untuk transaksi di luar katalog.", target: "rk-create" },
  { title: "Ringkasan dana", desc: "Pantau dana ditahan, saldo rekber, dan yang perlu tindakan.", target: "rk-stats" },
  { title: "Selesai", desc: "Pencairan saldo rekber selalu diperiksa admin." },
];

function Rekber() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"semua" | "deposit" | "ditahan" | "sengketa" | "selesai">("semua");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", detail: "", amount: "", payer: "pembeli" as "pembeli" | "penjual" | "dibagi" });
  const amount = Number(f.amount || "0");

  const submit = () => {
    if (f.title.trim().length < 3) { toast.error("Judul kesepakatan minimal 3 karakter"); return; }
    if (amount < REKBER_MIN || amount > REKBER_MAX) { toast.error(`Nominal ${rpSeller(REKBER_MIN)} – ${rpSeller(REKBER_MAX)}`); return; }
    toast("Rekber segera hadir. Kesepakatan belum disimpan.");
    setOpen(false);
  };

  return (
    <>
      <div><h2 className="text-2xl font-bold">Rekber Marketku</h2><p className="mt-1 text-sm text-muted-foreground">Titipkan dana ke Marketku sampai kedua pihak selesai. Pencairan saldo rekber selalu diperiksa admin.</p></div>
      <div className="flex gap-2">
        <button onClick={() => { void qc.invalidateQueries(); toast("Dimuat ulang"); }} className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Muat ulang</button>
        <button data-tour="rk-create" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-95"><Plus className="h-4 w-4" /> Buat rekber</button>
      </div>
      <div data-tour="rk-stats" className="space-y-3">
        <Stat icon={ShieldCheck} t="Dana ditahan" v={rpSeller(0)} d="Total nilai rekber yang sedang dititipkan" />
        <Stat icon={Wallet} t="Saldo rekber" v={rpSeller(0)} d="Pencairan diperiksa admin" />
        <Stat icon={Inbox} t="Perlu tindakan" v="0" d="Rekber yang menunggu langkah Anda" />
      </div>
      <SellerCard className="p-3">
        <Chips value={tab} onChange={setTab} items={[{ value: "semua", label: "Semua" }, { value: "deposit", label: "Perlu deposit" }, { value: "ditahan", label: "Ditahan" }, { value: "sengketa", label: "Sengketa" }, { value: "selesai", label: "Selesai" }]} />
      </SellerCard>
      <SellerCard className="px-6 py-10 text-center">
        <p className="font-bold">Belum ada rekber</p>
        <p className="mt-1 text-sm text-muted-foreground">Buat rekber untuk transaksi di luar katalog, lalu bagikan link ke pihak lain.</p>
      </SellerCard>

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
          <button onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-95"><Plus className="h-4 w-4" /> Buat rekber</button>
        </div>
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
