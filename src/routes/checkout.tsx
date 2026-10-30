import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, ShieldCheck, Shield, QrCode, CircleCheck, ShoppingCart, Loader2, Store, Wallet, Circle } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useImageUrls } from "@/lib/products";
import { dbError, parseItems, unitPrice, type Discount } from "@/lib/market";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { ProductImage, rpBuyer } from "@/components/marketku/product-card";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/checkout")({
  validateSearch: (s: Record<string, unknown>): { items?: string } => (typeof s["items"] === "string" && s["items"] ? { items: s["items"] } : {}),
  head: () => pageMeta("Checkout — Marketku", "Selesaikan pesananmu dengan pembayaran Saldo Marketku atau QRIS."),
  component: Checkout,
});

function Checkout() {
  const { items } = Route.useSearch();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const wanted = parseItems(items);
  const [wa, setWa] = useState("");
  const [note, setNote] = useState("");
  const [voucher, setVoucher] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"saldo" | "qris">("saldo");
  const wallet = useWallet(user?.id);

  const q = useQuery({
    queryKey: ["checkout_items", items],
    enabled: wanted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants")
        .select("id, name, price, discount, image_url, products(id, name, images, owner_id, require_buyer_note)")
        .in("id", wanted.map((w) => w.variant_id));
      if (error) throw error;
      const owners = [...new Set((data ?? []).map((d) => d.products?.owner_id).filter(Boolean) as string[])];
      const stores = owners.length ? (await supabase.rpc("public_stores", { p_ids: owners })).data ?? [] : [];
      return (data ?? []).map((d) => ({ ...d, qty: wanted.find((w) => w.variant_id === d.id)?.qty ?? 1, store: stores.find((s) => s.owner_id === d.products?.owner_id)?.store_name ?? "Toko" }));
    },
  });
  const profile = useQuery({
    queryKey: ["profile", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("full_name, username, whatsapp, created_at").eq("id", user!.id).maybeSingle()).data,
  });
  const lines = q.data ?? [];
  const urls = useImageUrls(lines.map((l) => l.image_url || l.products?.images?.[0] || "").filter(Boolean));
  const subtotal = lines.reduce((a, l) => a + unitPrice(Number(l.price), l.qty, l.discount as Discount) * l.qty, 0);
  const noteReq = lines.some((l) => l.products?.require_buyer_note);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const phone = wa || profile.data?.whatsapp || "";
  const bal = wallet.data ?? 0;
  const lowSaldo = bal < subtotal;

  const pay = async () => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (noteReq && note.trim().length < 3) { toast.error("Catatan untuk seller wajib diisi"); return; }
    if (phone && !/^(\+?62|0)8\d{7,12}$/.test(phone)) { toast.error("Nomor WhatsApp tidak valid"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", { p_items: wanted, p_whatsapp: phone, p_note: note, p_voucher: voucher });
    setBusy(false);
    if (error || !data) { toast.error(dbError(error)); return; }
    void qc.invalidateQueries({ queryKey: ["cart", user.id] });
    if (method === "saldo") {
      const { error: payErr } = await supabase.rpc("pay_order_with_wallet", { p_checkout: data });
      if (payErr) toast.error(`Pesanan dibuat, tapi belum terbayar: ${dbError(payErr)}`);
      else { toast.success("Pembayaran berhasil dengan Saldo Marketku"); void qc.invalidateQueries({ queryKey: ["wallet", user.id] }); }
    } else toast.success("Pesanan dibuat, lanjut bayar QRIS");
    navigate({ to: "/bayar/$id", params: { id: data }, replace: true });
  };

  if (ready && !user) return <AppShell nav={false}><div className="p-3"><EmptyState icon={ShoppingCart} title="Masuk untuk checkout" desc="Kamu perlu masuk agar pesanan tersimpan di akunmu." action={<PrimaryLink to="/login">Masuk</PrimaryLink>} /></div></AppShell>;

  return (
    <AppShell nav={false}>
      <div className="space-y-4 px-3 pt-4 pb-28">
        <section className="space-y-4 rounded-2xl border bg-card p-4">
          <h2 className="border-b pb-3 text-lg font-bold">Pesanan Anda</h2>
          {lines.length === 0 ? (
            q.isLoading ? <div className="h-20 animate-pulse rounded-xl bg-muted" /> :
            <EmptyState icon={ShoppingCart} title="Belum ada produk" desc="Pilih produk dulu untuk checkout." action={<PrimaryLink to="/cari">Pilih produk</PrimaryLink>} />
          ) : lines.map((l) => {
            const path = l.image_url || l.products?.images?.[0] || "";
            return (
              <div key={l.id} className="flex gap-3">
                <ProductImage url={path ? urls.data?.[path] : undefined} alt={l.products?.name ?? ""} className="h-16 w-16 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Store className="h-3 w-3" />{l.store}</p>
                  <p className="line-clamp-2 font-semibold">{l.products?.name}</p>
                  <p className="text-muted-foreground">{l.name} · {l.qty}x</p>
                </div>
                <p className="font-bold">{rpBuyer(unitPrice(Number(l.price), l.qty, l.discount as Discount) * l.qty)}</p>
              </div>
            );
          })}
          <label className="block text-sm font-medium text-muted-foreground"><span className="flex items-center gap-1"><Phone className="h-4 w-4" /> Nomor WhatsApp</span>
            <input value={phone} onChange={(e) => setWa(e.target.value.replace(/[^\d+]/g, ""))} placeholder="08xxxxxxxxxx" inputMode="tel" className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-foreground outline-none focus:border-primary" />
          </label>
          <label className="block text-sm font-medium">Catatan untuk seller {noteReq ? "*" : "(opsional)"}
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder={noteReq ? "Wajib diisi sesuai kebutuhan pesanan." : "Tulis catatan bila perlu."} className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 outline-none focus:border-primary" />
          </label>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">Kode voucher</p>
          <input value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} placeholder="Masukkan kode voucher" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 outline-none focus:border-primary" />
          <p className="mt-1 text-xs text-muted-foreground">Potongan voucher toko dihitung otomatis saat pesanan dibuat.</p>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="border-b pb-3 text-lg font-bold">Metode Pembayaran</h2>
          {([["saldo", Wallet, "Saldo Marketku", `Saldo ${rpBuyer(bal)}${lowSaldo ? " • tidak cukup" : ""}`], ["qris", QrCode, "QRIS Marketku", "Scan QRIS / e-wallet, upload bukti"]] as const).map(([k, I, l, d]) => (
            <button key={k} type="button" onClick={() => setMethod(k)} className={`mt-3 flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition active:scale-[0.99] ${method === k ? "border-primary bg-accent" : "border-border"}`}>
              <I className="h-5 w-5 text-primary" />
              <span className="flex-1"><span className="block font-semibold">{l}</span><span className={`block text-xs ${k === "saldo" && lowSaldo ? "text-destructive" : "text-muted-foreground"}`}>{d}</span></span>
              {method === k ? <CircleCheck className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
            </button>
          ))}
          {method === "saldo" && lowSaldo && <Link to="/topup" className="mt-2 block text-sm font-semibold text-primary">Top up saldo →</Link>}
          <p className="mt-3 flex gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-success" /> Data kamu aman dan hanya dipakai untuk pengiriman produk.</p>
        </section>
        <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <h2 className="border-b pb-3 text-lg font-bold">Rincian Pembayaran</h2>
          {[["Metode Pembayaran", method === "saldo" ? "Saldo Marketku" : "QRIS Marketku"], [`Total Pesanan (${count} item)`, rpBuyer(subtotal)], ["Biaya admin", rpBuyer(0)], ["Kode unik QRIS", method === "saldo" ? "Tidak ada" : "Dibuat saat bayar"]].map(([a, b]) => (
            <div key={a} className="flex justify-between"><span className="text-muted-foreground">{a}</span><span>{b}</span></div>
          ))}
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{rpBuyer(subtotal)}</span></div>
          <p className="flex gap-2 rounded-xl border bg-accent/50 p-3 text-muted-foreground"><Shield className="h-4 w-4 text-primary" /> Pembayaran aman dijaga platform Marketku.</p>
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-between border-t bg-card p-4">
        <div><p className="text-xs text-muted-foreground">Total dibayar</p><p className="text-xl font-bold">{rpBuyer(subtotal)}</p></div>
        <button disabled={!lines.length || busy || (method === "saldo" && lowSaldo)} onClick={() => void pay()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition active:scale-95 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} {method === "saldo" ? "Bayar pakai Saldo" : "Bayar Sekarang"}
        </button>
      </div>
    </AppShell>
  );
}
