import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Camera, Star, SlidersHorizontal, ChevronDown, ThumbsUp, MoreVertical, X, Check, ArrowUpDown } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/marketku/shell";
import { Stars } from "@/components/marketku/product-card";
import { ratingBars, ratingOf, useProductDetail, useReviews, fmtDate, type ReviewRow } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/ulasan/$id")({
  staticData: { sitemap: false },
  head: () => pageMeta("Ulasan Produk — Marketku", "Baca rating dan ulasan pembeli untuk produk dan toko di Marketku."),
  component: Ulasan,
});

const TOPICS = ["Kualitas Barang", "Kemasan", "Sesuai Deskripsi", "Pengiriman", "Pelayanan Seller"];
const SORT = ["Paling Membantu", "Terbaru", "Rating Tertinggi", "Rating Terendah"] as const;
const PER_PAGE = 10;
const HELP_KEY = "marketku-helpful";

function Ulasan() {
  const { id } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const product = useProductDetail(id);
  const [tab, setTab] = useState<"produk" | "toko">("produk");
  const prod = useReviews({ product: id });
  const shop = useReviews({ seller: product.data?.owner_id ?? "" });
  const rows = (tab === "produk" ? prod.data : shop.data) ?? [];
  const [rating, setRating] = useState<number | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [sort, setSort] = useState<(typeof SORT)[number]>("Terbaru");
  const [sheet, setSheet] = useState<null | "rating" | "topik" | "urut">(null);
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<string | null>(null);
  const [helped, setHelped] = useState<string[]>([]);
  useEffect(() => { try { setHelped(JSON.parse(window.localStorage.getItem(HELP_KEY) ?? "[]")); } catch { setHelped([]); } }, []);
  const toggleHelp = (rid: string) => {
    const next = helped.includes(rid) ? helped.filter((x) => x !== rid) : [...helped, rid];
    setHelped(next); window.localStorage.setItem(HELP_KEY, JSON.stringify(next));
  };

  const list = useMemo(() => {
    const f = rows.filter((r) => (rating == null || r.rating === rating) && (!topic || r.topic === topic));
    const by: Record<string, (a: ReviewRow, b: ReviewRow) => number> = {
      "Paling Membantu": (a, b) => b.helpful_count - a.helpful_count || b.created_at.localeCompare(a.created_at),
      Terbaru: (a, b) => b.created_at.localeCompare(a.created_at),
      "Rating Tertinggi": (a, b) => b.rating - a.rating,
      "Rating Terendah": (a, b) => a.rating - b.rating,
    };
    return [...f].sort(by[sort]);
  }, [rows, rating, topic, sort]);
  const r = ratingOf(rows);
  const happy = rows.length ? Math.round((rows.filter((x) => x.rating >= 4).length / rows.length) * 100) : 0;
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const chip = (on: boolean) => `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${on ? "border-primary bg-accent text-primary" : ""}`;

  return (
    <AppShell>
      <div className="bg-card">
        <div className="flex items-center gap-3 px-4 py-3">
          <button aria-label="Kembali" onClick={() => router.history.back()}><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-lg font-bold">Ulasan</h1>
        </div>
        <div className="grid grid-cols-2 border-b">
          {(["produk", "toko"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`border-b-2 py-2.5 text-sm font-semibold ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t === "produk" ? "Produk" : "Toko"}</button>
          ))}
        </div>
        <div className="flex gap-4 px-4 py-4">
          <div className="flex-1">
            <p className="flex items-end gap-1"><Star className="h-7 w-7 fill-warning text-warning" /><b className="text-4xl">{r.avg || 0}</b><span className="mb-1 text-muted-foreground">/5.0</span></p>
            <p className="mt-1 text-sm">{happy}% pembeli merasa puas</p>
            <p className="text-xs text-muted-foreground">{r.count} rating · {rows.filter((x) => x.comment).length} ulasan</p>
          </div>
          <div className="w-36 space-y-0.5">
            {ratingBars(rows).map((b) => (
              <div key={b.star} className="flex items-center gap-1.5 text-xs"><Star className="h-3 w-3 fill-warning text-warning" />{b.star}
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: r.count ? `${(b.n / r.count) * 100}%` : 0 }} /></span><span className="w-5 text-right">{b.n}</span></div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          <button className={chip(false)} disabled title="Belum ada ulasan dengan foto"><Camera className="h-4 w-4" /> Foto & Video</button>
          <button onClick={() => setSheet("rating")} className={chip(rating != null)}><Star className="h-4 w-4" /> {rating ? `${rating} Bintang` : "Rating"} <ChevronDown className="h-3.5 w-3.5" /></button>
          <button onClick={() => setSheet("topik")} className={chip(!!topic)}><SlidersHorizontal className="h-4 w-4" /> {topic ?? "Topik"} <ChevronDown className="h-3.5 w-3.5" /></button>
          <button onClick={() => setSheet("urut")} className={chip(sort !== "Terbaru")}><ArrowUpDown className="h-4 w-4" /> {sort} <ChevronDown className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="divide-y bg-card">
        {shown.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted-foreground">Belum ada ulasan yang cocok.</p>}
        {shown.map((x) => (
          <div key={x.id} className="relative px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-primary">{x.buyer_label.charAt(0).toUpperCase()}</span>
              <div className="flex-1"><b className="text-sm">{x.buyer_label}</b><p className="text-xs text-muted-foreground">{fmtDate(x.created_at)}</p></div>
              <Stars n={x.rating} size="h-4 w-4" />
              <button aria-label="Opsi ulasan" onClick={() => setMenu(menu === x.id ? null : x.id)}><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            {menu === x.id && (
              <button onClick={() => { setMenu(null); navigate({ to: "/kontak" }); }} className="absolute right-4 top-10 z-10 rounded-lg border bg-card px-4 py-2.5 text-sm shadow-lg">Laporkan Ulasan</button>
            )}
            {tab === "toko" && x.products?.name && <p className="mt-2 text-xs text-muted-foreground">{x.products.name}</p>}
            <p className={`mt-2 text-sm ${x.comment ? "" : "italic text-muted-foreground"}`}>{x.comment || "Tidak ada komentar"}</p>
            <button onClick={() => toggleHelp(x.id)} className={`mt-2 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${helped.includes(x.id) ? "border-primary text-primary" : "text-muted-foreground"}`}><ThumbsUp className="h-3.5 w-3.5" /> Membantu</button>
          </div>
        ))}
        {list.length > 0 && (
          <div className="flex items-center justify-between px-4 py-4 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Sebelumnya</button>
            <span>Halaman {page} dari {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-40">Berikutnya</button>
          </div>
        )}
      </div>

      <Dialog.Root open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl bg-card pb-4 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <div className="flex items-center justify-between px-4 py-4">
              <Dialog.Title className="font-bold">{sheet === "rating" ? "Filter Rating" : sheet === "topik" ? "Filter Topik" : "Urutkan"}</Dialog.Title>
              <Dialog.Close aria-label="Tutup"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            {sheet === "rating" && [5, 4, 3, 2, 1].map((n) => (
              <button key={n} onClick={() => { setRating(rating === n ? null : n); setSheet(null); setPage(1); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm">
                <Stars n={n} size="h-4 w-4" /> {n} Bintang {rating === n && <Check className="ml-auto h-4 w-4 text-primary" />}
              </button>
            ))}
            {sheet === "topik" && TOPICS.map((t) => (
              <button key={t} onClick={() => { setTopic(topic === t ? null : t); setSheet(null); setPage(1); }} className="flex w-full items-center px-4 py-3 text-sm">{t}{topic === t && <Check className="ml-auto h-4 w-4 text-primary" />}</button>
            ))}
            {sheet === "urut" && SORT.map((t) => (
              <button key={t} onClick={() => { setSort(t); setSheet(null); }} className="flex w-full items-center px-4 py-3 text-sm">{t}{sort === t && <Check className="ml-auto h-4 w-4 text-primary" />}</button>
            ))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}
