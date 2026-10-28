import { createFileRoute } from "@tanstack/react-router";
import { Phone, ShieldCheck, Shield, QrCode, CircleCheck, ShoppingCart } from "lucide-react";
import { AppShell, EmptyState, PrimaryLink, soon } from "@/components/marketku/shell";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Marketku" },
      { name: "description", content: "Selesaikan pembayaran pesananmu di Marketku." },
      { property: "og:title", content: "Checkout — Marketku" },
      { property: "og:description", content: "Checkout aman dengan QRIS Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  return (
    <AppShell nav={false}>
      <div className="space-y-4 px-3 pt-4 pb-28">
        <section className="space-y-4 rounded-2xl border bg-card p-4">
          <h2 className="border-b pb-3 text-lg font-bold">Pesanan Anda</h2>
          <EmptyState icon={ShoppingCart} title="Belum ada produk" desc="Pilih produk dulu untuk checkout." action={<PrimaryLink to="/cari">Pilih produk</PrimaryLink>} />
          <label className="block text-sm font-medium text-muted-foreground"><span className="flex items-center gap-1"><Phone className="h-4 w-4" /> Nomor WhatsApp</span>
            <input placeholder="08xxxxxxxxxx" inputMode="tel" className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-foreground outline-none" />
          </label>
          <label className="block text-sm font-medium">Catatan untuk seller *
            <textarea rows={3} placeholder="Wajib diisi sesuai kebutuhan pesanan." className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 outline-none" />
          </label>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">Kode voucher</p>
          <div className="mt-2 flex gap-2">
            <input placeholder="Masukkan kode voucher" className="flex-1 bg-transparent outline-none" />
            <button onClick={() => soon("Voucher")} className="rounded-xl bg-primary/60 px-4 py-2 text-sm font-semibold text-primary-foreground">Terapkan</button>
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="border-b pb-3 text-lg font-bold">Metode Pembayaran</h2>
          <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-primary bg-accent p-3">
            <QrCode className="h-5 w-5 text-primary" /><span className="flex-1 font-semibold">QRIS Marketku</span><CircleCheck className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 flex gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-success" /> Data kamu aman dan hanya dipakai untuk pengiriman produk.</p>
        </section>
        <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <h2 className="border-b pb-3 text-lg font-bold">Rincian Pembayaran</h2>
          {[["Metode Pembayaran", "QRIS Marketku"], ["Total Pesanan (0 item)", "Rp0"], ["Biaya admin", "Rp0"], ["Kode unik QRIS", "Rp0"]].map(([a, b]) => (
            <div key={a} className="flex justify-between"><span className="text-muted-foreground">{a}</span><span>{b}</span></div>
          ))}
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>Rp0</span></div>
          <p className="flex gap-2 rounded-xl border bg-accent/50 p-3 text-muted-foreground"><Shield className="h-4 w-4 text-primary" /> Pembayaran aman dijaga platform Marketku.</p>
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-between border-t bg-card p-4">
        <div><p className="text-xs text-muted-foreground">Total dibayar</p><p className="text-xl font-bold">Rp0</p></div>
        <button onClick={() => soon("Pembayaran")} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Shield className="h-4 w-4" /> Bayar Sekarang</button>
      </div>
    </AppShell>
  );
}
