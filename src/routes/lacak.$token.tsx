import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CircleCheck, Clock, Copy, Download, ImagePlus, Link2, Loader2, Package, RefreshCw, X } from "lucide-react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { LoadingLine } from "@/components/marketku/loading";
import { pageMeta } from "@/lib/meta";
import { guestOrder, guestSubmitProof } from "@/lib/guest.functions";
import { rememberGuestOrder } from "@/lib/guest";
import { dbError } from "@/lib/market";
import logo from "@/assets/logo-marketku.png.asset.json";

export const Route = createFileRoute("/lacak/$token")({
  head: () => ({ ...pageMeta("Pesanan Tamu — Marketku", "Bayar QRIS dan buka produk pesananmu tanpa akun Marketku."), meta: [...pageMeta("Pesanan Tamu — Marketku", "Bayar QRIS dan buka produk pesananmu tanpa akun Marketku.").meta, { name: "robots", content: "noindex" }] }),
  component: GuestOrderPage,
});

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  return now;
}

const toBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] ?? "");
  r.onerror = () => rej(new Error("Gagal membaca foto"));
  r.readAsDataURL(f);
});

function GuestOrderPage() {
  const { token } = Route.useParams();
  const read = useServerFn(guestOrder);
  const submit = useServerFn(guestSubmitProof);
  const q = useQuery({
    queryKey: ["guest_order", token],
    queryFn: () => read({ data: { token } }),
    refetchInterval: (s) => (s.state.data?.orders.some((o) => o.status === "pending") ? 15_000 : false),
    retry: false,
  });
  useEffect(() => { if (q.data) rememberGuestOrder(token); }, [q.data, token]);
  const now = useNow();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const d = q.data;
  const methods = d?.methods ?? [];
  useEffect(() => { if (!methodId && methods.length) setMethodId((methods.find((m) => m.kind === "qris") ?? methods[0]!).id); }, [methods, methodId]);

  if (q.isLoading) return <AppShell><LoadingLine label="Memuat pesanan..." className="m-3 rounded-2xl border bg-card py-16" /></AppShell>;
  if (!d || !d.orders.length) return <AppShell><div className="p-3"><EmptyState icon={Package} title="Pesanan tidak ditemukan" desc="Link pesanan ini salah atau sudah tidak berlaku." action={<PrimaryLink to="/cari">Belanja</PrimaryLink>} /></div></AppShell>;

  const orders = d.orders;
  const pending = orders.filter((o) => o.status === "pending");
  const paid = orders.some((o) => o.paid_at);
  const cancelled = !pending.length && !paid;
  const due = pending.reduce((a, o) => a + Number(o.total), 0);
  const uniq = pending.reduce((a, o) => a + Number(o.unique_code), 0);
  const expAt = pending[0]?.expires_at ? new Date(pending[0].expires_at).getTime() : null;
  const left = expAt ? Math.max(0, expAt - now) : null;
  const waiting = d.payments.find((p) => p.status === "pending");
  const rejected = !waiting ? d.payments.find((p) => p.status === "rejected") : undefined;
  const expired = left === 0 && !waiting;
  const method = methods.find((m) => m.id === methodId);
  const orderNo = `M-${orders[0]!.order_no}`;
  const items = orders.flatMap((o) => o.order_items);
  const link = typeof window !== "undefined" ? window.location.href : "";

  const sendProof = async () => {
    if (!method) return;
    if (!file) { toast.error("Upload bukti transfer dulu"); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast.error("Format harus JPG, PNG, atau WebP"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5 MB"); return; }
    setBusy(true);
    try {
      const r = await submit({ data: { token, method: method.id, type: file.type, file: await toBase64(file) } });
      if (!r.ok) throw new Error(r.error);
      toast.success("Bukti dikirim. Admin akan mengecek pembayaranmu.");
      setFile(null); void q.refetch();
    } catch (e) { toast.error(dbError(e)); } finally { setBusy(false); }
  };

  const status = paid ? ["bg-success", "Pembayaran diterima"] : cancelled || expired ? ["bg-destructive", "Pesanan dibatalkan / kedaluwarsa"] : waiting ? ["bg-warning", "Menunggu konfirmasi admin"] : ["bg-warning", "Menunggu pembayaran"];

  return (
    <AppShell>
      <div className="space-y-3 px-3 pb-6 pt-3">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b bg-gradient-to-b from-muted/60 to-transparent px-4 pb-4 pt-3 text-center">
            <p className="flex items-center justify-center gap-2 font-bold"><span className={`h-2.5 w-2.5 rounded-full ${status[0]}`} /> {status[1]}</p>
            <div className="mt-2 flex justify-center gap-2">
              <button onClick={() => { void navigator.clipboard.writeText(orderNo); toast.success("Order ID disalin"); }} className="flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning"><Copy className="h-3.5 w-3.5" /> #{orderNo}</button>
              <button onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link pesanan disalin"); }} className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><Link2 className="h-3.5 w-3.5" /> Salin link</button>
              <button onClick={() => void q.refetch()} aria-label="Muat ulang" className="grid h-7 w-7 place-items-center rounded-full border text-muted-foreground"><RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /></button>
            </div>
          </div>

          {paid ? (
            <div className="px-4 py-5 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-success to-primary text-primary-foreground shadow-lg animate-in zoom-in-50"><CircleCheck className="h-9 w-9" /></span>
              <p className="mt-3 text-lg font-bold">Pembayaran Berhasil</p>
              <p className="text-sm text-muted-foreground">Produk otomatis terkirim di bawah. Produk manual dikirim seller ke {d.telegram ? `Telegram @${d.telegram}` : `WhatsApp ${d.whatsapp ?? ""}`}.</p>
            </div>
          ) : cancelled || expired ? (
            <div className="px-4 py-6 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive text-primary-foreground"><X className="h-9 w-9" strokeWidth={3} /></span>
              <p className="mt-3 text-lg font-bold">Pembayaran sudah kedaluwarsa</p>
              <p className="text-sm text-muted-foreground">Silakan buat pesanan baru untuk melanjutkan.</p>
              <Link to="/produk/$id" params={{ id: items[0]?.product_id ?? "" }} className="mt-4 inline-block rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground">Beli lagi</Link>
            </div>
          ) : waiting ? (
            <p className="m-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-muted-foreground">Bukti {waiting.method_label} sebesar <b className="text-foreground">{rp(Number(waiting.amount))}</b> sudah dikirim. Halaman ini otomatis diperbarui setelah admin menyetujui.</p>
          ) : (
            <div className="px-4 pt-4 text-center">
              {left !== null && <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-warning/60 bg-warning/10 px-4 py-1.5 text-sm font-semibold text-warning"><Clock className="h-4 w-4" /> Berlaku selama <span className="font-mono">{String(Math.floor(left / 60000)).padStart(2, "0")}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}</span></p>}
              {methods.length > 1 && (
                <div className="mt-3 flex justify-center gap-2 overflow-x-auto">
                  {methods.map((m) => <button key={m.id} onClick={() => setMethodId(m.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${methodId === m.id ? "border-primary text-primary" : "text-muted-foreground"}`}>{m.provider}</button>)}
                </div>
              )}
              {!method ? <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">QRIS belum tersedia. Hubungi admin.</p> : (
                <>
                  <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                    <img src={logo.url} alt="Marketku" className="mx-auto h-8 w-auto" />
                    <div className="relative mt-3 rounded-2xl bg-[hsl(222_47%_11%)] p-4 pb-3">
                      <div className="relative rounded-xl bg-white p-3">
                        {method.qr_url ? <img src={method.qr_url} alt={`QR ${method.provider}`} className="mx-auto aspect-square w-full object-contain" /> : (
                          <div className="grid aspect-square place-items-center text-center text-xs text-neutral-500">{method.account_number ? <span><b className="block text-base text-neutral-900">{method.provider}</b><span className="font-mono">{method.account_number}</span><br />a.n. {method.account_name}</span> : "QR tidak tersedia"}</div>
                        )}
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(222_47%_11%)] px-3 py-1 font-mono text-xs font-bold text-white">#{orderNo}</span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-bold text-white">{items.map((i) => i.product_name).join(", ")}</p>
                    </div>
                  </div>
                  {method.qr_url && <a href={method.qr_url} download={`QRIS-${orderNo}.png`} target="_blank" rel="noreferrer" className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"><Download className="h-4 w-4" /> Download QR</a>}
                  {rejected && <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-left text-xs text-destructive">Bukti sebelumnya ditolak{rejected.admin_note ? `: ${rejected.admin_note}` : ""}. Silakan kirim ulang.</p>}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <button onClick={() => fileRef.current?.click()} className="mt-4 flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 py-3 text-sm text-muted-foreground">
                    <ImagePlus className="h-5 w-5 text-primary" /> {file ? <span className="font-semibold text-foreground">{file.name}</span> : "Upload bukti transfer"}
                  </button>
                  <button disabled={busy} onClick={() => void sendProof()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Kirim Bukti Pembayaran</button>
                </>
              )}
            </div>
          )}

          {!paid && !cancelled && !expired && (
            <div className="mt-4 flex items-center justify-between border-t bg-muted/30 px-4 py-4">
              <span className="text-sm text-muted-foreground">Total pembayaran{uniq > 0 ? ` (kode unik ${rp(uniq)})` : ""}</span>
              <span className="text-2xl font-bold text-primary">{rp(due)}</span>
            </div>
          )}
        </div>

        {orders.map((o) => (
          <section key={o.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="space-y-2 p-3">
              <p className="text-sm font-bold">{o.store_name}</p>
              {o.order_items.map((i) => (
                <div key={i.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-bold leading-snug">{i.product_name}</p><p className="text-xs text-muted-foreground">{i.variant_name}{i.qty > 1 ? ` · ${i.qty}x` : ""}</p></div>
                    <b className="shrink-0 text-sm">{rp(Number(i.line_total))}</b>
                  </div>
                  {i.delivered.length > 0 && (
                    <div className="rounded-xl bg-accent p-3 text-sm">
                      <p className="mb-1 font-semibold text-primary">Produk kamu</p>
                      {i.delivered.map((x, n) => "file" in x ? (
                        <a key={n} href={x.url ?? "#"} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-semibold"><Download className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{x.file}</span><span className="text-primary">Unduh</span></a>
                      ) : <p key={n} className="whitespace-pre-wrap break-all font-mono text-xs">{x.text}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="space-y-1 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          <p><b className="text-foreground">Email:</b> {d.email}</p>
          {d.whatsapp && <p><b className="text-foreground">WhatsApp:</b> {d.whatsapp}</p>}
          {d.telegram && <p><b className="text-foreground">Telegram:</b> @{d.telegram}</p>}
          <p className="pt-1">Simpan link halaman ini untuk membuka pesananmu lagi. Siapa pun yang punya link ini bisa melihat produkmu.</p>
        </section>
      </div>
    </AppShell>
  );
}
