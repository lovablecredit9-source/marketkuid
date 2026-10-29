import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Package, Boxes, CheckSquare, FileText, SlidersHorizontal, ArrowUpDown, LayoutGrid, List, Plus, ChevronRight, Check } from "lucide-react";
import { PageTour } from "@/components/marketku/tour";
import { useAuth } from "@/lib/auth";
import { priceRange, useCategories, useImageUrls, useMyProducts, type MyProduct } from "@/lib/products";
import { SellerCard, SellerEmpty, StatCell } from "@/components/marketku/seller-ui";
import { ProductSheet, productTypeText } from "@/components/marketku/product-sheet";
import { StockManager } from "@/components/marketku/stock-manager";

type Search = { tab?: "stok"; pid?: string };

export const Route = createFileRoute("/seller/produk")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(s["tab"] === "stok" ? { tab: "stok" as const } : {}),
    ...(typeof s["pid"] === "string" ? { pid: s["pid"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Produk Saya — Seller Center Marketku" },
      { name: "description", content: "Tambah dan kelola produk digital toko kamu di Marketku." },
      { property: "og:title", content: "Produk Saya — Seller Center Marketku" },
      { property: "og:description", content: "Kelola produk dan stok toko." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Produk,
});

type Sort = "new" | "old" | "best" | "quality" | "lowstock" | "expensive" | "cheap";
const sortLabel: Record<Sort, string> = { new: "Terbaru", old: "Terlama", best: "Terlaris", quality: "Skor kualitas", lowstock: "Stok tipis", expensive: "Harga tertinggi", cheap: "Harga terendah" };
type Status = "all" | "active" | "draft" | "pending" | "rejected";
const statusLabel: Record<Status, string> = { all: "Semua", active: "Aktif", draft: "Draft", pending: "Menunggu", rejected: "Ditolak" };
const tour = [
  { title: "Tambah produk", desc: "Mulai dari sini untuk membuat produk baru lewat wizard langkah demi langkah.", target: "p-add" },
  { title: "Cari & saring", desc: "Cari produk, saring status, dan urutkan sesuai kebutuhan.", target: "p-search" },
  { title: "Tampilan", desc: "Ganti tampilan daftar atau grid.", target: "p-layout" },
  { title: "Filter kategori", desc: "Lompat cepat ke kategori tertentu.", target: "p-cats" },
  { title: "Daftar produk", desc: "Klik salah satu produk untuk edit, atur stok, atau lihat detail.", target: "p-list" },
  { title: "Selesai", desc: "Kamu bisa membuka panduan ini lagi lewat tombol Panduan." },
];

function Produk() {
  const { tab, pid } = Route.useSearch();
  const navigate = useNavigate({ from: "/seller/produk" });
  const { user } = useAuth();
  const products = useMyProducts(user?.id);
  const cats = useCategories();
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<Status>("all");
  const [menu, setMenu] = useState<"filter" | "sort" | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = products.data ?? [];
  const minPrice = (p: MyProduct) => Math.min(...p.product_variants.map((v) => Number(v.price)), Number.MAX_SAFE_INTEGER);
  const shown = useMemo(() => {
    const r = list.filter((p) => (cat === "all" || p.category_id === cat) && (status === "all" || p.status === status) &&
      (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())));
    const avail = (p: MyProduct) => p.product_stock.filter((x) => x.status === "available").length;
    const sold = (p: MyProduct) => p.product_stock.filter((x) => x.status !== "available").length;
    const score = (p: MyProduct) => p.images.length * 2 + (p.description ? Math.min(p.description.length / 100, 5) : 0) + p.product_variants.length;
    if (sort === "old") r.reverse();
    if (sort === "best") r.sort((a, b) => sold(b) - sold(a));
    if (sort === "quality") r.sort((a, b) => score(b) - score(a));
    if (sort === "lowstock") r.sort((a, b) => avail(a) - avail(b));
    if (sort === "cheap") r.sort((a, b) => minPrice(a) - minPrice(b));
    if (sort === "expensive") r.sort((a, b) => minPrice(b) - minPrice(a));
    return r;
  }, [list, cat, status, q, sort]);
  const catChips = (cats.data ?? []).map((c) => ({ ...c, n: list.filter((p) => p.category_id === c.id).length })).filter((c) => c.n > 0);
  const imgs = useImageUrls(list.map((p) => p.images[0] ?? "").filter(Boolean));
  const thumb = (p: MyProduct) => imgs.data?.[p.images[0] ?? ""];
  const open = list.find((p) => p.id === openId) ?? null;
  const stockProduct = tab === "stok" && pid ? list.find((p) => p.id === pid) : undefined;
  const setTab = (t: "produk" | "stok") => navigate({ search: t === "stok" ? { tab: "stok" } : {} });

  return (
    <>
      <SellerCard className="grid grid-cols-2 gap-1 p-2">
        {([["produk", "Produk", Package], ["stok", "Stok", Boxes]] as const).map(([k, label, I]) => {
          const on = (tab ?? "produk") === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center justify-center gap-3 rounded-xl py-3.5 font-semibold transition active:scale-95 ${on ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-foreground/80"}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${on ? "" : "bg-accent"}`}><I className="h-5 w-5" /></span>{label}
            </button>
          );
        })}
      </SellerCard>

      {tab === "stok" ? (
        stockProduct ? (
          <StockManager key={stockProduct.id} product={stockProduct} onBack={() => navigate({ search: {} })} />
        ) : (
          <SellerCard className="overflow-hidden">
            <p className="border-b px-4 py-3 text-sm font-semibold">Pilih produk untuk kelola stok</p>
            {products.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Memuat...</p>}
            {!products.isLoading && list.length === 0 && <SellerEmpty icon={Boxes} title="Belum ada stok" desc="Stok akan muncul setelah kamu menambahkan produk." />}
            {list.map((p) => (
              <ProductRow key={p.id} p={p} img={thumb(p)} onClick={() => navigate({ search: { tab: "stok", pid: p.id } })}
                meta={`${p.product_stock.filter((s) => s.status === "available").length} stok tersedia`} />
            ))}
          </SellerCard>
        )
      ) : (
        <>
          <SellerCard className="grid grid-cols-3 divide-x overflow-hidden">
            <button onClick={() => setStatus("all")} className="text-left"><StatCell icon={Package} label="Total Produk" value={String(list.length)} /></button>
            <button onClick={() => setStatus(status === "active" ? "all" : "active")} className="text-left"><StatCell icon={CheckSquare} label="Aktif" value={String(list.filter((p) => p.status === "active").length)} valueClass="text-success" /></button>
            <button onClick={() => setStatus(status === "draft" ? "all" : "draft")} className="text-left"><StatCell icon={FileText} label="Draft" value={String(list.filter((p) => p.status === "draft").length)} valueClass="text-primary" /></button>
          </SellerCard>

          <div className="relative">
          <SellerCard data-tour="p-search" className="flex items-stretch overflow-hidden">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk..."
              className="min-w-0 flex-1 rounded-l-2xl border-r bg-background/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
            <IconCell label={`Filter: ${statusLabel[status]}`} active={status !== "all" || menu === "filter"} dot={status !== "all"}
              onClick={() => setMenu(menu === "filter" ? null : "filter")}><SlidersHorizontal className="h-5 w-5" /></IconCell>
            <IconCell label={`Urutkan: ${sortLabel[sort]}`} onClick={() => setMenu(menu === "sort" ? null : "sort")} active dot>
              <ArrowUpDown className="h-5 w-5" /></IconCell>
            <span data-tour="p-layout" className="flex">
              <IconCell label="Tampilan grid" onClick={() => setLayout("grid")} active={layout === "grid"}><LayoutGrid className="h-5 w-5" /></IconCell>
              <IconCell label="Tampilan list" onClick={() => setLayout("list")} active={layout === "list"}><List className="h-5 w-5" /></IconCell>
            </span>
          </SellerCard>
          {menu && (
            <>
              <button aria-label="Tutup menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(null)} />
              <div className={`absolute top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border bg-popover py-1 shadow-2xl animate-in fade-in-0 zoom-in-95 ${menu === "filter" ? "left-0" : "right-24"}`}>
                {(menu === "filter" ? (Object.keys(statusLabel) as Status[]) : (Object.keys(sortLabel) as Sort[])).map((k) => {
                  const on = menu === "filter" ? status === k : sort === k;
                  return (
                    <button key={k} onClick={() => { if (menu === "filter") setStatus(k as Status); else setSort(k as Sort); setMenu(null); }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition active:bg-accent ${on ? "font-semibold text-primary" : "text-foreground/90"}`}>
                      {menu === "filter" ? statusLabel[k as Status] : sortLabel[k as Sort]} {on && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          </div>

          <div data-tour="p-cats" className="-mx-3 overflow-x-auto px-3 pb-2 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]">
            <div className="flex w-max gap-1">
              <Chip on={cat === "all"} onClick={() => setCat("all")} label="Semua" n={list.length} />
              {catChips.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)} label={c.name} n={c.n} />)}
            </div>
          </div>

          <div data-tour="p-list">
          {products.isLoading ? (
            <SellerCard><p className="p-8 text-center text-sm text-muted-foreground">Memuat produk...</p></SellerCard>
          ) : shown.length === 0 ? (
            <SellerCard>
              <SellerEmpty icon={Package} title={list.length ? "Produk tidak ditemukan" : "Belum ada produk"}
                desc={list.length ? "Coba kata kunci atau kategori lain." : "Tambahkan produk pertamamu supaya pembeli bisa mulai belanja."} />
            </SellerCard>
          ) : layout === "list" ? (
            <SellerCard className="overflow-hidden">
              {shown.map((p) => <ProductRow key={p.id} p={p} img={thumb(p)} onClick={() => setOpenId(p.id)} />)}
            </SellerCard>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shown.map((p) => (
                <button key={p.id} onClick={() => setOpenId(p.id)} className="overflow-hidden rounded-xl border bg-card text-left transition active:scale-[0.98]">
                  <div className="grid aspect-square place-items-center bg-muted">
                    {thumb(p) ? <img src={thumb(p)} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-bold uppercase">{p.name}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{priceRange(p.product_variants.map((v) => Number(v.price)))}</p>
                    <p className="text-xs text-muted-foreground">{metaText(p)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>

          <button data-tour="p-add" onClick={() => navigate({ to: "/seller/produk/baru", search: {} })}
            className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-xl bg-foreground px-5 py-3.5 font-semibold text-background shadow-2xl transition active:scale-95">
            <Plus className="h-5 w-5" /> Tambah Produk Baru
          </button>
        </>
      )}

      {tab !== "stok" && <PageTour id="seller-produk" steps={tour} panel />}
      {open && <ProductSheet product={open} onClose={() => setOpenId(null)} onStock={(id) => navigate({ search: { tab: "stok", pid: id } })} />}
    </>
  );
}

function metaText(p: MyProduct) {
  if (p.status === "draft") return "Draft";
  if (p.product_type === "preorder") return "Pre-order";
  return `${p.product_stock.filter((s) => s.status === "available").length} stok`;
}

function ProductRow({ p, img, onClick, meta }: { p: MyProduct; img?: string | undefined; onClick: () => void; meta?: string }) {
  const m = meta ?? metaText(p);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b px-3 py-3 text-left last:border-b-0 transition active:bg-accent">
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
        {img ? <img src={img} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold uppercase">{p.name}</span>
        <span className="mt-1 block truncate text-sm">
          <span className="font-semibold text-primary">{priceRange(p.product_variants.map((v) => Number(v.price)))}</span>
          <span className={m.endsWith("stok") ? "text-tone-amber" : "text-foreground/80"}> · {m}</span>
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-foreground/80" />
    </button>
  );
}

function Chip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${on ? "bg-foreground text-background" : "border-r text-foreground/90"}`}>
      {label} <span className="text-xs opacity-80">{n}</span>
    </button>
  );
}

function IconCell({ children, label, onClick, active, dot }: { children: ReactNode; label: string; onClick: () => void; active?: boolean; dot?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={`relative grid w-12 place-items-center border-l transition active:scale-90 ${active ? "text-primary" : "text-foreground/80"}`}>
      {children}
      {dot && <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />}
    </button>
  );
}
