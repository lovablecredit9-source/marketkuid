import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronLeft, ExternalLink, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";

const TABS = [
  { to: "/bantuan", label: "Bantuan" },
  { to: "/syarat", label: "Syarat" },
  { to: "/privasi", label: "Privasi" },
  { to: "/kontak", label: "Kontak" },
] as const;

export type LegalLink = { label: string; to?: (typeof TABS)[number]["to"]; href?: string; primary?: boolean };

export function LegalPage({ badge, title, intro, links, children }: { badge: string; title: string; intro: string; links: LegalLink[]; children: ReactNode }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="space-y-3 px-3 pt-3">
        <div className="flex items-center gap-2">
          <button aria-label="Kembali" onClick={() => router.history.back()} className="grid h-9 w-9 place-items-center rounded-full border bg-card transition active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
          <nav className="flex flex-1 gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <Link key={t.to} to={t.to} className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold underline-offset-2 transition active:scale-95 data-[status=active]:border-primary/40 data-[status=active]:bg-accent data-[status=active]:text-primary">{t.label}</Link>
            ))}
          </nav>
          <button aria-label="Muat ulang" onClick={() => router.invalidate()} className="grid h-9 w-9 place-items-center rounded-full border bg-card transition active:rotate-180"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">{badge}</span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">{intro}</p>
          <div className="mt-4 space-y-2">
            {links.map((l) => {
              const cls = `flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition active:scale-[0.98] ${l.primary ? "bg-primary text-primary-foreground" : "border bg-card"}`;
              return l.href
                ? <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={cls}>{l.label} <ExternalLink className="h-3.5 w-3.5" /></a>
                : <Link key={l.label} to={l.to!} className={cls}>{l.label}</Link>;
            })}
          </div>
        </section>
        {children}
      </div>
    </AppShell>
  );
}

export function LegalCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return <ul className="space-y-1.5 pl-1">{items.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />{i}</li>)}</ul>;
}
