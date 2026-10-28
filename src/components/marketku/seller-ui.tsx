import * as Dialog from "@radix-ui/react-dialog";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid, Package, Coins, ShoppingBag, Menu, RefreshCw, HelpCircle, Bell, Monitor, X,
  Megaphone, Bot, Settings, ArrowLeft, LogOut, ArrowRight,
} from "lucide-react";
import { soon } from "@/components/marketku/shell";
import { supabase } from "@/integrations/supabase/client";

export const rpSeller = (n: number) => `Rp. ${n.toLocaleString("id-ID")},-`;

const navTabs = [
  { to: "/seller", label: "Dasbor", icon: LayoutGrid },
  { to: "/seller/produk", label: "Produk", icon: Package },
  { to: "/seller/saldo", label: "Saldo", icon: Coins },
  { to: "/seller/transaksi", label: "Transaksi", icon: ShoppingBag },
] as const;

const titles: Record<string, string> = {
  "/seller": "Dasbor",
  "/seller/produk": "Produk Saya",
  "/seller/saldo": "Saldo",
  "/seller/transaksi": "Transaksi",
};

export function SellerHeader({ initial, onMenu }: { initial: string; onMenu: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/seller" });
  const qc = useQueryClient();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-1 px-3 py-3">
        <button aria-label="Menu" onClick={onMenu} className="grid h-9 w-9 place-items-center rounded-lg transition active:scale-90"><Menu className="h-5 w-5" /></button>
        <h1 className="ml-1 text-lg font-bold">{titles[path] ?? "Seller Center"}</h1>
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
          <Link key={to} to={to} activeOptions={{ exact: true }}
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

export function SellerMenuSheet({ open, onOpenChange, storeName }: { open: boolean; onOpenChange: (v: boolean) => void; storeName: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const go = (to: "/seller" | "/seller/produk" | "/seller/saldo" | "/seller/transaksi" | "/akun") => { onOpenChange(false); navigate({ to }); };
  const signOut = async () => {
    onOpenChange(false);
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
  const item = (icon: typeof Package, label: string, onClick: () => void, danger?: boolean) => {
    const I = icon;
    return (
      <button key={label} onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left text-[15px] font-semibold transition active:scale-[0.98] ${danger ? "border-destructive/40 text-destructive" : ""}`}>
        <I className="h-5 w-5" /> {label}
      </button>
    );
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="seller-panel fixed inset-y-0 left-0 z-50 w-[82%] max-w-xs overflow-y-auto border-r p-4 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
          <div className="flex items-center justify-between pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold">Marketku <span className="ml-1 text-xs font-bold tracking-widest text-muted-foreground">SELLER CENTER</span></Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">{storeName}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full transition active:scale-90"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <div className="space-y-2">
            {item(LayoutGrid, "Dasbor", () => go("/seller"))}
            {item(Package, "Produk Saya", () => go("/seller/produk"))}
            {item(Coins, "Saldo & Credits", () => go("/seller/saldo"))}
            {item(ShoppingBag, "Transaksi", () => go("/seller/transaksi"))}
            {item(Megaphone, "Broadcast", () => soon("Broadcast"))}
            {item(Bot, "Bot Telegram", () => soon("Bot Telegram"))}
            {item(Settings, "Pengaturan", () => soon("Pengaturan toko"))}
            <div className="pt-3" />
            {item(ArrowLeft, "Kembali ke Marketku", () => go("/akun"))}
            {item(LogOut, "Keluar", () => void signOut(), true)}
          </div>
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
