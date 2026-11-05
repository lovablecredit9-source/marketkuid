import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock, Wallet, Package, ShoppingBag, Megaphone, Bot, Settings, ShieldCheck, Snowflake, DollarSign, Users, Percent,
  TrendingUp, ArrowUpRight, CheckCircle2, XCircle, Clock3,
} from "lucide-react";
import { ActionRow, SellerCard, SellerEmpty, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { pageMeta } from "@/lib/meta";
import { useAuth } from "@/lib/auth";
import { useImageUrls, useMyProducts } from "@/lib/products";
import { ORDER_LABEL } from "@/lib/market";
import { sellerStats, useSellerOrders } from "@/lib/seller-orders";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Circle, CircleCheck, Info, Landmark, Store, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSellerStore } from "@/lib/seller";
import { SELLER_WA_ADMIN, SELLER_WA_GROUP, storeSetupSteps } from "@/lib/seller-setup";
import { HoldsSheet, SELLER_FEE_PERCENT, WARRANTY_HOLD_MAX_DAYS, holdLeft, holdsOfKind, useSellerBalance, useSellerHolds, type HoldKind } from "@/components/marketku/seller-holds";

export const Route = createFileRoute("/seller/")({
  head: () => pageMeta("Dasbor Seller — Marketku", "Ringkasan aktivitas, saldo, dan penjualan toko kamu di Marketku."),
  component: Dasbor,
});

const tour = [
  { title: "Bilah atas", desc: "Notifikasi, tema, dan menu profil ada di sini.", target: "topbar" },
  { title: "Navigasi", desc: "Semua fitur toko kamu ada di menu ini.", target: "bottomnav" },
  { title: "Produk", desc: "Tambah dan kelola produk digital tokomu di sini.", target: "nav-produk" },
  { title: "Bot Telegram", desc: "Hubungkan dan kelola bot Telegram untuk jualan otomatis.", target: "qa-bot" },
  { title: "Voucher", desc: "Buat voucher diskon untuk menarik pembeli.", target: "bottomnav" },
  { title: "Withdraw", desc: "Tarik saldo hasil penjualan ke rekening kamu.", target: "qa-withdraw" },
  { title: "Aksi cepat", desc: "Tugas harian seperti withdraw, kelola produk, dan lihat pesanan.", target: "quick" },
  { title: "Saldo", desc: "Pantau saldo penjualan, saldo tertahan, dan credits.", target: "saldo" },
  { title: "Ringkasan performa", desc: "Pendapatan, transaksi, dan produk aktif tokomu.", target: "perf" },
  { title: "Transaksi terbaru", desc: "Pesanan terbaru yang masuk ke toko.", target: "recent" },
  { title: "Produk terlaris", desc: "Produk dengan penjualan terbanyak.", target: "best" },
  { title: "Notifikasi", desc: "Pesanan baru muncul di lonceng ini.", target: "h-notif" },
  { title: "Menu profil", desc: "Buka atau tutup toko dan akses profil di sini.", target: "h-profile" },
  { title: "Panduan", desc: "Buka pusat panduan lengkap kapan saja di menu ini.", target: "h-panduan" },
  { title: "Selesai", desc: "Kamu bisa membuka panduan ini lagi kapan saja lewat tombol Panduan di bilah atas." },
];

function Dasbor() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orders = useSellerOrders(user?.id);
  const products = useMyProducts(user?.id);
  const all = orders.data ?? [];
  const st = sellerStats(all);
  const prods = products.data ?? [];
  const active = prods.filter((p) => p.status === "active").length;
  const pending = st.preorderTodo;
  const holds = useSellerHolds(user?.id);
  const balance = useSellerBalance(user?.id);
  const [holdOpen, setHoldOpen] = useState<HoldKind | null>(null);
  const biasa = holdsOfKind(holds.data ?? [], "biasa");
  const garansi = holdsOfKind(holds.data ?? [], "garansi");
  const heldTotal = biasa.reduce((s, h) => s + Number(h.amount), 0);
  const garansiTotal = garansi.reduce((s, h) => s + Number(h.amount), 0);
  const nextRelease = biasa.map((h) => h.release_at).sort()[0];
  const nextGaransi = garansi.map((h) => h.release_at).sort()[0];
  const coverOf = (id: string | null) => prods.find((p) => p.id === id)?.images?.[0] ?? "";
  const bestImgs = useImageUrls(st.bestSellers.map((b) => coverOf(b.id)).filter(Boolean));
  const maxQty = Math.max(1, ...st.bestSellers.map((b) => b.qty));
  return (
    <>
      <HoldsSheet open={!!holdOpen} kind={holdOpen ?? "biasa"} onClose={() => setHoldOpen(null)} uid={user?.id} />
      <WaGroupBanner />
      <StoreSetup userId={user?.id} hasProduct={active > 0} />
      {pending > 0 && <SellerCard className="border-primary/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Aktivitas Pending</h2>
            <p className="text-xs text-muted-foreground">Pesanan pre-order yang perlu ditindaklanjuti.</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${pending ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"}`}>{pending ? `${pending} perlu diproses` : "Semua beres"}</span>
        </div>
        <button onClick={() => navigate({ to: "/seller/transaksi" })} className="mt-3 flex w-full items-center gap-3 rounded-xl border bg-background/40 p-3 text-left transition active:scale-[0.98]">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-warning/20 text-warning"><Clock className="h-4 w-4" /></span>
          <span className="flex-1">
            <span className="block text-xs text-muted-foreground">Pre-order Belum Diproses</span>
            <span className="block text-lg font-semibold">{pending}</span>
          </span>
        </button>
      </SellerCard>}

      <SellerCard data-tour="quick">
        <h3 className="border-b px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground">AKSI CEPAT</h3>
        <div className="space-y-2.5 p-3">
          <div data-tour="qa-withdraw"><ActionRow icon={Wallet} title="Withdraw" desc="Tarik saldo penjualan ke rekening bank" onClick={() => navigate({ to: "/seller/withdraw" })} /></div>
          <ActionRow icon={Package} title="Kelola Produk" desc="Tambah, ubah harga, dan atur stok produk" onClick={() => navigate({ to: "/seller/produk" })} />
          <ActionRow icon={ShoppingBag} title="Lihat Pesanan" desc="Pantau dan proses pesanan pembeli" onClick={() => navigate({ to: "/seller/transaksi" })} />
          <ActionRow icon={Megaphone} title="Broadcast" desc="Kirim pesan massal ke pelanggan bot" onClick={() => navigate({ to: "/seller/broadcast" })} />
          <div data-tour="qa-bot"><ActionRow icon={Bot} title="Bot Telegram" desc="Hubungkan dan atur bot toko" onClick={() => navigate({ to: "/seller/bot" })} /></div>
          <ActionRow icon={Settings} title="Pengaturan" desc="Profil toko, jam operasional, dan preferensi" onClick={() => navigate({ to: "/seller/pengaturan" })} />
        </div>
      </SellerCard>

      <SellerCard data-tour="saldo" className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell icon={Wallet} label="Saldo Penjualan" value={rpSeller(balance.data ?? 0)} sub={`Sudah dipotong admin ${SELLER_FEE_PERCENT}%`} valueClass="text-success" />
        <StatCell onClick={() => setHoldOpen("biasa")} icon={Clock} label="Saldo Tertahan" value={rpSeller(heldTotal)} sub={nextRelease ? `Cair ${holdLeft(nextRelease)}` : "Menunggu konfirmasi pembeli"} valueClass="text-warning" />
        <StatCell onClick={() => setHoldOpen("garansi")} icon={ShieldCheck} label="Saldo Menunggu Masa Garansi" value={rpSeller(garansiTotal)} sub={nextGaransi ? `Cair ${holdLeft(nextGaransi)}` : `Dana ditahan paling lama ${WARRANTY_HOLD_MAX_DAYS} hari`} valueClass="text-warning" />
        <StatCell icon={Snowflake} label="Saldo Freeze" value={rpSeller(0)} sub="Ditahan sementara · Tidak dapat ditarik" valueClass="text-destructive" />
      </SellerCard>

      <SellerCard data-tour="perf" className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell onClick={() => navigate({ to: "/seller/transaksi" })} icon={DollarSign} label="Total Pendapatan" value={rpSeller(st.revenue)} sub={`Hari ini: ${rpSeller(st.today)}`} />
        <StatCell onClick={() => navigate({ to: "/seller/transaksi" })} icon={ShoppingBag} label="Transaksi" value={String(st.total)} sub={`${st.completed} selesai`} />
        <StatCell onClick={() => navigate({ to: "/seller/produk" })} icon={Package} label="Produk Aktif" value={String(active)} sub={`Total: ${prods.length}`} />
        <StatCell onClick={() => navigate({ to: "/seller/transaksi" })} icon={Clock} label="Menunggu" value={String(st.waiting)} sub="menunggu bayar" />
        <StatCell icon={Users} label="Pelanggan" value={String(st.buyers)} sub="unik bertransaksi" />
        <StatCell icon={Percent} label="Konversi" value={`${st.conversion}%`} sub={`avg ${rpSeller(st.avgOrder)}`} />
      </SellerCard>

      <SellerCard data-tour="recent">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4" /> Transaksi Terbaru</h3>
          <button onClick={() => navigate({ to: "/seller/transaksi" })} className="flex items-center gap-1 text-xs font-medium text-primary">Lihat semua <ArrowUpRight className="h-3 w-3" /></button>
        </div>
        {all.length === 0 ? <SellerEmpty icon={ShoppingBag} title="Belum ada transaksi" desc="Transaksi pembeli akan muncul di sini." /> : (
          <div className="divide-y">
            {all.slice(0, 5).map((o) => {
              const ok = ["paid", "processing", "completed"].includes(o.status);
              const bad = ["cancelled", "failed", "expired"].includes(o.status);
              const tone = ok ? "text-success" : bad ? "text-destructive" : o.status === "pending" ? "text-warning" : "text-muted-foreground";
              const Icon = ok ? CheckCircle2 : bad ? XCircle : Clock3;
              return (
              <button key={o.id} onClick={() => navigate({ to: "/seller/transaksi" })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-muted/40">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background/70"><Icon className={`h-4 w-4 ${tone}`} strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium uppercase">{o.order_items[0]?.product_name}</span><span className="block truncate text-xs text-muted-foreground">{o.buyer_name || "Pelanggan"} · {new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span></span>
                <span className="shrink-0 text-right"><span className="block text-sm font-semibold">{rpSeller(Number(o.subtotal) - Number(o.discount))}</span><span className={`mt-0.5 inline-block whitespace-nowrap text-xs font-medium ${tone} ${bad ? "rounded-md bg-destructive/15 px-1.5 py-0.5" : ""}`}>{ORDER_LABEL[o.status]}</span></span>
              </button>
              );
            })}
          </div>
        )}
      </SellerCard>

      <SellerCard data-tour="best">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4" /> Produk Terlaris</h3>
          <button onClick={() => navigate({ to: "/seller/produk" })} className="flex items-center gap-1 text-xs font-medium text-primary">Kelola <ArrowUpRight className="h-3 w-3" /></button>
        </div>
        {st.bestSellers.length === 0 ? <SellerEmpty icon={Package} title="Belum ada produk terjual" desc="Produk terlaris akan tampil setelah ada penjualan." /> : (
          <div className="divide-y">
            {st.bestSellers.map((b, i) => (
              <div key={b.id ?? b.name} className="flex items-center gap-3 px-4 py-3">
                <span className="w-4 shrink-0 text-sm font-medium text-muted-foreground">{i + 1}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background/70">
                  {bestImgs.data?.[coverOf(b.id)] ? <img src={bestImgs.data[coverOf(b.id)]} alt={b.name} className="h-full w-full object-cover" loading="lazy" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium uppercase">{b.name}</span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-gradient-to-r from-warning/40 to-warning" style={{ width: `${Math.round((b.qty / maxQty) * 100)}%` }} /></span>
                </span>
                <span className="shrink-0 text-right"><span className="block text-sm font-semibold">{b.qty} terjual</span><span className="text-xs text-muted-foreground">{rpSeller(b.revenue)}</span></span>
              </div>
            ))}
          </div>
        )}
      </SellerCard>
      <PageTour id="seller-dashboard" steps={tour} panel />
    </>
  );
}

const WA_BANNER_KEY = "marketku-seller-wa-banner";

function WaGroupBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(!window.localStorage.getItem(WA_BANNER_KEY)); }, []);
  if (!show) return null;
  const close = () => { window.localStorage.setItem(WA_BANNER_KEY, "1"); setShow(false); };
  return (
    <section className="relative flex gap-3 rounded-lg border border-primary/30 border-l-4 border-l-primary bg-primary/10 p-3 pr-9">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"><Info className="h-4 w-4" /></span>
      <div className="text-[12.5px] leading-snug">
        <h3 className="text-[13px] font-semibold">Grup Whatsapp Seller</h3>
        <p className="mt-0.5">Bagi kalian seller yang serius berjualan di marketku.id<br />Wajib gabung ke grup seller whatsapp untuk menerima info, pembaruan, dan lainnya.</p>
        <p className="mt-2"><a href={SELLER_WA_GROUP} target="_blank" rel="noreferrer" className="text-primary underline">Klik disini untuk gabung ke grup seller.</a></p>
        <p className="mt-2">Silahkan chat admin dan berikan nama toko anda agar di konfirmasi di grup.<br />Wa admin <a href={SELLER_WA_ADMIN} target="_blank" rel="noreferrer" className="text-primary underline">Klik disini</a></p>
      </div>
      <button aria-label="Tutup" onClick={close} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition active:scale-90"><X className="h-4 w-4" /></button>
    </section>
  );
}

function StoreSetup({ userId, hasProduct }: { userId: string | undefined; hasProduct: boolean }) {
  const navigate = useNavigate();
  const store = useSellerStore(userId);
  const bots = useQuery({
    queryKey: ["telegram_bots_count", userId], enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase.from("telegram_bots").select("id", { count: "exact", head: true }).eq("owner_id", userId!);
      return count ?? 0;
    },
  });
  if (!store.data) return null;
  const steps = storeSetupSteps({ store: store.data, hasProduct, botCount: bots.data ?? 0 });
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  if (steps.every((s) => s.done)) return null;
  const pct = Math.round((done / required.length) * 100);
  const icons = { profil: Store, bank: Landmark, produk: Package, bot: Bot } as const;
  const go = (key: keyof typeof icons) => {
    if (key === "profil") navigate({ to: "/seller/pengaturan", search: { tab: "profil" } });
    else if (key === "bank") navigate({ to: "/seller/pengaturan", search: { tab: "keuangan" } });
    else if (key === "produk") navigate({ to: "/seller/produk/baru" });
    else navigate({ to: "/seller/bot" });
  };
  return (
    <SellerCard className="overflow-hidden rounded-lg">
      <div className="flex items-start justify-between gap-3 border-b px-3 py-2.5">
        <div>
          <h2 className="text-[13px] font-semibold">Siapkan toko kamu</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{done} dari {required.length} langkah wajib selesai.</p>
        </div>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-primary">{pct}%</span>
      </div>
      <div className="px-3 pt-2.5"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} /></div></div>
      <ol className="grid grid-cols-1 gap-2 p-3">
        {steps.map((s) => {
          const I = icons[s.key];
          return (
            <li key={s.key} className="min-w-0">
              <button type="button" disabled={s.done} onClick={() => go(s.key)}
                className="seller-tap flex min-h-[60px] w-full items-center gap-3 rounded-md border bg-background/40 p-2.5 text-left disabled:cursor-default disabled:opacity-70">
                {s.done ? <CircleCheck className="h-[18px] w-[18px] shrink-0 text-primary" /> : <Circle className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />}
                <I className="h-[15px] w-[15px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12.5px] font-semibold ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}{s.optional && <span className="font-normal text-muted-foreground"> (opsional)</span>}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{s.desc}</span>
                </span>
                {!s.done && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
              </button>
            </li>
          );
        })}
      </ol>
    </SellerCard>
  );
}
