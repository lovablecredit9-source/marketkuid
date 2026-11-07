import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Trash2, Minus, Plus, Store } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useImageUrls } from "@/lib/products";
import { unitPrice, useCart, useCartActions, useMarketProducts, type CartRow, type Discount } from "@/lib/market";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { ProductImage, ProductList, rpBuyer } from "@/components/marketku/product-card";
import { pageMeta } from "@/lib/meta";
import { liveFlashPercent, useFlashSales, type FlashSale } from "@/lib/flash";

export const Route = createFileRoute("/keranjang")({
  head: () => pageMeta("Keranjang — Marketku", "Keranjang belanja produk digital Marketku."),
  component: Keranjang,
});

const lineTotal = (r: CartRow, fl?: FlashSale[]) => unitPrice(Number(r.product_variants?.price ?? 0), r.qty, (r.product_variants?.discount ?? null) as Discount, liveFlashPercent(fl, r.product_id)) * r.qty;

function Keranjang() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const cart = useCart();
  const act = useCartActions();
  const rows = cart.data ?? [];
  const flash = useFlashSales([...new Set(rows.map((r) => r.product_id))]);
  const valid = rows.filter((r) => r.products?.status === "active" && r.store?.is_open);
  const urls = useImageUrls(rows.map((r) => r.product_variants?.image_url || r.products?.images?.[0] || "").filter(Boolean));
  const rec = useMarketProducts({ limit: 6 });
  const groups = new Map<string, CartRow[]>();
  for (const r of rows) {
    const k = r.store?.store_name ?? "Toko";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const total = valid.reduce((a, r) => a + lineTotal(r, flash.data), 0);
  const recItems = (rec.data ?? []).filter((p) => !rows.some((r) => r.product_id === p.id)).slice(0, 4);

  if (ready && !user) {
    return <AppShell showSupport={false}><div className="space-y-4 px-3 pt-4"><h1 className="text-lg font-bold">Keranjang</h1>
      <EmptyState icon={ShoppingCart} title="Masuk untuk melihat keranjang" desc="Keranjang tersimpan di akunmu." action={<PrimaryLink to="/login">Masuk</PrimaryLink>} /></div></AppShell>;
  }

  return (
    <AppShell showSupport={false}>
      <div className="space-y-4 px-3 pt-4 pb-24">
        <h1 className="text-lg font-bold">Keranjang</h1>
        {rows.length === 0 && !cart.isLoading ? (
          <EmptyState icon={ShoppingCart} title="Keranjang masih kosong" desc="Produk yang kamu tambahkan akan muncul di sini." action={<PrimaryLink to="/cari">Mulai belanja</PrimaryLink>} />
        ) : (
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {[...groups.entries()].map(([store, items]) => (
              <div key={store} className="px-4 py-3">
                <p className="mb-2 flex items-center gap-2 font-bold"><Store className="h-4 w-4 text-primary" />{store}</p>
                {items.map((r) => {
                  const path = r.product_variants?.image_url || r.products?.images?.[0] || "";
                  const off = !(r.products?.status === "active" && r.store?.is_open);
                  return (
                    <div key={r.variant_id} className={`flex items-center gap-3 py-2 ${off ? "opacity-50" : ""}`}>
                      <Link to="/produk/$id" params={{ id: r.product_id }}><ProductImage url={path ? urls.data?.[path] : undefined} alt={r.products?.name ?? "Produk"} className="h-12 w-20 shrink-0 rounded-lg" /></Link>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold uppercase">{r.products?.name}</p>
                        <span className="inline-block rounded bg-accent px-1.5 text-[11px] text-primary">{r.product_variants?.name}</span>
                        <p className="text-sm font-bold text-primary">{off ? "Tidak tersedia" : rpBuyer(lineTotal(r, flash.data))}</p>
                      </div>
                      <button aria-label="Hapus" onClick={() => void act.remove([r.variant_id])} className="text-muted-foreground transition active:scale-90"><Trash2 className="h-4 w-4" /></button>
                      <div className="flex items-center rounded-full border">
                        <button aria-label="Kurangi" onClick={() => void act.setQty(r.variant_id, r.qty - 1)} className="grid h-8 w-8 place-items-center"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center text-sm">{r.qty}</span>
                        <button aria-label="Tambah" onClick={() => void act.setQty(r.variant_id, r.qty + 1)} className="grid h-8 w-8 place-items-center text-primary"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {recItems.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Rekomendasi untukmu</h2>
            <ProductList items={recItems} compact />
          </section>
        )}
      </div>
      {rows.length > 0 && (
        <div className="fixed inset-x-0 bottom-[84px] z-30 mx-auto flex max-w-md items-center justify-between border-t bg-card px-4 py-3">
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{rpBuyer(total)}</p></div>
          <button disabled={!valid.length} onClick={() => navigate({ to: "/checkout", search: { items: valid.map((r) => `${r.variant_id}:${r.qty}`).join(",") } })}
            className="rounded-xl bg-primary px-8 py-3 font-bold text-primary-foreground transition active:scale-95 disabled:opacity-50">Beli ({valid.length})</button>
        </div>
      )}
    </AppShell>
  );
}
