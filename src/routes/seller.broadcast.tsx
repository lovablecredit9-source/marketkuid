import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Upload, Eye, History, X, Send, FlaskConical, Bot, Users, Loader2 } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { SellerCard } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BROADCAST_MAX } from "@/lib/broadcast";
import { broadcastPreview, broadcastTest, sendBroadcast } from "@/lib/broadcast.functions";

export const Route = createFileRoute("/seller/broadcast")({
  head: () => pageMeta("Broadcast — Seller Center Marketku", "Kirim pesan massal ke pelanggan bot Telegram tokomu."),
  component: Broadcast,
});

const tour = [
  { title: "Tulis pesan", desc: "Tulis pesan broadcast untuk pelanggan botmu. Mendukung HTML dasar.", target: "bc-msg" },
  { title: "Gambar opsional", desc: "Tambahkan gambar agar pesan lebih menarik.", target: "bc-img" },
  { title: "Pratinjau dulu", desc: "Buka pratinjau untuk cek target dan tes ke akunmu sendiri.", target: "bc-preview" },
  { title: "Selesai", desc: "Setelah tes lolos, broadcast dikirim lewat antrean agar prosesnya cepat." },
];

type Preview = { recipients: number; selfReady: boolean; selfName: string | null; active: boolean };
const fmt = (d: string) => new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Broadcast() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const previewFn = useServerFn(broadcastPreview);
  const testFn = useServerFn(broadcastTest);
  const sendFn = useServerFn(sendBroadcast);
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [botId, setBotId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tested, setTested] = useState(false);
  const [busy, setBusy] = useState<"" | "preview" | "test" | "send">("");
  useEffect(() => () => { if (img) URL.revokeObjectURL(img); }, [img]);

  const bots = useQuery({
    queryKey: ["telegram_bots_min", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("telegram_bots").select("id, username, name, is_active").eq("owner_id", user!.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => { if (!botId && bots.data?.length) setBotId(bots.data[0]!.id); }, [bots.data, botId]);

  const history = useQuery({
    queryKey: ["telegram_broadcasts", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("telegram_broadcasts").select("id, message, image_path, recipients, sent, failed, status, created_at, telegram_bots(username)").eq("owner_id", user!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Any edit invalidates the test so the seller re-tests what is actually sent.
  useEffect(() => { setTested(false); }, [msg, imagePath, botId]);

  const pick = (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast.error("Format gambar harus JPG, PNG, atau WebP"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Ukuran gambar maksimal 5 MB"); return; }
    setFile(f); setImagePath(null); setImg(URL.createObjectURL(f));
  };
  const clearImg = () => { setFile(null); setImg(null); setImagePath(null); };

  const ensureImage = async () => {
    if (!file || imagePath) return imagePath;
    const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${user!.id}/broadcast/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
    if (error) throw new Error("Gagal mengunggah gambar");
    setImagePath(path);
    return path;
  };

  const openPreview = async () => {
    if (!msg.trim()) { toast.error("Tulis pesan broadcast dulu"); return; }
    if (!botId) { toast.error("Hubungkan bot Telegram dulu untuk mengirim broadcast"); return; }
    setBusy("preview");
    try { setPreview(await previewFn({ data: { botId } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal membuka pratinjau"); }
    finally { setBusy(""); }
  };
  const runTest = async () => {
    setBusy("test");
    try {
      const path = await ensureImage();
      const r = await testFn({ data: { botId, message: msg, imagePath: path } });
      setTested(true);
      toast.success(`Tes terkirim ke @${r.to}. Cek Telegram kamu`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Tes gagal"); }
    finally { setBusy(""); }
  };
  const runSend = async () => {
    setBusy("send");
    try {
      const path = await ensureImage();
      const r = await sendFn({ data: { botId, message: msg, imagePath: path } });
      toast.success(`Broadcast terkirim ke ${r.sent} dari ${r.recipients} pelanggan`);
      setPreview(null); setMsg(""); clearImg();
      qc.invalidateQueries({ queryKey: ["telegram_broadcasts", user?.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Broadcast gagal"); }
    finally { setBusy(""); }
  };

  const noBot = bots.isSuccess && !bots.data.length;

  return (
    <>
      <SellerCard className="flex gap-3 border-warning/40 bg-warning/10 p-4 text-sm text-foreground/85">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        Sekarang broadcast pakai alur aman: cek pratinjau dulu, tes ke akun Anda sendiri, lalu kirim ke antrean agar proses terasa jauh lebih cepat.
      </SellerCard>
      {noBot ? (
        <SellerCard className="flex items-center gap-3 p-4 text-sm">
          <Bot className="h-5 w-5 shrink-0 text-primary" />
          <span className="flex-1">Belum ada bot terhubung.</span>
          <Link to="/seller/bot" className="font-semibold text-primary">Hubungkan bot</Link>
        </SellerCard>
      ) : (bots.data?.length ?? 0) > 1 ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Kirim lewat bot</span>
          <select value={botId} onChange={(e) => setBotId(e.target.value)} className="w-full rounded-xl border bg-card px-4 py-3 outline-none focus:border-primary">
            {bots.data!.map((b) => <option key={b.id} value={b.id}>@{b.username}{b.is_active ? "" : " (nonaktif)"}</option>)}
          </select>
        </label>
      ) : null}
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
            <button aria-label="Hapus gambar" onClick={clearImg} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed bg-card px-6 py-8 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-warning/15 text-warning"><Upload className="h-5 w-5" /></span>
            <span className="mt-3 text-sm font-semibold">Upload Gambar</span>
            <span className="text-xs text-muted-foreground">Klik untuk pilih gambar • Crop &amp; sesuaikan</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
      </div>
      {preview ? (
        <SellerCard className="space-y-3 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold"><Eye className="h-4 w-4" /> Pratinjau</p>
          <div className="flex items-center gap-2 text-foreground/85"><Users className="h-4 w-4 text-primary" /> Estimasi penerima: <b>{preview.recipients}</b> pelanggan</div>
          {!preview.active && <p className="text-warning">Bot sedang nonaktif. Aktifkan di halaman Bot Telegram.</p>}
          <p className="text-xs text-muted-foreground">{preview.selfReady ? `Tes akan dikirim ke @${preview.selfName}.` : "Agar bisa tes, buka bot kamu di Telegram dan tekan /start. Username Telegram di profil harus sama."}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={runTest} disabled={!!busy || !preview.selfReady} className="flex items-center justify-center gap-2 rounded-xl border py-3 font-semibold transition active:scale-95 disabled:opacity-50">
              {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Tes ke saya
            </button>
            <button onClick={runSend} disabled={!!busy || !tested || !preview.recipients || !preview.active} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-50">
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim
            </button>
          </div>
          {!tested && <p className="text-xs text-muted-foreground">Tombol Kirim aktif setelah tes berhasil.</p>}
        </SellerCard>
      ) : (
        <p className="text-xs text-muted-foreground">Estimasi penerima akan dihitung saat membuka pratinjau</p>
      )}
      <button data-tour="bc-preview" onClick={openPreview} disabled={busy === "preview"} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-warning/70 to-warning py-3.5 font-semibold text-background transition active:scale-95">
        {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Buka Pratinjau Dulu
      </button>
      <SellerCard className="p-4">
        <p className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" /> Riwayat Broadcast</p>
        {history.data?.length ? (
          <ul className="mt-3 divide-y">
            {history.data.map((h) => (
              <li key={h.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{fmt(h.created_at)} · @{(h.telegram_bots as { username: string } | null)?.username ?? "bot"}{h.image_path ? " · gambar" : ""}</span>
                  <span className={h.status === "done" ? "text-success" : h.status === "failed" ? "text-destructive" : "text-warning"}>{h.status === "done" ? "Terkirim" : h.status === "failed" ? "Gagal" : "Mengirim"}</span>
                </div>
                <p className="mt-1 line-clamp-2">{h.message.replace(/<[^>]+>/g, "")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{h.sent}/{h.recipients} terkirim{h.failed ? ` · ${h.failed} gagal` : ""}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada broadcast.{noBot && <> <Link to="/seller/bot" className="text-primary">Hubungkan bot</Link> untuk mulai.</>}</p>
        )}
      </SellerCard>
      <PageTour id="seller-broadcast" steps={tour} panel />
    </>
  );
}
