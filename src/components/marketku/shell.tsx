import * as Dialog from "@radix-ui/react-dialog";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, Search, ShoppingCart, Menu, Home, Package, MessageCircle, User, ChevronRight, X, Handshake, Clock, ShieldAlert,
  Heart, LayoutGrid, HelpCircle, Moon, Store, ArrowUp, GitCompareArrows, Smartphone,
} from "lucide-react";
import { VoiceSearchButton } from "@/components/marketku/voice-search";
import { useInstallApp } from "@/components/marketku/install-app";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/products";
import { toast } from "sonner";
import logo from "@/assets/logo-marketku.png.asset.json";
import { toneClass, useSellerStore, type Tone } from "@/lib/seller";
import { useCart } from "@/lib/market";
import { supportWaUrl } from "@/lib/support";
import { useUnreadChats } from "@/lib/chat";
import { BanScreen, useAccountBan } from "@/components/marketku/ban-gate";
import { SearchSuggest } from "@/components/marketku/search-suggest";

export const soon = (label: string) => toast(`${label} segera hadir`);

export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <Link to="/" aria-label="Marketku beranda">
      <img src={logo.url} alt="Marketku" className={`${className} w-auto dark:rounded-md dark:bg-foreground dark:px-1`} />
    </Link>
  );
}

const DARK_KEY = "marketku-dark";
/** Toggle and persist the buyer app dark theme. */
export function toggleDark() {
  const on = document.documentElement.classList.toggle("dark");
  window.localStorage.setItem(DARK_KEY, on ? "1" : "0");
  return on;
}
function useStoredDark() {
  useEffect(() => {
    if (window.localStorage.getItem(DARK_KEY) === "1") document.documentElement.classList.add("dark");
  }, []);
}

export function NotifDrop({ onClose, className = "" }: { onClose: () => void; className?: string }) {
  return (
    <>
      <button aria-label="Tutup notifikasi" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div className={`absolute z-50 mt-2 w-72 overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 ${className}`}>
        <div className="flex items-start justify-between border-b px-4 py-3">
          <div><p className="font-bold">Notifikasi</p><p className="text-xs text-muted-foreground">Semua sudah dibaca</p></div>
          <button onClick={onClose} className="text-xs font-semibold text-primary">Hapus semua</button>
        </div>
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
      </div>
    </>
  );
}

/** True once the page has scrolled past `y` px (used to fold the home search bar into an icon). */
function useScrolledPast(y: number, enabled: boolean) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const on = () => setPast(window.scrollY > y);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [y, enabled]);
  return past;
}

export function Header({ title, showSupport = true, homeSearch = false }: { title?: string | undefined; showSupport?: boolean; homeSearch?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notif, setNotif] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [suggest, setSuggest] = useState(false);
  const cart = useCart();
  const cartCount = cart.data?.length ?? 0;
  const folded = useScrolledPast(40, homeSearch);
  const showBar = homeSearch && !folded;
  if (title) {
    return (
      <header className="relative z-30 mx-auto max-w-md px-3 pb-2 pt-3 lg:hidden">
        <div className="relative flex items-center gap-3 rounded-2xl border bg-card px-3 py-2 shadow-sm">
          <Logo className="h-8" />
          <span className="mk-acc-heading border-l pl-3 text-sm font-semibold">{title}</span>
          <button onClick={() => setNotif(!notif)} aria-label="Notifikasi" aria-expanded={notif} className={`mk-clay-icon ml-auto grid h-9 w-9 place-items-center rounded-full border transition active:scale-90 ${notif ? "is-open border-primary" : ""}`}>
            <Bell className="h-4 w-4" />
          </button>
          {notif && <NotifDrop onClose={() => setNotif(false)} className="right-0 top-full" />}
        </div>
      </header>
    );
  }
  const spacer = (showSupport ? 94 : 54) + (homeSearch ? 44 : 0);
  return (
    <><div aria-hidden className="lg:hidden" style={{ height: spacer }} /><header className="fixed inset-x-0 top-0 z-30 mx-auto max-w-md border-b lg:hidden bg-card shadow-[0_6px_10px_-8px_hsl(0_0%_0%/0.18)]">
      <div className="relative flex items-center gap-1 px-3 py-2">
        <Logo className="h-9" />
        <div className="ml-auto flex items-center">
          {user && <IconBtn label="Notifikasi" open={notif} onClick={() => setNotif(!notif)}><Bell className="h-5 w-5" /></IconBtn>}
          {!showBar && <span className="mk-fade-in"><IconBtn label="Cari" onClick={() => navigate({ to: "/cari" })}><Search className="h-5 w-5" /></IconBtn></span>}
          <IconBtn label="Keranjang" onClick={() => navigate({ to: "/keranjang" })}>
            <span className="relative"><ShoppingCart className="h-6 w-6" />{cartCount > 0 && <span key={cartCount} className="mk-badge-pop absolute -right-2.5 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-card bg-destructive px-1 text-[10px] font-black leading-none text-destructive-foreground">{cartCount > 99 ? "99+" : cartCount}</span>}</span>
          </IconBtn>
          <IconBtn label="Menu" open={menu} onClick={() => setMenu(true)}><Menu className="h-5 w-5" /></IconBtn>
        </div>
        {notif && <NotifDrop onClose={() => setNotif(false)} className="right-3 top-full" />}
      </div>
      {homeSearch && (
        <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${showBar ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <form aria-hidden={!showBar} className="overflow-hidden px-3" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/cari", search: q.trim() ? { q: q.trim() } : {} }); }}>
            <label className="mb-2 flex h-9 items-center gap-2.5 rounded-xl border bg-card px-3 shadow-sm">
              <Search className="h-[18px] w-[18px] text-muted-foreground" />
              <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setSuggest(true); }} onFocus={() => setSuggest(true)} onBlur={() => setSuggest(false)} tabIndex={showBar ? 0 : -1} placeholder="Cari produk digital..." className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
              {showBar && <VoiceSearchButton onResult={(t) => navigate({ to: "/cari", search: { q: t } })} />}
            </label>
          </form>
        </div>
      )}
      {homeSearch && showBar && suggest && q.trim() && (
        <div className="relative px-3">
          <SearchSuggest q={q} className="absolute inset-x-3 top-0"
            onPick={() => { setSuggest(false); setQ(""); }}
            onAll={() => { setSuggest(false); navigate({ to: "/cari", search: { q: q.trim() } }); }} />
        </div>
      )}
      {showSupport && <a href={supportWaUrl()} target="_blank" rel="noopener noreferrer" className="block border-t py-2 text-center text-sm font-semibold transition active:bg-accent">Bantuan</a>}
      <SideMenu open={menu} onOpenChange={setMenu} />
    </header></>
  );
}

/** Laptop/desktop top bar like marketku.id: logo, wide search with "Cari", icon pill, Jadi Seller and Masuk/Daftar (or Akun). */
export function DesktopHeader({ showSupport = true }: { showSupport?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const store = useSellerStore(user?.id);
  const cart = useCart();
  const cartCount = cart.data?.length ?? 0;
  const unread = useUnreadChats(user?.id).data?.total ?? 0;
  const [q, setQ] = useState("");
  const [suggest, setSuggest] = useState(false);
  const [notif, setNotif] = useState(false);
  const submit = () => { setSuggest(false); navigate({ to: "/cari", search: q.trim() ? { q: q.trim() } : {} }); };
  const icons = [
    { label: "Wishlist", icon: Heart, go: () => navigate({ to: "/wishlist" }) },
    { label: "Pesanan", icon: Package, go: () => navigate({ to: "/riwayat" }) },
    { label: "Pesan", icon: MessageCircle, go: () => navigate({ to: "/pesan" }), badge: unread },
    { label: "Keranjang", icon: ShoppingCart, go: () => navigate({ to: "/keranjang" }), badge: cartCount },
    { label: "Mode gelap", icon: Moon, go: () => { toggleDark(); } },
  ];
  return (
    <header className="sticky top-0 z-30 hidden border-b bg-card/95 backdrop-blur lg:block">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-5 px-5">
        <Logo className="h-9" />
        <form className="relative ml-auto w-full max-w-[540px]" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="flex h-9 items-center gap-2.5 rounded-full border bg-card pl-3.5 pr-1 shadow-sm focus-within:border-primary">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setSuggest(true); }} onFocus={() => setSuggest(true)} onBlur={() => setSuggest(false)}
              placeholder="Cari produk digital, template, lisensi..." aria-label="Cari produk" className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
            <button type="submit" className="h-7 shrink-0 rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground transition active:scale-95">Cari</button>
          </label>
          {suggest && q.trim() && (
            <SearchSuggest q={q} className="absolute inset-x-0 top-full mt-1"
              onPick={() => { setSuggest(false); setQ(""); }}
              onAll={submit} />
          )}
        </form>
        <div className="relative flex shrink-0 items-center gap-0.5 rounded-full border bg-card px-1.5 py-1 shadow-sm">
          {user && (
            <button type="button" aria-label="Notifikasi" aria-expanded={notif} onClick={() => setNotif(!notif)} className={`mk-clay-icon grid h-9 w-9 place-items-center rounded-full text-foreground/85 hover:bg-accent ${notif ? "is-open" : ""}`}><Bell className="h-5 w-5" /></button>
          )}
          {icons.map(({ label, icon: I, go, badge }) => (
            <button key={label} type="button" aria-label={label} title={label} onClick={go} className="mk-clay-icon relative grid h-9 w-9 place-items-center rounded-full text-foreground/85 hover:bg-accent">
              <I className="h-5 w-5" />
              {!!badge && badge > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-black leading-none text-destructive-foreground">{badge > 99 ? "99+" : badge}</span>}
            </button>
          ))}
          {notif && <NotifDrop onClose={() => setNotif(false)} className="right-0 top-full" />}
        </div>
        <Link to={store.data ? "/seller" : "/jadi-seller"} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-accent px-3 text-[13.5px] font-bold text-primary transition hover:bg-primary/15">
          <Store className="h-4 w-4" /> {store.data ? "Seller Center" : "Jadi Seller"}
        </Link>
        {user ? (
          <Link to="/akun" className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-[13.5px] font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90">
            <User className="h-4 w-4" /> Akun
          </Link>
        ) : (
          <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Link to="/login" className="flex h-full items-center gap-1.5 px-3 text-[12px] font-semibold opacity-90 transition hover:bg-primary-foreground/10"><User className="h-4 w-4" /> Masuk</Link>
            <span className="h-5 w-px bg-primary-foreground/30" />
            <Link to="/register" className="flex h-full items-center px-3 text-[13.5px] font-bold transition hover:bg-primary-foreground/10">Daftar</Link>
          </div>
        )}
      </div>
      {showSupport && (
        <div className="border-t">
          <div className="mx-auto max-w-[1240px] px-5">
            <a href={supportWaUrl()} target="_blank" rel="noopener noreferrer" className="inline-block py-2 pl-[88px] text-[13px] font-semibold transition hover:text-primary">Bantuan</a>
          </div>
        </div>
      )}
    </header>
  );
}

const sideLinks = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/rekber", label: "Rekber", icon: Handshake },
  { to: "/riwayat", label: "Riwayat", icon: Clock },
  { to: "/pesan", label: "Pesan", icon: MessageCircle },
  { to: "/dispute", label: "Dispute", icon: ShieldAlert },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/toko-diikuti", label: "Toko Diikuti", icon: Store },
  { to: "/bandingkan", label: "Bandingkan Produk", icon: GitCompareArrows },
  { to: "/cari", label: "Kategori", icon: LayoutGrid },
  { to: "/bantuan", label: "Bantuan", icon: HelpCircle },
] as const;

export function SideMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cats = useCategories();
  const store = useSellerStore(user?.id);
  const profile = useQuery({
    queryKey: ["profile", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("full_name, username, created_at").eq("id", user!.id).maybeSingle()).data,
  });
  const name = profile.data?.full_name || user?.email?.split("@")[0];
  const go = (fn: () => void) => { onOpenChange(false); fn(); };
  const app = useInstallApp();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 right-0 z-50 flex w-[70%] max-w-[300px] flex-col bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="flex items-center justify-between px-3.5 pt-3.5">
            <img src={logo.url} alt="Marketku" className="h-8 w-auto" />
            <Dialog.Title className="sr-only">Menu Marketku</Dialog.Title>
            <Dialog.Close aria-label="Tutup menu" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition active:scale-90"><X className="h-[18px] w-[18px]" /></Dialog.Close>
          </div>
          <div className="space-y-2 px-3.5 pt-3">
            {user ? (
              <>
                {name && <p className="flex items-center gap-2 pb-1 text-[13px] font-bold uppercase"><User className="h-4 w-4" /> {name}</p>}
                <button onClick={() => go(() => navigate({ to: "/akun" }))} className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent/60 py-2 text-[12.5px] font-bold text-primary transition active:scale-[0.98]"><User className="h-4 w-4" /> Profil & Saldo</button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => go(() => navigate({ to: "/login" }))} className="rounded-lg border border-primary/20 bg-accent py-2 text-[12.5px] font-bold text-primary transition active:scale-[0.98]">Masuk</button>
                <button onClick={() => go(() => navigate({ to: "/register" }))} className="rounded-lg bg-primary py-2 text-[12.5px] font-bold text-primary-foreground transition active:scale-[0.98]">Daftar</button>
              </div>
            )}
            <div className="border-t pt-2">
              {store.data ? (
                <button onClick={() => go(() => navigate({ to: "/seller" }))} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-accent py-2 text-[12.5px] font-bold text-primary transition active:scale-[0.98]"><Store className="h-4 w-4" /> Seller Center</button>
              ) : (
                <button onClick={() => go(() => navigate({ to: "/jadi-seller" }))} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-accent py-2 text-[12.5px] font-bold text-primary transition active:scale-[0.98]"><Store className="h-4 w-4" /> Mulai Jualan</button>
              )}
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-2.5 py-1.5">
            {sideLinks.map(({ to, label, icon: I }) => (
              <Link key={label} to={to} onClick={() => onOpenChange(false)} activeOptions={{ exact: true }}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium text-foreground/85 transition active:scale-[0.98] data-[status=active]:bg-accent data-[status=active]:text-primary">
                <I className="h-[17px] w-[17px]" strokeWidth={1.75} /> {label}
              </Link>
            ))}
            <button onClick={() => toggleDark()} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium text-foreground/85 transition active:scale-[0.98]">
              <Moon className="h-[17px] w-[17px]" strokeWidth={1.75} /> Mode Gelap
            </button>
            {!app.installed && (
              <button onClick={() => go(() => void app.install())} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium text-primary transition active:scale-[0.98]">
                <Smartphone className="h-[17px] w-[17px]" strokeWidth={1.75} /> Pasang Aplikasi
              </button>
            )}
            {(cats.data?.length ?? 0) > 0 && (
              <div className="mt-1.5 border-t px-1 pt-3">
                <p className="pb-2 text-[10px] font-bold tracking-[0.08em] text-muted-foreground">KATEGORI POPULER</p>
                <div className="flex flex-wrap gap-1.5">
                  {cats.data!.slice(0, 10).map((c) => (
                    <button key={c.id} onClick={() => go(() => navigate({ to: "/cari", search: { kategori: c.id } }))} className="rounded-md border bg-muted/40 px-2 py-1 text-[11.5px] font-medium transition active:scale-95">{c.name}</button>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Header icon button: clay shadow, lifts on hover, presses on tap, bounces once when tapped and glows blue while its panel is open. */
function IconBtn({ children, label, onClick, open = false }: { children: ReactNode; label: string; onClick: () => void; open?: boolean }) {
  const [bump, setBump] = useState(0);
  return (
    <button
      onClick={() => { setBump((n) => n + 1); onClick(); }}
      onAnimationEnd={() => setBump(0)}
      aria-label={label}
      aria-expanded={open || undefined}
      className={`mk-clay-icon grid h-10 w-10 place-items-center rounded-full text-foreground/85 hover:bg-accent ${open ? "is-open" : ""} ${bump ? "is-bump" : ""}`}
    >
      {children}
    </button>
  );
}

// Same tabs and order as marketku.id: signed-out visitors get 3 tabs, signed-in users also get Pesan.
const GUEST_TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/riwayat", label: "Pesanan", icon: Package },
  { to: "/akun", label: "Akun", icon: User },
] as const;
const USER_TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/riwayat", label: "Pesanan", icon: Package },
  { to: "/pesan", label: "Pesan", icon: MessageCircle },
  { to: "/akun", label: "Akun", icon: User },
] as const;

export function BottomNav() {
  const { user } = useAuth();
  const unread = useUnreadChats(user?.id).data?.total ?? 0;
  const tabs = user ? USER_TABS : GUEST_TABS;
  return (
    <nav aria-label="Navigasi utama" className="mk-acc-heading lg:hidden fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md justify-center px-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+6px)]">
      <div className="mk-nav-pill grid w-full max-w-[400px] grid-flow-col auto-cols-fr gap-0.5 rounded-[17px] border p-1">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/", includeSearch: false }}
            className="group relative flex min-h-12 flex-col items-center justify-center gap-[3px] overflow-hidden rounded-[13px] px-[3px] pb-1 pt-[5px] text-foreground transition-[color,background-color,transform] duration-200 active:translate-y-px data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
          >
            <span className="absolute left-1/2 top-0 h-0.5 w-0 -translate-x-1/2 rounded-b-[1px] bg-primary transition-[width] duration-300 ease-out group-data-[status=active]:w-[38%]" />
            <span className="relative inline-flex">
              <Icon strokeWidth={2.1} className="mk-nav-icon h-[19px] w-[19px]" />
              {to === "/pesan" && unread > 0 && (
                <span key={unread} aria-label={`${unread} pesan belum dibaca`} className="mk-badge-pop absolute -right-[9px] -top-[5px] h-3.5 min-w-3.5 rounded-full border-[1.5px] border-card bg-destructive px-[3px] text-center text-[8px] font-bold leading-[11px] text-destructive-foreground">
                  {Math.min(99, unread)}
                </span>
              )}
            </span>
            <span className="max-w-full truncate text-[9.5px] font-semibold leading-[1.15] tracking-[0.01em]">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * Page frame. Phones get the mobile header + bottom tabs; laptops/desktops (lg+) get the marketku.id
 * desktop top bar and no bottom tabs. `wide` pages (home, search, product, store…) use the full
 * 1180px content width on desktop; the rest stay a centred column.
 */
export function AppShell({ children, title, nav = true, header = true, showSupport = true, homeSearch = false, className = "", wide = false }: { children: ReactNode; title?: string; nav?: boolean; header?: boolean; showSupport?: boolean; homeSearch?: boolean; className?: string; wide?: boolean }) {
  useStoredDark();
  const ban = useAccountBan();
  return (
    <div className={`mx-auto min-h-screen max-w-md bg-background lg:max-w-none ${className}`}>
      <DesktopHeader showSupport={header && showSupport && !title} />
      {header && <Header title={title} showSupport={showSupport} homeSearch={homeSearch} />}
      <main className={`${nav ? "pb-28" : "pb-8"} lg:mx-auto lg:pb-12 ${wide ? "lg:max-w-[1220px] lg:px-5" : "lg:max-w-3xl lg:px-5 lg:pt-4"}`}>{ban ? <BanScreen ban={ban} /> : children}</main>
      {nav && <BottomNav />}
      {nav && <BackToTop />}
    </div>
  );
}

/** Round "Kembali ke atas" button that appears after scrolling past 320px, like marketku.id. */
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 320);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return (
    <button type="button" className="mk-back-to-top" aria-label="Kembali ke atas" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      <ArrowUp className="h-[18px] w-[18px]" />
    </button>
  );
}

export function EmptyState({ icon: Icon, title, desc, action }: { icon: typeof Home; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-xl bg-accent text-primary"><Icon className="h-6 w-6" /></div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PrimaryLink({ to, children }: { to: "/" | "/cari" | "/login"; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md">
      {children}
    </Link>
  );
}

export function MenuRow({ icon: Icon, title, desc, onClick, tone = "blue" }: { icon: typeof Home; title: string; desc: string; onClick?: () => void; tone?: Tone }) {
  return (
    <button onClick={onClick ?? (() => soon(title))} className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition active:scale-[0.98]">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${toneClass[tone]}`}><Icon className="h-3.5 w-3.5" /></span>
      <span className="flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-3">
      <h3 className="mb-2 text-[10px] font-bold tracking-widest text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");
