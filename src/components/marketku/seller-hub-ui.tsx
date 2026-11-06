import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, Eye, EyeOff, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { connectHubBot, createHubLink, deleteHubBot, getHubBotAdmin, getMyHubLink, setHubBotActive, unlinkMyHub } from "@/lib/seller-hub.functions";

const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan");
const fmt = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Admin Console: install the platform "Marketku Seller Center" bot used by every seller. */
export function HubBotAdminCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getHubBotAdmin);
  const connectFn = useServerFn(connectHubBot);
  const activeFn = useServerFn(setHubBotActive);
  const delFn = useServerFn(deleteHubBot);
  const q = useQuery({ queryKey: ["hub_bot_admin"], queryFn: () => getFn() });
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (k: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(k);
    try { await fn(); if (ok) toast.success(ok); await qc.invalidateQueries({ queryKey: ["hub_bot_admin"] }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const bot = q.data?.bot;
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary to-primary-glow p-4 text-primary-foreground">
        <p className="text-[10px] font-bold tracking-[0.2em] opacity-80">TELEGRAM · SELLER</p>
        <p className="text-lg font-extrabold">Marketku Seller Center</p>
        <p className="text-xs opacity-90">Bot untuk semua seller: dashboard toko + notifikasi bergambar (pesanan baru, dibayar, dibatalkan, habis waktu, chat pembeli, deposit).</p>
      </div>
      {q.isLoading ? <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : bot ? (
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Send className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{bot.name}</p>
              <a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">@{bot.username}</a>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${bot.is_active && bot.webhook_ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {bot.is_active ? (bot.webhook_ok ? "Aktif" : "Webhook gagal") : "Nonaktif"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Seller terhubung: <b className="text-foreground">{q.data?.sellers ?? 0}</b> · Notifikasi terkirim: <b className="text-foreground">{q.data?.sent ?? 0}</b></p>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!!busy} onClick={() => void run("a", () => activeFn({ data: { active: !bot.is_active } }), bot.is_active ? "Bot dinonaktifkan" : "Bot diaktifkan")} className="rounded-xl border px-3 py-2.5 text-xs font-bold active:scale-95">
              {busy === "a" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : bot.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
            <button disabled={!!busy} onClick={() => void run("h", () => activeFn({ data: { active: true } }), "Webhook diperbarui")} className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold active:scale-95">
              {busy === "h" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> Perbarui webhook</>}
            </button>
          </div>
          <button disabled={!!busy} onClick={() => { if (confirm("Hapus bot Seller Center? Semua seller terputus.")) void run("d", () => delFn(), "Bot dihapus"); }} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2.5 text-xs font-bold text-destructive active:scale-95">
            <Trash2 className="h-3.5 w-3.5" /> Hapus bot
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 p-4">
          <p className="text-sm font-bold">Pasang bot Seller Center</p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Di @BotFather kirim /newbot, beri nama "Marketku Seller Center".</li>
            <li>Tempel token dari BotFather di bawah (harus bot baru, bukan bot toko/admin).</li>
          </ol>
          <div className="relative">
            <input value={token} onChange={(e) => setToken(e.target.value)} type={show ? "text" : "password"} placeholder="123456789:AA..." autoComplete="off" aria-label="Token bot Seller Center"
              className="h-11 w-full rounded-xl border bg-background px-3 pr-10 text-sm outline-none focus:border-primary" />
            <button type="button" aria-label={show ? "Sembunyikan token" : "Tampilkan token"} onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button disabled={!token.trim() || !!busy}
            onClick={() => void run("c", async () => { const r = await connectFn({ data: { token } }); setToken(""); if (!r.webhook) toast.error(`Bot tersimpan, webhook gagal: ${r.message ?? ""}`); }, "Bot Seller Center terpasang")}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-95">
            {busy === "c" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pasang bot Seller Center"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Seller Center: link the seller's own Telegram to the platform Marketku Seller Center bot. */
export function HubLinkCard() {
  const getFn = useServerFn(getMyHubLink);
  const linkFn = useServerFn(createHubLink);
  const unlinkFn = useServerFn(unlinkMyHub);
  const q = useQuery({ queryKey: ["hub_link"], queryFn: () => getFn(), refetchInterval: 8000 });
  const [busy, setBusy] = useState(false);
  const d = q.data;
  if (q.isLoading || !d?.bot) return null;
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center gap-3 bg-gradient-to-br from-primary to-primary-glow p-4 text-primary-foreground">
        <Bell className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-extrabold">Marketku Seller Center</p>
          <p className="text-[11px] opacity-90">Dashboard toko & notifikasi bergambar di Telegram: pesanan, pembayaran, batal, habis waktu, chat pembeli, deposit.</p>
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        {d.link ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5">
            <Check className="h-4 w-4 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.link.tg_name || "Telegram"} terhubung</p>
              <p className="text-[11px] text-muted-foreground">Sejak {fmt(d.link.linked_at)} · @{d.bot.username}</p>
            </div>
            <button disabled={busy} onClick={async () => { setBusy(true); try { await unlinkFn(); toast.success("Telegram diputus"); await q.refetch(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold text-destructive">Putus</button>
          </div>
        ) : <p className="text-xs text-muted-foreground">Belum terhubung. Tekan tombol di bawah lalu tekan <b>Start</b> di Telegram.</p>}
        <button disabled={busy} onClick={async () => { setBusy(true); try { const r = await linkFn(); window.open(r.url, "_blank", "noopener"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-95">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> {d.link ? "Hubungkan ulang" : "Hubungkan Marketku Seller Center"}</>}
        </button>
      </div>
    </section>
  );
}
