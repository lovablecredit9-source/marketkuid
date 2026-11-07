import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Zap, ShieldCheck, Headphones, Package, BadgePercent, Facebook, Instagram, Twitter, Youtube, Heart, Star,
  Sparkles, TrendingUp, Clock, Gamepad2, ArrowRight, ChevronDown, Bot, AppWindow, Cloud, Palette, MoreHorizontal,
  Smartphone, Users, Cpu, Tv, Wrench, LayoutGrid, History, BellRing, type LucideIcon,
} from "lucide-react";
import { readRestock, restocked, writeRestock } from "@/lib/buyer-tools";
import logo from "@/assets/logo-marketku.png.asset.json";
import { AppShell, EmptyState, soon } from "@/components/marketku/shell";
import { ProductImage, SellerPeek, rpBuyer, useSellerPeek, useToggleWishlist, useWishlistIds } from "@/components/marketku/product-card";
import { trackAdClick, useMarketProducts, useSponsored, type CardProduct } from "@/lib/market";
import { categoryPath, childCategories, descendantIds, useCategories, useImageUrls, type CategoryRow } from "@/lib/products";
import { BRAND_GROUPS, HOME_BANNERS, HOME_GAMES, PARTNERS } from "@/lib/home-assets";
import { categoryIcon } from "@/lib/category-icons";
import { HomeNotice } from "@/components/marketku/home-notice";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearRecent, orderByRecent, readRecent, recommendFromViewed } from "@/lib/recently-viewed";

type FLink = { label: string; to?: "/cari" | "/flash-sale" | "/akun" | "/jadi-seller" | "/seller" | "/seller/panduan" | "/bantuan" | "/syarat" | "/privasi" | "/kontak" | "/kategori" | "/referral" };
const FOOTER: { title: string; links: FLink[] }[] = [
  { title: "Marketplace", links: [{ label: "Semua Produk", to: "/cari" }, { label: "Flash Sale", to: "/flash-sale" }, { label: "Best Seller" }, { label: "Kategori", to: "/kategori" }, { label: "Undang Teman", to: "/referral" }] },
  { title: "Seller", links: [{ label: "Mulai Jualan", to: "/jadi-seller" }, { label: "Seller Center", to: "/seller" }, { label: "Panduan Seller", to: "/seller/panduan" }, { label: "Biaya Layanan", to: "/syarat" }] },
  { title: "Bantuan", links: [{ label: "Pusat Bantuan", to: "/bantuan" }, { label: "Syarat & Ketentuan", to: "/syarat" }, { label: "Kebijakan Privasi", to: "/privasi" }, { label: "Hubungi Kami", to: "/kontak" }] },
];

const CAT_ICON: Record<string, LucideIcon> = {
  "AI Tools": Bot, Aplikasi: AppWindow, Cloud, "Design & Kreatif": Palette, "Game Online": Gamepad2, Lainnya: MoreHorizontal,
  PPOB: Smartphone, "Social Media": Users, Software: Cpu, Streaming: Tv, Tools: Wrench,
};

type HomeSearch = { kategori?: string; subkategori?: string };

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  // Like marketku.id, picking a category filters right on the home page: /?kategori=AI+Tools&subkategori=9router
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    ...(typeof s["kategori"] === "string" && s["kategori"] ? { kategori: s["kategori"] } : {}),
    ...(typeof s["subkategori"] === "string" && s["subkategori"] ? { subkategori: s["subkategori"] } : {}),
  }),
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
  const products = useMarketProducts({ limit: 60 });
  const list = useMemo(() => products.data ?? [], [products.data]);
  const urls = useImageUrls([...new Set(list.map((p) => p.images[0] ?? "").filter(Boolean))]);
  const urlOf = (p: CardProduct) => (p.images[0] ? urls.data?.[p.images[0]] : undefined);

  const liked = useMemo(() => [...list].sort((a, b) => b.likes - a.likes || b.sold_count - a.sold_count || b.rating.avg - a.rating.avg), [list]);
  const best = useMemo(() => list.filter((p) => p.sold_count > 0).sort((a, b) => b.sold_count - a.sold_count).slice(0, 10), [list]);
  const trending = useMemo(() => list.filter((p) => p.sold_count > 0 || p.rating.count > 0).sort((a, b) => (b.rating.count * 2 + b.sold_count + b.likes) - (a.rating.count * 2 + a.sold_count + a.likes)).slice(0, 10), [list]);
  const discounted = useMemo(() => list.filter((p) => p.basePrice > p.minPrice).sort((a, b) => (1 - b.minPrice / b.basePrice) - (1 - a.minPrice / a.basePrice)).slice(0, 10), [list]);
  const fresh = useMemo(() => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10), [list]);

  return (
    <AppShell className="relative isolate" homeSearch>
      <div aria-hidden className="mk-grid-bg pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]" />
      <HomeNotice />

      <div className="space-y-5 px-3 pt-3">
        <Banner />

        <RecentPurchases />

        <HomeCategories />

        <div className="!mt-[18px] space-y-[18px]">
          {BRAND_GROUPS.map((g) => <BrandGroup key={g.title} group={g} />)}
        </div>

        {products.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : !list.length ? (
          <EmptyState icon={Package} title="Belum ada produk" desc="Produk akan tampil di sini setelah seller menambahkannya." />
        ) : (
          <>
            <SponsoredSection />

            <RestockAlert />
            <RecentlyViewed pool={list} />

            <LikedSection items={trending.length ? [...trending, ...liked.filter((p) => !trending.includes(p))] : liked} urlOf={urlOf} />

            <Section icon={TrendingUp} tone="gold" kicker="Paling laku hari ini" title="Terlaris hari ini">
              {best.length ? (
                <Rail>{best.map((p, i) => <MiniCard key={p.id} p={p} url={urlOf(p)} rank={i + 1} />)}</Rail>
              ) : (
                <p className="px-3 pb-4 text-sm text-muted-foreground">Belum ada produk yang terjual. Produk terlaris muncul setelah ada transaksi.</p>
              )}
            </Section>

            {discounted.length > 0 && (
              <Section icon={BadgePercent} tone="pink" kicker="Harga spesial terbatas" title="Produk Lagi Diskon" to="/produk/diskon">
                <Rail>{discounted.map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} />)}</Rail>
              </Section>
            )}

            <Section icon={Clock} tone="green" kicker="Baru ditambahkan" title="Produk Baru" to="/produk/baru">
              <Rail>{fresh.map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} />)}</Rail>
            </Section>

            <GameSection items={list} urlOf={urlOf} />
          </>
        )}

        <div className="-mx-3 border-y bg-card pb-4 pt-3.5" aria-label="Sponsor Marketku">
          <p className="mb-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mitra Marketku</p>
          <div className="mk-partners" role="marquee">
            <div className="mk-partners__track">
              {PARTNERS.map((m) => (
                <a key={m.name} href={m.href} target="_blank" rel="noopener noreferrer" title={m.name} aria-label={m.name} className="mk-partners__item">
                  <img src={m.img} alt={m.name} loading="lazy" className="h-8 w-auto max-w-[160px] object-contain" />
                </a>
              ))}
            </div>
          </div>
        </div>

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

/** Promo banners: swipe by hand (scroll-snap) or let them auto-advance every 4s; dots follow the visible slide. */
function Banner() {
  const items = HOME_BANNERS;
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const touching = useRef(false);
  const goTo = (n: number) => { const el = track.current; if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" }); };
  useEffect(() => {
    if (items.length < 2) return;
    const t = window.setInterval(() => {
      const el = track.current;
      if (!el || touching.current) return;
      const cur = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      el.scrollTo({ left: ((cur + 1) % items.length) * el.clientWidth, behavior: "smooth" });
    }, 4000);
    return () => window.clearInterval(t);
  }, [items.length]);
  return (
    <div className="relative" data-tour="banner">
      <div ref={track} className="mk-banner-track rounded-2xl shadow-sm"
        onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
        onTouchStart={() => { touching.current = true; }} onTouchEnd={() => { window.setTimeout(() => { touching.current = false; }, 2500); }}>
        {items.map((b) => (
          <Link key={b.src} to={b.to} search={"q" in b ? { q: b.q } : {}} draggable={false} className="block overflow-hidden rounded-2xl" aria-label={b.alt}>
            <img src={b.src} alt={b.alt} draggable={false} className="aspect-[4/1] w-full object-cover" />
          </Link>
        ))}
      </div>
      {items.length > 1 && (
        <div className="absolute bottom-2 right-3 flex gap-1.5 rounded-full bg-foreground/40 px-1.5 py-1" aria-label="Pilih banner promo">
          {items.map((b, n) => (
            <button key={b.src} aria-label={`Tampilkan banner ${n + 1}`} aria-current={n === i} onClick={() => goTo(n)} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-card" : "w-1.5 bg-card/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/** "Produk yang baru dibeli": real recent paid purchases (refreshed every minute); hidden until there are any. */
function RecentPurchases() {
  const q = useQuery({
    queryKey: ["recent_purchases"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recent_purchases", { _limit: 12 });
      if (error) throw error;
      return data ?? [];
    },
  });
  const items = q.data ?? [];
  const urls = useImageUrls([...new Set(items.map((p) => p.image_path ?? "").filter(Boolean))]);
  if (!items.length) return null;
  const animated = items.length >= 4;
  const row = animated ? [...items, ...items] : items;
  return (
    <section className="mk-run-viewport -mx-3 pb-1.5" aria-label="Produk yang baru dibeli">
      <div className={`flex w-max gap-6 px-3 ${animated ? "mk-runmarquee" : ""}`}>
        {row.map((p, n) => {
          const url = p.image_path ? urls.data?.[p.image_path] : undefined;
          return (
            <Link key={`${p.product_id}-${n}`} to="/produk/$id" params={{ id: p.product_id }} title={`${p.name} — baru dibeli`}
              className="mk-run-pill flex h-8 shrink-0 items-center gap-2 py-1">
              <span className="grid h-[18px] w-[18px] shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex items-center text-[12px] font-bold">
                <span className="mk-run-name max-w-[200px] truncate text-foreground">{p.name}</span>
                <span className="px-1 text-muted-foreground" aria-hidden>-</span>
                <span className="text-primary">{p.price ? rpBuyer(Number(p.price)) : "Gratis"}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Top-level order of the home shortcut bar on marketku.id; categories not listed follow by their sort. */
const STRIP_ORDER = ["Tools", "Lainnya", "AI Tools", "PPOB", "Aplikasi", "Cloud", "Software", "Social Media", "Game Online", "Design & Kreatif", "Streaming"];

/** Home URL for a category: root name in `kategori`, the deeper pick (if any) in `subkategori`. */
function catSearch(cats: CategoryRow[], c: CategoryRow): HomeSearch {
  const path = categoryPath(cats, c.id);
  const root = path[0] ?? c;
  return root.id === c.id ? { kategori: c.name } : { kategori: root.name, subkategori: c.name };
}

function CatIcon({ name, size = "h-[34px] w-[34px]" }: { name: string; size?: string }) {
  const img = categoryIcon(name);
  const I = CAT_ICON[name] ?? LayoutGrid;
  return img ? (
    <span className={`mk-float-icon grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted ${size}`}><img src={img} alt="" className="h-full w-full object-cover" /></span>
  ) : (
    <span className={`mk-float-icon grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary ${size}`}><I className="h-4 w-4" /></span>
  );
}

/** One pill in a shortcut bar; a thin divider sits between pills and hides next to the active one. */
function StripItem({ active, onClick, children, label }: { active?: boolean; onClick?: () => void; children: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`mk-strip-item relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3 transition-colors active:scale-95 ${active ? "is-active bg-primary/10" : ""}`}>
      {children}
      <span className={`text-[12.5px] leading-tight ${active ? "font-bold text-primary" : "font-semibold text-foreground/80"}`}>{label}</span>
    </button>
  );
}

function Strip({ children, tour }: { children: ReactNode; tour?: string }) {
  return <div className="-mx-3 flex items-center gap-2 overflow-x-auto scroll-smooth px-4 py-2 [scrollbar-width:none]" data-tour={tour}>{children}</div>;
}

/** Category shortcut bar + sub-category bars + the picked category's products, all on the home page. */
function HomeCategories() {
  const cats = useCategories();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const all = cats.data ?? [];
  const roots = useMemo(() => {
    const top = all.filter((c) => !c.parent_id);
    const rank = (n: string) => { const i = STRIP_ORDER.indexOf(n); return i < 0 ? 99 : i; };
    return [...top].sort((a, b) => rank(a.name) - rank(b.name) || a.sort - b.sort);
  }, [all]);
  const root = roots.find((c) => c.name === search.kategori);
  const leaf = (search.subkategori && root ? all.find((c) => c.name === search.subkategori && descendantIds(all, root.id).includes(c.id)) : undefined) ?? root;
  const path = leaf ? categoryPath(all, leaf.id) : [];
  const products = useMarketProducts({ category: leaf?.id ?? null, limit: 30 });
  const enabled = !!leaf;
  const items = enabled ? (products.data ?? []) : [];
  const urls = useImageUrls([...new Set(items.map((p) => p.images[0] ?? "").filter(Boolean))]);
  if (!all.length) return null;

  const go = (s: HomeSearch) => navigate({ to: "/", search: s, replace: true, resetScroll: false });
  // Bars: the top level, then one bar per picked level that has children.
  const levels = path.filter((c) => childCategories(all, c.id).length > 0);

  return (
    <div className="!mt-4 space-y-1">
      <Strip tour="kategori">
        {roots.map((c) => (
          <StripItem key={c.id} label={c.name} active={root?.id === c.id} onClick={() => go(root?.id === c.id ? {} : { kategori: c.name })}>
            <CatIcon name={c.name} />
          </StripItem>
        ))}
        <Link to="/kategori" className="mk-strip-item relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3 transition-colors active:scale-95">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-primary/10 text-primary"><LayoutGrid className="h-4 w-4" /></span>
          <span className="text-[12.5px] font-semibold leading-tight text-foreground/80">Lihat semua</span>
        </Link>
      </Strip>

      {levels.map((lv) => {
        const next = path[path.indexOf(lv) + 1];
        return (
          <Strip key={lv.id}>
            <StripItem label="Semua Produk" onClick={() => go(catSearch(all, lv))}><CatIcon name={lv.name} /></StripItem>
            {childCategories(all, lv.id).map((c) => (
              <StripItem key={c.id} label={c.name} active={next?.id === c.id}
                onClick={() => go(next?.id === c.id ? catSearch(all, lv) : catSearch(all, c))}>
                <CatIcon name={c.name} />
              </StripItem>
            ))}
          </Strip>
        );
      })}

      {leaf && (
        <section className="mk-fade-in pt-3" aria-label={`Produk ${leaf.name}`}>
          <div className="mb-2 flex items-center gap-3">
            <CatIcon name={leaf.name} size="h-9 w-9" />
            <h2 className="text-lg font-extrabold tracking-tight">{leaf.name}</h2>
          </div>
          {products.isLoading ? (
            <div className="flex gap-3">{[0, 1].map((n) => <div key={n} className="h-60 w-40 shrink-0 animate-pulse rounded-xl border bg-card" />)}</div>
          ) : items.length ? (
            <div className="-mx-3"><Rail>{items.map((p) => <MiniCard key={p.id} p={p} url={p.images[0] ? urls.data?.[p.images[0]] : undefined} />)}</Rail></div>
          ) : (
            <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">Belum ada produk di kategori {leaf.name}.</p>
          )}
        </section>
      )}
    </div>
  );
}

/** Paid sponsored slots (Iklan) — only shown when a seller campaign is live. */
function SponsoredSection() {
  const ads = useSponsored("", 6);
  const items = ads.data ?? [];
  const urls = useImageUrls([...new Set(items.map((p) => p.images[0] ?? "").filter(Boolean))]);
  if (!items.length) return null;
  return (
    <section aria-labelledby="mk-sponsored-title">
      <div className="mb-2.5 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="mk-sponsored-title" className="flex items-center gap-2 text-[17px] font-extrabold leading-tight">
            Pilihan bersponsor <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">Iklan</span>
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Produk yang dipromosikan seller untuk kamu.</p>
        </div>
        <Link to="/cari" search={{ sort: "sponsored" }} className="shrink-0 pb-0.5 text-[12px] font-semibold text-primary">Lihat semua →</Link>
      </div>
      <div className="-mx-3"><Rail>{items.map((p) => (
        <div key={p.campaignId} onClickCapture={() => trackAdClick(p.campaignId)}>
          <MiniCard p={p} url={p.images[0] ? urls.data?.[p.images[0]] : undefined} />
        </div>
      ))}</Rail></div>
    </section>
  );
}

/** Sold-out products the buyer asked to be reminded about, shown once they have stock again. */
function RestockAlert() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(readRestock()), []);
  const q = useMarketProducts({ ids, limit: 20 });
  const back = useMemo(() => restocked(ids, q.data ?? []), [ids, q.data]);
  const urls = useImageUrls(back.map((p) => p.images[0] ?? "").filter(Boolean));
  if (!ids.length || !back.length) return null;
  const dismiss = () => { const left = ids.filter((x) => !back.some((p) => p.id === x)); writeRestock(left); setIds(left); };
  return (
    <section className="mk-rail overflow-hidden rounded-2xl border border-success/40 bg-card shadow-sm" aria-label="Stok tersedia lagi">
      <div className="mk-rail__head flex items-center gap-3 border-b px-3 py-2.5">
        <span className="mk-float-icon grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-success/15 text-success"><BellRing className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Pengingat kamu</p>
          <h2 className="truncate text-[14px] font-extrabold leading-tight">Stok tersedia lagi</h2>
        </div>
        <button type="button" onClick={dismiss} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-primary transition active:scale-95">Tutup</button>
      </div>
      <div className="pt-3"><Rail>{back.map((p) => <MiniCard key={p.id} p={p} url={p.images[0] ? urls.data?.[p.images[0]] : undefined} />)}</Rail></div>
    </section>
  );
}

/** "Terakhir kamu lihat" + "Rekomendasi untuk kamu" — from products opened on this device; hidden until there are any. */
function RecentlyViewed({ pool }: { pool: CardProduct[] }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(readRecent()), []);
  const q = useMarketProducts({ ids, limit: 20 });
  const viewed = useMemo(() => orderByRecent(q.data ?? [], ids), [q.data, ids]);
  const recs = useMemo(() => recommendFromViewed(pool, viewed), [pool, viewed]);
  const urls = useImageUrls([...new Set([...viewed, ...recs].map((p) => p.images[0] ?? "").filter(Boolean))]);
  const urlOf = (p: CardProduct) => (p.images[0] ? urls.data?.[p.images[0]] : undefined);
  if (!ids.length || !viewed.length) return null;
  return (
    <>
      <section className="mk-rail overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="mk-rail__head flex items-center gap-3 border-b px-3 py-2.5">
          <span className="mk-rail__icon mk-float-icon grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]"><History className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Riwayat kamu</p>
            <h2 className="truncate text-[14px] font-extrabold leading-tight">Terakhir kamu lihat</h2>
          </div>
          <button type="button" onClick={() => { clearRecent(); setIds([]); }} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-primary transition active:scale-95">Hapus</button>
        </div>
        <div className="pt-3"><Rail>{viewed.map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} />)}</Rail></div>
      </section>
      {recs.length > 0 && (
        <Section icon={Sparkles} tone="green" kicker="Berdasarkan yang kamu lihat" title="Rekomendasi untuk kamu">
          <Rail>{recs.map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} />)}</Rail>
        </Section>
      )}
    </>
  );
}

/** Brand shortcuts (AI, App Premium) — each brand opens the search for that name. */
function BrandGroup({ group }: { group: (typeof BRAND_GROUPS)[number] }) {
  const cats = useCategories();
  const navigate = useNavigate();
  const all = cats.data ?? [];
  const cat = all.find((c) => c.name === group.category);
  // Owner-supplied brands first, then any other sub-category of this group that has an icon.
  const brands = useMemo(() => {
    const base = group.brands.map((b) => ({ name: b.name, img: b.img as string }));
    if (!cat) return base;
    const extra = childCategories(all, cat.id)
      .filter((c) => !base.some((b) => b.name === c.name))
      .map((c) => ({ name: c.name, img: categoryIcon(c.name) }))
      .filter((b): b is { name: string; img: string } => !!b.img);
    return [...base, ...extra];
  }, [all, cat, group.brands]);
  const open = (name: string) => {
    const c = all.find((x) => x.name === name && (!cat || descendantIds(all, cat.id).includes(x.id)));
    if (c) navigate({ to: "/", search: catSearch(all, c), resetScroll: false });
    else navigate({ to: "/cari", search: { q: name } });
    // Bring the category bars (and the picked products) into view under the header.
    const bar = document.querySelector<HTMLElement>('[data-tour="kategori"]');
    if (bar) window.scrollTo({ top: Math.max(0, bar.getBoundingClientRect().top + window.scrollY - 110), behavior: "smooth" });
  };
  return (
    <section className="min-w-0">
      <div className="mb-2.5 flex min-h-[30px] items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-[30px] w-[30px] place-items-center"><img src={group.icon} alt="" className="h-7 w-7 rounded-[7px] object-cover" /></span>
          <h2 className="truncate text-lg font-extrabold leading-none tracking-[-0.025em]">{group.title}</h2>
        </div>
        <button type="button" onClick={() => cat ? open(cat.name) : navigate({ to: "/cari" })}
          className="inline-flex min-h-7 min-w-[58px] items-center justify-center gap-1 rounded-[7px] border border-primary/55 bg-card px-[7px] text-[10px] font-bold text-primary transition active:scale-95">
          Semua <ArrowRight className="h-[13px] w-[13px]" />
        </button>
      </div>
      <div className="grid auto-cols-[72px] grid-flow-col gap-2.5 overflow-x-auto overscroll-x-contain rounded-b border-t border-primary/20 bg-primary/[0.06] px-2.5 py-3 [scrollbar-width:none]">
        {brands.map((b) => (
          <button type="button" key={b.name} aria-label={`Lihat kategori ${b.name}`} onClick={() => open(b.name)} className="flex min-w-0 flex-col items-center gap-1.5 transition active:scale-95">
            <img src={b.img} alt="" loading="lazy" className="aspect-square w-[58px] rounded-md object-cover" />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">{b.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

type RailTone = "blue" | "gold" | "pink" | "green" | "violet";
function Section({ icon: I, tone, kicker, title, to, toSearch, children }: { icon: LucideIcon; tone: RailTone; kicker: string; title: string; to?: "/cari" | "/produk/baru" | "/produk/diskon"; toSearch?: { sort: "sponsored" | "terlaris" }; children: ReactNode }) {
  const cls = "flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-primary transition active:scale-95";
  return (
    <section className={`mk-rail ${tone === "blue" ? "" : `mk-rail--${tone}`} overflow-hidden rounded-2xl border bg-card shadow-sm`}>
      <div className="mk-rail__head flex items-center gap-3 border-b px-3 py-2.5">
        <span className="mk-rail__icon mk-float-icon grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]"><I className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{kicker}</p>
          <h2 className="truncate text-[14px] font-extrabold leading-tight">{title}</h2>
        </div>
        {to && toSearch ? (
          <Link to="/cari" search={toSearch} className={cls}>Lihat semua <ArrowRight className="h-3.5 w-3.5" /></Link>
        ) : to ? <Link to={to} className={cls}>Lihat semua <ArrowRight className="h-3.5 w-3.5" /></Link> : null}
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
  const out = !p.storeOpen ? "Toko Tutup" : p.product_type !== "preorder" && p.stock <= 0 ? "Kosong" : null;
  const off = p.basePrice > p.minPrice ? Math.round(((p.basePrice - p.minPrice) / p.basePrice) * 100) : 0;
  const { peek, bind } = useSellerPeek();
  return (
    <article {...bind} className={`mk-peek-card relative overflow-hidden rounded-2xl border bg-card ${grid ? "" : "w-[150px] shrink-0"} ${out ? "mk-card-off" : ""} ${peek ? "is-seller-peek" : ""}`}>
      <Link to="/produk/$id" params={{ id: p.id }} className="block p-1.5">
        <div className="relative overflow-hidden rounded-xl bg-muted/70 p-3">
          <ProductImage url={url} alt={p.name} className="aspect-square" />
          <SellerPeek p={p} />
          {out && <span className="absolute bottom-2 right-2 z-[2] rounded-full bg-foreground/75 px-2 py-1 text-[10px] font-bold leading-none text-background">{out}</span>}
          <span className="absolute left-1.5 top-1.5 z-[2] flex gap-1">
            {rank && <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-foreground">#{rank}</span>}
            {off > 0 && <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">-{off}%</span>}
          </span>
        </div>
      </Link>
      <button aria-label={on ? "Hapus dari wishlist" : "Simpan ke wishlist"} onClick={() => void toggle(p.id, on)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-card/90 shadow transition active:scale-90">
        <Heart className={`h-3.5 w-3.5 ${on ? "fill-destructive text-destructive" : ""}`} />
      </button>
      <Link to="/produk/$id" params={{ id: p.id }} className="block px-2.5 pb-3">
        {p.category && <span className="inline-block rounded-md border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{p.category}</span>}
        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-tight">{p.name}</p>
        <p className="mt-1.5 text-[15px] font-bold leading-tight text-primary">{rpBuyer(p.minPrice)}</p>
        {off > 0 && <p className="text-[11px] leading-tight text-muted-foreground line-through">{rpBuyer(p.basePrice)}</p>}
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {p.rating.count > 0 && <><Star className="h-3 w-3 fill-warning text-warning" /><span className="font-semibold text-foreground/80">{p.rating.avg.toFixed(1)}</span><span className="h-3 w-px bg-border" /></>}
          {p.sold_count > 0 ? `${p.sold_count}+ terjual` : "Baru"}
        </p>
      </Link>
    </article>
  );
}

function LikedSection({ items, urlOf }: { items: CardProduct[]; urlOf: (p: CardProduct) => string | undefined }) {
  const [n, setN] = useState(6);
  return (
    <Section icon={Sparkles} tone="blue" kicker="Jelajahi Marketku" title="Sedang Populer">
      <div className="grid grid-cols-2 gap-3 px-3 pb-3">
        {items.slice(0, n).map((p) => <MiniCard key={p.id} p={p} url={urlOf(p)} grid />)}
      </div>
      {items.length > n && (
        <div className="px-3 pb-3">
          <button onClick={() => setN((v) => v + 6)} className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-semibold text-primary transition active:scale-95">
            Tampilkan lainnya <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </Section>
  );
}

const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

function GameSection({ items, urlOf }: { items: CardProduct[]; urlOf: (p: CardProduct) => string | undefined }) {
  const [game, setGame] = useState<string>(HOME_GAMES[0].name);
  const cats = useCategories();
  const all = cats.data ?? [];
  // Products in the game's category (and its sub-categories), like marketku.id; falls back to the product name.
  const shown = useMemo(() => {
    const roots = all.filter((c) => squash(c.name) === squash(game));
    const names = new Set(roots.flatMap((r) => descendantIds(all, r.id)).map((id) => all.find((c) => c.id === id)?.name).filter(Boolean));
    return items.filter((p) => (p.category && names.has(p.category)) || squash(p.name).includes(squash(game)));
  }, [all, game, items]);
  return (
    <Section icon={Gamepad2} tone="violet" kicker="Cari game favorit mu disini" title="Jelajahi Game">
      <div className="-mt-3 mb-3 flex flex-wrap gap-2 border-b px-3.5 pb-3 pt-2.5" role="tablist" aria-label="Jelajahi Game">
        {HOME_GAMES.map((g) => (
          <button key={g.name} role="tab" aria-selected={g.name === game} onClick={() => setGame(g.name)}
            className={`mk-game-tab inline-flex min-h-[34px] shrink-0 items-center gap-[7px] rounded-full border bg-card px-3 text-[12.5px] font-bold text-foreground/80 transition active:scale-95 ${g.name === game ? "is-active" : ""}`}>
            <img src={g.icon} alt="" className="h-[18px] w-[18px] rounded-[5px] object-cover" />{g.name}
          </button>
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
