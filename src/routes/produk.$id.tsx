import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Share2, Heart, Star, Zap, ShieldCheck, Store, ChevronRight, ChevronLeft, MessageSquareQuote, MessageCircle, ShoppingCart, Check, X, Minus, Plus, Package, MoreVertical, Home, Flag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useImageUrls, useStoreMedia, warrantyLabel, type Warranty } from "@/lib/products";
import { supportWaUrl } from "@/lib/support";
import { ratingBars, ratingOf, unitPrice, useCartActions, useMarketProducts, useProductDetail, useReviews, dbError, fmtDate, type Discount } from "@/lib/market";
import { AppShell, EmptyState } from "@/components/marketku/shell";
import { ProductImage, Stars, rpBuyer, useToggleWishlist, useWishlistIds } from "@/components/marketku/product-card";
import { productTypeText } from "@/components/marketku/product-sheet";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/produk/$id")({
  head: () => pageMeta("Detail Produk — Marketku", "Lihat varian, harga, spesifikasi, dan ulasan produk digital di Marketku."),
  component: ProdukDetail,
});

const durText = (v: { lifetime: boolean; duration_value: number | null; duration_unit: string | null }) =>
  v.lifetime ? "Lifetime" : v.duration_value ? `${v.duration_value} ${v.duration_unit ?? "hari"}` : "-";

function ProdukDetail() {
  const { id } = Route.useParams();
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
  const [vid, setVid] = useState<string | null>(null);
  const [img, setImg] = useState(0);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    const key = `mk-viewed-${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("record_product_view", { p_product: id }).then(() => {}, () => {});
  }, [id]);
  const similar = useMarketProducts({ category: p?.category_id ?? null, limit: 12 });
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
  const rating = ratingOf(reviews.data ?? []);
  const wished = wish.data?.has(p.id) ?? false;
  const gallery = [...new Set([...p.images, ...p.variants.map((x) => x.image_url ?? "")].filter(Boolean))];
  const storeRating = ratingOf(storeReviews.data ?? []);
  const shown = gallery[Math.min(img, gallery.length - 1)];
  const price = v ? unitPrice(Number(v.price), qty, v.discount as Discount) : 0;

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
  const share = async () => {
    const url = window.location.href;
    try { if (navigator.share) await navigator.share({ title: p.name, url }); else { await navigator.clipboard.writeText(url); toast.success("Link produk disalin"); } } catch { /* dibatalkan */ }
  };
  const w = v?.warranty as Warranty | null;

  return (
    <AppShell nav={false} header={false}>
      <div className="pb-28">
        <div className="relative">
          <button type="button" aria-label="Lihat foto produk" onClick={() => gallery.length && setViewer(true)} className="block w-full">
            <ProductImage url={shown ? urls.data?.[shown] : undefined} alt={p.name} className="aspect-square w-full" />
          </button>
          <button aria-label="Kembali" onClick={() => router.history.back()} className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-card/80 shadow backdrop-blur transition active:scale-90"><ArrowLeft className="h-5 w-5" /></button>
          <div className="absolute right-3 top-3 flex gap-2">
            <button aria-label="Bagikan" onClick={() => void share()} className="grid h-10 w-10 place-items-center rounded-full bg-card/80 shadow backdrop-blur transition active:scale-90"><Share2 className="h-5 w-5" /></button>
            <button aria-label="Menu lainnya" onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full bg-card/80 shadow backdrop-blur transition active:scale-90"><MoreVertical className="h-5 w-5" /></button>
          </div>
          {closed && <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-1.5 text-center text-xs font-bold text-background">Toko sedang tutup</span>}
        </div>
        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto bg-card px-4 pt-3">
            {gallery.map((g, i) => (
              <button key={g + i} aria-label={`Foto ${i + 1}`} onClick={() => setImg(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition active:scale-95 ${i === img ? "border-primary" : "border-border opacity-70"}`}>
                <ProductImage url={urls.data?.[g]} alt={`${p.name} ${i + 1}`} className="h-full w-full" />
              </button>
            ))}
          </div>
        )}

        <section className="space-y-3 bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-2xl font-bold text-primary">{rpBuyer(price)}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{p.sold_count} terjual</span>
              <button aria-label={wished ? "Hapus dari wishlist" : "Simpan ke wishlist"} onClick={() => void toggleWish(p.id, wished)} className="transition active:scale-90"><Heart className={`h-5 w-5 ${wished ? "fill-destructive text-destructive" : ""}`} /></button>
            </div>
          </div>
          <h1 className="text-lg font-bold leading-snug">{p.name}</h1>
          <p className="flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-warning text-warning" /> <b>{rating.avg || 0}</b> <span className="text-muted-foreground">({rating.count} ulasan)</span></p>

          {p.variants.length > 0 && (
            <div>
              <div className="mb-2 flex justify-between text-sm"><span className="font-semibold">Pilih varian:</span><span className="font-semibold text-primary">{v?.name}</span></div>
              <div className="grid grid-cols-2 gap-2">
                {p.variants.map((x) => {
                  const empty = !pre && x.stock <= 0;
                  const on = v?.id === x.id;
                  return (
                    <button key={x.id} disabled={empty} onClick={() => { setVid(x.id); setQty(1); }}
                      className={`relative rounded-lg border px-2 py-2 text-xs font-semibold transition active:scale-95 ${on ? "border-primary bg-accent text-primary ring-1 ring-primary" : ""} ${empty ? "border-destructive/30 bg-destructive/5 text-muted-foreground" : ""}`}>
                      {empty && <span className="absolute -top-2 right-2 rounded bg-card px-1 text-[10px] text-destructive">Habis</span>}
                      {x.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 border-t pt-3 text-center text-xs text-muted-foreground">
            <span className="flex flex-col items-center gap-1"><Zap className="h-4 w-4 text-primary" />{pre ? "Pre-order manual" : "Pengiriman Instan"}</span>
            <span className="flex flex-col items-center gap-1"><ShieldCheck className="h-4 w-4 text-primary" />{w ? warrantyLabel(w) : "Tanpa garansi"}</span>
          </div>
          {p.store && (
            <Link to="/toko/$slug" params={{ slug: p.store.slug || p.owner_id }} className="flex items-center gap-3 rounded-2xl border bg-background/40 px-4 py-3 transition active:scale-[0.98]">
              {avatarUrl
                ? <img src={avatarUrl} alt={p.store.store_name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-primary"><Store className="h-5 w-5" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold">{p.store.store_name}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-warning text-warning" /><b className="text-foreground">{storeRating.count > 0 ? storeRating.avg.toFixed(1) : "0"}</b> · {storeRating.count} reviews
                </span>
              </span>
            </Link>
          )}
        </section>

        <section className="mt-2 bg-card px-5 py-6">
          <h2 className="mb-3 text-xl font-bold">Spesifikasi</h2>
          <div className="divide-y divide-border">
            {[["Kategori", p.product_categories?.name ?? "-"], ["Tipe produk", productTypeText(p.product_type)], ["Durasi", v ? durText(v) : "-"], ["Garansi", w ? warrantyLabel(w) : "Tanpa garansi"], ["Varian", v?.name ?? "-"], ["Stok", closed ? "Toko tutup" : pre ? "Pre-order" : `Stok ${v?.stock ?? 0}`]].map(([a, b]) => (
              <div key={a} className="flex justify-between gap-4 py-3.5 text-[15px]"><span className="text-muted-foreground">{a}</span><span className="text-right font-medium">{b}</span></div>
            ))}
          </div>
          <div className="my-4 h-2 bg-background/60" />
        </section>
        <section className="space-y-3 bg-card px-5 pb-4">
          <h2 className="text-xl font-bold">Deskripsi</h2>
          <p className={`whitespace-pre-line text-sm leading-relaxed ${more ? "" : "line-clamp-4"}`}>{p.description || "Belum ada deskripsi."}</p>
          {p.description.length > 160 && <button onClick={() => setMore(!more)} className="text-sm font-semibold text-primary">{more ? "Sembunyikan" : "Selengkapnya"}</button>}
          {p.usage_guide && more && (<><h3 className="pt-1 font-bold">Cara Pakai</h3><p className="whitespace-pre-line text-sm">{p.usage_guide}</p></>)}
          <p className="flex items-center gap-2 border-t pt-3 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /> Trade Guard — Belanja aman bergaransi</p>
        </section>

        <section className="mt-2 space-y-3 bg-card px-4 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold">Ulasan Pembeli</h2>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">{rating.count} ulasan</span>
            {rating.count > 0 && <Link to="/ulasan/$id" params={{ id: p.id }} className="ml-auto text-sm font-semibold text-primary">Lihat semua →</Link>}
          </div>
          {rating.count === 0 ? (
            <div className="flex gap-3 rounded-xl border border-dashed border-primary/40 bg-accent/40 p-4">
              <MessageSquareQuote className="h-6 w-6 shrink-0 text-primary" />
              <div><p className="font-semibold">Belum ada ulasan</p><p className="text-sm text-muted-foreground">Jadilah pembeli pertama yang memberi rating setelah transaksi selesai.</p></div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border p-3">
                <p className="text-center text-2xl font-bold">{rating.avg}</p>
                <p className="text-center text-xs text-muted-foreground">dari {rating.count} ulasan</p>
                {ratingBars(reviews.data ?? []).map((b) => (
                  <div key={b.star} className="flex items-center gap-2 text-xs"><Star className="h-3 w-3 fill-warning text-warning" />{b.star}
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${(b.n / rating.count) * 100}%` }} /></span>{b.n}</div>
                ))}
              </div>
              {(reviews.data ?? []).slice(0, 5).map((r) => (
                <div key={r.id} className="flex gap-3 border-b pb-3 last:border-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{r.buyer_label.charAt(0).toUpperCase()}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm"><b>{r.buyer_label}</b><span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span></div>
                    <Stars n={r.rating} />
                    <p className={`text-sm ${r.comment ? "" : "italic text-muted-foreground"}`}>{r.comment || "Tidak ada komentar."}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>

        {(similar.data ?? []).filter((x) => x.id !== p.id).length > 0 && (
          <section className="mt-2 bg-card px-4 py-4">
            <h2 className="mb-3 font-bold">Produk Serupa</h2>
            <Similar items={(similar.data ?? []).filter((x) => x.id !== p.id)} />
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t bg-card p-3">
        <button aria-label="Chat seller" onClick={() => void chat()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-primary text-primary transition active:scale-90"><MessageCircle className="h-5 w-5" /></button>
        <button disabled={!canBuy} onClick={() => (user ? setSheet(true) : needLogin())} className="h-12 flex-1 rounded-full border-2 border-primary font-bold text-primary transition active:scale-95 disabled:opacity-40">Beli Sekarang</button>
        <button disabled={!canBuy} onClick={() => void addCart()} className="flex h-12 flex-1 flex-col items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition active:scale-95 disabled:opacity-40">
          {added ? <><Check className="h-4 w-4" />Ditambahkan</> : <><ShoppingCart className="h-4 w-4" />Keranjang</>}
        </button>
      </div>
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

      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card pb-4 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <Dialog.Title className="text-lg font-bold">Ada yang bisa kami bantu?</Dialog.Title>
              <Dialog.Close aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full transition active:scale-90"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <button onClick={() => { setMenu(false); navigate({ to: "/" }); }} className="flex w-full items-center gap-4 border-b px-5 py-4 text-left transition active:bg-muted"><Home className="h-5 w-5" /> Kembali ke Beranda</button>
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
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {items.map((p) => (
        <Link key={p.id} to="/produk/$id" params={{ id: p.id }} className="w-40 shrink-0 overflow-hidden rounded-xl border">
          <ProductImage url={p.images[0] ? urls.data?.[p.images[0]] : undefined} alt={p.name} className="aspect-square" />
          <div className="p-2">
            <p className="line-clamp-2 text-sm font-semibold">{p.name}</p>
            <p className="mt-1 font-bold text-primary">{rpBuyer(p.minPrice)}</p>
            <p className="text-xs text-warning">★ {p.rating.avg || 0} · {p.rating.count} ulasan</p>
            <p className="text-xs text-muted-foreground">{p.sold_count} terjual</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
