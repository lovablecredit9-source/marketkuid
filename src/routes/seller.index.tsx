import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock, Wallet, Package, ShoppingBag, Megaphone, Bot, Settings, ShieldCheck, Snowflake, DollarSign, Users, Percent,
  TrendingUp, ArrowUpRight,
} from "lucide-react";
import { ActionRow, SellerCard, SellerEmpty, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { pageMeta } from "@/lib/meta";

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
  return (
    <>
      <SellerCard className="border-foreground/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Aktivitas Pending</h2>
            <p className="text-sm text-muted-foreground">Pesanan pre-order yang perlu ditindaklanjuti.</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Semua beres</span>
        </div>
        <button onClick={() => navigate({ to: "/seller/transaksi" })} className="mt-4 flex w-full items-center gap-4 rounded-xl border bg-background/40 p-4 text-left transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-warning/20 text-warning"><Clock className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block text-sm text-muted-foreground">Pre-order Belum Diproses</span>
            <span className="block text-xl font-bold">0</span>
          </span>
        </button>
      </SellerCard>

      <SellerCard data-tour="quick">
        <h3 className="border-b px-4 py-3 text-sm font-bold tracking-wide text-muted-foreground">AKSI CEPAT</h3>
        <div className="space-y-3 p-4">
          <div data-tour="qa-withdraw"><ActionRow icon={Wallet} title="Withdraw" desc="Tarik saldo penjualan ke rekening bank" onClick={() => navigate({ to: "/seller/withdraw" })} /></div>
          <ActionRow icon={Package} title="Kelola Produk" desc="Tambah, ubah harga, dan atur stok produk" onClick={() => navigate({ to: "/seller/produk" })} />
          <ActionRow icon={ShoppingBag} title="Lihat Pesanan" desc="Pantau dan proses pesanan pembeli" onClick={() => navigate({ to: "/seller/transaksi" })} />
          <ActionRow icon={Megaphone} title="Broadcast" desc="Kirim pesan massal ke pelanggan bot" onClick={() => navigate({ to: "/seller/broadcast" })} />
          <div data-tour="qa-bot"><ActionRow icon={Bot} title="Bot Telegram" desc="Hubungkan dan atur bot toko" onClick={() => navigate({ to: "/seller/bot" })} /></div>
          <ActionRow icon={Settings} title="Pengaturan" desc="Profil toko, jam operasional, dan preferensi" onClick={() => navigate({ to: "/seller/pengaturan" })} />
        </div>
      </SellerCard>

      <SellerCard data-tour="saldo" className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell icon={Wallet} label="Saldo Penjualan" value={rpSeller(0)} valueClass="text-success" />
        <StatCell icon={Clock} label="Saldo Tertahan" value={rpSeller(0)} sub="Menunggu konfirmasi pembeli" valueClass="text-warning" />
        <StatCell icon={ShieldCheck} label="Saldo Menunggu Masa Garansi" value={rpSeller(0)} sub="Dana ditahan paling lama 3 hari" valueClass="text-warning" />
        <StatCell icon={Snowflake} label="Saldo Freeze" value={rpSeller(0)} sub="Ditahan sementara · Tidak dapat ditarik" valueClass="text-destructive" />
      </SellerCard>

      <SellerCard data-tour="perf" className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
        <StatCell icon={DollarSign} label="Total Pendapatan" value={rpSeller(0)} sub={`Hari ini: ${rpSeller(0)}`} />
        <StatCell icon={ShoppingBag} label="Transaksi" value="0" sub="0 selesai" />
        <StatCell icon={Package} label="Produk Aktif" value="0" sub="Total: 0" />
        <StatCell icon={Clock} label="Menunggu" value="0" sub="menunggu bayar" />
        <StatCell icon={Users} label="Pelanggan" value="0" sub="unik bertransaksi" />
        <StatCell icon={Percent} label="Konversi" value="0%" sub={`avg ${rpSeller(0)}`} />
      </SellerCard>

      <SellerCard data-tour="recent">
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h3 className="flex items-center gap-2 font-bold"><ShoppingBag className="h-5 w-5" /> Transaksi Terbaru</h3>
          <button onClick={() => navigate({ to: "/seller/transaksi" })} className="flex items-center gap-1 text-sm font-semibold text-primary">Lihat semua <ArrowUpRight className="h-3 w-3" /></button>
        </div>
        <SellerEmpty icon={ShoppingBag} title="Belum ada transaksi" desc="Transaksi pembeli akan muncul di sini." />
      </SellerCard>

      <SellerCard data-tour="best">
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h3 className="flex items-center gap-2 font-bold"><TrendingUp className="h-5 w-5" /> Produk Terlaris</h3>
          <button onClick={() => navigate({ to: "/seller/produk" })} className="flex items-center gap-1 text-sm font-semibold text-primary">Kelola <ArrowUpRight className="h-3 w-3" /></button>
        </div>
        <SellerEmpty icon={Package} title="Belum ada produk terjual" desc="Produk terlaris akan tampil setelah ada penjualan." />
      </SellerCard>
      <PageTour id="seller-dashboard" steps={tour} panel />
    </>
  );
}
