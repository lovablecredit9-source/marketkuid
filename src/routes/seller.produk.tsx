import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Boxes, CheckSquare, FileText, SlidersHorizontal, ArrowUpDown, LayoutGrid, List, Plus, ChevronRight, Check, Save, Send, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageTour } from "@/components/marketku/tour";
import { useAuth } from "@/lib/auth";
import { priceRange, useCategories, useImageUrls, useMyProducts, type MyProduct } from "@/lib/products";
import { SellerCard, SellerEmpty, StatCell } from "@/components/marketku/seller-ui";
import { ConfirmDialog, ProductSheet, productTypeText } from "@/components/marketku/product-sheet";
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
  const [delId, setDelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const qc = useQueryClient();

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
  const delProduct = list.find((p) => p.id === delId) ?? null;
  const stockProduct = tab === "stok" && pid ? list.find((p) => p.id === pid) : undefined;
  const setTab = (t: "produk" | "stok") => navigate({ search: t === "stok" ? { tab: "stok" } : {} });

  return (
    <>
      <SellerCard className="grid grid-cols-2 gap-1 p-2">
        {([["produk", "Produk", Package], ["stok", "Stok", Boxes]] as const).map(([k, label, I]) => {
          const on = (tab ?? "produk") === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center justify-center gap-2.5 rounded-xl py-2.5 text-sm font-medium transition active:scale-95 ${on ? "bg-primary text-primary-foreground" : "text-foreground/80"}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-lg ${on ? "" : "bg-accent"}`}><I className="h-4 w-4" strokeWidth={1.75} /></span>{label}
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
              className="min-w-0 flex-1 rounded-l-2xl border-r bg-background/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
            <IconCell label={`Filter: ${statusLabel[status]}`} active={status !== "all" || menu === "filter"} dot={status !== "all"}
              onClick={() => setMenu(menu === "filter" ? null : "filter")}><SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} /></IconCell>
            <IconCell label={`Urutkan: ${sortLabel[sort]}`} onClick={() => setMenu(menu === "sort" ? null : "sort")} active dot>
              <ArrowUpDown className="h-[18px] w-[18px]" strokeWidth={1.75} /></IconCell>
            <span data-tour="p-layout" className="flex">
              <IconCell label="Tampilan grid" onClick={() => setLayout("grid")} active={layout === "grid"}><LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.75} /></IconCell>
              <IconCell label="Tampilan list" onClick={() => setLayout("list")} active={layout === "list"}><List className="h-[18px] w-[18px]" strokeWidth={1.75} /></IconCell>
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
            <div className="grid grid-cols-2 gap-2.5">
              {shown.map((p) => (
                <GridCard key={p.id} p={p} img={thumb(p)} onOpen={() => setOpenId(p.id)}
                  onEdit={() => navigate({ to: "/seller/produk/baru", search: { edit: p.id } })}
                  onStock={() => navigate({ search: { tab: "stok", pid: p.id } })} onDelete={() => setDelId(p.id)} />
              ))}
            </div>
          )}
          </div>

          <button data-tour="p-add" onClick={() => navigate({ to: "/seller/produk/baru", search: {} })}
            className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-2xl transition active:scale-95">
            <Plus className="h-4 w-4" /> Tambah Produk Baru
          </button>
        </>
      )}

      {tab !== "stok" && <PageTour id="seller-produk" steps={tour} panel />}
      {open && <ProductSheet product={open} onClose={() => setOpenId(null)} onStock={(id) => navigate({ search: { tab: "stok", pid: id } })} />}
      <ConfirmDialog open={!!delProduct} onOpenChange={(o) => { if (!o) setDelId(null); }} title="Hapus Produk" busy={deleting} confirmLabel="Hapus Produk"
        onConfirm={() => { if (delProduct) void removeProduct(delProduct, qc, setDeleting, () => setDelId(null)); }}>
        <p className="font-semibold">Hapus produk <b>{delProduct?.name}</b>?</p>
        <p className="mt-1 text-sm text-muted-foreground">Produk, varian, dan stoknya akan dihapus permanen.</p>
      </ConfirmDialog>
    </>
  );
}

async function removeProduct(p: MyProduct, qc: QueryClient, setBusy: (b: boolean) => void, done: () => void) {
  setBusy(true);
  const { error } = await supabase.from("products").delete().eq("id", p.id);
  if (!error && p.images.length) await supabase.storage.from("product-images").remove(p.images);
  setBusy(false);
  if (error) { toast.error("Gagal menghapus produk"); return; }
  toast.success(`Produk "${p.name}" berhasil dihapus`);
  qc.setQueriesData<MyProduct[]>({ queryKey: ["my_products"] }, (old) => old?.filter((x) => x.id !== p.id));
  done();
  void qc.invalidateQueries({ queryKey: ["category_counts"] });
}

function GridCard({ p, img, onOpen, onEdit, onStock, onDelete }: {
  p: MyProduct; img?: string | undefined; onOpen: () => void; onEdit: () => void; onStock: () => void; onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const avail = p.product_stock.filter((s) => s.status === "available").length;
  const pre = p.product_type === "preorder";
  const habis = !pre && avail === 0;
  const isDraft = p.status === "draft";
  const toggleDraft = async () => {
    setBusy(true);
    const status = isDraft ? "active" : "draft";
    const { error } = await supabase.from("products").update({ status }).eq("id", p.id);
    setBusy(false);
    if (error) { toast.error("Gagal mengubah status"); return; }
    await Promise.all([qc.invalidateQueries({ queryKey: ["my_products"] }), qc.invalidateQueries({ queryKey: ["category_counts"] })]);
    toast.success(status === "draft" ? "Produk dipindah ke draft" : "Produk diaktifkan");
  };
  const btn = "flex min-w-0 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition active:scale-95 disabled:opacity-60";
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <button onClick={onOpen} aria-label={`Detail ${p.name}`} className="relative grid aspect-[16/10] place-items-center overflow-hidden bg-muted">
        {img ? <img src={img} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />}
        {habis && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground">HABIS</span>}
        {isDraft && <span className="absolute left-2 top-2 rounded-md bg-tone-amber px-2 py-0.5 text-[10px] font-semibold text-background">DRAFT</span>}
      </button>
      <div className="flex flex-1 flex-col p-2.5">
        <button onClick={onOpen} className="truncate text-left text-[13px] font-semibold uppercase">{p.name}</button>
        <p className="mt-1 truncate text-[13px] font-medium text-primary">{priceRange(p.product_variants.map((v) => Number(v.price)))}</p>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-x-1 text-[11px] leading-tight">
          <span className={habis ? "text-destructive" : "text-foreground/80"}>{pre ? <>Pre-<br />order</> : <>{avail}<br />stok</>}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground/80">{p.sold_count}<br />terjual</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground/80">{p.view_count}x<br />dilihat</span>
        </div>
        <div className="my-2.5 h-px bg-foreground/70" />
        <div className="mt-auto grid grid-cols-2 gap-1.5">
          <button onClick={() => void toggleDraft()} disabled={busy} className={`${btn} border-tone-amber/50 bg-tone-amber/10 text-tone-amber`}>
            {isDraft ? <Send className="h-3.5 w-3.5 shrink-0" /> : <Save className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{isDraft ? "Aktifkan" : "Draftkan"}</span>
          </button>
          <button onClick={onEdit} className={`${btn} text-foreground`}><Pencil className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Edit</span></button>
          <button onClick={onStock} className={`${btn} border-success/40 bg-success/10 text-success`}><Boxes className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Stok</span></button>
          <button onClick={onDelete} className={`${btn} border-destructive/40 bg-destructive/10 text-destructive`}><Trash2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Hapus</span></button>
        </div>
      </div>
    </div>
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
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 transition active:bg-accent">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
        {img ? <img src={img} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium uppercase">{p.name}</span>
        <span className="mt-0.5 block truncate text-xs">
          <span className="font-medium text-primary">{priceRange(p.product_variants.map((v) => Number(v.price)))}</span>
          <span className={m.endsWith("stok") ? "text-tone-amber" : "text-foreground/80"}> · {m}</span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/80" strokeWidth={1.75} />
    </button>
  );
}

function Chip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition active:scale-95 ${on ? "bg-foreground text-background" : "border-r text-foreground/90"}`}>
      {label} <span className="text-xs opacity-80">{n}</span>
    </button>
  );
}

function IconCell({ children, label, onClick, active, dot }: { children: ReactNode; label: string; onClick: () => void; active?: boolean; dot?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={`relative grid w-11 place-items-center border-l transition active:scale-90 ${active ? "text-primary" : "text-foreground/80"}`}>
      {children}
      {dot && <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />}
    </button>
  );
}
