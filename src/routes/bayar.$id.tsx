import { isUuid } from "@/lib/market";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Check, CircleCheck, Clock, Copy, Download, Home, ImagePlus, Info, Loader2, Package, ShoppingBag, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dbError } from "@/lib/market";
import { usePaymentMethods } from "@/lib/admin";
import { uploadPaymentImage, usePaymentUrls, useWallet } from "@/lib/wallet";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { LoadingLine } from "@/components/marketku/loading";
import { pageMeta } from "@/lib/meta";
import logo from "@/assets/logo-marketku.png.asset.json";

export const Route = createFileRoute("/bayar/$id")({
  head: () => pageMeta("Pembayaran — Marketku", "Scan QRIS atau bayar dengan Saldo Marketku untuk menyelesaikan pesananmu."),
  component: Bayar,
});

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

function useCountdown(to: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  if (!to) return null;
  const ms = Math.max(0, new Date(to).getTime() - now);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return { ms, text: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

function Bayar() {
  const { id } = Route.useParams();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["order_view", id, user?.id], enabled: !!user,
    queryFn: async () => {
      if (!isUuid(id)) return { orders: [] };
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("checkout_id", id).eq("buyer_id", user!.id).order("created_at");
      if (error) throw error;
      return { orders: data ?? [] };
    },
  });
  const orders = q.data?.orders ?? [];
  const pending = orders.filter((o) => o.status === "pending");
  const items = pending.flatMap((o) => o.order_items);
  const qrisDue = pending.reduce((a, o) => a + Number(o.total), 0);
  const saldoDue = pending.reduce((a, o) => a + Number(o.subtotal) - Number(o.discount), 0);
  const uniq = pending.reduce((a, o) => a + Number(o.unique_code), 0);
  const cd = useCountdown(pending[0]?.expires_at);

  const wallet = useWallet(user?.id);
  const methods = usePaymentMethods(!!user);
  const active = (methods.data ?? []).filter((m) => m.is_active);
  const qrUrls = usePaymentUrls(active.map((m) => m.qr_path));
  const payments = useQuery({
    queryKey: ["order_payments", id], enabled: !!user,
    queryFn: async () => !isUuid(id) ? [] : (await supabase.from("order_payments").select("id, status, admin_note, amount, method_label").eq("checkout_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const [tab, setTab] = useState<"qris" | "saldo">("qris");
  const [methodId, setMethodId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!methodId && active.length) setMethodId((active.find((m) => m.kind === "qris") ?? active[0]!).id); }, [active, methodId]);

  const method = active.find((m) => m.id === methodId);
  const qr = method?.qr_path ? qrUrls.data?.[method.qr_path] : undefined;
  const waiting = payments.data?.find((p) => p.status === "pending");
  const rejected = !waiting ? payments.data?.find((p) => p.status === "rejected") : undefined;
  const bal = wallet.data ?? 0;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["order_view", id, user?.id] }); void payments.refetch(); };

  const payWallet = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("pay_order_with_wallet", { p_checkout: id });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Pembayaran berhasil dengan Saldo Marketku");
    void qc.invalidateQueries({ queryKey: ["wallet", user?.id] });
    refresh();
  };
  const sendProof = async () => {
    if (!user || !method) return;
    if (!file) { toast.error("Upload bukti transfer dulu"); return; }
    setBusy(true);
    try {
      const path = await uploadPaymentImage(user.id, file);
      const { error } = await supabase.rpc("submit_order_payment", { p_checkout: id, p_proof: path, p_method: method.id });
      if (error) throw error;
      toast.success("Bukti dikirim. Admin akan mengecek pembayaranmu.");
      setFile(null); refresh();
    } catch (e) { toast.error(dbError(e)); } finally { setBusy(false); }
  };
  const download = async () => {
    if (!qr) return;
    try {
      const blob = await (await fetch(qr)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `QRIS-M-${pending[0]?.order_no ?? ""}.png`; a.click();
      URL.revokeObjectURL(a.href);
    } catch { window.open(qr, "_blank"); }
  };

  if (ready && !user) return <AppShell><div className="p-3"><EmptyState icon={Package} title="Masuk untuk membayar" desc="Pesanan tersimpan di akunmu." action={<PrimaryLink to="/login">Masuk</PrimaryLink>} /></div></AppShell>;
  if (!ready || q.isLoading) return <AppShell><LoadingLine label="Memuat pembayaran..." className="m-3 rounded-2xl border bg-card py-16" /></AppShell>;
  if (!pending.length) {
    if (!orders.length) return <AppShell><div className="p-3"><EmptyState icon={Package} title="Pesanan tidak ditemukan" desc="Pesanan ini tidak ada di akunmu." action={<PrimaryLink to="/cari">Belanja</PrimaryLink>} /></div></AppShell>;
    const paid = orders.some((o) => o.paid_at);
    return <PayResult id={id} paid={paid} orderNo={orders[0]!.order_no} productId={orders[0]!.order_items[0]?.product_id ?? null} />;
  }

  const orderNo = `#M-${pending[0]!.order_no}`;
  const title = items.map((i) => i.product_name).join(", ");
  const qtyAll = items.reduce((a, i) => a + i.qty, 0);
  const expired = cd ? cd.ms === 0 : false;
  if (expired && !waiting) return <PayResult id={id} paid={false} orderNo={pending[0]!.order_no} productId={items[0]?.product_id ?? null} />;

  return (
    <AppShell>
      <div className="px-3 pb-6 pt-3">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b bg-gradient-to-b from-muted/60 to-transparent px-4 pb-4 pt-3 text-center">
            <p className="flex items-center justify-center gap-2 font-bold"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> {waiting ? "Menunggu konfirmasi admin" : "Menunggu pembayaran"}</p>
            <div className="mt-2 flex justify-center gap-2">
              <button onClick={() => setGuide(true)} className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><Info className="h-3.5 w-3.5" /> Cara bayar</button>
              <Link to="/pesanan/$id" params={{ id }} className="flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning"><Copy className="h-3.5 w-3.5" /> Order</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 px-4 pt-4">
            {([["qris", "QRIS / E-Wallet"], ["saldo", "Saldo Marketku"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-xl border py-2 text-xs font-semibold transition active:scale-95 ${tab === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>

          {waiting ? (
            <p className="m-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-muted-foreground">Bukti {waiting.method_label} sebesar <b className="text-foreground">{rp(Number(waiting.amount))}</b> sudah dikirim. Pesanan diproses otomatis setelah admin menyetujui.</p>
          ) : tab === "qris" ? (
            <div className="px-4 pt-4 text-center">
              {cd && <p className={`mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${expired ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-warning/60 bg-warning/10 text-warning"}`}><Clock className="h-4 w-4" /> {expired ? "Waktu bayar habis" : <>Berlaku selama <span className="font-mono">{cd.text}</span></>}</p>}
              {active.length > 1 && (
                <div className="mt-3 flex justify-center gap-2 overflow-x-auto">
                  {active.map((m) => <button key={m.id} onClick={() => setMethodId(m.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${methodId === m.id ? "border-primary text-primary" : "text-muted-foreground"}`}>{m.provider}</button>)}
                </div>
              )}
              {methods.isPending ? <LoadingLine label="Memuat QRIS..." className="py-10" /> : !method ? (
                <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">QRIS belum tersedia. Pakai Saldo Marketku dulu.</p>
              ) : (
                <>
                  <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                    <img src={logo.url} alt="Marketku" className="mx-auto h-8 w-auto" />
                    <div className="relative mt-3 rounded-2xl bg-[hsl(222_47%_11%)] p-4 pb-3">
                      <div className="relative rounded-xl bg-white p-3">
                        {qr ? <img src={qr} alt={`QR ${method.provider}`} className="mx-auto aspect-square w-full object-contain" /> : (
                          <div className="grid aspect-square place-items-center text-center text-xs text-neutral-500">{method.account_number ? <span><b className="block text-base text-neutral-900">{method.provider}</b><span className="font-mono">{method.account_number}</span><br />a.n. {method.account_name}</span> : "QR tidak tersedia"}</div>
                        )}
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(222_47%_11%)] px-3 py-1 font-mono text-xs font-bold text-white">{orderNo}</span>
                        <span className="absolute -bottom-3 left-2 rounded-t-lg bg-[hsl(222_47%_11%)] px-3 py-1 text-[11px] font-bold tracking-widest text-white">SCAN ME</span>
                      </div>
                      <p className="mt-4 line-clamp-2 text-sm font-bold text-white">{title}</p>
                    </div>
                  </div>
                  {qr && <button onClick={() => void download()} className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition active:scale-95"><Download className="h-4 w-4" /> Download</button>}
                  {method.account_number && qr && (
                    <button onClick={() => { void navigator.clipboard.writeText(method.account_number!.replace(/\s/g, "")); toast.success("Nomor disalin"); }} className="mx-auto mt-2 flex items-center gap-1 text-xs text-muted-foreground">{method.provider} <span className="font-mono">{method.account_number}</span> <Copy className="h-3 w-3" /></button>
                  )}
                  {rejected && <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-left text-xs text-destructive">Bukti sebelumnya ditolak{rejected.admin_note ? `: ${rejected.admin_note}` : ""}. Silakan kirim ulang.</p>}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <button onClick={() => fileRef.current?.click()} className="mt-4 flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 py-3 text-sm text-muted-foreground">
                    <ImagePlus className="h-5 w-5 text-primary" /> {file ? <span className="font-semibold text-foreground">{file.name}</span> : "Upload bukti transfer"}
                  </button>
                  <button disabled={busy || expired} onClick={() => void sendProof()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Kirim Bukti Pembayaran</button>
                </>
              )}
            </div>
          ) : (
            <div className="m-4 rounded-xl border p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo kamu</span><b>{rp(bal)}</b></div>
              {bal < saldoDue && <p className="mt-2 text-xs text-destructive">Saldo kurang {rp(saldoDue - bal)}. <Link to="/topup" className="font-bold underline">Top up dulu</Link></p>}
              <button disabled={busy || bal < saldoDue || expired} onClick={() => void payWallet()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Bayar {rp(saldoDue)}</button>
            </div>
          )}

          <div className="mt-4 border-t px-4 py-4">
            <h2 className="mb-2 font-bold">Detail Pembayaran</h2>
            <div className="flex gap-4 border-b py-3 text-sm"><span className="shrink-0 text-muted-foreground">Produk</span><span className="font-semibold">{title}</span></div>
            <DRow a={`Total harga (${qtyAll} item)`} b={rp(saldoDue)} />
            <div className="flex items-center justify-between border-b py-3 text-sm"><span className="text-muted-foreground">Metode</span><span className="flex items-center gap-2 font-semibold">{tab === "qris" ? <><span className="rounded-md border border-primary/60 px-1.5 text-[10px] font-bold text-primary">QR</span>{method?.provider ?? "Marketku"}</> : "Saldo Marketku"}</span></div>
            <DRow a="Biaya layanan" b="Rp0" />
            {tab === "qris" && <DRow a="Kode unik" b={rp(uniq)} last />}
          </div>
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-4">
            <span className="text-sm text-muted-foreground">Total pembayaran</span>
            <span className="text-2xl font-bold text-primary">{rp(tab === "qris" ? qrisDue : saldoDue)}</span>
          </div>
        </div>
      </div>

      <Dialog.Root open={guide} onOpenChange={setGuide}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-3">
              <div><p className="text-xs font-semibold tracking-widest text-muted-foreground">PANDUAN</p><Dialog.Title className="text-xl font-bold">Cara bayar</Dialog.Title></div>
              <Dialog.Close className="rounded-full border px-4 py-1.5 text-sm font-semibold text-muted-foreground">Tutup</Dialog.Close>
            </div>
            <ol className="mt-4 space-y-4">
              {[["Pesanan dibuat", "Kode QR sudah siap dipindai."], ["Scan QRIS", "Buka m-banking/e-wallet, pilih scan QR, lalu bayar sesuai nominal."], ["Kirim bukti", "Upload bukti transfer. Admin mengecek dan membuka data pesanan setelah pembayaran sukses."]].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${i === 0 ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>{i === 0 ? <Check className="h-4 w-4" /> : i + 1}</span>
                  <span><b className="block">{t}</b><span className="text-sm text-muted-foreground">{d}</span></span>
                </li>
              ))}
            </ol>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}

const DRow = ({ a, b, last }: { a: string; b: string; last?: boolean }) => (
  <div className={`flex justify-between py-3 text-sm ${last ? "" : "border-b"}`}><span className="text-muted-foreground">{a}</span><b>{b}</b></div>
);

// Layar hasil: berhasil (otomatis pindah ke data akses 3 detik) atau kadaluarsa/dibatalkan.
function PayResult({ id, paid, orderNo, productId }: { id: string; paid: boolean; orderNo: number; productId: string | null }) {
  const navigate = useNavigate();
  const [sec, setSec] = useState(3);
  useEffect(() => {
    if (!paid) return;
    const t = window.setInterval(() => setSec((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [paid]);
  useEffect(() => { if (paid && sec <= 0) navigate({ to: "/pesanan/$id", params: { id }, replace: true }); }, [paid, sec, id, navigate]);
  const copy = () => { void navigator.clipboard.writeText(`M-${orderNo}`); toast.success("Order ID disalin"); };
  return (
    <AppShell>
      <div className="px-3 pb-6 pt-3">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3 text-center">
            {paid ? (
              <>
                <p className="flex items-center justify-center gap-2 font-bold"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Pembayaran diterima</p>
                <p className="text-sm text-muted-foreground">Pembayaran diterima</p>
              </>
            ) : <div className="h-2" />}
            <div className={`mt-2 flex gap-2 ${paid ? "justify-center" : "justify-end"}`}>
              <button onClick={copy} className="flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning"><Copy className="h-3.5 w-3.5" /> Order</button>
            </div>
          </div>
          <div className={`px-6 pb-8 pt-8 text-center ${paid ? "bg-gradient-to-b from-primary/5 to-transparent" : "bg-gradient-to-b from-destructive/10 to-transparent"}`}>
            <span className={`mx-auto grid h-24 w-24 place-items-center rounded-3xl text-primary-foreground shadow-lg animate-in zoom-in-50 ${paid ? "bg-gradient-to-br from-success to-primary" : "bg-destructive"}`}>
              {paid ? <CircleCheck className="h-12 w-12" /> : <X className="h-12 w-12" strokeWidth={3} />}
            </span>
            <h1 className="mt-5 text-2xl font-bold leading-tight">{paid ? "Pembayaran Berhasil" : "Pembayaran untuk pesanan ini sudah kadaluarsa"}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{paid ? "Terima kasih, pembayaran kamu sudah diterima. Data akses produk sudah bisa dibuka sekarang." : "Waktu pembayaran sudah habis dan QR tidak bisa digunakan lagi. Silakan buat pesanan baru untuk melanjutkan pembelian."}</p>
            {paid ? (
              <div className="mt-6 space-y-3">
                <Link to="/pesanan/$id" params={{ id }} className="block rounded-xl bg-primary py-3 font-bold text-primary-foreground">Lihat data akses sekarang</Link>
                <Link to="/riwayat" className="block rounded-xl border-2 border-primary py-3 font-bold text-primary">Riwayat pesanan</Link>
                <p className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-semibold text-muted-foreground">Otomatis pindah ke halaman data akses dalam {Math.max(sec, 0)} detik</p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {productId ? <Link to="/produk/$id" params={{ id: productId }} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"><ShoppingBag className="h-4 w-4" /> Beli lagi</Link>
                  : <Link to="/cari" className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"><ShoppingBag className="h-4 w-4" /> Beli lagi</Link>}
                <Link to="/" className="flex items-center justify-center gap-2 rounded-xl border py-3 font-bold"><Home className="h-4 w-4" /> Home</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
