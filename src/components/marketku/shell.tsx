import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bell, Search, ShoppingCart, Menu, Home, Package, MessageCircle, User, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-marketku.png.asset.json";

export const soon = (label: string) => toast(`${label} segera hadir`);

export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <Link to="/" aria-label="Marketku beranda">
      <img src={logo.url} alt="Marketku" className={`${className} w-auto`} />
    </Link>
  );
}

export function Header({ title }: { title?: string | undefined }) {
  const navigate = useNavigate();
  if (title) {
    return (
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-2 shadow-sm">
          <Logo className="h-8" />
          <span className="border-l pl-3 text-sm font-semibold">{title}</span>
          <button onClick={() => soon("Notifikasi")} aria-label="Notifikasi" className="ml-auto grid h-9 w-9 place-items-center rounded-full border">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-30 border-b bg-card">
      <div className="flex items-center gap-1 px-3 py-2">
        <Logo className="h-9" />
        <div className="ml-auto flex items-center">
          <IconBtn label="Notifikasi" onClick={() => soon("Notifikasi")}><Bell className="h-5 w-5" /></IconBtn>
          <IconBtn label="Cari" onClick={() => navigate({ to: "/cari" })}><Search className="h-5 w-5" /></IconBtn>
          <IconBtn label="Keranjang" onClick={() => navigate({ to: "/keranjang" })}><ShoppingCart className="h-5 w-5" /></IconBtn>
          <IconBtn label="Menu" onClick={() => navigate({ to: "/akun" })}><Menu className="h-5 w-5" /></IconBtn>
        </div>
      </div>
    </header>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid h-10 w-10 place-items-center rounded-full text-foreground hover:bg-accent">
      {children}
    </button>
  );
}

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/riwayat", label: "Pesanan", icon: Package },
  { to: "/pesan", label: "Pesan", icon: MessageCircle },
  { to: "/akun", label: "Akun", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-3">
      <div className="grid grid-cols-4 rounded-2xl border bg-card p-1 shadow-lg">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="group relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-semibold text-foreground transition-colors duration-300 active:scale-95 data-[status=active]:bg-accent data-[status=active]:text-primary"
          >
            <span className="absolute -top-1 left-1/2 h-[3px] w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 ease-out group-data-[status=active]:w-1/2" />
            <Icon className="h-5 w-5 transition-transform duration-300 ease-out group-active:-translate-y-1 group-data-[status=active]:-translate-y-0.5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function AppShell({ children, title, nav = true }: { children: ReactNode; title?: string; nav?: boolean }) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      <Header title={title} />
      <main className={nav ? "pb-28" : "pb-8"}>{children}</main>
      {nav && <BottomNav />}
    </div>
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

export function PrimaryLink({ to, children }: { to: "/" | "/cari"; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md">
      {children}
    </Link>
  );
}

export function MenuRow({ icon: Icon, title, desc, onClick }: { icon: typeof Home; title: string; desc: string; onClick?: () => void }) {
  return (
    <button onClick={onClick ?? (() => soon(title))} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><Icon className="h-4 w-4" /></span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h3 className="mb-3 text-xs font-bold tracking-widest text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");
