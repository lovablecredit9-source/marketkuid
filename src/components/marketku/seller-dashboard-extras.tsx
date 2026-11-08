import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ExternalLink, FileText, ImageOff, PackageX, Pencil, Plus, Share2, Target, X } from "lucide-react";
import { toast } from "sonner";
import { rpSeller, SellerCard } from "@/components/marketku/seller-ui";
import { greeting, monthRevenue, parseRupiah, productAlerts, targetProgress, todayVsYesterday, type ProductAlertKind } from "@/lib/seller-insights";
import { dailyRevenue } from "@/lib/seller-orders";

type O = Parameters<typeof todayVsYesterday>[0][number] & Parameters<typeof dailyRevenue>[0][number];

export function SellerHero({ store, orders }: { store: { store_name: string; is_open: boolean; slug: string | null; owner_id: string }; orders: O[] }) {
  const navigate = useNavigate();
  const [hello, setHello] = useState("Halo");
  useEffect(() => setHello(greeting()), []);
  const t = todayVsYesterday(orders);
  const week = dailyRevenue(orders, 7);
  const max = Math.max(1, ...week.map((d) => d.value));
  const up = (t.change ?? 0) >= 0;
  const share = async () => {
    const url = `${window.location.origin}/toko/${store.slug ?? store.owner_id}`;
    try {
      if (navigator.share) await navigator.share({ title: store.store_name, text: `Cek toko ${store.store_name} di Marketku`, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link toko disalin"); }
    } catch { /* dibatalkan */ }
  };
  return (
    <section className="seller-hero relative overflow-hidden rounded-2xl border p-4">
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{hello} 👋</p>
            <h2 className="mt-0.5 truncate text-lg font-bold">{store.store_name}</h2>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${store.is_open ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${store.is_open ? "seller-live bg-success" : "bg-destructive"}`} />
            {store.is_open ? "Toko buka" : "Toko tutup"}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pendapatan hari ini</p>
            <p className="mt-0.5 truncate text-2xl font-bold tabular-nums">{rpSeller(t.today)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              {t.change !== null && (
                <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-success" : "text-destructive"}`}>
                  {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(t.change)}%
                </span>
              )}
              <span>{t.change !== null ? "dibanding kemarin" : `Kemarin ${rpSeller(t.yesterday)}`}</span>
              <span>· {t.ordersToday} pesanan masuk</span>
            </p>
          </div>
          <div className="flex h-12 shrink-0 items-end gap-1" aria-label="Pendapatan 7 hari terakhir">
            {week.map((d, i) => (
              <span key={d.label} title={`${d.label}: ${rpSeller(d.value)}`}
                className={`w-2 rounded-full ${i === week.length - 1 ? "bg-primary" : "bg-primary/35"}`}
                style={{ height: `${Math.max(8, Math.round((d.value / max) * 100))}%` }} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => navigate({ to: "/seller/produk/baru" })} className="seller-tap flex items-center justify-center gap-1.5 rounded-xl bg-primary px-2 py-2.5 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Produk</button>
          <a href={`/toko/${store.slug ?? store.owner_id}`} target="_blank" rel="noreferrer" className="seller-tap flex items-center justify-center gap-1.5 rounded-xl border bg-background/50 px-2 py-2.5 text-xs font-semibold"><ExternalLink className="h-3.5 w-3.5" /> Lihat toko</a>
          <button type="button" onClick={() => void share()} className="seller-tap flex items-center justify-center gap-1.5 rounded-xl border bg-background/50 px-2 py-2.5 text-xs font-semibold"><Share2 className="h-3.5 w-3.5" /> Bagikan</button>
        </div>
      </div>
    </section>
  );
}

const targetKey = (uid: string) => `mk_seller_target_${uid}`;

export function MonthlyTarget({ uid, orders }: { uid: string; orders: O[] }) {
  const [target, setTarget] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    setTarget(Number(window.localStorage.getItem(targetKey(uid)) ?? 0) || 0);
  }, [uid]);
  if (!now) return null;
  const revenue = monthRevenue(orders, now);
  const p = targetProgress(revenue, target, now);
  const month = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const save = () => {
    const v = parseRupiah(draft);
    if (v > 0) window.localStorage.setItem(targetKey(uid), String(v)); else window.localStorage.removeItem(targetKey(uid));
    setTarget(v); setEditing(false);
    toast.success(v > 0 ? "Target bulan ini disimpan" : "Target dihapus");
  };
  return (
    <SellerCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" /> Target {month}</h3>
        {!editing && (
          <button type="button" onClick={() => { setDraft(target ? target.toLocaleString("id-ID") : ""); setEditing(true); }} className="flex items-center gap-1 text-xs font-medium text-primary">
            <Pencil className="h-3 w-3" /> {target ? "Ubah" : "Atur target"}
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-xl border bg-background px-3 focus-within:border-primary">
            <span className="text-xs text-muted-foreground">Rp</span>
            <input autoFocus inputMode="numeric" value={draft} onChange={(e) => { const v = parseRupiah(e.target.value); setDraft(v ? v.toLocaleString("id-ID") : ""); }}
              placeholder="contoh 5.000.000" aria-label="Target pendapatan bulan ini" className="w-full bg-transparent px-2 py-2.5 text-sm outline-none" />
          </div>
          <button aria-label="Simpan target" className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Check className="h-4 w-4" /></button>
          <button type="button" aria-label="Batal" onClick={() => setEditing(false)} className="grid h-10 w-10 place-items-center rounded-xl border"><X className="h-4 w-4" /></button>
        </form>
      ) : target > 0 ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="truncate text-base font-bold tabular-nums">{rpSeller(revenue)}</p>
            <p className="shrink-0 text-xs text-muted-foreground">dari {rpSeller(target)}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-[width] duration-700 ${p.reached ? "bg-success" : "bg-gradient-to-r from-primary to-primary-glow"}`} style={{ width: `${p.pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {p.reached ? "🎉 Target bulan ini tercapai. Mantap!" : `${p.pct}% tercapai · kurang ${rpSeller(p.remaining)} · sekitar ${rpSeller(p.perDay)}/hari selama ${p.daysLeft} hari lagi`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Pasang target pendapatan bulan ini supaya progres penjualan kamu mudah dipantau. Target hanya tersimpan di perangkat ini.</p>
      )}
    </SellerCard>
  );
}

const ALERT_META: Record<ProductAlertKind, { icon: typeof PackageX; label: (s?: number) => string; tone: string }> = {
  habis: { icon: PackageX, label: () => "Stok habis — pembeli tidak bisa membeli", tone: "text-destructive bg-destructive/15" },
  menipis: { icon: AlertTriangle, label: (s) => `Stok tinggal ${s}`, tone: "text-warning bg-warning/15" },
  foto: { icon: ImageOff, label: () => "Belum ada foto produk", tone: "text-warning bg-warning/15" },
  deskripsi: { icon: FileText, label: () => "Deskripsi terlalu singkat", tone: "text-muted-foreground bg-muted" },
};

export function ProductAlerts({ products }: { products: Parameters<typeof productAlerts>[0] }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const alerts = productAlerts(products);
  if (!alerts.length) return null;
  const shown = all ? alerts : alerts.slice(0, 4);
  return (
    <SellerCard>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Perlu Perhatian</h3>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">{alerts.length}</span>
      </div>
      <div className="divide-y">
        {shown.map((a) => {
          const m = ALERT_META[a.kind];
          return (
            <button key={`${a.id}-${a.kind}`} type="button" onClick={() => navigate({ to: "/seller/produk/baru", search: { edit: a.id } })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-muted/40">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.tone}`}><m.icon className="h-4 w-4" strokeWidth={1.8} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium uppercase">{a.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.label(a.stock)}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-primary">Perbaiki</span>
            </button>
          );
        })}
      </div>
      {alerts.length > 4 && (
        <button type="button" onClick={() => setAll(!all)} className="w-full border-t py-2.5 text-xs font-medium text-primary">{all ? "Tampilkan lebih sedikit" : `Lihat semua (${alerts.length})`}</button>
      )}
    </SellerCard>
  );
}
