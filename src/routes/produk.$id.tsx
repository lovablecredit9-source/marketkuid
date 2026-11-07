import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Share2, Heart, Star, Zap, ShieldCheck, Store, ChevronRight, ChevronLeft, MessageSquareQuote, MessageCircle, ShoppingCart, Check, X, Minus, Plus, Package, MoreVertical, Home, Flag, ArrowUp, Clock, Shield, GitCompareArrows,
} from "lucide-react";
import { viewsLabel } from "@/lib/views";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useImageUrls, useStoreMedia, warrantyLabel, type Warranty } from "@/lib/products";
import { supportWaUrl } from "@/lib/support";
import { isUuid, ratingBars, ratingOf, unitPrice, useCartActions, useMarketProducts, useProductDetail, useReviews, dbError, fmtDate, type Discount } from "@/lib/market";
import { AppShell, EmptyState } from "@/components/marketku/shell";
import { ProductImage, Stars, rpBuyer, useToggleWishlist, useWishlistIds } from "@/components/marketku/product-card";
import { productTypeText } from "@/components/marketku/product-sheet";
import { productHead } from "@/lib/meta";
import { getProductSeo } from "@/lib/seo.functions";
import { liveFlashPercent, useFlashSales } from "@/lib/flash";
import { FlashStrip } from "@/components/marketku/flash-strip";
import { rememberViewed } from "@/lib/recently-viewed";
import { ShareSheet } from "@/components/marketku/share-sheet";
import { useCompare } from "@/components/marketku/compare";
import { Bell, BellRing } from "lucide-react";
import { readRestock, toggleRestock, writeRestock } from "@/lib/buyer-tools";

export const Route = createFileRoute("/produk/$id")({
  staticData: { sitemap: true },
  loader: async ({ params }) => {
    const seo = await getProductSeo({ data: params.id });
    // Old /produk/<id> links move to the product's name link, e.g. /produk/chatgpgt-plus.
    if (seo?.slug && seo.slug !== params.id) throw redirect({ to: "/produk/$id", params: { id: seo.slug }, replace: true });
    return seo;
  },
  head: ({ params, loaderData }) => productHead(loaderData?.slug ?? params.id, loaderData),
  component: ProdukDetail,
});

const durText = (v: { lifetime: boolean; duration_value: number | null; duration_unit: string | null }) =>
  v.lifetime ? "Lifetime" : v.duration_value ? `${v.duration_value} ${v.duration_unit ?? "hari"}` : "-";

function ProdukDetail() {
  const { id: param } = Route.useParams();
  const seo = Route.useLoaderData();
  const id = seo?.id ?? param;
  const router = useRouter();
  const navigate = useNavigate();
  const { user } = useAuth();
  const q = useProductDetail(id);
  const p = q.data;
  const reviews = useReviews({ product: id });
  const urls = useImageUrls([...(p?.images ?? []), ...(p?.variants.map((v) => v.image_url ?? "") ?? [])].filter(Boolean));
  const wish = useWishlistIds();
  const toggleWish = useToggleWishlist();
  const cart = useCartActions();
  const flash = useFlashSales(isUuid(id) ? [id] : []);
  const [vid, setVid] = useState<string | null>(null);
  const [img, setImg] = useState(0);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [guard, setGuard] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const compare = useCompare();
  const [watching, setWatching] = useState(false);
  useEffect(() => setWatching(readRestock().includes(id)), [id]);
  const toggleWatch = () => {
    const next = toggleRestock(readRestock(), id);
    writeRestock(next);
    const on = next.includes(id);
    setWatching(on);
    toast.success(on ? "Kami ingatkan di Beranda saat stok tersedia lagi" : "Pengingat stok dimatikan");
  };
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const key = `mk-viewed-${id}`;
    if (isUuid(id)) rememberViewed(id);
    if (!isUuid(id) || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("record_product_view", { p_product: id }).then(() => {}, () => {});
  }, [id]);
  const similar = useMarketProducts({ category: p?.category_id ?? null, limit: 12 });
  const ranked = useMarketProducts({ category: p?.category_id ?? null, limit: 200 });
  const vouchers = useQuery({
    queryKey: ["store_vouchers", p?.owner_id],
    enabled: !!p?.owner_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_store_vouchers", { p_owner: p!.owner_id });
      if (error) throw error;
      return data ?? [];
    },
  });
  const storeReviews = useReviews(p ? { seller: p.owner_id } : {});
  const media = useStoreMedia(p ? [p.owner_id] : []);
  const avatarPath = p ? media.data?.[p.owner_id]?.avatar_path ?? null : null;
  const avatarUrl = useImageUrls(avatarPath ? [avatarPath] : []).data?.[avatarPath ?? ""];

  if (q.isLoading) return <AppShell nav={false}><div className="m-3 h-96 animate-pulse rounded-2xl border bg-card" /></AppShell>;
  if (!p) return <AppShell><div className="p-3"><EmptyState icon={Package} title="Produk tidak ditemukan" desc="Produk ini tidak tersedia atau sudah dinonaktifkan." /></div></AppShell>;

  const v = p.variants.find((x) => x.id === vid) ?? p.variants.find((x) => x.stock > 0 || p.product_type === "preorder") ?? p.variants[0];
  const pre = p.product_type === "preorder";
  const stock = v ? (pre ? (v.preorder_quota && v.preorder_quota > 0 ? v.preorder_quota : 999) : v.stock) : 0;
  const closed = !p.store?.is_open;
  const own = user?.id === p.owner_id;
  const canBuy = !!v && stock > 0 && !closed && p.status === "active" && !own;
  // Like marketku.id: a closed store (or a sold-out product) can still be viewed and chatted about, but not ordered.
  const soldOut = !pre && p.variants.every((x) => x.stock <= 0);
  const blocked = closed ? "Toko sedang tutup" : soldOut ? "Stok habis" : null;
  const rating = ratingOf(reviews.data ?? []);
  const wished = wish.data?.has(p.id) ?? false;
  const gallery = [...new Set([...p.images, ...p.variants.map((x) => x.image_url ?? "")].filter(Boolean))];
  const storeRating = ratingOf(storeReviews.data ?? []);
  const shown = gallery[Math.min(img, gallery.length - 1)];
  const fp = liveFlashPercent(flash.data, p.id, Date.now(), qty);
  const price = v ? unitPrice(Number(v.price), qty, v.discount as Discount, fp) : 0;

  const needLogin = () => { toast("Masuk dulu untuk melanjutkan"); navigate({ to: "/login" }); };
  const addCart = async () => {
    if (!user) return needLogin();
    if (!v || !canBuy) return;
    if (await cart.add(p.id, v.id, 1)) { setAdded(true); toast.success("Ditambahkan ke keranjang"); window.setTimeout(() => setAdded(false), 2500); }
  };
  const chat = async () => {
    if (!user) return needLogin();
    if (own) { toast("Ini produk toko kamu sendiri"); return; }
    const { data, error } = await supabase.rpc("start_conversation", { p_seller: p.owner_id });
    if (error || !data) { toast.error(dbError(error)); return; }
    navigate({ to: "/chat/$id", params: { id: data }, search: { produk: p.id } });
  };
  const share = () => setShareOpen(true);
  const w = v?.warranty as Warranty | null;
  // Peringkat terlaris di kategori yang sama — hanya tampil kalau produk sudah pernah terjual.
  const rank = p.sold_count > 0 && ranked.data
    ? [...ranked.data].sort((a, b) => b.sold_count - a.sold_count).findIndex((x) => x.id === p.id) + 1
    : 0;
  const copyVoucher = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success(`Kode ${code} disalin`); } catch { toast(code); }
  };

  return (
    <AppShell nav={false} header={false}>
      <div className="pb-28">
        <div className="relative">
          <button type="button" aria-label="Lihat foto produk" onClick={() => gallery.length && setViewer(true)} className="block w-full">
            <ProductImage url={shown ? urls.data?.[shown] : undefined} alt={p.name} className="aspect-square w-full" />
          </button>
          <button aria-label="Kembali" onClick={() => router.history.back()} className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-card/80 shadow backdrop-blur transition active:scale-90"><ArrowLeft className="h-5 w-5" /></button>
          <div className="absolute right-3 top-3 flex gap-2">
            <button aria-label="Bagikan" onClick={share} className="grid h-10 w-10 place-items-center rounded-full bg-card/80 shadow backdrop-blur transition active:scale-90"><Share2 className="h-5 w-5" /></button>
            <button aria-label={compare.has(p.id) ? "Hapus dari Bandingkan" : "Bandingkan"} onClick={() => compare.toggle(p.id)} className={`grid h-10 w-10 place-items-center rounded-full shadow backdrop-blur transition active:scale-90 ${compare.has(p.id) ? "bg-primary text-primary-foreground" : "bg-card/80"}`}><GitCompareArrows className="h-5 w-5" /></button>
            <button aria-label="Menu lainnya" onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full bg-card/80 shadow backdrop-blur transition active:scale-90"><MoreVertical className="h-5 w-5" /></button>
          </div>
          {blocked && <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-background/30 bg-foreground/75 px-4 py-1.5 text-[12.5px] font-bold text-background shadow backdrop-blur">{blocked}</span>}
        </div>
        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto bg-card px-4 pt-3">
            {gallery.map((g, i) => (
              <button key={g + i} aria-label={`Foto ${i + 1}`} onClick={() => setImg(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition active:scale-95 ${i === img ? "border-primary" : "border-border opacity-70"}`}>
                <ProductImage url={urls.data?.[g]} alt={`${p.name} ${i + 1}`} className="h-full w-full" />
              </button>
            ))}
          </div>
        )}

        <FlashStrip sales={flash.data ?? []} />
        <section className="space-y-2.5 bg-card px-3.5 pb-3 pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex flex-wrap items-baseline gap-x-1.5 font-bold leading-none text-primary"><span><span className="text-[15px]">Rp</span><span className="text-[22px]">{rpBuyer(price).replace(/^Rp/, "")}</span></span>
              {v && Number(v.price) > price && (<>
                <span className="text-[13px] font-normal text-muted-foreground line-through">{rpBuyer(Number(v.price))}</span>
                <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11.5px] text-destructive">{Math.round((1 - price / Number(v.price)) * 100)}%</span>
              </>)}
            </p>
            <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
              <span>{p.sold_count} terjual</span>
              <button aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"} onClick={() => void toggleWish(p.id, wished)} className="transition active:scale-90"><Heart className={`h-[18px] w-[18px] ${wished ? "fill-destructive text-destructive" : ""}`} /></button>
            </div>
          </div>
          <h1 className="text-[14.5px] font-bold leading-snug">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] shadow-sm"><Star className="h-3.5 w-3.5 fill-warning text-warning" /> <b>{rating.avg || 0}</b> <span className="text-muted-foreground">({rating.count} ulasan)</span></p>
            <span className="text-[11.5px] text-muted-foreground">{viewsLabel(p.view_count)}</span>
            {rank > 0 && rank <= 10 && p.product_categories?.name && (
              <span className="text-[11.5px] font-semibold text-warning">🏅 No. {rank} terlaris di {p.product_categories.name}</span>
            )}
          </div>

          {(vouchers.data?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-semibold">Voucher Toko</p>
              <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                {vouchers.data!.map((vc) => (
                  <button key={vc.code} type="button" onClick={() => void copyVoucher(vc.code)} aria-label={`Salin kode voucher ${vc.code}`}
                    className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-primary/40 bg-accent text-left transition active:scale-95">
                    <span className="flex flex-col justify-center px-2.5 py-1.5">
                      <span className="text-[12px] font-bold text-primary">{vc.value_type === "percent" ? `Diskon ${Number(vc.value)}%` : `Potongan ${rpBuyer(Number(vc.value))}`}</span>
                      <span className="text-[10px] text-muted-foreground">{Number(vc.min_spend) > 0 ? `Min. belanja ${rpBuyer(Number(vc.min_spend))}` : "Tanpa minimum belanja"}</span>
                    </span>
                    <span className="flex items-center border-l border-dashed border-primary/40 px-2 text-[10.5px] font-bold tracking-wide text-primary">{vc.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {p.variants.length > 0 && (
            <div>
              <div className="mb-1.5 flex justify-between text-[12px]"><span className="font-semibold">Pilih varian:</span><span className="font-semibold text-primary">{v?.name}</span></div>
              <div className="grid grid-cols-2 gap-2">
                {p.variants.map((x) => {
                  const empty = !pre && x.stock <= 0;
                  const on = v?.id === x.id;
                  return (
                    <button key={x.id} disabled={empty} onClick={() => { setVid(x.id); setQty(1); }}
                      className={`relative rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition active:scale-95 ${on ? "border-primary bg-accent text-primary ring-1 ring-primary" : ""} ${empty ? "border-destructive/30 bg-destructive/5 text-muted-foreground" : ""}`}>
                      {empty && <span className="absolute -top-2 right-2 rounded bg-card px-1 text-[9px] text-destructive">Habis</span>}
                      {x.name}
                      {(() => {
                        const base = Number(x.price); const net = unitPrice(base, 1, x.discount as Discount, fp);
                        return base > net ? <span className="mt-0.5 block text-[9.5px] font-medium text-success">Hemat {rpBuyer(base - net)} · {Math.round((1 - net / base) * 100)}%</span> : null;
                      })()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 border-b pb-2.5 pt-1.5 text-center text-[10.5px] text-muted-foreground">
            <span className="flex flex-col items-center gap-1"><Zap className="h-3.5 w-3.5 text-primary" />{pre ? "Pre-order manual" : "Pengiriman Instan"}</span>
            <span className="flex flex-col items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" />{w ? warrantyLabel(w) : "Tanpa garansi"}</span>
          </div>
          {p.store && (
            <Link to="/toko/$slug" params={{ slug: p.store.slug || p.owner_id }} className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 shadow-sm transition active:scale-[0.98]">
              {avatarUrl
                ? <img src={avatarUrl} alt={p.store.store_name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-primary"><Store className="h-5 w-5" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold">{p.store.store_name}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3 fill-warning text-warning" /><b className="text-foreground">{storeRating.count > 0 ? storeRating.avg.toFixed(1) : "0"}</b> · {storeRating.count} reviews
                </span>
              </span>
            </Link>
          )}
        </section>

        <section className="mt-2.5 rounded-2xl border bg-card px-4 pb-3 pt-5 shadow-sm">
          <h2 className="mb-2 text-[18px] font-bold">Spesifikasi</h2>
          <div className="divide-y divide-border">
            {[["Kategori", p.product_categories?.name ?? "-"], ["Tipe produk", productTypeText(p.product_type)], ["Durasi", v ? durText(v) : "-"], ["Garansi", w ? warrantyLabel(w) : "Tanpa garansi"], ["Varian", v?.name ?? "-"], ["Stok", closed ? "Toko tutup" : pre ? "Pre-order" : soldOut ? "Stok habis" : `Stok ${v?.stock ?? 0}`]].map(([a, b]) => (
              <div key={a} className="flex justify-between gap-4 py-3 text-[13.5px]"><span className="text-muted-foreground">{a}</span><span className="text-right font-semibold">{b}</span></div>
            ))}
          </div>
          <div className="-mx-4 my-4 h-1.5 bg-background" />
          <h2 className="mb-2 text-[18px] font-bold">Deskripsi</h2>
          <div className="relative">
            <p className={`whitespace-pre-line text-[13.5px] leading-relaxed ${more ? "" : "line-clamp-[10]"}`}>{p.description || "Belum ada deskripsi."}</p>
            {!more && p.description.length > 160 && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />}
          </div>
          {p.description.length > 160 && <button onClick={() => setMore(!more)} className="mt-2 text-[11px] font-semibold text-primary">{more ? "Sembunyikan" : "Selengkapnya"}</button>}
          {p.usage_guide && more && (<><h3 className="pt-2 text-[13px] font-bold">Cara Pakai</h3><p className="whitespace-pre-line text-[12.5px]">{p.usage_guide}</p></>)}
          <button type="button" onClick={() => setGuard(true)} className="mt-3 flex w-full items-center gap-2 border-t pt-3 text-left text-[11.5px] transition active:opacity-70"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> <span className="flex-1">Trade Guard — Belanja aman bergaransi</span><ChevronRight className="h-4 w-4 text-primary" /></button>
        </section>

        <section className="mt-2.5 rounded-2xl border bg-card px-3 py-4 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-3">
            <h2 className="text-[14px] font-bold">Ulasan Pembeli</h2>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-primary">{rating.count} ulasan</span>
            {rating.count > 0 && <Link to="/ulasan/$id" params={{ id: p.id }} className="ml-auto inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-primary">Lihat semua <ChevronRight className="h-3.5 w-3.5" /></Link>}
          </div>
          {rating.count === 0 ? (
            <div className="mt-3 flex gap-2.5 rounded-xl border border-dashed border-primary/40 bg-accent/40 p-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-primary/40 bg-card text-primary"><MessageSquareQuote className="h-3.5 w-3.5" /></span>
              <div><p className="text-[12px] font-semibold">Belum ada ulasan</p><p className="text-[11px] leading-snug text-muted-foreground">Jadilah pembeli pertama yang memberi rating setelah transaksi selesai.</p></div>
            </div>
          ) : (
            <>
              <div className="mt-3 rounded-2xl border bg-accent/40 p-3.5">
                <div className="rounded-xl border bg-card py-3 text-center">
                  <p className="text-[24px] font-bold leading-none">{rating.avg.toFixed(1)}</p>
                  <div className="mt-2 flex justify-center"><Stars n={Math.round(rating.avg)} size="h-3.5 w-3.5" /></div>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">dari {rating.count} ulasan</p>
                </div>
                <div className="mt-2.5 space-y-2">
                  {ratingBars(reviews.data ?? []).map((b) => (
                    <div key={b.star} className="flex items-center gap-2.5 text-[11px] font-semibold">
                      <span className="flex w-7 items-center gap-0.5 text-primary"><Star className="h-3 w-3 fill-primary text-primary" />{b.star}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15"><span className="block h-full rounded-full bg-gradient-to-r from-primary to-primary/70" style={{ width: `${(b.n / rating.count) * 100}%` }} /></span>
                      <span className="w-4 text-right text-muted-foreground">{b.n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-1">
                {(reviews.data ?? []).slice(0, 5).map((r) => (
                  <div key={r.id} className="flex gap-3 border-b py-3.5 last:border-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[13px] font-bold text-primary-foreground shadow-md">{r.buyer_label.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2"><b className="truncate text-[12.5px]">{r.buyer_label}</b><span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(r.created_at)}</span></div>
                      <Stars n={r.rating} />
                      <p className="text-[12.5px]">{r.comment || "Tidak ada komentar."}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {(similar.data ?? []).filter((x) => x.id !== p.id).length > 0 && (
          <section className="mt-2.5 px-3 py-4">
            <h2 className="mb-3 text-[12px] font-bold">Produk Serupa</h2>
            <Similar items={(similar.data ?? []).filter((x) => x.id !== p.id)} />
          </section>
        )}
      </div>

      {showTop && (
        <button aria-label="Kembali ke atas" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-[78px] right-[max(12px,calc(50%-224px+12px))] z-40 grid h-10 w-10 place-items-center rounded-full border bg-card text-primary shadow-md transition active:scale-90"><ArrowUp className="h-4 w-4" /></button>
      )}
      {blocked && !own ? (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t bg-card px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-primary">{blocked}</p>
            <p className="truncate text-[11px] text-muted-foreground">Produk bisa dilihat, belum bisa order</p>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-md border">
            <button aria-label="Chat seller" onClick={() => void chat()} className="flex h-11 items-center gap-1.5 border-r px-3 text-[12.5px] font-semibold transition active:bg-muted"><MessageCircle className="h-4 w-4" /> Chat</button>
            <button aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"} onClick={() => void toggleWish(p.id, wished)} className="grid h-11 w-11 place-items-center border-r transition active:bg-muted"><Heart className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : ""}`} /></button>
            {soldOut && !closed && (
              <button aria-label={watching ? "Matikan pengingat stok" : "Ingatkan saat stok tersedia"} aria-pressed={watching} onClick={toggleWatch} className={`grid h-11 w-11 place-items-center border-r transition active:bg-muted ${watching ? "bg-accent text-primary" : ""}`}>{watching ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</button>
            )}
            <button aria-label="Bagikan" onClick={share} className="grid h-11 w-11 place-items-center transition active:bg-muted"><Share2 className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t bg-card px-2.5 py-3">
        <button aria-label="Chat seller" onClick={() => void chat()} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border-[1.5px] border-primary text-primary transition active:scale-90"><MessageCircle className="h-[18px] w-[18px]" /></button>
        <button disabled={!canBuy} onClick={() => setSheet(true)} className="h-[46px] flex-1 rounded-full border-[1.5px] border-primary text-[13px] font-bold text-primary transition active:scale-95 disabled:opacity-40">Beli Sekarang</button>
        <button disabled={!canBuy} onClick={() => void addCart()} className="flex h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-[12.5px] font-bold leading-none text-primary-foreground transition active:scale-95 disabled:opacity-40">
          {added ? <><Check className="h-4 w-4" />Ditambahkan</> : <><ShoppingCart className="h-4 w-4" />Keranjang</>}
        </button>
      </div>
      )}
      {own && <p className="fixed inset-x-0 bottom-[76px] z-40 mx-auto max-w-md bg-accent py-1 text-center text-xs font-semibold text-primary">Ini produk toko kamu</p>}

      <Dialog.Root open={sheet} onOpenChange={setSheet}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-xl font-bold">Masukkan Jumlah</Dialog.Title>
              <Dialog.Close aria-label="Tutup" className="grid h-10 w-10 place-items-center rounded-full border transition active:scale-90"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <div className="mt-5 flex items-stretch overflow-hidden rounded-xl border">
              <button aria-label="Kurangi" onClick={() => setQty(Math.max(1, qty - 1))} className="grid w-12 place-items-center border-r"><Minus className="h-4 w-4" /></button>
              <input aria-label="Jumlah" value={qty} inputMode="numeric" onChange={(e) => setQty(Math.max(1, Math.min(stock, Number(e.target.value.replace(/\D/g, "")) || 1)))} className="w-12 border-r bg-transparent text-center font-bold outline-none" />
              <button aria-label="Tambah" onClick={() => setQty(Math.min(stock, qty + 1))} className="grid w-12 place-items-center border-r"><Plus className="h-4 w-4" /></button>
              <span className="grid flex-1 place-items-center py-3">{pre ? "Pre-order" : `Stok ${stock}`}</span>
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4"><span className="text-muted-foreground">Subtotal</span><span className="text-2xl font-bold text-primary">{rpBuyer(price * qty)}</span></div>
            <button onClick={() => { setSheet(false); if (v) navigate({ to: "/checkout", search: { items: `${v.id}:${qty}` } }); }} className="mt-4 w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground shadow-lg transition active:scale-[0.98]">Lanjut ke Checkout</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={viewer} onOpenChange={setViewer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col px-4 py-6 data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <Dialog.Title className="sr-only">Foto produk {img + 1} dari {gallery.length}</Dialog.Title>
            <div className="flex justify-end">
              <Dialog.Close aria-label="Tutup" className="grid h-12 w-12 place-items-center rounded-full border bg-card/80 shadow transition active:scale-90"><X className="h-6 w-6" /></Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center py-4">
              {shown && urls.data?.[shown]
                ? <img key={shown} src={urls.data[shown]} alt={p.name} className="mk-pop-in max-h-[calc(100dvh-13rem)] max-w-full rounded-2xl border object-contain shadow-2xl" />
                : <ProductImage alt={p.name} className="aspect-square w-full rounded-2xl" />}
            </div>
            {gallery.length > 1 && (
              <>
                <p className="pb-3 text-center text-sm text-muted-foreground">{img + 1} / {gallery.length}</p>
                <div className="flex justify-center gap-3">
                  <button onClick={() => setImg((img - 1 + gallery.length) % gallery.length)} className="flex items-center gap-2 rounded-full border bg-card/80 px-5 py-3 font-bold shadow transition active:scale-95"><ChevronLeft className="h-5 w-5" /> Sebelumnya</button>
                  <button onClick={() => setImg((img + 1) % gallery.length)} className="flex items-center gap-2 rounded-full border bg-card/80 px-5 py-3 font-bold shadow transition active:scale-95">Berikutnya <ChevronRight className="h-5 w-5" /></button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={guard} onOpenChange={setGuard}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-md flex-col rounded-t-3xl bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <div className="flex items-center justify-between border-b px-4 py-3.5">
              <Dialog.Title className="text-[16px] font-bold">Trade Guard &amp; proteksi buyer</Dialog.Title>
              <Dialog.Close aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition active:scale-90"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <div className="space-y-2.5 overflow-y-auto px-4 pb-6 pt-3.5">
              <p className="text-[12px] leading-relaxed text-muted-foreground">Sinyal keamanan utama ditaruh di depan supaya kamu cepat paham jalur bayar, garansi, dan bantuan.</p>
              {[
                { icon: Shield, t: "Trade Guard aktif", d: "Dana masuk lewat jalur pembayaran resmi dan status pesanan tetap bisa kamu pantau dari riwayat." },
                { icon: Shield, t: w ? "Proteksi seller tersedia" : "Tanpa garansi seller", d: w ? "Detail proteksi bisa berbeda per produk atau durasi. Cek riwayat dan data akses sesudah pesanan dibuat untuk status akhirnya." : "Produk ini tidak mencantumkan garansi. Cek deskripsi dan tanyakan ke seller sebelum membeli." },
                pre
                  ? { icon: Clock, t: "Pesanan diproses seller", d: "Kalau seller perlu proses manual, riwayat pembelian membantumu melihat progres order dan akses produk." }
                  : { icon: Zap, t: "Pengiriman instan", d: "Produk dikirim otomatis setelah pembayaran terkonfirmasi dan bisa kamu lihat di riwayat pembelian." },
                { icon: Star, t: "Review pembeli terverifikasi", d: rating.count > 0 ? `${rating.count} pembeli sudah memberi ulasan dengan rata-rata ${rating.avg.toFixed(1)}.` : "Belum ada ulasan. Ulasan hanya bisa diberikan pembeli setelah transaksi selesai." },
              ].map((x) => (
                <div key={x.t} className="flex gap-3 rounded-2xl border bg-background/50 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-primary"><x.icon className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="text-[12.5px] font-semibold">{x.t}</p><p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{x.d}</p></div>
                </div>
              ))}
              <div className="flex gap-2 pt-1.5">
                <Link to="/bantuan" onClick={() => setGuard(false)} className="rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-semibold text-primary-foreground transition active:scale-95">Buka Pusat Bantuan</Link>
                <a href={supportWaUrl(`Halo Marketku, saya butuh bantuan soal produk "${p.name}".`)} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold transition active:scale-95">Support</a>
              </div>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">Kalau order tidak sesuai, siapkan order ID, screenshot, dan kronologi singkat agar support bisa review lebih cepat.</p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} title={p.name} url={typeof window === "undefined" ? "" : window.location.href} text={price > 0 ? `Cek ${p.name} cuma ${rpBuyer(price)} di Marketku` : `Cek ${p.name} di Marketku`} />
      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card pb-4 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <Dialog.Title className="text-lg font-bold">Ada yang bisa kami bantu?</Dialog.Title>
              <Dialog.Close aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full transition active:scale-90"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <button onClick={() => { setMenu(false); navigate({ to: "/" }); }} className="flex w-full items-center gap-4 border-b px-5 py-4 text-left transition active:bg-muted"><Home className="h-5 w-5" /> Kembali ke Beranda</button>
            <button onClick={() => { setMenu(false); navigate({ to: "/bandingkan" }); }} className="flex w-full items-center gap-4 border-b px-5 py-4 text-left transition active:bg-muted"><GitCompareArrows className="h-5 w-5" /> Lihat Bandingkan{compare.ids.length ? ` (${compare.ids.length})` : ""}</button>
            <button onClick={() => { setMenu(false); void chat(); }} className="flex w-full items-center gap-4 border-b px-5 py-4 text-left transition active:bg-muted"><MessageCircle className="h-5 w-5" /> Chat penjual</button>
            <a href={supportWaUrl(`Halo Marketku, saya butuh bantuan soal produk "${p.name}".`)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)} className="flex w-full items-center gap-4 border-b px-5 py-4 text-left transition active:bg-muted"><MessageCircle className="h-5 w-5" /> Hubungi bantuan Marketku</a>
            <button onClick={() => { setMenu(false); if (!user) return needLogin(); navigate({ to: "/dispute" }); }} className="flex w-full items-center gap-4 px-5 py-4 text-left transition active:bg-muted"><Flag className="h-5 w-5" /> Laporkan produk</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}

function Similar({ items }: { items: { id: string; name: string; images: string[]; minPrice: number; rating: { avg: number; count: number }; sold_count: number }[] }) {
  const urls = useImageUrls(items.map((p) => p.images[0] ?? "").filter(Boolean));
  return (
    <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-2">
      {items.map((p) => {
        const tag = p.sold_count >= 100 ? "Seller sering dilihat" : p.rating.count > 0 && p.rating.avg >= 4.5 ? "Rating kuat" : null;
        return (
          <Link key={p.id} to="/produk/$id" params={{ id: p.id }} className="w-[136px] shrink-0 overflow-hidden rounded-xl border bg-card shadow-sm transition active:scale-[0.98]">
            <div className="p-2 pb-0"><ProductImage url={p.images[0] ? urls.data?.[p.images[0]] : undefined} alt={p.name} className="aspect-square rounded-md" /></div>
            <div className="space-y-1 p-2">
              <p className="line-clamp-2 min-h-[2.5em] text-[11px] font-semibold leading-tight">{p.name}</p>
              <p className="text-[14px] font-bold text-primary">{rpBuyer(p.minPrice)}</p>
              <p className="flex items-center gap-1 text-[9.5px] text-warning"><Star className="h-2.5 w-2.5 fill-warning" />{p.rating.count > 0 ? p.rating.avg.toFixed(1) : "0"} · {p.rating.count} ulasan</p>
              <p className="text-[9.5px] text-muted-foreground">{p.sold_count} terjual</p>
              <div className="flex flex-col items-start gap-1 pt-0.5">
                <span className="rounded-full border px-1.5 py-0.5 text-[8.5px] text-muted-foreground">Kategori serupa</span>
                {tag && <span className="rounded-full border px-1.5 py-0.5 text-[8.5px] text-muted-foreground">{tag}</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
