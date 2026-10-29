import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Search, Zap, ShieldCheck, Headphones, Package, BadgePercent, Facebook, Instagram, Twitter, Youtube, Heart, Star,
  Sparkles, TrendingUp, Clock, Gamepad2, ArrowRight, ChevronDown, Bot, AppWindow, Cloud, Palette, MoreHorizontal,
  Smartphone, Users, Cpu, Tv, Wrench, LayoutGrid, type LucideIcon,
} from "lucide-react";
import logo from "@/assets/logo-marketku.png.asset.json";
import { AppShell, EmptyState, soon } from "@/components/marketku/shell";
import { ProductImage, rpBuyer, useToggleWishlist, useWishlistIds } from "@/components/marketku/product-card";
import { useMarketProducts, type CardProduct } from "@/lib/market";
import { useCategories, useImageUrls } from "@/lib/products";
import { BRAND_GROUPS, CATEGORY_IMAGES, HOME_BANNERS } from "@/lib/home-assets";

type FLink = { label: string; to?: "/cari" | "/akun" | "/seller" | "/seller/panduan" | "/bantuan" | "/syarat" | "/privasi" | "/kontak" };
const FOOTER: { title: string; links: FLink[] }[] = [
  { title: "Marketplace", links: [{ label: "Semua Produk", to: "/cari" }, { label: "Flash Sale" }, { label: "Best Seller" }, { label: "Kategori", to: "/cari" }] },
  { title: "Seller", links: [{ label: "Mulai Jualan", to: "/akun" }, { label: "Seller Center", to: "/seller" }, { label: "Panduan Seller", to: "/seller/panduan" }, { label: "Biaya Layanan", to: "/syarat" }] },
  { title: "Bantuan", links: [{ label: "Pusat Bantuan", to: "/bantuan" }, { label: "Syarat & Ketentuan", to: "/syarat" }, { label: "Kebijakan Privasi", to: "/privasi" }, { label: "Hubungi Kami", to: "/kontak" }] },
];

const CAT_ICON: Record<string, LucideIcon> = {
  "AI Tools": Bot, Aplikasi: AppWindow, Cloud, "Design & Kreatif": Palette, "Game Online": Gamepad2, Lainnya: MoreHorizontal,
  PPOB: Smartphone, "Social Media": Users, Software: Cpu, Streaming: Tv, Tools: Wrench,
};
const GAMES = ["Roblox", "Free Fire", "Mobile Legends", "PUBG"] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marketku — Belanja Produk Digital" },
      { name: "description", content: "Beranda Marketku: cari dan beli produk digital dengan aman." },
      { property: "og:title", content: "Marketku — Belanja Produk Digital" },
      { property: "og:description", content: "Cari dan beli produk digital dengan aman di Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const products = useMarketProducts({ limit: 60 });
  const list = useMemo(() => products.data ?? [], [products.data]);
  const urls = useImageUrls([...new Set(list.map((p) => p.images[0] ?? "").filter(Boolean))]);
  const urlOf = (p: CardProduct) => (p.images[0] ? urls.data?.[p.images[0]] : undefined);

  const liked = useMemo(() => [...list].sort((a, b) => b.likes - a.likes || b.sold_count - a.sold_count || b.rating.avg - a.rating.avg), [list]);
  const best = useMemo(() => list.filter((p) => p.sold_count > 0).sort((a, b) => b.sold_count - a.sold_count).slice(0, 10), [list]);
  const fresh = useMemo(() => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10), [list]);
  const banners = useMemo(() => list.filter((p) => p.images.length > 0).slice(0, 5), [list]);

  return (
    <AppShell>
      <form className="px-3 pt-3" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/cari", search: { q } }); }}>
        <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk digital..." className="w-full bg-transparent text-sm outline-none" />
        </label>
      </form>

      <div className="space-y-5 px-3 pt-3">
        <Banner />

        {list.length > 0 && <Ticker items={list.slice(0, 12)} urlOf={urlOf} />}

        <CategoryStrip />

        {BRAND_GROUPS.map((g) => <BrandGroup key={g.title} group={g} />)}

        {products.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : !list.length ? (
          <EmptyState icon={Package} title="Belum ada produk" desc="Produk akan tampil di sini setelah seller menambahkannya." />
        ) : (
          <>
            <LikedSection items={liked} urlOf={urlOf} />

            <Section icon={TrendingUp} tone="bg-warning text-foreground" kicker="Paling laku hari ini" title="Produk Terlaris" to="/cari">
              {best.length ? (
                <Rail>{best.map((p, i) => <MiniCard key={p.id} p={p} url={urlOf(p)} rank={i + 1} />)}</Rail>
              ) : (
                <p className="px-3 pb-4 text-sm text-muted-foreground">Belum ada produk yang terjual. Produk terlaris muncul setelah ada transaksi.</p>
              )}
            </Section>

            <Section icon={Clock} tone="bg-success text-primary-foreground" kicker="Baru ditambahkan" title="Produk Baru" to="/cari">
              <Rail>{fresh.map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} />)}</Rail>
            </Section>

            <GameSection items={list} urlOf={urlOf} />
          </>
        )}

        <section className="space-y-1 rounded-2xl border bg-card p-2">
          {[
            { icon: Zap, t: "Kirim Instan", d: "Otomatis setelah bayar" },
            { icon: ShieldCheck, t: "Transaksi Aman", d: "Terenkripsi SSL" },
            { icon: BadgePercent, t: "Diskon Tiap Hari", d: "Promo eksklusif" },
            { icon: Headphones, t: "Support 24/7", d: "Selalu siap bantu" },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="flex items-center gap-3 p-2">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><I className="h-5 w-5" /></span>
              <span><span className="block text-sm font-bold">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
            </div>
          ))}
        </section>
      </div>

      <footer className="mt-6 bg-primary px-5 pb-8 pt-8 text-primary-foreground">
        <img src={logo.url} alt="Marketku" className="h-9 w-auto brightness-0 invert" />
        <p className="mt-4 text-sm leading-relaxed opacity-90">Marketplace untuk beli dan jual produk digital dengan mudah dan cepat.</p>
        <div className="mt-4 flex gap-2">
          {[Facebook, Instagram, Twitter, Youtube].map((I, n) => (
            <button key={n} aria-label="Media sosial" onClick={() => soon("Media sosial Marketku")} className="grid h-9 w-9 place-items-center rounded-lg border border-primary-foreground/30 transition active:scale-90"><I className="h-4 w-4" /></button>
          ))}
        </div>
        {FOOTER.map((col) => (
          <div key={col.title} className="mt-7">
            <h3 className="font-bold">{col.title}</h3>
            <ul className="mt-3 space-y-2.5 text-sm opacity-90">
              {col.links.map((l) => <li key={l.label}>{l.to ? <Link to={l.to}>{l.label}</Link> : <button onClick={() => soon(l.label)}>{l.label}</button>}</li>)}
            </ul>
          </div>
        ))}
        <div className="mt-8 border-t border-primary-foreground/20 pt-5">
          <p className="text-xs font-bold tracking-widest opacity-80">METODE PEMBAYARAN</p>
          <span className="mt-3 inline-block rounded-lg bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold">QRIS — Support ewallet dan bank</span>
        </div>
        <p className="mt-6 text-xs opacity-70">© {new Date().getFullYear()} Marketku. Marketplace produk digital.</p>
      </footer>
    </AppShell>
  );
}

/** Auto-sliding promo banners supplied by the owner. */
function Banner() {
  const items = HOME_BANNERS;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % items.length), 4000);
    return () => window.clearInterval(t);
  }, [items.length]);
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm" data-tour="banner">
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {items.map((b) => (
          <Link key={b.src} to={b.to} search={"q" in b ? { q: b.q } : undefined} className="block w-full shrink-0" aria-label={b.alt}>
            <img src={b.src} alt={b.alt} className="aspect-[4/1] w-full object-cover" />
          </Link>
        ))}
      </div>
      {items.length > 1 && (
        <div className="absolute bottom-2 right-3 flex gap-1.5 rounded-full bg-foreground/40 px-1.5 py-1">
          {items.map((b, n) => (
            <button key={b.src} aria-label={`Banner ${n + 1}`} onClick={() => setI(n)} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-card" : "w-1.5 bg-card/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Ticker({ items, urlOf }: { items: CardProduct[]; urlOf: (p: CardProduct) => string | undefined }) {
  const row = (k: string) => items.map((p) => (
    <Link key={`${k}${p.id}`} to="/produk/$id" params={{ id: p.id }} className="flex shrink-0 items-center gap-2 border-r px-4 text-sm font-semibold uppercase last:border-r-0">
      {urlOf(p) && <img src={urlOf(p)} alt="" className="h-7 w-7 rounded-full object-cover" />}
      {p.name} <span className="text-muted-foreground">-</span> <span className="text-primary">{rpBuyer(p.minPrice)}</span>
    </Link>
  ));
  return (
    <div className="overflow-hidden py-1">
      <div className="mk-marquee flex w-max">{row("a")}{row("b")}</div>
    </div>
  );
}

function CategoryStrip() {
  const cats = useCategories();
  if (!cats.data?.length) return null;
  return (
    <div className="-mx-3 flex overflow-x-auto px-3 py-1 [scrollbar-width:none]" data-tour="kategori">
      {cats.data.map((c) => {
        const I = CAT_ICON[c.name] ?? LayoutGrid;
        const img = CATEGORY_IMAGES[c.name];
        return (
          <Link key={c.id} to="/cari" search={{ kategori: c.id }} className="flex shrink-0 items-center gap-2.5 border-r px-4 text-sm font-medium transition last:border-r-0 active:scale-95">
            {img ? (
              <img src={img} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-primary"><I className="h-4 w-4" /></span>
            )}
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}

/** Brand shortcuts (AI, App Premium) — each brand opens the search for that name. */
function BrandGroup({ group }: { group: (typeof BRAND_GROUPS)[number] }) {
  const cats = useCategories();
  const cat = cats.data?.find((c) => c.name === group.category);
  return (
    <section>
      <div className="flex items-center gap-2.5 border-b-2 border-border pb-2">
        <img src={group.icon} alt="" className="h-8 w-8 rounded-lg object-cover" />
        <h2 className="flex-1 text-xl font-bold">{group.title}</h2>
        <Link to="/cari" search={cat ? { kategori: cat.id } : undefined} className="flex items-center gap-1 rounded-lg border-2 border-primary/70 px-3 py-1 text-sm font-semibold text-primary transition active:scale-95">
          Semua <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-3 px-2 pt-3">
        {group.brands.map((b) => (
          <Link key={b.name} to="/cari" search={{ q: b.name }} className="flex flex-col items-center gap-1.5 transition active:scale-95">
            <img src={b.img} alt={b.name} className="aspect-square w-full max-w-16 rounded-xl object-cover" />
            <span className="truncate text-xs text-muted-foreground">{b.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Section({ icon: I, tone, kicker, title, to, children }: { icon: LucideIcon; tone: string; kicker: string; title: string; to?: "/cari"; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b px-3 py-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}><I className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kicker}</p>
          <h2 className="truncate font-bold">{title}</h2>
        </div>
        {to && <Link to={to} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-primary">Lihat semua <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
      <div className="pt-3">{children}</div>
    </section>
  );
}

function Rail({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">{children}</div>;
}

/** Small portrait card for horizontal rails and the 2-column grid. */
function MiniCard({ p, url, rank, grid = false }: { p: CardProduct; url?: string | undefined; rank?: number; grid?: boolean }) {
  const wish = useWishlistIds();
  const toggle = useToggleWishlist();
  const on = wish.data?.has(p.id) ?? false;
  const out = !p.storeOpen ? "Toko Tutup" : p.product_type !== "preorder" && p.stock <= 0 ? "Stok Habis" : null;
  return (
    <article className={`relative overflow-hidden rounded-xl border bg-card ${grid ? "" : "w-40 shrink-0"}`}>
      <Link to="/produk/$id" params={{ id: p.id }} className="block p-1.5">
        <div className="relative overflow-hidden rounded-lg">
          <ProductImage url={url} alt={p.name} className="aspect-square" />
          {out && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-foreground/75 px-2.5 py-0.5 text-[10px] font-semibold text-background">{out}</span>}
          {rank && <span className="absolute left-1.5 top-1.5 rounded-md bg-warning px-1.5 py-0.5 text-[10px] font-bold text-foreground">#{rank}</span>}
        </div>
      </Link>
      <button aria-label={on ? "Hapus dari wishlist" : "Simpan ke wishlist"} onClick={() => void toggle(p.id, on)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-card/90 shadow transition active:scale-90">
        <Heart className={`h-3.5 w-3.5 ${on ? "fill-destructive text-destructive" : ""}`} />
      </button>
      <Link to="/produk/$id" params={{ id: p.id }} className="block px-2.5 pb-2.5">
        {p.category && <span className="inline-block rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{p.category}</span>}
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{p.name}</p>
        <p className="mt-1.5 font-bold text-primary">{rpBuyer(p.minPrice)}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3 fill-warning text-warning" />{p.rating.count ? p.rating.avg.toFixed(1) : "0"}
          <span className="h-3 w-px bg-border" />{p.sold_count > 0 ? `${p.sold_count}+ sold` : "New"}
        </p>
      </Link>
    </article>
  );
}

function LikedSection({ items, urlOf }: { items: CardProduct[]; urlOf: (p: CardProduct) => string | undefined }) {
  const [n, setN] = useState(6);
  return (
    <Section icon={Sparkles} tone="bg-primary text-primary-foreground" kicker="Explore Marketku" title="Produk Disukai" to="/cari">
      <div className="grid grid-cols-2 gap-3 px-3 pb-3">
        {items.slice(0, n).map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} grid />)}
      </div>
      {items.length > n && (
        <div className="px-3 pb-3">
          <button onClick={() => setN((v) => v + 6)} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-primary transition active:scale-95">
            Tampilkan lagi <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </Section>
  );
}

function GameSection({ items, urlOf }: { items: CardProduct[]; urlOf: (p: CardProduct) => string | undefined }) {
  const [game, setGame] = useState<(typeof GAMES)[number]>("Roblox");
  const shown = items.filter((p) => p.name.toLowerCase().includes(game.toLowerCase()));
  return (
    <Section icon={Gamepad2} tone="bg-chart-3 text-primary-foreground" kicker="Cari game favorit mu disini" title="Jelajahi Game">
      <div className="flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
        {GAMES.map((g) => (
          <button key={g} onClick={() => setGame(g)} aria-pressed={g === game}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${g === game ? "border-primary bg-accent text-primary" : ""}`}>{g}</button>
        ))}
      </div>
      {shown.length ? (
        <Rail>{shown.map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} />)}</Rail>
      ) : (
        <p className="px-3 pb-4 text-sm text-muted-foreground">Belum ada produk {game}.</p>
      )}
    </Section>
  );
}
