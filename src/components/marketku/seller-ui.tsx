import * as Dialog from "@radix-ui/react-dialog";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutGrid, Package, Coins, ShoppingBag, Menu, RefreshCw, HelpCircle, Bell, Monitor, X,
  Megaphone, Bot, Settings, LogOut, ArrowRight, BarChart3, Users, MessageCircle, AlertTriangle,
  Wallet, CreditCard, Handshake, Gem, Shield, Percent, BookOpen, ChevronDown, Sun, Moon, Store, User as UserIcon,
} from "lucide-react";
import logoMark from "@/assets/seller-logo-mark.png";
import logoWord from "@/assets/seller-logo-word.png";
import { soon } from "@/components/marketku/shell";
import { startTour } from "@/components/marketku/tour";
import { supabase } from "@/integrations/supabase/client";
import { lockSeller } from "@/lib/chat";

export const rpSeller = (n: number) => `Rp. ${n.toLocaleString("id-ID")},-`;

const navTabs = [
  { to: "/seller", label: "Dasbor", icon: LayoutGrid },
  { to: "/seller/produk", label: "Produk", icon: Package },
  { to: "/seller/saldo", label: "Saldo", icon: Coins },
  { to: "/seller/transaksi", label: "Transaksi", icon: ShoppingBag },
] as const;

const titles: [string, string][] = [
  ["/seller/produk", "Produk Saya"], ["/seller/saldo", "Credits"], ["/seller/transaksi", "Transaksi"],
  ["/seller/withdraw", "Withdraw"], ["/seller/pembayaran", "Kontrol Pembayaran"], ["/seller/rekber", "Rekber"],
  ["/seller/garansi", "Garansi"], ["/seller/bot", "Bot Telegram"], ["/seller/voucher", "Voucher"],
  ["/seller/broadcast", "Broadcast"], ["/seller/panduan", "Panduan"], ["/seller/pengaturan", "Pengaturan"],
  ["/seller/analitik", "Analitik"], ["/seller/pelanggan", "Pelanggan"], ["/seller/program", "Program Seller"], ["/seller/iklan", "Dashboard Iklan"],
];
const titleFor = (p: string) => (p === "/seller" ? "Dasbor" : titles.find(([k]) => p.startsWith(k))?.[1] ?? "Seller Center");

/* ---------- theme (Light / Dark / System) for the seller panel ---------- */
export type SellerTheme = "light" | "dark" | "system";
const THEME_KEY = "marketku-seller-theme";
export function useSellerTheme() {
  const [theme, setTheme] = useState<SellerTheme>("dark");
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const light = theme === "light" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("seller-light", light);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => { mq.removeEventListener("change", apply); document.documentElement.classList.remove("seller-light"); };
  }, [theme]);
  const change = (t: SellerTheme) => { setTheme(t); window.localStorage.setItem(THEME_KEY, t); };
  return [theme, change] as const;
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

export type HeaderStore = { owner_id: string; store_name: string; is_open: boolean };

export function SellerHeader({ store, email, onMenu, theme, onTheme, menuOpen = false }: {
  store: HeaderStore; email: string; onMenu: () => void; theme: SellerTheme; onTheme: (t: SellerTheme) => void; menuOpen?: boolean;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/seller" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState<null | "notif" | "theme" | "profile">(null);
  const close = () => setOpen(null);
  const ref = useOutside(open !== null, close);
  const toggle = (k: NonNullable<typeof open>) => setOpen((o) => (o === k ? null : k));

  const toggleStore = async () => {
    const { error } = await supabase.from("seller_stores").update({ is_open: !store.is_open }).eq("owner_id", store.owner_id);
    if (error) { toast.error("Gagal mengubah status toko"); return; }
    toast.success(store.is_open ? "Toko ditutup" : "Toko dibuka");
    void qc.invalidateQueries({ queryKey: ["seller_store", store.owner_id] });
  };
  // Leaving Seller Center keeps the buyer session; Seller Center asks to log in again next time.
  const signOut = () => {
    close(); lockSeller(store.owner_id);
    toast.success("Keluar dari Seller Center");
    navigate({ to: "/akun", replace: true });
  };

  return (
    <header data-seller-header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div ref={ref} className="relative flex items-center gap-1 px-3 py-3">
        <button aria-label="Menu" onClick={onMenu} className={`grid h-9 w-9 place-items-center rounded-lg border transition active:scale-90 ${menuOpen ? "border-primary" : "border-transparent"}`}><Menu className="h-5 w-5" /></button>
        <h1 className="ml-1 min-w-0 truncate text-[15px] font-semibold">{titleFor(path)}</h1>
        <div className="ml-auto flex items-center gap-0.5" data-tour="topbar">
          <HeadBtn label="Muat ulang" onClick={() => { void qc.invalidateQueries(); toast("Data dimuat ulang"); }}><RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.75} /></HeadBtn>
          <HeadBtn tour="h-panduan" label="Panduan" onClick={() => { close(); startTour(); }}><HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.75} /></HeadBtn>
          <HeadBtn tour="h-notif" label="Notifikasi" active={open === "notif"} onClick={() => toggle("notif")}><Bell className="h-[18px] w-[18px]" strokeWidth={1.75} /></HeadBtn>
          <HeadBtn label="Tema" active={open === "theme"} onClick={() => toggle("theme")}><Monitor className="h-[18px] w-[18px]" strokeWidth={1.75} /></HeadBtn>
          <button data-tour="h-profile" aria-label="Menu profil" onClick={() => toggle("profile")}
            className={`ml-1 grid h-9 w-9 place-items-center rounded-full border bg-card text-sm font-semibold text-primary transition active:scale-90 ${open === "profile" ? "border-primary ring-2 ring-primary/40" : "border-primary/50"}`}>
            {store.store_name.charAt(0).toUpperCase()}
          </button>
        </div>

        {open === "notif" && (
          <Drop className="right-3 w-72">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div><p className="font-bold">Notifikasi</p><p className="text-xs text-muted-foreground">Semua sudah dibaca</p></div>
            </div>
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
          </Drop>
        )}
        {open === "theme" && (
          <Drop className="right-14 w-40 p-1">
            {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => { onTheme(k); close(); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${theme === k ? "font-semibold text-primary" : "text-foreground/85"}`}>
                <I className="h-4 w-4" /> {l}
              </button>
            ))}
          </Drop>
        )}
        {open === "profile" && (
          <Drop className="right-3 w-64">
            <div className="flex items-start justify-between border-b px-4 py-3">
              <div className="min-w-0"><p className="text-xs text-muted-foreground">Masuk sebagai</p><p className="truncate text-sm font-semibold">{email}</p></div>
              <button aria-label="Tutup" onClick={close} className="text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="px-4 pt-3 text-[11px] font-semibold tracking-widest text-muted-foreground">STATUS TOKO</p>
            <button onClick={() => void toggleStore()}
              className={`mt-2 flex w-full items-center gap-2 px-4 py-3 text-sm font-bold transition active:scale-[0.98] ${store.is_open ? "bg-success text-primary-foreground" : "bg-muted text-foreground"}`}>
              <Store className="h-4 w-4" /> <span className="flex-1 truncate text-left uppercase">{store.store_name}</span>
              <span className="text-xs">{store.is_open ? "BUKA" : "TUTUP"}</span>
            </button>
            <div className="py-1">
              <DropItem icon={UserIcon} label="Profil Toko" onClick={() => { close(); navigate({ to: "/seller/pengaturan" }); }} />
              <DropItem icon={Settings} label="Pengaturan" onClick={() => { close(); navigate({ to: "/seller/pengaturan", search: { tab: "keamanan" } }); }} />
            </div>
            <button onClick={() => void signOut()} className="flex w-full items-center gap-3 border-t px-4 py-3 text-sm text-destructive"><LogOut className="h-4 w-4" /> Keluar</button>
          </Drop>
        )}
      </div>
    </header>
  );
}

function Drop({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`absolute top-full z-40 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 ${className}`}>{children}</div>;
}
function DropItem({ icon: I, label, onClick }: { icon: typeof Package; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/90 transition active:bg-accent"><I className="h-4 w-4" /> {label}</button>;
}

function HeadBtn({ children, label, onClick, active, tour }: { children: ReactNode; label: string; onClick: () => void; active?: boolean; tour?: string }) {
  return <button data-tour={tour} aria-label={label} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-full text-foreground/90 transition active:scale-90 ${active ? "bg-accent text-primary ring-1 ring-primary/60" : ""}`}>{children}</button>;
}

export function SellerBottomNav({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-background" data-tour="bottomnav">
      <div className="flex items-stretch justify-around px-2 py-2">
        {navTabs.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} data-tour={`nav-${label.toLowerCase()}`} activeOptions={{ exact: to === "/seller" }}
            className="group relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground/80 transition-all duration-300 active:scale-95 data-[status=active]:bg-accent data-[status=active]:text-primary">
            <span className="absolute -top-2 left-1/2 h-[3px] w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 group-data-[status=active]:w-3" />
            <Icon className="h-[18px] w-[18px] transition-transform duration-300 group-active:-translate-y-1 group-data-[status=active]:-translate-y-0.5" strokeWidth={1.75} />
            <span className="hidden group-data-[status=active]:inline">{label}</span>
          </Link>
        ))}
        <button aria-label="Menu" onClick={onMenu}
          className={`group relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 active:scale-95 ${menuOpen ? "bg-accent text-primary" : "text-foreground/80"}`}>
          <Menu className="h-[18px] w-[18px] transition-transform duration-300 group-active:-translate-y-1" strokeWidth={1.75} />
          {menuOpen && <span>Menu</span>}
        </button>
      </div>
    </nav>
  );
}

type SellerPath =
  | "/seller" | "/seller/produk" | "/seller/saldo" | "/seller/transaksi" | "/seller/withdraw" | "/seller/pembayaran"
  | "/seller/rekber" | "/seller/garansi" | "/seller/bot" | "/seller/voucher" | "/seller/broadcast" | "/seller/panduan"
  | "/seller/pengaturan" | "/seller/analitik" | "/seller/pelanggan" | "/seller/program" | "/pesan" | "/dispute";
type AdTab = "campaign" | "buat" | "performa" | "saldo" | undefined;
type MenuItem = { label: string; icon: typeof Package; to?: SellerPath; badge?: string; children?: { label: string; tab: AdTab }[] };
const menuGroups: { title: string; items: MenuItem[] }[] = [
  { title: "UTAMA", items: [{ label: "Dasbor", icon: LayoutGrid, to: "/seller" }, { label: "Analitik", icon: BarChart3, to: "/seller/analitik" }] },
  { title: "MANAJEMEN TOKO", items: [
    { label: "Produk Saya", icon: Package, to: "/seller/produk" },
    { label: "Transaksi", icon: ShoppingBag, to: "/seller/transaksi" },
    { label: "Pelanggan", icon: Users, to: "/seller/pelanggan" },
    { label: "Inbox Chat", icon: MessageCircle, to: "/pesan" },
    { label: "Dispute Pesanan", icon: AlertTriangle, to: "/dispute" },
  ] },
  { title: "KEUANGAN", items: [
    { label: "Pendapatan Saya", icon: Coins, to: "/seller/withdraw" },
    { label: "Withdraw", icon: Wallet, to: "/seller/withdraw" },
    { label: "Credits", icon: Coins, to: "/seller/saldo" },
    { label: "Kontrol Pembayaran", icon: CreditCard, to: "/seller/pembayaran" },
    { label: "Rekber", icon: Handshake, to: "/seller/rekber" },
    { label: "Program Seller", icon: Gem, to: "/seller/program" },
    { label: "Garansi", icon: Shield, to: "/seller/garansi" },
  ] },
  { title: "IKLAN", items: [{ label: "Iklan", icon: Megaphone, badge: "BETA", children: [{ label: "Dashboard Iklan", tab: undefined }, { label: "Campaign", tab: "campaign" }, { label: "Buat Iklan", tab: "buat" }, { label: "Performa", tab: "performa" }, { label: "Saldo Iklan", tab: "saldo" }] }] },
  { title: "INTEGRASI", items: [
    { label: "Bot Telegram", icon: Bot, to: "/seller/bot" },
    { label: "Voucher", icon: Percent, to: "/seller/voucher" },
    { label: "Broadcast", icon: Megaphone, to: "/seller/broadcast" },
  ] },
  { title: "LAINNYA", items: [
    { label: "Grup WhatsApp", icon: MessageCircle },
    { label: "Panduan", icon: BookOpen, to: "/seller/panduan" },
    { label: "Pengaturan", icon: Settings, to: "/seller/pengaturan" },
  ] },
];

export function SellerMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  // Last tapped menu item gets the blue bar + blue icon (like panel.marketku.id), even for items without a page.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => { if (!open) setTapped(null); }, [open]);
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/seller" });
  const isActive = (to?: string) => !!to && (to === "/seller" ? path === "/seller" : path.startsWith(to));
  const signOut = async () => {
    onOpenChange(false);
    const { data } = await supabase.auth.getSession();
    if (data.session) lockSeller(data.session.user.id);
    toast.success("Keluar dari Seller Center");
    navigate({ to: "/akun", replace: true });
  };
  // The menu opens below the sticky Seller Center header (like panel.marketku.id), so the header stays visible.
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (!open) return;
    const h = document.querySelector("[data-seller-header]");
    setTop(h ? Math.max(0, Math.round(h.getBoundingClientRect().bottom)) : 0);
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ top }} className="seller-panel fixed inset-x-0 bottom-0 z-50 !bg-[var(--drawer-overlay)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content style={{ top }} className="seller-panel fixed bottom-0 left-0 z-50 flex w-[78%] max-w-[280px] flex-col border-r !bg-[var(--sheet-body)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
          <div className="flex items-center justify-between py-2.5 pl-[23px] pr-4">
            <Link to="/" onClick={() => onOpenChange(false)} className="flex items-center">
              <img src={logoMark} alt="" className="h-11 w-auto" />
              <span className="mx-3 h-8 w-px bg-foreground/25" />
              <span className="flex flex-col">
                <img src={logoWord} alt="Marketku" className="h-[22px] w-auto self-start" />
                <span className="mt-0.5 text-[9px] font-medium tracking-[0.15em] text-foreground/75">Seller Dashboard</span>
              </span>
            </Link>
            <Dialog.Title className="sr-only">Menu Seller Dashboard</Dialog.Title>
            <Dialog.Description className="sr-only">Navigasi Seller Center Marketku</Dialog.Description>
            <Dialog.Close aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-foreground/80 transition active:scale-90"><X className="h-[18px] w-[18px]" strokeWidth={1.75} /></Dialog.Close>
          </div>
          <nav className="flex-1 overflow-y-auto px-1.5 pb-2 pt-4">
            {menuGroups.map((g) => (
              <div key={g.title} className="mb-1.5">
                <p className="flex items-center gap-2 px-3.5 pb-1.5 pt-1 text-[10.5px] font-medium tracking-[0.08em] text-muted-foreground/80">
                  {g.title}<span className="h-px flex-1 bg-border/50" />
                </p>
                {g.items.map(({ label, icon: I, to, badge, children }) => {
                  const active = isActive(to);
                  const isOpen = expanded === label;
                  const marked = active || tapped === label;
                  return (
                    <div key={label}>
                      <button
                        onClick={() => {
                          setTapped(label);
                          if (children) setExpanded(isOpen ? null : label);
                          else if (to) { onOpenChange(false); navigate({ to }); }
                          else soon(label);
                        }}
                        className={`relative flex h-[35px] w-full items-center gap-3 rounded-lg px-4 text-left text-[14px] transition active:scale-[0.98] ${active ? "bg-[var(--drawer-active)] text-foreground" : "text-foreground/85"} ${isOpen ? "ring-1 ring-primary" : ""}`}>
                        {marked && <span className="absolute -left-0.5 top-1 bottom-1 w-[3px] rounded-full bg-primary" />}
                        <I className={`h-4 w-4 shrink-0 ${marked ? "text-primary" : ""}`} strokeWidth={1.6} />
                        <span className="flex-1">{label}</span>
                        {badge && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">{badge}</span>}
                        {children && <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                      </button>
                      {children && isOpen && (
                        <div className="py-1 pl-10">
                          {children.map((c) => (
                            <button key={c.label} onClick={() => { onOpenChange(false); navigate({ to: "/seller/iklan", search: c.tab ? { tab: c.tab } : {} }); }} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground/80 transition active:bg-accent">{c.label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
          <button onClick={() => void signOut()} className="flex items-center gap-3 border-t px-6 py-3.5 text-[14px] text-foreground/85 transition active:scale-[0.98]">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.6} /> Keluar
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Page title block used at the top of Seller Center pages. */
export function SellerPageTitle({ icon: I, title, desc, right }: { icon: typeof Package; title: string; desc: string; right?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 text-primary"><I className="h-5 w-5" strokeWidth={1.75} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
      </div>
      {right}
    </div>
  );
}

export function SellerInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary ${props.className ?? ""}`} />;
}

export function Chips<T extends string>({ items, value, onChange }: { items: { value: T; label: string; icon?: typeof Package }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {items.map(({ value: v, label, icon: I }) => (
        <button key={v} onClick={() => onChange(v)}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-95 ${value === v ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/80"}`}>
          {I && <I className="h-3.5 w-3.5" />}{label}
        </button>
      ))}
    </div>
  );
}


/** Bottom sheet used by Seller Center forms (garansi, diskon, kategori, dll). */
export function SellerSheet({ open, onOpenChange, title, children, footer, className = "", actions, subheader, full = false }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; children: ReactNode; footer?: ReactNode; className?: string;
  /** Extra square buttons left of close (panel style). */
  actions?: ReactNode;
  /** Content shown under the title inside the header (e.g. status card). */
  subheader?: ReactNode;
  /** Full-screen panel page instead of a bottom sheet. */
  full?: boolean;
}) {
  const boxed = actions !== undefined;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined}
          className={`seller-panel fixed z-50 mx-auto flex max-w-md flex-col ${full ? "inset-0 !bg-[var(--sheet-body)]" : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border bg-card shadow-2xl"} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom ${className}`}>
          <div className={`border-b ${full ? "bg-[var(--sheet-head)] px-4 pb-3 pt-2.5" : "px-5 py-4"}`}>
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="min-w-0 text-base font-bold">{title}</Dialog.Title>
              <div className="flex shrink-0 items-center gap-2">
                {actions}
                <Dialog.Close aria-label="Tutup" className={boxed ? "grid h-8 w-8 place-items-center rounded-lg border text-foreground/80 transition active:scale-90" : "grid h-8 w-8 place-items-center rounded-full text-foreground/80 transition active:scale-90"}><X className={boxed ? "h-3.5 w-3.5" : "h-5 w-5"} /></Dialog.Close>
              </div>
            </div>
            {subheader && <div className="mt-3">{subheader}</div>}
          </div>
          <div className={`flex-1 overflow-y-auto ${full ? "px-4 py-2" : "px-5 py-4"}`}>{children}</div>
          {footer && <div className={`flex items-center justify-between gap-2 border-t ${full ? "px-4 py-2.5" : "px-5 py-4"}`}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SellerCard({ children, className = "", ...rest }: HTMLAttributes<HTMLElement> & { "data-tour"?: string }) {
  return <section {...rest} className={`rounded-2xl border bg-card ${className}`}>{children}</section>;
}

export function ActionRow({ icon: I, title, desc, onClick }: { icon: typeof Package; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border bg-background/40 px-3 py-3 text-left transition active:scale-[0.98]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent"><I className="h-4 w-4" strokeWidth={1.75} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
    </button>
  );
}

export function StatCell({ icon: I, label, value, sub, valueClass = "" }: { icon: typeof Package; label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs text-foreground/80"><I className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} /> <span className="truncate">{label}</span></p>
      <p className={`mt-1 text-base font-semibold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SellerEmpty({ icon: I, title, desc, action }: { icon: typeof Package; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary"><I className="h-5 w-5" strokeWidth={1.75} /></span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
