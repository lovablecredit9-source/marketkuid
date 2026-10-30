import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock, Wallet, Package, ShoppingBag, Megaphone, Bot, Settings, ShieldCheck, Snowflake, DollarSign, Users, Percent,
  TrendingUp, ArrowUpRight,
} from "lucide-react";
import { ActionRow, SellerCard, SellerEmpty, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { pageMeta } from "@/lib/meta";
import { useAuth } from "@/lib/auth";
import { useMyProducts } from "@/lib/products";
import { ORDER_LABEL } from "@/lib/market";
import { sellerStats, useSellerOrders } from "@/lib/seller-orders";
import { useState } from "react";
import { HOLD_HOURS, HoldsSheet, SELLER_FEE_PERCENT, holdLeft, useSellerBalance, useSellerHolds } from "@/components/marketku/seller-holds";

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
  const [holdOpen, setHoldOpen] = useState(false);
  const heldTotal = (holds.data ?? []).reduce((s, h) => s + Number(h.amount), 0);
  const nextRelease = (holds.data ?? []).map((h) => h.release_at).sort()[0];
  return (
    <>
      <HoldsSheet open={holdOpen} onClose={() => setHoldOpen(false)} uid={user?.id} />
      <SellerCard className="border-primary/50 p-4">
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
      </SellerCard>

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
        <button onClick={() => setHoldOpen(true)} className="text-left transition active:scale-[0.98]">
          <StatCell icon={Clock} label="Saldo Tertahan" value={rpSeller(heldTotal)} sub={nextRelease ? `Cair ${holdLeft(nextRelease)}` : `Ditahan maks ${HOLD_HOURS} jam · ketuk detail`} valueClass="text-warning" />
        </button>
        <StatCell icon={ShieldCheck} label="Saldo Menunggu Masa Garansi" value={rpSeller(0)} sub="Dana ditahan paling lama 3 hari" valueClass="text-warning" />
        <StatCell icon={Snowflake} label="Saldo Freeze" value={rpSeller(0)} sub="Ditahan sementara · Tidak dapat ditarik" valueClass="text-destructive" />
      </SellerCard>

      <SellerCard data-tour="perf" className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell icon={DollarSign} label="Total Pendapatan" value={rpSeller(st.revenue)} sub={`Hari ini: ${rpSeller(st.today)}`} />
        <StatCell icon={ShoppingBag} label="Transaksi" value={String(st.total)} sub={`${st.completed} selesai`} />
        <StatCell icon={Package} label="Produk Aktif" value={String(active)} sub={`Total: ${prods.length}`} />
        <StatCell icon={Clock} label="Menunggu" value={String(st.waiting)} sub="menunggu bayar" />
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
            {all.slice(0, 5).map((o) => (
              <button key={o.id} onClick={() => navigate({ to: "/seller/transaksi" })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium uppercase">{o.order_items[0]?.product_name}</span><span className="text-xs text-muted-foreground">{o.buyer_name} · {new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span></span>
                <span className="text-right"><span className="block text-sm font-semibold">{rpSeller(Number(o.subtotal) - Number(o.discount))}</span><span className={`text-xs font-medium ${["paid", "completed"].includes(o.status) ? "text-success" : ["cancelled", "failed"].includes(o.status) ? "text-destructive" : o.status === "pending" ? "text-warning" : "text-muted-foreground"}`}>{ORDER_LABEL[o.status]}</span></span>
              </button>
            ))}
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
              <div key={b.name} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 text-sm font-medium text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium uppercase">{b.name}</span>
                <span className="text-right"><span className="block text-sm font-semibold">{b.qty} terjual</span><span className="text-xs text-muted-foreground">{rpSeller(b.revenue)}</span></span>
              </div>
            ))}
          </div>
        )}
      </SellerCard>
      <PageTour id="seller-dashboard" steps={tour} panel />
    </>
  );
}
