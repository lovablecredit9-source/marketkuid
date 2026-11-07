import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Zap, Info, QrCode, KeyRound, Eye, EyeOff, Save, SlidersHorizontal } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { SellerCard, SellerInput, SellerPageTitle, SellerSheet } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/pembayaran")({
  staticData: { sitemap: false },
  head: () => pageMeta("Kontrol Pembayaran — Seller Center Marketku", "Hubungkan payment gateway KlikQRIS pribadi untuk tokomu."),
  component: Pembayaran,
});

const tour = [
  { title: "Tambah gateway", desc: "Tambah provider seperti KlikQRIS untuk pembayaran QRIS pribadi.", target: "pg-add" },
  { title: "Payment gateway", desc: "Atur gateway pembayaran tokomu di halaman ini.", target: "pg-title" },
  { title: "Selesai", desc: "Gateway aktif membuat pembayaran QRIS terdeteksi otomatis." },
];

function Pembayaran() {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ apiKey: "", merchant: "" });
  const submit = () => {
    if (f.apiKey.trim().length < 10) { toast.error("API Key KlikQRIS tidak valid"); return; }
    toast("Pengajuan PG pribadi segera hadir. Kredensial belum disimpan.");
    setOpen(false);
  };
  return (
    <>
      <div data-tour="pg-title"><SellerPageTitle icon={CreditCard} title="Payment Gateway" desc="Hubungkan PG KlikQRIS pribadi toko Anda" /></div>
      <button data-tour="pg-add" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-95"><Zap className="h-4 w-4" /> Tambah Gateway</button>
      <SellerCard className="flex gap-3 p-4 text-sm text-foreground/85">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>PG KlikQRIS pribadi wajib disetujui admin sebelum dipakai untuk pembayaran. Selama menunggu, transaksi toko tetap memakai gateway platform. Mengubah API Key atau Merchant ID akan mengirim ulang permintaan persetujuan.</p>
      </SellerCard>
      <SellerCard className="flex flex-col items-center border-dashed px-6 py-12 text-center">
        <QrCode className="h-9 w-9" />
        <p className="mt-4 font-bold">Belum ada PG KlikQRIS</p>
        <p className="mt-1 text-sm text-muted-foreground">Masukkan API Key KlikQRIS Anda lalu ajukan persetujuan admin</p>
      </SellerCard>
      <SellerSheet open={open} onOpenChange={setOpen} title={<span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /> Tambah Gateway</span>}>
        <p className="-mt-2 mb-4 text-xs text-muted-foreground">Isi kredensial KlikQRIS lalu ajukan persetujuan</p>
        <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-accent/50 p-4">
          <QrCode className="h-5 w-5 text-primary" />
          <div><p className="font-semibold text-primary">KlikQRIS</p><p className="text-xs text-muted-foreground">Disetujui admin sebelum dipakai checkout</p></div>
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold tracking-widest text-muted-foreground">KREDENSIAL</p>
        <div className="space-y-2 rounded-xl border p-3">
          <div className="relative">
            <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <SellerInput type={show ? "text" : "password"} value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} placeholder="API Key *" className="pl-10 pr-10" autoComplete="off" />
            <button aria-label="Tampilkan API Key" onClick={() => setShow(!show)} className="absolute right-3 top-3.5 text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="relative">
            <CreditCard className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <SellerInput value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} placeholder="Merchant ID" className="pl-10" autoComplete="off" />
          </div>
        </div>
        <button onClick={submit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-95"><Save className="h-4 w-4" /> Simpan</button>
        <button onClick={() => setOpen(false)} className="mt-2 w-full rounded-xl border bg-background/60 py-3 font-semibold">Batal</button>
      </SellerSheet>
      <PageTour id="seller-pembayaran" steps={tour} panel />
    </>
  );
}
