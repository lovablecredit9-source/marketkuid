import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/bantuan")({
  head: () => pageMeta("Pusat Bantuan — Marketku", "Jawaban pertanyaan umum seputar belanja dan jualan di Marketku."),
  component: Bantuan,
});

const FAQ = [
  ["Bagaimana cara membeli produk?", "Pilih produk, masukkan ke keranjang, lalu bayar lewat QRIS di halaman checkout. Produk digital dikirim otomatis setelah pembayaran berhasil."],
  ["Berapa lama produk dikirim?", "Produk dengan stok otomatis dikirim instan. Produk pre-order mengikuti estimasi dari penjual."],
  ["Bagaimana jika produk bermasalah?", "Ajukan klaim garansi atau dispute dari halaman pesanan. Dana ditahan sampai masalah selesai."],
  ["Bagaimana cara mulai berjualan?", "Buka halaman Akun lalu pilih Mulai Jualan. Isi nama toko dan kamu langsung bisa memakai Seller Center."],
  ["Bagaimana menarik saldo penjualan?", "Daftarkan rekening di Pengaturan Seller → Keuangan, lalu tarik dana dari menu Withdraw (minimal Rp50.000)."],
] as const;

function Bantuan() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <AppShell title="Bantuan">
      <div className="space-y-3 px-3 pt-3">
        <div className="flex items-center gap-3 rounded-2xl bg-accent/50 p-4">
          <HelpCircle className="h-6 w-6 text-primary" />
          <div><h1 className="text-lg font-bold">Pusat Bantuan</h1><p className="text-sm text-muted-foreground">Pertanyaan yang sering diajukan</p></div>
        </div>
        {FAQ.map(([q, a], i) => (
          <div key={q} className="rounded-xl border bg-card">
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 p-4 text-left font-semibold">
              <span className="flex-1">{q}</span><ChevronDown className={`h-4 w-4 transition ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-4 pb-4 text-sm text-muted-foreground">{a}</p>}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
