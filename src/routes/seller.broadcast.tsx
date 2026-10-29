import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Upload, Eye, History, X } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { SellerCard } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/broadcast")({
  head: () => pageMeta("Broadcast — Seller Center Marketku", "Kirim pesan massal ke pelanggan bot Telegram tokomu."),
  component: Broadcast,
});

export const BROADCAST_MAX = 4000;

const tour = [
  { title: "Tulis pesan", desc: "Tulis pesan broadcast untuk pelanggan botmu. Mendukung HTML dasar.", target: "bc-msg" },
  { title: "Gambar opsional", desc: "Tambahkan gambar agar pesan lebih menarik.", target: "bc-img" },
  { title: "Pratinjau dulu", desc: "Buka pratinjau untuk cek target dan tes ke akunmu sendiri.", target: "bc-preview" },
  { title: "Selesai", desc: "Setelah tes lolos, broadcast dikirim lewat antrean agar prosesnya cepat." },
];

function Broadcast() {
  const [msg, setMsg] = useState("");
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => () => { if (img) URL.revokeObjectURL(img); }, [img]);

  const pick = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Pilih file gambar"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran gambar maksimal 5 MB"); return; }
    setImg(URL.createObjectURL(file));
  };
  const preview = () => {
    if (!msg.trim()) { toast.error("Tulis pesan broadcast dulu"); return; }
    toast.error("Hubungkan bot Telegram dulu untuk mengirim broadcast");
  };

  return (
    <>
      <SellerCard className="flex gap-3 border-warning/40 bg-warning/10 p-4 text-sm text-foreground/85">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        Sekarang broadcast pakai alur aman: cek pratinjau dulu, tes ke akun Anda sendiri, lalu kirim ke antrean agar proses terasa jauh lebih cepat.
      </SellerCard>
      <div data-tour="bc-msg">
        <textarea value={msg} maxLength={BROADCAST_MAX} onChange={(e) => setMsg(e.target.value)} rows={6} placeholder="Pesan Broadcast"
          className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        <p className="mt-1 text-xs text-muted-foreground">{msg.length} karakter — Support HTML: &lt;b&gt;, &lt;i&gt;, &lt;a&gt;</p>
      </div>
      <div data-tour="bc-img">
        <p className="mb-2 text-sm">Gambar (opsional)</p>
        {img ? (
          <div className="relative overflow-hidden rounded-xl border">
            <img src={img} alt="Gambar broadcast" className="max-h-60 w-full object-cover" />
            <button aria-label="Hapus gambar" onClick={() => setImg(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed bg-card px-6 py-8 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-warning/15 text-warning"><Upload className="h-5 w-5" /></span>
            <span className="mt-3 text-sm font-semibold">Upload Gambar</span>
            <span className="text-xs text-muted-foreground">Klik untuk pilih gambar • Crop &amp; sesuaikan</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Estimasi penerima akan dihitung saat membuka pratinjau</p>
      <button data-tour="bc-preview" onClick={preview} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-warning/70 to-warning py-3.5 font-semibold text-background transition active:scale-95"><Eye className="h-4 w-4" /> Buka Pratinjau Dulu</button>
      <SellerCard className="p-4">
        <p className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" /> Riwayat Broadcast</p>
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada broadcast. <Link to="/seller/bot" className="text-primary">Hubungkan bot</Link> untuk mulai.</p>
      </SellerCard>
      <PageTour id="seller-broadcast" steps={tour} panel />
    </>
  );
}
