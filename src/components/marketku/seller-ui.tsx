import * as Dialog from "@radix-ui/react-dialog";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid, Package, Coins, ShoppingBag, Menu, RefreshCw, HelpCircle, Bell, Monitor, X,
  Megaphone, Bot, Settings, LogOut, ArrowRight, BarChart3, Users, MessageCircle, AlertTriangle,
  Wallet, CreditCard, Handshake, Gem, Shield, Percent, BookOpen, ChevronDown,
} from "lucide-react";
import logo from "@/assets/logo-marketku.png.asset.json";
import { soon } from "@/components/marketku/shell";
import { supabase } from "@/integrations/supabase/client";

export const rpSeller = (n: number) => `Rp. ${n.toLocaleString("id-ID")},-`;

const navTabs = [
  { to: "/seller", label: "Dasbor", icon: LayoutGrid },
  { to: "/seller/produk", label: "Produk", icon: Package },
  { to: "/seller/saldo", label: "Saldo", icon: Coins },
  { to: "/seller/transaksi", label: "Transaksi", icon: ShoppingBag },
] as const;

const titleFor = (p: string) =>
  p === "/seller" ? "Dasbor"
  : p.startsWith("/seller/produk") ? "Produk Saya"
  : p.startsWith("/seller/saldo") ? "Credits"
  : p.startsWith("/seller/transaksi") ? "Pesanan Saya"
  : "Seller Center";

export function SellerHeader({ initial, onMenu }: { initial: string; onMenu: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/seller" });
  const qc = useQueryClient();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-1 px-3 py-3">
        <button aria-label="Menu" onClick={onMenu} className="grid h-9 w-9 place-items-center rounded-lg transition active:scale-90"><Menu className="h-5 w-5" /></button>
        <h1 className="ml-1 text-lg font-bold">{titleFor(path)}</h1>
        <div className="ml-auto flex items-center gap-0.5">
          <HeadBtn label="Muat ulang" onClick={() => { void qc.invalidateQueries(); }}><RefreshCw className="h-5 w-5" /></HeadBtn>
          <HeadBtn label="Bantuan" onClick={() => soon("Bantuan seller")}><HelpCircle className="h-5 w-5" /></HeadBtn>
          <HeadBtn label="Notifikasi" onClick={() => soon("Notifikasi")}><Bell className="h-5 w-5" /></HeadBtn>
          <HeadBtn label="Tampilan desktop" onClick={() => soon("Tampilan desktop")}><Monitor className="h-5 w-5" /></HeadBtn>
          <span className="ml-1 grid h-10 w-10 place-items-center rounded-full border border-primary/50 bg-card text-sm font-bold text-primary">{initial}</span>
        </div>
      </div>
    </header>
  );
}

function HeadBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return <button aria-label={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-full text-foreground/90 transition active:scale-90">{children}</button>;
}

export function SellerBottomNav({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-background">
      <div className="flex items-stretch justify-around px-2 py-2">
        {navTabs.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/seller" }}
            className="group relative flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-foreground/80 transition-all duration-300 active:scale-95 data-[status=active]:bg-accent data-[status=active]:text-primary">
            <span className="absolute -top-2 left-1/2 h-[3px] w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 group-data-[status=active]:w-3" />
            <Icon className="h-5 w-5 transition-transform duration-300 group-active:-translate-y-1 group-data-[status=active]:-translate-y-0.5" />
            <span className="hidden group-data-[status=active]:inline">{label}</span>
          </Link>
        ))}
        <button aria-label="Menu" onClick={onMenu}
          className={`group relative flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 active:scale-95 ${menuOpen ? "bg-accent text-primary" : "text-foreground/80"}`}>
          <Menu className="h-5 w-5 transition-transform duration-300 group-active:-translate-y-1" />
          {menuOpen && <span>Menu</span>}
        </button>
      </div>
    </nav>
  );
}

type MenuItem = { label: string; icon: typeof Package; to?: "/seller" | "/seller/produk" | "/seller/saldo" | "/seller/transaksi" | "/pesan"; badge?: string; chevron?: boolean };
const menuGroups: { title: string; items: MenuItem[] }[] = [
  { title: "UTAMA", items: [{ label: "Dasbor", icon: LayoutGrid, to: "/seller" }, { label: "Analitik", icon: BarChart3 }] },
  { title: "MANAJEMEN TOKO", items: [
    { label: "Produk Saya", icon: Package, to: "/seller/produk" },
    { label: "Transaksi", icon: ShoppingBag, to: "/seller/transaksi" },
    { label: "Pelanggan", icon: Users },
    { label: "Inbox Chat", icon: MessageCircle, to: "/pesan" },
    { label: "Dispute Pesanan", icon: AlertTriangle },
  ] },
  { title: "KEUANGAN", items: [
    { label: "Pendapatan Saya", icon: Coins },
    { label: "Withdraw", icon: Wallet },
    { label: "Credits", icon: Coins, to: "/seller/saldo" },
    { label: "Kontrol Pembayaran", icon: CreditCard },
    { label: "Rekber", icon: Handshake },
    { label: "Program Seller", icon: Gem },
    { label: "Garansi", icon: Shield },
  ] },
  { title: "IKLAN", items: [{ label: "Iklan", icon: Megaphone, badge: "BETA", chevron: true }] },
  { title: "INTEGRASI", items: [{ label: "Bot Telegram", icon: Bot }, { label: "Voucher", icon: Percent }, { label: "Broadcast", icon: Megaphone }] },
  { title: "LAINNYA", items: [{ label: "Grup WhatsApp", icon: MessageCircle }, { label: "Panduan", icon: BookOpen }, { label: "Pengaturan", icon: Settings }] },
];

export function SellerMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void; storeName: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/seller" });
  const isActive = (to?: string) => !!to && (to === "/seller" ? path === "/seller" : path.startsWith(to));
  const signOut = async () => {
    onOpenChange(false);
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/60 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="seller-panel fixed inset-y-0 left-0 z-50 flex w-[78%] max-w-[300px] flex-col border-r bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <Link to="/" onClick={() => onOpenChange(false)} className="flex items-center gap-3">
              <img src={logo.url} alt="Marketku" className="h-10 w-auto" />
            </Link>
            <Dialog.Title className="sr-only">Menu Seller Dashboard</Dialog.Title>
            <Dialog.Description className="sr-only">Navigasi Seller Center Marketku</Dialog.Description>
            <Dialog.Close aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition active:scale-90"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <p className="-mt-3 border-b pb-3 pl-[4.4rem] text-[10px] font-medium tracking-[0.2em] text-muted-foreground">Seller Dashboard</p>
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {menuGroups.map((g) => (
              <div key={g.title} className="mb-3">
                <p className="flex items-center gap-2 px-3 pb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground">
                  {g.title}<span className="h-px flex-1 bg-border" />
                </p>
                {g.items.map(({ label, icon: I, to, badge, chevron }) => {
                  const active = isActive(to);
                  return (
                    <button key={label}
                      onClick={() => { if (to) { onOpenChange(false); navigate({ to }); } else soon(label); }}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] transition active:scale-[0.98] ${active ? "bg-accent text-foreground" : "text-foreground/85"}`}>
                      {active && <span className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />}
                      <I className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                      <span className="flex-1">{label}</span>
                      {badge && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">{badge}</span>}
                      {chevron && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <button onClick={() => void signOut()} className="flex items-center gap-3 border-t px-5 py-4 text-[15px] text-foreground/85 transition active:scale-[0.98]">
            <LogOut className="h-5 w-5" strokeWidth={1.75} /> Keluar
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Bottom sheet used by Seller Center forms (garansi, diskon, kategori, dll). */
export function SellerSheet({ open, onOpenChange, title, children, footer, className = "" }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; children: ReactNode; footer?: ReactNode; className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined}
          className={`seller-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-2xl border bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom ${className}`}>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
            <Dialog.Close aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-foreground/80 transition active:scale-90"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-between gap-3 border-t px-5 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SellerCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border bg-card ${className}`}>{children}</section>;
}

export function ActionRow({ icon: I, title, desc, onClick }: { icon: typeof Package; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-xl border bg-background/40 px-4 py-4 text-left transition active:scale-[0.98]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent"><I className="h-4 w-4" /></span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function StatCell({ icon: I, label, value, sub, valueClass = "" }: { icon: typeof Package; label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="p-4">
      <p className="flex items-center gap-2 text-sm text-foreground/85"><I className="h-4 w-4 shrink-0" /> <span className="truncate">{label}</span></p>
      <p className={`mt-1 text-lg font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SellerEmpty({ icon: I, title, desc, action }: { icon: typeof Package; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary"><I className="h-6 w-6" /></span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
