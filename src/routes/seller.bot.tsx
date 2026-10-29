import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Plus, RefreshCw, Search, Link2 } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { SellerCard, SellerInput, SellerSheet } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/bot")({
  head: () => pageMeta("Bot Telegram — Seller Center Marketku", "Hubungkan dan kelola bot Telegram untuk jualan otomatis."),
  component: BotPage,
});

export const MAX_BOTS = 5;
export const isBotToken = (t: string) => /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(t.trim());

const tour = [
  { title: "Hubungkan bot", desc: "Klik untuk menghubungkan bot Telegram baru ke tokomu.", target: "b-add" },
  { title: "Cari bot", desc: "Temukan bot dengan cepat saat punya banyak.", target: "b-search" },
  { title: "Daftar bot", desc: "Bot terhubung tampil di sini dengan statistik penjualan.", target: "b-list" },
  { title: "Selesai", desc: "Buat bot lewat @BotFather, lalu hubungkan tokennya di sini." },
];

function BotPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ token: "", name: "", admin: "", wa: "" });
  const submit = () => {
    if (!isBotToken(f.token)) { toast.error("Token bot tidak valid. Salin token dari @BotFather"); return; }
    if (f.wa && !/^62\d{8,13}$/.test(f.wa)) { toast.error("Nomor WhatsApp admin harus diawali 62"); return; }
    toast("Koneksi bot Telegram segera hadir. Token belum disimpan.");
    setOpen(false);
  };
  return (
    <>
      <div className="flex items-start gap-3">
        <Bot className="mt-1 h-5 w-5 text-primary" />
        <div><h2 className="text-lg font-bold">Bot Telegram</h2><p className="text-xs text-muted-foreground">Kelola bot store Anda • 0/{MAX_BOTS} bot</p></div>
      </div>
      <div className="flex gap-2">
        <button aria-label="Muat ulang" onClick={() => void qc.invalidateQueries()} className="grid h-11 w-11 place-items-center rounded-xl border bg-card"><RefreshCw className="h-4 w-4" /></button>
        <button data-tour="b-add" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition active:scale-95"><Plus className="h-4 w-4" /> Hubungkan Bot</button>
      </div>
      <label data-tour="b-search" className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bot..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>
      <SellerCard data-tour="b-list" className="flex flex-col items-center px-6 py-14 text-center">
        <Bot className="h-8 w-8 text-primary" />
        <p className="mt-4 font-bold">Belum ada bot</p>
        <p className="mt-1 text-sm text-muted-foreground">Hubungkan bot Telegram Anda untuk mulai berjualan secara mandiri.</p>
        <button onClick={() => setOpen(true)} className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95"><Plus className="h-4 w-4" /> Hubungkan Bot Pertama</button>
      </SellerCard>

      <SellerSheet open={open} onOpenChange={setOpen} title={<span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-warning/15 text-warning"><Link2 className="h-4 w-4" /></span><span>Hubungkan Bot Baru<span className="block text-xs font-normal text-muted-foreground">Dapatkan token dari @BotFather di Telegram</span></span></span>}
        footer={<>
          <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border bg-background/60 py-3 text-sm font-semibold">Batal</button>
          <button onClick={submit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-warning/80 to-warning py-3 text-sm font-semibold text-background transition active:scale-95"><Link2 className="h-4 w-4" /> Hubungkan</button>
        </>}>
        <div className="space-y-3">
          <SellerInput value={f.token} onChange={(e) => setF({ ...f, token: e.target.value.trim() })} placeholder="Bot Token *" autoComplete="off" />
          <p className="text-xs text-muted-foreground">@BotFather → /newbot → salin token</p>
          <div className="grid grid-cols-2 gap-2">
            <SellerInput value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nama Bot" />
            <SellerInput value={f.admin} onChange={(e) => setF({ ...f, admin: e.target.value.replace(/[^A-Za-z0-9_@]/g, "") })} placeholder="Username Admin" />
          </div>
          <SellerInput inputMode="numeric" value={f.wa} onChange={(e) => setF({ ...f, wa: e.target.value.replace(/\D/g, "") })} placeholder="Nomor WhatsApp Admin (62xxx)" />
          <p className="text-xs text-muted-foreground">Gunakan kode negara 62, bukan diawali 0</p>
        </div>
      </SellerSheet>
      <PageTour id="seller-bot" steps={tour} panel />
    </>
  );
}
