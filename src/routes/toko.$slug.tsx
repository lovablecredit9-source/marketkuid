import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ShareSheet } from "@/components/marketku/share-sheet";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarDays, Copy, MessageCircle, MessageSquare, Package, RotateCcw, Search, ShieldAlert,
  ShoppingBag, Star, Store, Ticket, User, UserCheck, UserPlus, Share2, X, Eye, Users, Flame, Award, Sparkles, Layers, Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/marketku/shell";
import { ProductList, Stars } from "@/components/marketku/product-card";
import { ratingOf, useMarketProducts, useReviews, dbError, fmtDate } from "@/lib/market";
import { storeHead } from "@/lib/meta";
import { getStoreSeo } from "@/lib/seo.functions";
import { useImageUrls, useStoreMedia } from "@/lib/products";
import { shortCount, storeBadges, storeVisitorId, topSellers, type StoreBadge } from "@/lib/store-page";
import { STORE_SORTS, filterReviews, filterStoreProducts, reviewBreakdown, storeCategories, voucherTerms, voucherValue, type StoreSort } from "@/lib/store-page";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/toko/$slug")({
  staticData: { sitemap: true },
  loader: async ({ params }) => {
    const seo = await getStoreSeo({ data: params.slug });
    // Old /toko/<id> links move to the store's name link, e.g. /toko/tambas.
    if (seo?.slug && seo.slug !== params.slug) throw redirect({ to: "/toko/$slug", params: { slug: seo.slug }, replace: true });
    return seo;
  },
  head: ({ loaderData }) => storeHead(loaderData),
  component: Toko,
});

function StatusCard({ icon: Icon, title, desc, action }: { icon: typeof User; title: string; desc: string; action?: ReactNode }) {
  return (
    <AppShell showSupport={false} className="store-profile" wide>
      <div className="px-4 pt-4 pb-10">
        <div className="store-surface flex flex-col items-center rounded-3xl border bg-card px-6 py-14 text-center">
          <div className="store-hero-fallback grid h-16 w-16 place-items-center rounded-2xl text-primary-foreground">
            <Icon className="h-8 w-8" strokeWidth={1.75} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">{desc}</p>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            {action}
            <Link to="/" className="flex h-11 w-full items-center justify-center rounded-full bg-store-electric text-sm font-bold text-primary-foreground shadow-md transition active:scale-[.98]">
              Kembali ke Marketku
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StoreSkeleton() {
  return (
    <AppShell showSupport={false} className="store-profile" wide>
      <div className="space-y-4 px-4 pt-4" aria-busy="true" aria-label="Memuat toko">
        <div className="overflow-hidden rounded-3xl border bg-card">
          <div className="aspect-[4/1] max-h-[150px] min-h-[84px] animate-pulse bg-muted" />
          <div className="px-5 pb-5">
            <div className="-mt-8 h-[68px] w-[68px] animate-pulse rounded-full border-[3px] border-card bg-muted" />
            <div className="mt-4 h-6 w-1/2 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-3 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-xl bg-muted" />)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border bg-card" />)}</div>
        <div className="grid grid-cols-2 gap-3">{[0, 1].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border bg-card" />)}</div>
      </div>
    </AppShell>
  );
}

const initials = (n: string) => n.split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase();
const REVIEW_PAGE = 6;

function Toko() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const store = useQuery({
    queryKey: ["store_slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("store_by_slug", { p_slug: slug });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const s = store.data;
  const banned = useQuery({
    queryKey: ["store_banned", s?.owner_id], enabled: !!s?.owner_id,
    queryFn: async () => s?.owner_id ? !!(await supabase.rpc("store_ban_status", { p_owner: s.owner_id })).data : false,
  });
  const products = useMarketProducts({ owner: s?.owner_id ?? "__none__", limit: 100 });
  const reviews = useReviews({ seller: s?.owner_id ?? "" });
  const vouchers = useQuery({
    queryKey: ["store_vouchers", s?.owner_id], enabled: !!s?.owner_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_store_vouchers", { p_owner: s!.owner_id });
      if (error) throw error;
      return data ?? [];
    },
  });
  const media = useStoreMedia(s?.owner_id ? [s.owner_id] : []);
  const m = s?.owner_id ? media.data?.[s.owner_id] : undefined;
  const mediaUrls = useImageUrls([m?.avatar_path ?? "", m?.banner_path ?? ""].filter(Boolean));
  const avatarUrl = m?.avatar_path ? mediaUrls.data?.[m.avatar_path] : undefined;
  const bannerUrl = m?.banner_path ? mediaUrls.data?.[m.banner_path] : undefined;
  const qc = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<StoreSort>("terbaru");
  const [star, setStar] = useState<number | null>(null);
  const [reviewLimit, setReviewLimit] = useState(REVIEW_PAGE);
  const follow = useQuery({
    queryKey: ["follow", user?.id, s?.owner_id], enabled: !!user && !!s?.owner_id,
    queryFn: async () => !!(await supabase.from("store_follows").select("seller_id").eq("user_id", user!.id).eq("seller_id", s!.owner_id).maybeSingle()).data,
  });
  // Count one real visit per device/account per day, then read the public counters.
  useEffect(() => {
    if (!s?.owner_id) return;
    void supabase.rpc("record_store_visit", { p_owner: s.owner_id, p_visitor: storeVisitorId() ?? "" })
      .then(() => qc.invalidateQueries({ queryKey: ["store_public_stats", s.owner_id] }), () => {});
  }, [s?.owner_id, qc]);
  const pub = useQuery({
    queryKey: ["store_public_stats", s?.owner_id], enabled: !!s?.owner_id,
    queryFn: async () => (await supabase.rpc("store_public_stats", { p_owner: s!.owner_id })).data?.[0] ?? null,
  });
  const heroRef = useRef<HTMLElement>(null);
  const [mini, setMini] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setMini(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [s?.owner_id, store.isLoading]);
  const reviewImgs = useImageUrls([...new Set((reviews.data ?? []).map((x) => x.products?.images?.[0] ?? "").filter(Boolean))]);

  const list = useMemo(() => (s?.owner_id ? (products.data ?? []).filter((p) => p.owner_id === s.owner_id) : []), [products.data, s?.owner_id]);
  const cats = useMemo(() => storeCategories(list), [list]);
  const shown = useMemo(() => (s?.owner_id ? filterStoreProducts(list, s.owner_id, { q, category, sort }) : []), [list, s?.owner_id, q, category, sort]);

  if (store.isLoading) return <StoreSkeleton />;
  if (store.isError) return <StatusCard icon={AlertTriangle} title="Gagal memuat toko" desc="Periksa koneksi internet kamu lalu coba lagi."
    action={<Button variant="outline" className="h-11 rounded-full" onClick={() => void store.refetch()}><RotateCcw /> Coba lagi</Button>} />;
  if (!s) return <StatusCard icon={User} title="Profil belum tersedia" desc="Toko tidak ditemukan. Mungkin linknya salah atau toko sudah tidak aktif." />;
  // Like marketku.id: a closed store's public profile is not shown to visitors (owner still sees it).
  if (!s.is_open && user?.id !== s.owner_id) return <StatusCard icon={Store} title="Toko sedang tutup" desc="Profil toko ini belum bisa dilihat. Coba kunjungi lagi nanti." />;

  const allReviews = reviews.data ?? [];
  const sold = list.reduce((a, p) => a + p.sold_count, 0);
  const r = ratingOf(allReviews);
  const own = user?.id === s.owner_id;
  const since = new Date(s.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const filtering = !!q.trim() || !!category || sort !== "terbaru";
  const starRows = filterReviews(allReviews, star);
  const bars = reviewBreakdown(allReviews);

  const chat = async () => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (own) { toast("Ini toko kamu sendiri"); return; }
    const { data, error } = await supabase.rpc("start_conversation", { p_seller: s.owner_id });
    if (error || !data) { toast.error(dbError(error)); return; }
    navigate({ to: "/chat/$id", params: { id: data } });
  };

  const toggleFollow = async () => {
    if (!user) { toast("Masuk dulu untuk mengikuti toko"); navigate({ to: "/login" }); return; }
    if (own) { toast("Ini toko kamu sendiri"); return; }
    if (busyFollow) return;
    setBusyFollow(true);
    const on = !!follow.data;
    const { error } = on
      ? await supabase.from("store_follows").delete().eq("user_id", user.id).eq("seller_id", s.owner_id)
      : await supabase.from("store_follows").insert({ user_id: user.id, seller_id: s.owner_id });
    setBusyFollow(false);
    if (error) { toast.error("Gagal memperbarui"); return; }
    toast.success(on ? "Berhenti mengikuti toko" : `Kamu mengikuti ${s.store_name}`);
    void qc.invalidateQueries({ queryKey: ["follow"] });
    void qc.invalidateQueries({ queryKey: ["followed_stores", user.id] });
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success(`Kode ${code} disalin`); }
    catch { toast(`Kode voucher: ${code}`); }
  };

  const badges = storeBadges({ avg: r.avg, reviews: r.count, sold, products: list.length, createdAt: s.created_at });
  const best = topSellers(list);
  const followers = Number(pub.data?.followers ?? 0);
  const visits = Number(pub.data?.visits_total ?? 0);
  const today = Number(pub.data?.visits_today ?? 0);
  const goProducts = () => document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const resetFilters = () => { setQ(""); setCategory(null); setSort("terbaru"); };

  const stats = [
    { icon: Package, value: list.length.toLocaleString("id-ID"), label: "Produk aktif" },
    { icon: ShoppingBag, value: sold.toLocaleString("id-ID"), label: "Terjual" },
    { icon: Star, value: r.count ? r.avg.toFixed(1) : "–", label: "Rating", star: true },
    { icon: MessageSquare, value: r.count.toLocaleString("id-ID"), label: "Ulasan" },
  ];

  return (
    <AppShell showSupport={false} className="store-profile" wide>
      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} title={s.store_name} url={typeof window === "undefined" ? "" : window.location.href} text={`Mampir ke toko ${s.store_name} di Marketku`} />
      <div className="space-y-4 px-3 pt-3 dt:px-6">
        {/* Compact bar once the hero scrolls away */}
        <div aria-hidden={!mini} className={`store-mini fixed inset-x-0 z-20 mx-auto max-w-md px-3 transition duration-300 dt:max-w-[56rem] dt:px-6 ${mini ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"}`}>
          <div className="store-surface flex items-center gap-2.5 rounded-xl border bg-card/95 px-2.5 py-1.5 backdrop-blur">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="store-hero-fallback grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-primary-foreground">{initials(s.store_name)}</span>}
            <button type="button" tabIndex={mini ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="min-w-0 flex-1 text-left leading-tight">
              <b className="block truncate text-[13px]">{s.store_name}</b>
              <span className="block truncate text-[10.5px] text-muted-foreground">{r.count ? `★ ${r.avg.toFixed(1)} · ` : ""}{shortCount(followers)} pengikut</span>
            </button>
            {!own && (
              <Button size="sm" tabIndex={mini ? 0 : -1} onClick={() => void toggleFollow()} disabled={busyFollow} variant={follow.data ? "outline" : "default"}
                className={`h-8 rounded-lg px-3 text-[12px] font-semibold ${follow.data ? "" : "bg-store-electric text-primary-foreground hover:bg-store-electric/90"}`}>
                {follow.data ? "Diikuti" : "Ikuti"}
              </Button>
            )}
          </div>
        </div>

        {/* Hero */}
        <section ref={heroRef} className="store-surface overflow-hidden rounded-2xl border bg-card">
          <div className="relative aspect-[4/1] max-h-[150px] min-h-[84px] overflow-hidden w-full">
            {bannerUrl
              ? <img src={bannerUrl} alt={`Banner ${s.store_name}`} className="h-full w-full object-cover object-center" />
              : <div className="store-hero-fallback h-full w-full" aria-hidden />}
            <div className="store-hero-shade pointer-events-none absolute inset-0" aria-hidden />
          </div>
          <div className="px-3.5 pb-4 sm:px-5">
            <div className="flex items-end justify-between gap-3">
              {avatarUrl
                ? <img src={avatarUrl} alt={`Foto ${s.store_name}`} className="relative -mt-9 h-[68px] w-[68px] shrink-0 rounded-full border-[3px] border-card bg-card object-cover shadow-lg sm:h-[80px] sm:w-[80px]" />
                : <span className="store-hero-fallback relative -mt-11 grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full border-[3px] border-card text-lg font-bold text-primary-foreground shadow-lg sm:h-[80px] sm:w-[80px]">{initials(s.store_name)}</span>}
              <span className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${s.is_open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.is_open ? "bg-success" : "bg-muted-foreground"}`} />{s.is_open ? "BUKA" : "TUTUP"}
              </span>
            </div>
            <h1 className="mt-2 break-words text-[18px] font-extrabold leading-tight tracking-tight sm:text-[20px]">{s.store_name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><CalendarDays className="h-3 w-3" /> Bergabung sejak {since}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-store-electric" /><b className="font-bold text-foreground">{shortCount(followers)}</b> pengikut</span>
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-store-electric" /><b className="font-bold text-foreground">{shortCount(visits)}</b> kunjungan</span>
              {today > 0 && (
                <span className="store-live inline-flex items-center gap-1.5 rounded-full bg-store-electric/10 px-2 py-0.5 font-semibold text-store-electric">
                  <span className="store-live__dot h-1.5 w-1.5 rounded-full bg-store-electric" />{today.toLocaleString("id-ID")} orang mampir hari ini
                </span>
              )}
            </div>
            {badges.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Lencana toko">
                {badges.map((b, i) => <BadgeChip key={b.key} b={b} delay={i * 80} />)}
              </ul>
            )}
            {s.description && <p className="mt-2 max-w-prose whitespace-pre-line break-words text-[12.5px] leading-relaxed text-foreground/85">{s.description}</p>}

            {!s.is_open && !banned.data && <p className="mt-3 flex items-start gap-2 rounded-xl border bg-muted px-3 py-2.5 text-xs font-semibold text-foreground/80"><Store className="mt-px h-4 w-4 shrink-0" />Toko sedang tutup — produk bisa dilihat, belum bisa order. Kamu tetap bisa kirim pesan ke seller.</p>}
            {banned.data && <p className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive"><ShieldAlert className="mt-px h-4 w-4 shrink-0" />Toko ini sedang diblokir oleh Marketku. Produknya tidak bisa dibeli untuk sementara.</p>}

            <div className={`mt-3 grid gap-2 ${own ? "grid-cols-2" : "grid-cols-3"}`}>
              {!own && (
                <Button onClick={() => void toggleFollow()} disabled={busyFollow} variant={follow.data ? "outline" : "default"}
                  className={`h-9 gap-1.5 rounded-lg text-[12px] font-semibold ${follow.data ? "" : "bg-store-electric text-primary-foreground hover:bg-store-electric/90"}`}>
                  {follow.data ? <><UserCheck /> Diikuti</> : <><UserPlus /> Ikuti</>}
                </Button>
              )}
              <Button variant="outline" onClick={() => void chat()} className="h-9 gap-1.5 rounded-lg text-[12px] font-semibold"><MessageCircle /> <span className="sm:hidden">Chat</span><span className="hidden sm:inline">Kirim Pesan</span></Button>
              <Button variant="outline" onClick={() => setShareOpen(true)} className="h-9 gap-1.5 rounded-lg text-[12px] font-semibold"><Share2 /> Bagikan</Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section aria-label="Statistik toko" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((x, i) => (
            <div key={x.label} className="store-surface store-rise flex items-center gap-2.5 rounded-xl border bg-card p-2.5" style={{ animationDelay: `${i * 60}ms` }}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${x.star ? "bg-warning/15 text-warning" : "bg-store-electric/10 text-store-electric"}`}>
                <x.icon className={`h-4 w-4 ${x.star ? "fill-warning" : ""}`} />
              </span>
              <span className="min-w-0 leading-tight">
                <b className="block truncate text-[14px] font-extrabold">{x.value}</b>
                <span className="block text-[10.5px] text-muted-foreground">{x.label}</span>
              </span>
            </div>
          ))}
        </section>

        {/* Vouchers (only shown when the store has live ones) */}
        {(vouchers.data?.length ?? 0) > 0 && (
          <section aria-labelledby="store-vouchers">
            <h2 id="store-vouchers" className="mb-3 flex items-center gap-2 text-[14px] font-bold"><Ticket className="h-4 w-4 text-store-electric" /> Voucher Toko</h2>
            <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {vouchers.data!.map((v) => (
                <div key={v.code} className="store-voucher store-surface flex w-[230px] shrink-0 snap-start overflow-hidden rounded-xl border bg-card">
                  <div className="store-hero-fallback flex w-[60px] shrink-0 flex-col items-center justify-center px-2 text-center text-primary-foreground">
                    <Ticket className="h-5 w-5" />
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">Voucher</span>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-dashed p-3">
                    <p className="truncate text-[11px] font-medium text-muted-foreground">{v.name || "Promo toko"}</p>
                    <p className="mt-0.5 text-[14px] font-extrabold text-store-electric">{voucherValue(v)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{voucherTerms(v)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <code className="truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold tracking-wider">{v.code}</code>
                      <button type="button" onClick={() => void copyCode(v.code)} aria-label={`Salin kode ${v.code}`}
                        className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-store-electric/10 px-2.5 text-[11px] font-bold text-store-electric transition active:scale-95">
                        <Copy className="h-3.5 w-3.5" /> Salin
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Best sellers (only products that really sold) */}
        {best.length > 0 && <BestSellers items={best} onAll={() => { setSort("terlaris"); setCategory(null); setQ(""); goProducts(); }} />}

        {/* Products */}
        <section aria-labelledby="store-products" className="@container">
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 id="store-products" className="text-[14px] font-bold">Produk Toko</h2>
            <span className="shrink-0 text-[12px] text-muted-foreground">{filtering ? `${shown.length} dari ${list.length} produk` : `${list.length} produk`}</span>
          </div>
          {list.length > 0 && (
            <div className="store-surface mb-3 space-y-2 rounded-xl border bg-card p-2.5">
              <div className="flex gap-2">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cari di ${s.store_name}`} aria-label="Cari produk di toko ini"
                    className="h-9 w-full rounded-lg border bg-background pl-9 pr-8 text-[13px] outline-none transition focus:border-store-electric focus:ring-2 focus:ring-store-electric/20" />
                  {q && <button type="button" aria-label="Hapus pencarian" onClick={() => setQ("")} className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
                </label>
                <select value={sort} onChange={(e) => setSort(e.target.value as StoreSort)} aria-label="Urutkan produk"
                  className="h-9 shrink-0 rounded-lg border bg-background px-2.5 text-[12.5px] font-medium outline-none focus:border-store-electric">
                  {STORE_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {cats.length > 0 && (
                <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter kategori">
                  {[{ name: null as string | null, n: list.length }, ...cats].map((c) => {
                    const on = category === c.name;
                    return (
                      <button key={c.name ?? "__all"} type="button" aria-pressed={on} onClick={() => setCategory(c.name)}
                        className={`h-7 shrink-0 rounded-full border px-2.5 text-[11.5px] font-semibold transition ${on ? "border-store-electric bg-store-electric text-primary-foreground" : "bg-background text-foreground/80 hover:border-store-electric/50"}`}>
                        {c.name ?? "Semua"} <span className={on ? "opacity-80" : "text-muted-foreground"}>{c.n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {filtering && (
                <button type="button" onClick={resetFilters} className="flex items-center gap-1 text-[12px] font-semibold text-store-electric"><RotateCcw className="h-3.5 w-3.5" /> Reset filter</button>
              )}
            </div>
          )}
          {products.isLoading ? (
            <div className="grid grid-cols-2 gap-2.5 @dt:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5">{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border bg-card" />)}</div>
          ) : products.isError ? (
            <EmptyBox icon={AlertTriangle} title="Gagal memuat produk" desc="Coba muat ulang sebentar lagi." action={<Button variant="outline" size="sm" className="rounded-full" onClick={() => void products.refetch()}><RotateCcw /> Coba lagi</Button>} />
          ) : list.length === 0 ? (
            <EmptyBox icon={Package} title="Belum ada produk" desc="Toko ini belum punya produk aktif. Ikuti toko supaya tidak ketinggalan produk barunya." />
          ) : shown.length === 0 ? (
            <EmptyBox icon={Search} title="Produk tidak ditemukan" desc="Coba kata kunci atau kategori lain." action={<Button variant="outline" size="sm" className="rounded-full" onClick={resetFilters}><RotateCcw /> Reset filter</Button>} />
          ) : <ProductList items={shown} simple />}
        </section>

        {/* Reviews */}
        <section aria-labelledby="store-reviews">
          <h2 id="store-reviews" className="mb-3 text-[14px] font-bold">Ulasan Pembeli</h2>
          <div className="store-surface rounded-xl border bg-card p-3">
            <div className="flex items-center gap-5">
              <div className="w-24 shrink-0 text-center">
                <p className="text-[28px] font-extrabold leading-none">{r.count ? r.avg.toFixed(1) : "0.0"}<span className="text-sm font-medium text-muted-foreground">/5</span></p>
                <div className="mt-2 flex justify-center"><Stars n={Math.round(r.avg)} size="h-3.5 w-3.5" /></div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{r.count.toLocaleString("id-ID")} ulasan</p>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {bars.map((b) => (
                  <div key={b.star} className="flex items-center gap-2 text-[11.5px]">
                    <span className="flex w-6 items-center gap-0.5 font-semibold">{b.star}<Star className="h-3 w-3 fill-warning text-warning" /></span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-warning transition-[width] duration-500" style={{ width: `${b.pct}%` }} /></span>
                    <span className="w-9 text-right tabular-nums text-muted-foreground">{b.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            {allReviews.length > 0 && (
              <div className="-mx-3 mt-3 flex gap-1.5 overflow-x-auto border-t px-3 pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter bintang">
                {[null, 5, 4, 3, 2, 1].map((n) => {
                  const on = star === n;
                  const count = n ? bars.find((b) => b.star === n)!.n : allReviews.length;
                  return (
                    <button key={n ?? "all"} type="button" aria-pressed={on} onClick={() => { setStar(n); setReviewLimit(REVIEW_PAGE); }}
                      className={`flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-semibold transition ${on ? "border-store-electric bg-store-electric/10 text-store-electric" : "text-foreground/80"}`}>
                      {n ? <>{n}<Star className="h-3 w-3 fill-warning text-warning" /></> : "Semua"} <span className="text-muted-foreground">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {reviews.isError ? (
            <div className="mt-3"><EmptyBox icon={AlertTriangle} title="Gagal memuat ulasan" desc="Coba muat ulang sebentar lagi." action={<Button variant="outline" size="sm" className="rounded-full" onClick={() => void reviews.refetch()}><RotateCcw /> Coba lagi</Button>} /></div>
          ) : allReviews.length === 0 ? (
            <div className="mt-3"><EmptyBox icon={MessageSquare} title="Belum ada ulasan" desc="Ulasan dari pembeli toko ini akan tampil di sini." /></div>
          ) : starRows.length === 0 ? (
            <p className="mt-3 rounded-xl border bg-card p-3 text-center text-sm text-muted-foreground">Belum ada ulasan bintang {star}.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {starRows.slice(0, reviewLimit).map((x) => {
                const img = x.products?.images?.[0];
                return (
                  <article key={x.id} className="store-surface rounded-xl border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-store-electric/10 text-[11px] font-bold text-store-electric">{initials(x.buyer_label || "?")}</span>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-[13px]">{x.buyer_label}</b>
                        <div className="mt-0.5 flex items-center gap-2"><Stars n={x.rating} size="h-3 w-3" /><span className="text-[11px] text-muted-foreground">{fmtDate(x.created_at)}</span></div>
                      </div>
                    </div>
                    {x.comment && <p className="mt-3 whitespace-pre-line break-words text-[13px] leading-relaxed">{x.comment}</p>}
                    {x.products?.name && (
                      <div className="mt-3 flex max-w-full items-center gap-2 rounded-xl bg-muted/60 px-2.5 py-2">
                        {img && reviewImgs.data?.[img] ? <img src={reviewImgs.data[img]} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" /> : <Package className="h-5 w-5 shrink-0 text-muted-foreground" />}
                        <span className="min-w-0 truncate text-[11.5px] text-foreground/80">{x.products.name}</span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {starRows.length > reviewLimit && (
            <Button variant="outline" onClick={() => setReviewLimit((n) => n + REVIEW_PAGE)} className="mt-3 h-9 w-full rounded-lg text-[12px] font-semibold">
              Tampilkan ulasan lainnya ({starRows.length - reviewLimit})
            </Button>
          )}
        </section>
      </div>
    </AppShell>
  );
}

const BADGE_ICON: Record<StoreBadge["key"], typeof Award> = { rating: Award, laris: Flame, lengkap: Layers, baru: Sparkles };

function BadgeChip({ b, delay }: { b: StoreBadge; delay: number }) {
  const Icon = BADGE_ICON[b.key];
  return (
    <li title={b.hint} className={`store-badge store-rise inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold store-badge--${b.key}`} style={{ animationDelay: `${delay}ms` }}>
      <Icon className="h-3 w-3" /> {b.label}
    </li>
  );
}

function BestSellers({ items, onAll }: { items: ReturnType<typeof topSellers>; onAll: () => void }) {
  const urls = useImageUrls(items.map((p) => p.images[0] ?? "").filter(Boolean));
  return (
    <section aria-labelledby="store-best">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 id="store-best" className="flex items-center gap-2 text-[14px] font-bold"><Crown className="h-4 w-4 text-warning" /> Terlaris di Toko Ini</h2>
        <button type="button" onClick={onAll} className="text-[12px] font-semibold text-store-electric">Lihat semua</button>
      </div>
      <ol className="-mx-3 flex snap-x scroll-px-3 gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dt:mx-0 dt:grid dt:grid-cols-3 dt:overflow-visible dt:px-0">
        {items.map((p, i) => {
          const url = p.images[0] ? urls.data?.[p.images[0]] : undefined;
          return (
            <li key={p.id} className="w-[240px] shrink-0 snap-start dt:w-auto">
              <Link to="/produk/$id" params={{ id: p.id }} className="store-card store-best flex items-center gap-2.5 rounded-xl border bg-card p-2">
                <span className="relative shrink-0">
                  {url ? <img src={url} alt="" loading="lazy" className="h-14 w-14 rounded-lg object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></span>}
                  <span className={`store-rank store-rank--${i + 1} absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold`}>{i + 1}</span>
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <b className="line-clamp-2 text-[12px] font-semibold">{p.name}</b>
                  <span className="mt-1 block text-[12.5px] font-bold text-store-electric">Rp {p.minPrice.toLocaleString("id-ID")}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground"><Flame className="h-3 w-3 text-destructive" />{p.sold_count.toLocaleString("id-ID")} terjual</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EmptyBox({ icon: Icon, title, desc, action }: { icon: typeof User; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-store-electric/10 text-store-electric"><Icon className="h-6 w-6" /></div>
      <h3 className="mt-3 text-[14px] font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-[12.5px] text-muted-foreground">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
