import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Check, FileEdit, Pencil, Package, Save, Trash2, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_TYPES, priceRange, useCategories, useImageUrls, type MyProduct } from "@/lib/products";

const typeShort = (t: string) => PRODUCT_TYPES.find((x) => x.value === t)?.label.split(" — ")[0] ?? t;
export const productTypeText = (t: string) => (t === "preorder" ? "Pre-order" : typeShort(t));

export function ProductSheet({ product, onClose, onStock }: { product: MyProduct | null; onClose: () => void; onStock: (id: string) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cats = useCategories();
  const firstImg = product?.images[0] ?? "";
  const img = useImageUrls(firstImg ? [firstImg] : []);
  const [editDesc, setEditDesc] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (!product) return null;
  const p = product;
  const cat = cats.data?.find((c) => c.id === p.category_id)?.name ?? "-";
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["my_products"] }), qc.invalidateQueries({ queryKey: ["category_counts"] })]);
  const date = new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const saveDesc = async () => {
    if (editDesc === null) return;
    setBusy("desc");
    const { error } = await supabase.from("products").update({ description: editDesc.trim().slice(0, 2000) }).eq("id", p.id);
    setBusy(null);
    if (error) { toast.error("Gagal menyimpan deskripsi"); return; }
    setEditDesc(null); await refresh(); toast.success("Deskripsi disimpan");
  };
  const toggleDraft = async () => {
    setBusy("draft");
    const status = p.status === "draft" ? "active" : "draft";
    const { error } = await supabase.from("products").update({ status }).eq("id", p.id);
    setBusy(null);
    if (error) { toast.error("Gagal mengubah status"); return; }
    await refresh(); toast.success(status === "draft" ? "Produk dipindah ke draft" : "Produk diaktifkan");
  };
  const duplicate = async () => {
    setBusy("copy");
    try {
      const { id: _id, created_at: _c, updated_at: _u, product_variants, product_stock: _s, sold_count: _sc, ...rest } = p;
      const { data, error } = await supabase.from("products").insert({ ...rest, name: `${p.name} (Salinan)`.slice(0, 120), status: "draft" }).select("id").single();
      if (error) throw error;
      const { data: full, error: e2 } = await supabase.from("product_variants").select("*").in("id", product_variants.map((v) => v.id));
      if (e2) throw e2;
      if (full.length) {
        const { error: e3 } = await supabase.from("product_variants").insert(full.map(({ id: _vid, created_at: _vc, product_id: _pid, ...v }) => ({ ...v, product_id: data.id })));
        if (e3) throw e3;
      }
      await refresh(); toast.success("Produk disalin sebagai draft");
    } catch { toast.error("Gagal menyalin produk"); }
    finally { setBusy(null); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/produk/${p.id}`); toast.success("Link produk disalin"); }
    catch { toast.error("Tidak bisa menyalin link"); }
  };
  const remove = async () => {
    setBusy("delete");
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (!error && p.images.length) await supabase.storage.from("product-images").remove(p.images);
    setBusy(null);
    if (error) { toast.error("Gagal menghapus produk"); return; }
    toast.success(`Produk "${p.name}" berhasil dihapus`);
    qc.setQueriesData<MyProduct[]>({ queryKey: ["my_products"] }, (old) => old?.filter((x) => x.id !== p.id));
    setConfirm(false); onClose(); void refresh();
  };

  const prices = p.product_variants.map((v) => Number(v.price));
  const actionCls = "flex items-center justify-center gap-2 rounded-lg py-3.5 text-sm font-semibold transition active:scale-95 disabled:opacity-60";

  return (
    <>
      <Dialog.Root open={!confirm} onOpenChange={(o) => { if (!o) { setEditDesc(null); onClose(); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined}
            className="seller-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] max-w-md flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <span className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/40" />
            <div className="flex items-center justify-between gap-3 px-6 py-4">
              <Dialog.Title className="flex min-w-0 items-center gap-2 text-base font-bold uppercase">
                <span className="truncate">{p.name}</span>
                <button aria-label="Edit produk" onClick={() => navigate({ to: "/seller/produk/baru", search: { edit: p.id } })}><Pencil className="h-4 w-4" /></button>
              </Dialog.Title>
              <Dialog.Close aria-label="Tutup" className="grid h-8 w-8 place-items-center"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid aspect-[16/9] place-items-center bg-muted">
                {firstImg && img.data?.[firstImg] ? <img src={img.data[firstImg]} alt={p.name} className="h-full w-full object-contain" /> : <Package className="h-10 w-10 text-muted-foreground" />}
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-primary">{priceRange(prices)}</p>
                  <p className="text-sm font-semibold text-foreground/80">{productTypeText(p.product_type)}</p>
                </div>
                {editDesc === null ? (
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <p className="whitespace-pre-line text-sm text-foreground/85">{p.description || "Belum ada deskripsi"}</p>
                    <button aria-label="Edit deskripsi" onClick={() => setEditDesc(p.description)}><FileEdit className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <textarea autoFocus value={editDesc} maxLength={2000} onChange={(e) => setEditDesc(e.target.value)} rows={4}
                      className="w-full resize-none rounded-lg border bg-muted/30 px-3 py-3 text-base outline-none focus:border-primary" />
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => void saveDesc()} disabled={busy === "desc"} className="flex items-center gap-1.5 px-2 py-1 text-sm font-semibold text-primary">
                        {busy === "desc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Simpan
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between gap-1 border-t pt-4 text-center text-xs text-foreground/85">
                  <span>📅 {date}</span>
                  <span>·</span><span>0<br />bot</span>
                  <span>·</span><span>{p.sold_count}<br />terjual</span>
                  <span>·</span><span className="max-w-[56px] truncate text-primary">{cat}</span>
                  <span>·</span><button onClick={() => void copyLink()} className="text-primary">Link<br />produk</button>
                  <span>·</span><button onClick={() => void duplicate()} disabled={busy === "copy"}>{busy === "copy" ? "..." : "Salin"}</button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t px-5 py-4">
              <button onClick={() => void toggleDraft()} disabled={!!busy} className={`${actionCls} bg-tone-amber/15 text-tone-amber`}>
                {p.status === "draft" ? <><Send className="h-4 w-4" /> Aktifkan</> : <><Save className="h-4 w-4" /> Draftkan</>}
              </button>
              <button onClick={() => navigate({ to: "/seller/produk/baru", search: { edit: p.id } })} className={`${actionCls} border`}><Pencil className="h-4 w-4" /> Edit</button>
              <button onClick={() => { onClose(); onStock(p.id); }} className={`${actionCls} bg-success/15 text-success`}><Boxes className="h-4 w-4" /> Stok</button>
              <button onClick={() => setConfirm(true)} className={`${actionCls} bg-destructive/15 text-destructive`}><Trash2 className="h-4 w-4" /> Hapus</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Hapus Produk" busy={busy === "delete"} confirmLabel="Hapus Produk" onConfirm={() => void remove()}>
        <p className="font-semibold">Hapus produk <b>{p.name}</b>?</p>
        <p className="mt-2 text-sm text-muted-foreground">Produk akan dihapus dari semua bot yang terhubung. Tindakan ini tidak bisa dibatalkan.</p>
      </ConfirmDialog>
    </>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, onConfirm, busy }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; busy?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined}
          className="seller-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/15 text-destructive"><AlertTriangle className="h-5 w-5" /></span>
            <Dialog.Title className="flex-1 font-bold">{title}</Dialog.Title>
            <Dialog.Close aria-label="Tutup"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          <div className="grid grid-cols-2 gap-3 px-5 pb-5">
            <button onClick={() => onOpenChange(false)} className="rounded-lg border py-3 text-sm font-semibold transition active:scale-95">Batal</button>
            <button onClick={onConfirm} disabled={busy} className="flex items-center justify-center gap-2 rounded-lg bg-destructive py-3 text-sm font-semibold text-destructive-foreground transition active:scale-95 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
