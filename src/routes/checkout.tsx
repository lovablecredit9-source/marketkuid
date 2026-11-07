import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readNotes, rememberNote, removeNote } from "@/lib/buyer-tools";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, ShieldCheck, Shield, QrCode, CircleCheck, ShoppingCart, Loader2, Store, Wallet, Circle, TriangleAlert, Zap, Clock, Ticket } from "lucide-react";
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
  const [vBusy, setVBusy] = useState(false);
  const [vInfo, setVInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const checkVoucher = async () => {
    const code = voucher.trim();
    if (!code) return;
    setVBusy(true);
    const owners = [...new Set(lines.map((l) => l.products?.owner_id).filter(Boolean) as string[])];
    const found = (await Promise.all(owners.map(async (o) => ((await supabase.rpc("public_store_vouchers", { p_owner: o })).data ?? []).find((v) => v.code.toUpperCase() === code)))).find(Boolean);
    setVBusy(false);
    setVInfo(found ? { ok: true, text: `Voucher "${found.name}" dipakai. Potongan dihitung saat pesanan dibuat.` } : { ok: false, text: "Kode voucher tidak ditemukan di toko ini." });
  };

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
    <AppShell nav={false} showSupport={false}>
      <div className="space-y-4 px-3 pt-4 pb-32">
        <section className="mk-co-card space-y-3">
          <h2>Pesanan Anda</h2>
          {lines.length === 0 ? (
            q.isLoading ? <div className="h-20 animate-pulse rounded-xl bg-muted" /> :
            <EmptyState icon={ShoppingCart} title="Belum ada produk" desc="Pilih produk dulu untuk checkout." action={<PrimaryLink to="/cari">Pilih produk</PrimaryLink>} />
          ) : lines.map((l) => {
            const path = l.image_url || l.products?.images?.[0] || "";
            return (
              <article key={l.id} className="mk-co-row">
                <ProductImage url={path ? urls.data?.[path] : undefined} alt={l.products?.name ?? ""} className="mk-co-row__media" />
                <div className="min-w-0">
                  <strong className="mk-co-row__title">{l.products?.name}</strong>
                  <span className="mk-co-row__seller"><Store className="h-[13px] w-[13px]" /><span>{l.store}</span></span>
                </div>
                {l.products?.product_type === "preorder"
                  ? <span className="mk-co-pill is-preorder"><Clock className="h-3 w-3" strokeWidth={2.7} />Pre-order · diproses seller</span>
                  : <span className="mk-co-pill"><Zap className="h-3 w-3" strokeWidth={2.7} />Pengiriman instan</span>}
                <span className="mk-co-variant" title={l.name}>{l.name}</span>
                <span className="mk-co-price">{l.qty > 1 && <small>{l.qty}x</small>}<strong>{rpBuyer(unitPrice(Number(l.price), l.qty, l.discount as Discount, fpOf(l)) * l.qty)}</strong></span>
              </article>
            );
          })}
          {guest ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-primary/30 bg-accent/60 p-3 text-xs text-muted-foreground">Belanja tanpa akun. Link pesanan dikirim ke halaman ini, simpan baik-baik. Sudah punya akun? <Link to="/login" className="font-bold text-primary">Masuk</Link></p>
              <label className="block"><span className="mk-co-label"><Mail className="h-3 w-3" /> Email anda *</span>
                <input value={email} onChange={(e) => setEmail(e.target.value.slice(0, 120))} type="email" inputMode="email" autoComplete="email" placeholder="kamu@email.com" className="mk-co-input" />
              </label>
              <div>
                <p className="mk-co-label">Kirim produk lewat *</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([["wa", Phone, "WhatsApp"], ["tg", Send, "Telegram"]] as const).map(([k, I, l]) => (
                    <button key={k} type="button" onClick={() => setVia(k)} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition active:scale-95 ${via === k ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground"}`}><I className="h-4 w-4" />{l}{via === k && <CircleCheck className="h-4 w-4" />}</button>
                  ))}
                </div>
                {via === "wa" ? (
                  <input value={wa} onChange={(e) => setWa(e.target.value.replace(/[^\d+]/g, "").slice(0, 16))} placeholder="08xxxxxxxxxx" inputMode="tel" aria-label="Nomor WhatsApp" className="mk-co-input mt-2" />
                ) : (
                  <input value={tg} onChange={(e) => setTg(e.target.value.replace(/[^@A-Za-z0-9_]/g, "").slice(0, 33))} placeholder="@username" aria-label="Username Telegram" className="mk-co-input mt-2" />
                )}
                <p className="mt-1 text-xs text-muted-foreground">Seller memakai kontak ini bila produk perlu dikirim manual.</p>
              </div>
            </div>
          ) : (
          <label className="block"><span className="mk-co-label"><Phone className="h-3 w-3" /> Nomor WhatsApp</span>
            <input value={phone} onChange={(e) => setWa(e.target.value.replace(/[^\d+]/g, ""))} placeholder="08xxxxxxxxxx" inputMode="tel" className="mk-co-input" />
          </label>
          )}
          <label className="block"><span className="mk-co-label">Catatan untuk seller{noteReq ? " *" : ""}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder={noteReq ? "Wajib diisi sesuai kebutuhan pesanan." : "Opsional, misalnya instruksi pengiriman."} className="mk-co-input" />
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
        <section className="mk-co-card">
          <p className="mk-co-label text-foreground"><Ticket className="h-3 w-3" /> Kode voucher</p>
          <div className="flex items-center gap-2">
            <input value={voucher} onChange={(e) => { setVoucher(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)); setVInfo(null); }} placeholder="Masukkan kode voucher" aria-label="Kode voucher" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base outline-none placeholder:text-muted-foreground" />
            <button type="button" onClick={() => void checkVoucher()} disabled={!voucher || vBusy || !lines.length} className="h-9 w-[76px] shrink-0 rounded-lg bg-primary text-[11px] font-extrabold text-primary-foreground transition active:scale-95 disabled:opacity-50">{vBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Terapkan"}</button>
          </div>
          {vInfo && <p className={`mt-1.5 text-[11px] ${vInfo.ok ? "text-success" : "text-destructive"}`}>{vInfo.text}</p>}
        </section>
        <section className="mk-co-card space-y-2">
          <h2>Metode Pembayaran</h2>
          {([["saldo", Wallet, "Saldo Marketku", guest ? "Masuk untuk bayar pakai saldo" : `Saldo ${rpBuyer(bal)}${lowSaldo ? " • tidak cukup" : ""}`], ["qris", QrCode, "QRIS Marketku", "Scan QRIS / e-wallet, upload bukti"]] as const).filter(([k]) => !guest || k === "qris").map(([k, I, l, d]) => (
            <button key={k} type="button" onClick={() => setMethod(k)} className={`mk-co-method ${payMethod === k ? "is-active" : ""}`}>
              <span className="mk-co-method__icon"><I className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-xs font-bold">{l}</strong><span className={`block text-[11px] ${k === "saldo" && lowSaldo ? "text-destructive" : "text-muted-foreground"}`}>{d}</span></span>
              {payMethod === k ? <CircleCheck className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
          {payMethod === "saldo" && lowSaldo && <Link to="/topup" className="mt-2 block text-sm font-semibold text-primary">Top up saldo →</Link>}
          <p className="flex gap-2 pt-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" /> Data kamu aman dan hanya dipakai untuk pengiriman produk.</p>
        </section>
        <section className="mk-co-card space-y-2.5 text-xs">
          <h2>Rincian Pembayaran</h2>
          {[["Metode Pembayaran", payMethod === "saldo" ? "Saldo Marketku" : "QRIS Marketku"], [`Total Pesanan (${count} item)`, rpBuyer(subtotal)], ["Biaya admin", rpBuyer(0)], ["Kode unik QRIS", payMethod === "saldo" ? "Tidak ada" : "Dibuat saat bayar"]].map(([a, b]) => (
            <div key={a} className="flex justify-between"><span className="text-muted-foreground">{a}</span><strong className="font-medium">{b}</strong></div>
          ))}
          <div className="flex items-center justify-between border-t pt-3"><span className="text-[13px] font-medium">Total</span><strong className="text-[17px] font-extrabold">{rpBuyer(subtotal)}</strong></div>
          <p className="flex items-center gap-2 rounded-xl border border-primary/15 bg-accent/50 px-3 py-2.5 text-[11px] text-muted-foreground"><Shield className="h-3.5 w-3.5 shrink-0 text-primary" /> Pembayaran aman dijaga platform Marketku.</p>
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-between rounded-t-2xl border-t bg-card px-4 py-3 shadow-[0_-12px_30px_-20px_color-mix(in_oklab,var(--foreground)_35%,transparent)]">
        <div className="min-w-0"><p className="text-[11px] font-bold text-muted-foreground">Total dibayar</p><p className="text-base font-extrabold">{rpBuyer(subtotal)}</p><em className="block text-[10px] font-semibold not-italic text-muted-foreground">{payMethod === "saldo" ? "Dipotong dari Saldo Marketku" : "Kode unik QRIS dibuat saat bayar"}</em></div>
        <button disabled={!lines.length || busy || (payMethod === "saldo" && lowSaldo)} onClick={start} className="flex h-[38px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition active:scale-95 disabled:opacity-50">
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
