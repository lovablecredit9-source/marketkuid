import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet, Lock, Repeat, Landmark, History, Clock, CircleCheck, Coins, ListChecks, ChevronRight, CalendarClock, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSellerStore } from "@/lib/seller";
import { pageMeta } from "@/lib/meta";
import { Chips, SellerCard, SellerEmpty, SellerSheet, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { useSellerBalance, useSellerHolds } from "@/components/marketku/seller-holds";

export const Route = createFileRoute("/seller/withdraw")({
  head: () => pageMeta("Withdraw — Seller Center Marketku", "Kelola dan pantau penarikan saldo penjualan toko."),
  component: Withdraw,
});

export const MIN_WITHDRAW = 50000;

const tour = [
  { title: "Saldo tersedia", desc: "Saldo hasil penjualan yang bisa kamu tarik ke rekening.", target: "w-hero" },
  { title: "Riwayat penarikan", desc: "Semua permintaan tarik dana tercatat di sini.", target: "w-history" },
  { title: "Status saldo", desc: "Lihat komposisi saldo tersedia, ditahan, sengketa, dan freeze.", target: "w-status" },
];

function Withdraw() {
  const { user } = useAuth();
  const store = useSellerStore(user?.id).data;
  const [tab, setTab] = useState<"semua" | "diproses" | "selesai" | "ditolak">("semua");
  const [saldoTab, setSaldoTab] = useState<"semua" | "tersedia" | "ditahan" | "sengketa" | "freeze">("semua");
  const [detail, setDetail] = useState<string | null>(null);
  const balance = useSellerBalance(user?.id).data ?? 0;
  const holdsList = useSellerHolds(user?.id).data ?? [];
  const held = holdsList.reduce((a, h) => a + Number(h.amount ?? 0), 0);
  const amounts: Record<"tersedia" | "ditahan" | "sengketa" | "freeze", number> = { tersedia: balance, ditahan: held, sengketa: 0, freeze: 0 };
  const bank = store?.bank_number ? `${store.bank_provider} • ${store.bank_number.slice(-4).padStart(store.bank_number.length, "•")}` : "Belum terdaftar";

  const tarik = () => {
    if (!store?.bank_number) { toast.error("Daftarkan rekening dulu di Pengaturan → Keuangan"); return; }
    if (balance < MIN_WITHDRAW) { toast.error(`Saldo minimal ${rpSeller(MIN_WITHDRAW)} untuk tarik dana`); return; }
  };

  return (
    <>
      <div><h2 className="text-2xl font-bold">Withdraw</h2><p className="text-sm text-muted-foreground">Kelola dan pantau saldo penjualan toko Anda</p></div>
      <SellerCard className="overflow-hidden" >
        <div data-tour="w-hero" className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
          <Wallet aria-hidden className="pointer-events-none absolute -right-6 -top-4 h-40 w-40 opacity-15" />
          <p className="relative flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4" /> Saldo tersedia</p>
          <p className="relative mt-2 text-3xl font-bold">{rpSeller(balance)}</p>
          <button onClick={tarik} className="relative mt-3 rounded-lg bg-background px-4 py-2 text-sm font-semibold text-primary shadow transition active:scale-95">Tarik Dana</button>
        </div>
        <div className="grid grid-cols-3 divide-x bg-accent/60 text-center">
          <Mini icon={Lock} label="Saldo ditahan" value={rpSeller(held)} sub="Menunggu penyelesaian" />
          <Mini icon={Repeat} label="Kuota reguler" value="1x" sub="Bebas biaya hari ini" />
          <Mini icon={Landmark} label="Rekening tujuan" value={store?.bank_number ? store.bank_provider ?? "" : "Belum diisi"} sub={bank} />
        </div>
      </SellerCard>
      {!store?.bank_number && (
        <Link to="/seller/pengaturan" search={{ tab: "keuangan" }} className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <Landmark className="h-4 w-4" /> <span className="flex-1">Daftarkan rekening pencairan dulu</span> <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      <SellerCard data-tour="w-history">
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><History className="h-5 w-5" /></span>
          <div><h3 className="font-bold">Riwayat penarikan</h3><p className="text-sm text-muted-foreground">Permintaan pencairan dana toko.</p></div>
        </div>
        <div className="px-4 pb-3">
          <Chips value={tab} onChange={setTab} items={[{ value: "semua", label: "Semua" }, { value: "diproses", label: "Diproses" }, { value: "selesai", label: "Selesai" }, { value: "ditolak", label: "Ditolak" }]} />
        </div>
        <div className="border-t"><SellerEmpty icon={Inbox} title="Belum ada penarikan" desc="Permintaan dengan status ini akan muncul di sini." /></div>
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">0 penarikan</p>
      </SellerCard>

      <SellerCard className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><CalendarClock className="h-5 w-5" /></span>
          <div className="flex-1"><h3 className="font-bold">Auto Withdraw <span className="ml-1 text-xs font-normal text-muted-foreground">Nonaktif</span></h3><p className="text-sm text-muted-foreground">Tarik saldo otomatis ke rekening toko.</p></div>
        </div>
        <div className="mt-3 divide-y rounded-xl border bg-background/40 text-sm">
          <Info icon={Clock} k="Jadwal" v="08:00 WIB · setiap hari" />
          <Info icon={Wallet} k="Minimum saldo" v={`Rp${MIN_WITHDRAW.toLocaleString("id-ID")}`} />
          <Info icon={Landmark} k="Rekening penerima" v={bank} />
        </div>
        <ul className="mt-3 space-y-2 rounded-xl bg-success/10 p-3 text-xs text-success">
          {["Saldo di bawah Rp50.000 tidak diproses.", "Request pending menunggu persetujuan admin.", "Pengaturan dapat dinonaktifkan kapan saja."].map((t) => <li key={t} className="flex gap-2"><CircleCheck className="h-3.5 w-3.5 shrink-0" />{t}</li>)}
        </ul>
      </SellerCard>

      <SellerCard data-tour="w-status" className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><Coins className="h-5 w-5" /></span>
          <div><h3 className="font-bold">Status saldo</h3><p className="text-sm text-muted-foreground">Komposisi saldo toko.</p></div>
        </div>
        <div className="mt-4 flex items-center gap-5">
          <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-[6px] border-success text-center">
            <div><p className="text-[11px] text-muted-foreground">Total saldo</p><p className="text-sm font-bold">{rpSeller(balance + held)}</p></div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Tersedia <b className="ml-2">{rpSeller(balance)}</b></p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Ditahan <b className="ml-2">{rpSeller(held)}</b></p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([["Saldo tersedia", "tersedia"], ["Saldo ditahan", "ditahan"], ["Saldo sengketa", "sengketa"], ["Saldo freeze", "freeze"]] as const).map(([l, k]) => (
            <button key={k} onClick={() => setDetail(l)} className="rounded-xl border bg-background/40 p-3 text-left transition active:scale-95">
              <p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-bold">{rpSeller(amounts[k])}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Saldo dompet adalah nilai otoritatif. Alokasi transaksi dapat tidak sama dengan saldo bila ada penyesuaian oleh admin.</p>
        <div className="mt-3"><Chips value={saldoTab} onChange={setSaldoTab} items={[{ value: "semua", label: "Semua" }, { value: "tersedia", label: "Tersedia" }, { value: "ditahan", label: "Ditahan" }, { value: "sengketa", label: "Sengketa" }, { value: "freeze", label: "Freeze" }]} /></div>
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
      </SellerCard>

      <SellerCard className="p-4">
        <h3 className="flex items-center gap-2 font-bold"><ListChecks className="h-5 w-5 text-primary" /> Cara kerja Auto Withdraw</h3>
        <ol className="mt-3 space-y-3 text-sm">
          {["Aktifkan Auto Withdraw.", "Saldo mencapai minimum.", "Sistem memproses jadwal harian.", "Dana dikirim ke rekening terdaftar."].map((t, i) => (
            <li key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>{t}</li>
          ))}
        </ol>
      </SellerCard>

      <SellerSheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)} title={detail ?? ""}>
        <p className="text-sm text-muted-foreground">Perkiraan waktu dapat berubah jika ada sengketa.</p>
        <p className="mt-4 text-sm">Tidak ada transaksi pada kategori ini.</p>
      </SellerSheet>
      <PageTour id="seller-withdraw" steps={tour} panel />
    </>
  );
}

function Mini({ icon: I, label, value, sub }: { icon: typeof Wallet; label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/50 text-primary"><I className="h-4 w-4" /></span>
      <p className="mt-2 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
      <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
function Info({ icon: I, k, v }: { icon: typeof Wallet; k: string; v: string }) {
  return <div className="flex items-center gap-3 px-3 py-3"><I className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">{k}</p><p className="font-semibold">{v}</p></div></div>;
}
