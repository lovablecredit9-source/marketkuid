import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Boxes, History, Loader2, Plus, RefreshCw, Settings, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { digits, stockLines, type MyProduct } from "@/lib/products";
import { SellerSheet } from "@/components/marketku/seller-ui";
import { ConfirmDialog } from "@/components/marketku/product-sheet";
import { fieldCls } from "@/components/marketku/product-form";

type Filter = "available" | "sold" | "all";

export function StockManager({ product, onBack }: { product: MyProduct; onBack: () => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"stok" | "history">("stok");
  const [filter, setFilter] = useState<Filter>("available");
  const [variant, setVariant] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "selected" | "unsold">(null);
  const [busy, setBusy] = useState(false);

  const stock = useQuery({
    queryKey: ["product_stock", product.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_stock").select("id, content, status, variant_id, created_at")
        .eq("product_id", product.id).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const vName = (id: string) => product.product_variants.find((v) => v.id === id)?.name ?? "-";
  const all = stock.data ?? [];
  const rows = all.filter((r) =>
    (view === "history" ? r.status === "sold" : filter === "all" || r.status === filter) &&
    (variant === "all" || r.variant_id === variant) &&
    (!q.trim() || r.content.toLowerCase().includes(q.trim().toLowerCase())));
  const refresh = () => Promise.all([stock.refetch(), qc.invalidateQueries({ queryKey: ["my_products"] })]);
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const del = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    const { error } = await supabase.from("product_stock").delete().in("id", ids);
    setBusy(false);
    if (error) { toast.error("Gagal menghapus stok"); return; }
    setSel(new Set()); setConfirm(null); await refresh();
    toast.success(`${ids.length} stok dihapus`);
  };

  const pill = (on: boolean) => `px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${on ? "bg-primary text-primary-foreground" : "text-foreground/80"}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex flex-col items-center px-1 text-sm text-foreground/85"><ArrowLeft className="h-4 w-4" /> Produk</button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold uppercase">{product.name}</p>
          <p className="text-xs text-muted-foreground">{stock.isLoading ? "Memuat..." : `${all.length} item dimuat`}</p>
        </div>
        <button aria-label="Muat ulang stok" onClick={() => void refresh()} className="grid h-9 w-9 place-items-center transition active:scale-90"><RefreshCw className={`h-5 w-5 ${stock.isFetching ? "animate-spin" : ""}`} /></button>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold leading-tight text-primary-foreground transition active:scale-95">
          <Plus className="h-3.5 w-3.5" /> Tambah<br />Stok
        </button>
      </div>

      <div className="inline-flex overflow-hidden rounded-lg border">
        <button onClick={() => setView("stok")} className={`${pill(view === "stok")} flex items-center gap-2`}><Boxes className="h-4 w-4" /> Stok</button>
        <button onClick={() => setView("history")} className={`${pill(view === "history")} flex items-center gap-2`}><History className="h-4 w-4" /> History</button>
      </div>

      {view === "stok" && (
        <div className="block">
          <div className="inline-flex overflow-hidden rounded-lg border">
            {([["available", "Tersedia"], ["sold", "Terjual"], ["all", "Semua"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setFilter(k); setSel(new Set()); }} className={pill(filter === k)}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <select value={variant} onChange={(e) => setVariant(e.target.value)} className="block rounded-lg border bg-background px-4 py-3 text-base outline-none">
        <option value="all">Semua varian</option>
        {product.product_variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari isi stok..." className={fieldCls} />

      {view === "stok" && (
        <>
          <div className="flex items-center gap-5 px-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-primary" />
              Pilih semua ({rows.length})
            </label>
            <button disabled={!sel.size} onClick={() => setConfirm("selected")} className="flex items-center gap-1.5 text-sm font-semibold text-primary disabled:text-muted-foreground/60">
              <Settings className="h-4 w-4" /> Manage{sel.size ? ` (${sel.size})` : ""}
            </button>
          </div>
          <button disabled={!all.some((r) => r.status === "available")} onClick={() => setConfirm("unsold")}
            className="flex items-center gap-2 rounded-lg border border-destructive/60 px-4 py-2.5 text-sm font-semibold text-destructive transition active:scale-95 disabled:opacity-50">
            <AlertTriangle className="h-4 w-4" /> Hapus semua belum terjual
          </button>
        </>
      )}

      <div className="overflow-hidden rounded-xl border">
        {stock.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Memuat stok...</p>}
        {!stock.isLoading && rows.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">{view === "history" ? "Belum ada riwayat stok terjual." : "Belum ada stok di sini."}</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-4 border-b px-5 py-3.5 last:border-b-0">
            {view === "stok" && (
              <input type="checkbox" aria-label="Pilih stok" checked={sel.has(r.id)} className="h-4 w-4 accent-primary"
                onChange={() => { const s = new Set(sel); if (s.has(r.id)) s.delete(r.id); else s.add(r.id); setSel(s); }} />
            )}
            <div className="min-w-0 flex-1 pl-2">
              <p className="truncate font-mono text-sm">{r.content}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate uppercase">{vName(r.variant_id)}</span>
                <span className={`rounded px-2 py-0.5 ${r.status === "sold" ? "bg-muted text-muted-foreground" : "bg-success/15 text-success"}`}>{r.status === "sold" ? "Terjual" : "Tersedia"}</span>
              </p>
            </div>
            {r.status === "available" && view === "stok" && (
              <button aria-label="Hapus stok" onClick={() => void del([r.id])} className="text-destructive transition active:scale-90"><Trash2 className="h-5 w-5" /></button>
            )}
          </div>
        ))}
      </div>

      {addOpen && <AddStockSheet product={product} onClose={() => setAddOpen(false)} onDone={() => void refresh()} />}

      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} busy={busy}
        title={confirm === "unsold" ? "Hapus Stok Belum Terjual" : "Hapus Stok Terpilih"} confirmLabel="Hapus Stok"
        onConfirm={() => void del(confirm === "unsold" ? all.filter((r) => r.status === "available").map((r) => r.id) : [...sel])}>
        <p className="text-sm text-muted-foreground">
          {confirm === "unsold" ? `Semua ${all.filter((r) => r.status === "available").length} stok yang belum terjual akan dihapus.` : `${sel.size} stok terpilih akan dihapus.`} Tindakan ini tidak bisa dibatalkan.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function AddStockSheet({ product, onClose, onDone }: { product: MyProduct; onClose: () => void; onDone: () => void }) {
  const pre = product.product_type === "preorder";
  const [variant, setVariant] = useState(product.product_variants[0]?.id ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const items = pre ? Array.from({ length: Math.min(Number(digits(text)) || 0, 1000) }, () => "pre_order_slot") : stockLines(text).slice(0, 1000);
  const save = async () => {
    if (!variant) { toast.error("Produk belum punya varian"); return; }
    if (!items.length) { toast.error(pre ? "Isi jumlah slot" : "Isi minimal satu baris stok"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("product_stock").insert(items.map((content) => ({ product_id: product.id, variant_id: variant, owner_id: u.user!.id, content })));
    setBusy(false);
    if (error) { toast.error("Gagal menambah stok"); return; }
    toast.success(`${items.length} stok ditambahkan`); onDone(); onClose();
  };
  return (
    <SellerSheet open onOpenChange={(o) => !o && onClose()} title="Tambah Stok"
      footer={<>
        <button onClick={onClose} className="rounded-lg border px-5 py-2.5 text-sm font-semibold">Batal</button>
        <button onClick={() => void save()} disabled={busy} className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan {items.length ? `(${items.length})` : ""}
        </button>
      </>}>
      <p className="mb-2 text-sm font-semibold">Varian</p>
      <select value={variant} onChange={(e) => setVariant(e.target.value)} className={`${fieldCls} text-base`}>
        {product.product_variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <p className="mb-2 mt-4 text-sm font-semibold">{pre ? "Jumlah slot pre-order" : "Isi stok"}</p>
      {pre
        ? <input inputMode="numeric" value={text} onChange={(e) => setText(digits(e.target.value).slice(0, 4))} placeholder="Mis. 10" className={fieldCls} />
        : <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Satu baris = satu stok" className={`${fieldCls} resize-none font-mono text-xs`} />}
      <p className="mt-2 text-xs text-muted-foreground">Maksimal 1000 item per penambahan.</p>
    </SellerSheet>
  );
}
