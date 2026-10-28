import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Settings, RefreshCw, ArrowUpRight, Coins, ShoppingBag, Heart, ShoppingCart, Gift, MessageCircle, Clock,
  ShieldAlert, ShieldCheck, Bell, Moon, HelpCircle, Send, Store, LogOut, Wallet,
} from "lucide-react";
import { AppShell, MenuRow, Section, soon } from "@/components/marketku/shell";

export const Route = createFileRoute("/akun")({
  head: () => ({
    meta: [
      { title: "Akun Saya — Marketku" },
      { name: "description", content: "Kelola profil, saldo, dan pengaturan akun Marketku." },
      { property: "og:title", content: "Akun Saya — Marketku" },
      { property: "og:description", content: "Profil dan saldo akun Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Akun,
});

function Stat({ icon: I, value, label, full }: { icon: typeof Coins; value: number; label: string; full?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 ${full ? "col-span-2" : ""}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-primary"><I className="h-4 w-4" /></span>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="text-xs font-bold tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Tile({ icon: I, label, onClick }: { icon: typeof Coins; label: string; onClick: () => void }): ReactNode {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-xl border bg-card py-4 text-sm font-semibold">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-primary"><I className="h-4 w-4" /></span>
      {label}
    </button>
  );
}

// Belum ada fitur masuk akun, jadi selalu tampilkan halaman tamu.
// Ganti ke <AkunDashboard /> setelah login aktif.
function Akun() {
  return (
    <AppShell title="Akun Saya">
      <div className="relative overflow-hidden px-6 pt-24">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-40 h-[22rem] w-[40rem] rounded-[50%] border border-primary/10" />
        <div aria-hidden className="pointer-events-none absolute -left-10 top-48 h-[20rem] w-[36rem] rounded-[50%] border border-primary/10" />
        <div className="relative">
          <ShieldCheck className="ml-4 h-12 w-12 text-primary" />
          <h1 className="mt-8 text-center text-2xl font-bold">Masuk dulu untuk membuka akunmu</h1>
          <p className="mt-3 text-center text-base text-foreground/80">Setelah login, kamu bisa lihat saldo, ringkasan pesanan, dan aktivitas wishlist.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/login" className="rounded-2xl bg-primary px-8 py-4 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95">Masuk</Link>
            <Link to="/register" className="rounded-2xl border border-primary/40 bg-card px-8 py-4 font-bold text-primary transition active:scale-95">Buat akun</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function AkunDashboard() {
  const navigate = useNavigate();
  return (
    <AppShell title="Akun Saya">
      <div className="space-y-4 px-3 pt-4">
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">?</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">Tamu</h1>
                <span className="rounded-full border border-primary px-2 py-0.5 text-[10px] font-bold text-primary">MEMBER</span>
              </div>
              <p className="text-sm text-muted-foreground">Belum masuk</p>
            </div>
          </div>
          <button onClick={() => soon("Atur Profil")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-primary bg-accent py-2.5 text-sm font-semibold text-primary">
            <Settings className="h-4 w-4" /> Atur Profil
          </button>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground"><Wallet className="h-4 w-4" /> SALDO MARKETKU</p>
            <button aria-label="Muat ulang" onClick={() => soon("Muat ulang saldo")} className="grid h-8 w-8 place-items-center rounded-lg border"><RefreshCw className="h-4 w-4" /></button>
          </div>
          <p className="mt-3 font-mono text-2xl">Rp 0</p>
          <button onClick={() => soon("Riwayat saldo")} className="flex items-center gap-1 text-sm text-muted-foreground">Lihat riwayat & tarik dana <ArrowUpRight className="h-3 w-3" /></button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => soon("Tarik Saldo")} className="rounded-xl bg-primary/60 py-3 text-sm font-semibold text-primary-foreground">Tarik Saldo</button>
            <button onClick={() => soon("Top Up")} className="rounded-xl border bg-card py-3 text-sm font-semibold">Top Up</button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Saldo otomatis kembali ke akunmu kalau order dibatalkan atau di-refund.</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Coins} value={0} label="TOKEN" />
          <Stat icon={ShoppingBag} value={0} label="TOTAL ORDER" />
          <Stat icon={Heart} value={0} label="WISHLIST" full />
        </div>

        <section className="rounded-2xl border bg-card p-4">
          <h3 className="mb-3 text-xs font-bold tracking-widest text-muted-foreground">BELANJA</h3>
          <div className="grid grid-cols-3 gap-2">
            <Tile icon={ShoppingBag} label="Pesanan" onClick={() => navigate({ to: "/riwayat" })} />
            <Tile icon={Heart} label="Wishlist" onClick={() => soon("Wishlist")} />
            <Tile icon={ShoppingCart} label="Keranjang" onClick={() => navigate({ to: "/keranjang" })} />
            <Tile icon={Gift} label="Voucher" onClick={() => soon("Voucher")} />
            <Tile icon={MessageCircle} label="Pesan" onClick={() => navigate({ to: "/pesan" })} />
            <Tile icon={Clock} label="Riwayat" onClick={() => navigate({ to: "/riwayat" })} />
            <Tile icon={ShieldAlert} label="Dispute" onClick={() => soon("Dispute")} />
          </div>
        </section>

        <Section title="AKUN">
          <MenuRow icon={Settings} title="Pengaturan Akun" desc="Nama, email, no HP, dan password" />
          <MenuRow icon={Bell} title="Notifikasi" desc="Atur preferensi email & push" />
          <MenuRow icon={Moon} title="Tema Gelap" desc="Aktifkan mode gelap" onClick={() => document.documentElement.classList.toggle("dark")} />
        </Section>

        <Section title="BANTUAN">
          <MenuRow icon={HelpCircle} title="Pusat Bantuan" desc="FAQ & panduan pengguna" />
          <MenuRow icon={Send} title="Hubungi Kami" desc="Kirim pesan ke tim support" />
        </Section>

        <MenuRow icon={Store} title="Buka akun seller" desc="Kelola produk, pesanan, dan keuangan toko." />

        <button onClick={() => soon("Keluar")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 py-3 font-semibold text-destructive">
          <LogOut className="h-4 w-4" /> Keluar
        </button>
      </div>
    </AppShell>
  );
}
