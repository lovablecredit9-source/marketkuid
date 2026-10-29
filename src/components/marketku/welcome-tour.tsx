import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, CircleCheck, X, Gauge, Package, ShoppingBag, Wallet, Sparkles, Heart, MessageCircle, User } from "lucide-react";

export type WelcomeStep = { icon: typeof Gauge; title: string; desc: string };

export const SELLER_WELCOME: WelcomeStep[] = [
  { icon: Gauge, title: "Kenali ringkasan toko", desc: "Di halaman utama seller, kamu bisa melihat profil toko, saldo, dan statistik cepat untuk membaca kondisi toko dalam beberapa detik." },
  { icon: Package, title: "Kelola produk & stok", desc: "Masuk ke Produk & Stok untuk menambah produk, upload stok digital, dan memastikan produk aktif selalu tersedia untuk pembeli." },
  { icon: ShoppingBag, title: "Pantau pesanan masuk", desc: "Menu Pesanan membantu kamu memantau order pending, pesanan selesai, dan follow-up jika pembeli membutuhkan bantuan." },
  { icon: Wallet, title: "Cairkan saldo & top up credit", desc: "Gunakan kartu pendapatan untuk tarik dana ke rekening dan isi credit seller saat ingin mengaktifkan fitur operasional tambahan." },
  { icon: Sparkles, title: "Kembangkan toko", desc: "Kelola akun, tema, dan bantuan dari panel sebelah kanan. Tour ini bisa dibuka ulang kapan saja dari bagian Bantuan." },
];

export const BUYER_WELCOME: WelcomeStep[] = [
  { icon: User, title: "Kenali akunmu", desc: "Halaman Akun menampilkan profil, saldo Marketku, dan ringkasan aktivitas belanjamu." },
  { icon: ShoppingBag, title: "Pantau pesanan", desc: "Buka Pesanan untuk melihat status order, klaim garansi, atau ajukan dispute bila ada masalah." },
  { icon: Heart, title: "Simpan favorit", desc: "Tandai produk dengan ikon hati supaya mudah ditemukan lagi di Wishlist." },
  { icon: MessageCircle, title: "Chat dengan seller", desc: "Tanya seller langsung dari halaman produk. Semua percakapan tersimpan di menu Pesan." },
  { icon: Sparkles, title: "Mulai jualan", desc: "Siap jualan? Buka toko dari halaman Akun. Tour ini bisa dibuka ulang dari bagian Bantuan." },
];

export function WelcomeTour({ id, steps, open, onOpenChange }: { id: string; steps: WelcomeStep[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [i, setI] = useState(0);
  const key = `marketku-welcome:${id}`;
  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => {
    if (!window.localStorage.getItem(key)) { const t = setTimeout(() => onOpenChange(true), 800); return () => clearTimeout(t); }
    return undefined;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || typeof document === "undefined") return null;
  const step = steps[i];
  if (!step) return null;
  const last = i === steps.length - 1;
  const close = () => { window.localStorage.setItem(key, "1"); onOpenChange(false); };
  const I = step.icon;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/50 px-3 pb-28 animate-in fade-in-0">
      <div role="dialog" aria-label={step.title} className="relative w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl animate-in slide-in-from-bottom-4">
        <button aria-label="Tutup tour" onClick={close} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border text-muted-foreground transition active:scale-90"><X className="h-4 w-4" /></button>
        <div className="flex items-center gap-3 pr-10">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><I className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-bold tracking-widest text-primary">LANGKAH {i + 1}/{steps.length}</p>
            <h3 className="text-xl font-bold leading-tight">{step.title}</h3>
          </div>
        </div>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{step.desc}</p>
        <div className="mt-4 flex gap-1.5">{steps.map((_, n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= i ? "bg-primary" : "bg-muted"}`} />)}</div>
        <button onClick={close} className="mt-4 w-full rounded-xl border py-3 font-semibold transition active:scale-[0.98]">Lewati</button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button disabled={i === 0} onClick={() => setI(i - 1)} className="flex items-center justify-center gap-2 rounded-xl border py-3 font-semibold transition active:scale-[0.98] disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Sebelumnya</button>
          <button onClick={() => (last ? close() : setI(i + 1))} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[0.98]">
            {last ? <><CircleCheck className="h-4 w-4" /> Selesai</> : <>Lanjut <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
