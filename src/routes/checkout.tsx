import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readNotes, rememberNote, removeNote } from "@/lib/buyer-tools";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, ShieldCheck, Shield, QrCode, CircleCheck, ShoppingCart, Loader2, Store, Wallet, Circle, TriangleAlert } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useImageUrls } from "@/lib/products";
import { dbError, parseItems, unitPrice, type Discount } from "@/lib/market";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { ProductImage, rpBuyer } from "@/components/marketku/product-card";
import { pageMeta } from "@/lib/meta";
import { guestContactError, rememberGuestOrder } from "@/lib/guest";
import { guestCheckout } from "@/lib/guest.functions";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Send } from "lucide-react";
import { liveFlashPercent, useFlashSales } from "@/lib/flash";

export const Route = createFileRoute("/checkout")({
  staticData: { sitemap: false },
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
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  useEffect(() => setSavedNotes(readNotes()), []);
  const [voucher, setVoucher] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [tg, setTg] = useState("");
  const [via, setVia] = useState<"wa" | "tg">("wa");
  const placeGuest = useServerFn(guestCheckout);
  const guest = ready && !user;
  const [method, setMethod] = useState<"saldo" | "qris">("saldo");
  const wallet = useWallet(user?.id);

  const q = useQuery({
    queryKey: ["checkout_items", items],
    enabled: wanted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants")
        .select("id, name, price, discount, image_url, warranty, products(id, name, images, owner_id, require_buyer_note, product_type)")
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
  const flash = useFlashSales([...new Set(lines.map((l) => l.products?.id).filter(Boolean) as string[])]);
  const fpOf = (l: (typeof lines)[number]) => liveFlashPercent(flash.data, l.products?.id ?? "", Date.now(), l.qty);
  const urls = useImageUrls(lines.map((l) => l.image_url || l.products?.images?.[0] || "").filter(Boolean));
  const subtotal = lines.reduce((a, l) => a + unitPrice(Number(l.price), l.qty, l.discount as Discount, fpOf(l)) * l.qty, 0);
  const noteReq = lines.some((l) => l.products?.require_buyer_note);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const phone = wa || profile.data?.whatsapp || "";
  const bal = wallet.data ?? 0;
  const lowSaldo = bal < subtotal;
  const noWarranty = lines.some((l) => !l.warranty);
  const hasPre = lines.some((l) => l.products?.product_type === "preorder");
  const [ask, setAsk] = useState(false);

  const start = () => {
    if (guest) {
      const err = guestContactError({ email, whatsapp: via === "wa" ? wa : "", telegram: via === "tg" ? tg : "" });
      if (err) { toast.error(err); return; }
    } else if (!user) return;
    if (noWarranty || hasPre) setAsk(true); else void pay();
  };

  const pay = async () => {
    setAsk(false);
    if (noteReq && note.trim().length < 3) { toast.error("Catatan untuk seller wajib diisi"); return; }
    if (guest) {
      setBusy(true);
      const r = await placeGuest({ data: { items: wanted, email, whatsapp: via === "wa" ? wa : "", telegram: via === "tg" ? tg : "", note, voucher } }).catch((e: unknown) => ({ ok: false as const, error: dbError(e) }));
      setBusy(false);
      if (!r.ok) { toast.error(r.error); return; }
      rememberGuestOrder(r.token);
      rememberNote(note);
      toast.success("Pesanan dibuat, lanjut bayar QRIS");
      navigate({ to: "/lacak/$token", params: { token: r.token }, replace: true });
      return;
    }
    if (!user) return;
    if (noteReq && note.trim().length < 3) { toast.error("Catatan untuk seller wajib diisi"); return; }
    if (phone && !/^(\+?62|0)8\d{7,12}$/.test(phone)) { toast.error("Nomor WhatsApp tidak valid"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", { p_items: wanted, p_whatsapp: phone, p_note: note, p_voucher: voucher });
    setBusy(false);
    if (error || !data) { toast.error(dbError(error)); return; }
    void qc.invalidateQueries({ queryKey: ["cart", user.id] });
    rememberNote(note);
    if (method === "saldo") {
      const { error: payErr } = await supabase.rpc("pay_order_with_wallet", { p_checkout: data });
      if (payErr) toast.error(`Pesanan dibuat, tapi belum terbayar: ${dbError(payErr)}`);
      else { toast.success("Pembayaran berhasil dengan Saldo Marketku"); void qc.invalidateQueries({ queryKey: ["wallet", user.id] }); }
    } else toast.success("Pesanan dibuat, lanjut bayar QRIS");
    navigate({ to: "/bayar/$id", params: { id: data }, replace: true });
  };

  const payMethod = guest ? "qris" : method;

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
                <p className="font-bold">{rpBuyer(unitPrice(Number(l.price), l.qty, l.discount as Discount, fpOf(l)) * l.qty)}</p>
              </div>
            );
          })}
          {guest ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-primary/30 bg-accent/60 p-3 text-xs text-muted-foreground">Belanja tanpa akun. Link pesanan dikirim ke halaman ini, simpan baik-baik. Sudah punya akun? <Link to="/login" className="font-bold text-primary">Masuk</Link></p>
              <label className="block text-sm font-medium text-muted-foreground"><span className="flex items-center gap-1"><Mail className="h-4 w-4" /> Email anda *</span>
                <input value={email} onChange={(e) => setEmail(e.target.value.slice(0, 120))} type="email" inputMode="email" autoComplete="email" placeholder="kamu@email.com" className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-foreground outline-none focus:border-primary" />
              </label>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Kirim produk lewat *</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([["wa", Phone, "WhatsApp"], ["tg", Send, "Telegram"]] as const).map(([k, I, l]) => (
                    <button key={k} type="button" onClick={() => setVia(k)} className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-semibold transition active:scale-95 ${via === k ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground"}`}><I className="h-4 w-4" />{l}{via === k && <CircleCheck className="h-4 w-4" />}</button>
                  ))}
                </div>
                {via === "wa" ? (
                  <input value={wa} onChange={(e) => setWa(e.target.value.replace(/[^\d+]/g, "").slice(0, 16))} placeholder="08xxxxxxxxxx" inputMode="tel" aria-label="Nomor WhatsApp" className="mt-2 w-full rounded-xl border bg-card px-3 py-2.5 text-foreground outline-none focus:border-primary" />
                ) : (
                  <input value={tg} onChange={(e) => setTg(e.target.value.replace(/[^@A-Za-z0-9_]/g, "").slice(0, 33))} placeholder="@username" aria-label="Username Telegram" className="mt-2 w-full rounded-xl border bg-card px-3 py-2.5 text-foreground outline-none focus:border-primary" />
                )}
                <p className="mt-1 text-xs text-muted-foreground">Seller memakai kontak ini bila produk perlu dikirim manual.</p>
              </div>
            </div>
          ) : (
          <label className="block text-sm font-medium text-muted-foreground"><span className="flex items-center gap-1"><Phone className="h-4 w-4" /> Nomor WhatsApp</span>
            <input value={phone} onChange={(e) => setWa(e.target.value.replace(/[^\d+]/g, ""))} placeholder="08xxxxxxxxxx" inputMode="tel" className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-foreground outline-none focus:border-primary" />
          </label>
          )}
          <label className="block text-sm font-medium">Catatan untuk seller {noteReq ? "*" : "(opsional)"}
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder={noteReq ? "Wajib diisi sesuai kebutuhan pesanan." : "Tulis catatan bila perlu."} className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 outline-none focus:border-primary" />
          </label>
          {savedNotes.length > 0 && (
            <div aria-label="Catatan tersimpan">
              <p className="text-xs font-semibold text-muted-foreground">Catatan terakhir kamu</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {savedNotes.map((n) => (
                  <span key={n} className="inline-flex max-w-full items-center overflow-hidden rounded-full border bg-accent/60 text-xs">
                    <button type="button" onClick={() => setNote(n)} className="truncate px-3 py-1.5 text-left font-medium text-primary">{n}</button>
                    <button type="button" aria-label={`Hapus catatan ${n}`} onClick={() => { removeNote(n); setSavedNotes(readNotes()); }} className="border-l px-2 py-1.5 text-muted-foreground">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">Kode voucher</p>
          <input value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} placeholder="Masukkan kode voucher" className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 outline-none focus:border-primary" />
          <p className="mt-1 text-xs text-muted-foreground">Potongan voucher toko dihitung otomatis saat pesanan dibuat.</p>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="border-b pb-3 text-lg font-bold">Metode Pembayaran</h2>
          {([["saldo", Wallet, "Saldo Marketku", guest ? "Masuk untuk bayar pakai saldo" : `Saldo ${rpBuyer(bal)}${lowSaldo ? " • tidak cukup" : ""}`], ["qris", QrCode, "QRIS Marketku", "Scan QRIS / e-wallet, upload bukti"]] as const).filter(([k]) => !guest || k === "qris").map(([k, I, l, d]) => (
            <button key={k} type="button" onClick={() => setMethod(k)} className={`mt-3 flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition active:scale-[0.99] ${payMethod === k ? "border-primary bg-accent" : "border-border"}`}>
              <I className="h-5 w-5 text-primary" />
              <span className="flex-1"><span className="block font-semibold">{l}</span><span className={`block text-xs ${k === "saldo" && lowSaldo ? "text-destructive" : "text-muted-foreground"}`}>{d}</span></span>
              {payMethod === k ? <CircleCheck className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
            </button>
          ))}
          {payMethod === "saldo" && lowSaldo && <Link to="/topup" className="mt-2 block text-sm font-semibold text-primary">Top up saldo →</Link>}
          <p className="mt-3 flex gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-success" /> Data kamu aman dan hanya dipakai untuk pengiriman produk.</p>
        </section>
        <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <h2 className="border-b pb-3 text-lg font-bold">Rincian Pembayaran</h2>
          {[["Metode Pembayaran", payMethod === "saldo" ? "Saldo Marketku" : "QRIS Marketku"], [`Total Pesanan (${count} item)`, rpBuyer(subtotal)], ["Biaya admin", rpBuyer(0)], ["Kode unik QRIS", payMethod === "saldo" ? "Tidak ada" : "Dibuat saat bayar"]].map(([a, b]) => (
            <div key={a} className="flex justify-between"><span className="text-muted-foreground">{a}</span><span>{b}</span></div>
          ))}
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{rpBuyer(subtotal)}</span></div>
          <p className="flex gap-2 rounded-xl border bg-accent/50 p-3 text-muted-foreground"><Shield className="h-4 w-4 text-primary" /> Pembayaran aman dijaga platform Marketku.</p>
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-between border-t bg-card p-4">
        <div><p className="text-xs text-muted-foreground">Total dibayar</p><p className="text-xl font-bold">{rpBuyer(subtotal)}</p></div>
        <button disabled={!lines.length || busy || (payMethod === "saldo" && lowSaldo)} onClick={start} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition active:scale-95 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} {payMethod === "saldo" ? "Bayar pakai Saldo" : "Bayar Sekarang"}
        </button>
      </div>
      {ask && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/30 backdrop-blur-[2px]" onClick={() => setAsk(false)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-md rounded-t-3xl bg-card p-5 pb-7 shadow-2xl animate-in slide-in-from-bottom">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-warning text-primary-foreground"><TriangleAlert className="h-6 w-6" /></span>
            <p className="mt-4 text-lg font-bold">Konfirmasi sebelum membayar</p>
            {hasPre && <p className="mt-1.5 text-sm text-muted-foreground">🕐 Produk ini merupakan Pre-Order dan diproses secara manual oleh seller. Pastikan Anda sudah membaca dan memahami deskripsi produk sebelum membayar.</p>}
            {noWarranty && <p className="mt-1.5 text-sm text-muted-foreground">⚠️ Produk ini tidak memiliki garansi. Pastikan Anda sudah membaca dan memahami deskripsi produk sebelum membayar.</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setAsk(false)} className="rounded-xl border py-3 text-sm font-bold">Batal</button>
              <button onClick={() => void pay()} className="rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">Lanjutkan</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
