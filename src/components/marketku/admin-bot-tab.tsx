import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, EyeOff, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { connectAdminBot, createAdminBotLink, deleteAdminBot, getAdminBot, setAdminBotActive, unlinkAdminTelegram } from "@/lib/admin-bot.functions";

const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan");
const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Admin Console tab: install the Marketku Center admin bot and link admins' Telegram accounts. */
export function AdminBotTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAdminBot);
  const connectFn = useServerFn(connectAdminBot);
  const activeFn = useServerFn(setAdminBotActive);
  const deleteFn = useServerFn(deleteAdminBot);
  const linkFn = useServerFn(createAdminBotLink);
  const unlinkFn = useServerFn(unlinkAdminTelegram);
  const q = useQuery({ queryKey: ["admin_bot"], queryFn: () => getFn() });
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); await qc.invalidateQueries({ queryKey: ["admin_bot"] }); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(null); }
  };

  if (q.isLoading) return <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (q.error) return <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{errMsg(q.error)}</p>;
  const bot = q.data?.bot;
  const admins = q.data?.admins ?? [];
  const mine = admins.some((a) => a.mine);

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary to-primary-glow p-4 text-primary-foreground">
          <p className="text-[10px] font-bold tracking-[0.2em] opacity-80">TELEGRAM</p>
          <p className="text-lg font-extrabold">Marketku Center</p>
          <p className="text-xs opacity-90">Bot khusus admin: notifikasi deposit, withdraw, bukti bayar, dispute, kategori &amp; toko baru, plus ringkasan cepat.</p>
        </div>
        {bot ? (
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
            <p className="text-xs text-muted-foreground">Notifikasi terkirim: <b className="text-foreground">{q.data?.sent ?? 0}</b></p>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!!busy} onClick={() => void run("active", () => activeFn({ data: { active: !bot.is_active } }), bot.is_active ? "Bot dinonaktifkan" : "Bot diaktifkan")} className="rounded-xl border px-3 py-2.5 text-xs font-bold active:scale-95">
                {busy === "active" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : bot.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button disabled={!!busy} onClick={() => void run("hook", () => activeFn({ data: { active: true } }), "Webhook diperbarui")} className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold active:scale-95">
                {busy === "hook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> Perbarui webhook</>}
              </button>
            </div>
            <button disabled={!!busy} onClick={() => { if (confirm("Hapus bot admin? Semua admin yang terhubung ikut terputus.")) void run("del", () => deleteFn(), "Bot admin dihapus"); }} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2.5 text-xs font-bold text-destructive active:scale-95">
              <Trash2 className="h-3.5 w-3.5" /> Hapus bot
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 p-4">
            <p className="text-sm font-bold">Pasang bot admin</p>
            <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Buka @BotFather di Telegram, kirim /newbot, beri nama (misal Marketku Center).</li>
              <li>Salin token dari BotFather lalu tempel di bawah.</li>
            </ol>
            <div className="relative">
              <input value={token} onChange={(e) => setToken(e.target.value)} type={show ? "text" : "password"} placeholder="123456789:AA..." autoComplete="off"
                className="h-11 w-full rounded-xl border bg-background px-3 pr-10 text-sm outline-none focus:border-primary" />
              <button type="button" aria-label={show ? "Sembunyikan token" : "Tampilkan token"} onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button disabled={!token.trim() || !!busy}
              onClick={() => void run("connect", async () => { const r = await connectFn({ data: { token } }); setToken(""); if (!r.webhook) toast.error(`Bot tersimpan, webhook gagal: ${r.message ?? ""}`); }, "Bot admin terpasang")}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-95">
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pasang bot"}
            </button>
          </div>
        )}
      </section>

      {bot && (
        <section className="space-y-2.5 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Admin terhubung</p>
            <span className="text-xs text-muted-foreground">{admins.length} akun</span>
          </div>
          {admins.length === 0 && <p className="text-xs text-muted-foreground">Belum ada. Hubungkan Telegram kamu agar notifikasi masuk.</p>}
          {admins.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <Check className="h-4 w-4 text-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.name || "Telegram"} {a.mine && <span className="text-[10px] font-bold text-primary">(kamu)</span>}</p>
                <p className="text-[11px] text-muted-foreground">Terhubung {fmtDate(a.linked_at)}</p>
              </div>
              <button disabled={!!busy} onClick={() => void run(`un${a.id}`, () => unlinkFn({ data: { id: a.id } }), "Telegram diputus")} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold text-destructive">Putus</button>
            </div>
          ))}
          <button disabled={!!busy} onClick={() => void run("link", async () => { const r = await linkFn(); window.open(r.url, "_blank", "noopener"); })}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-95">
            {busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> {mine ? "Hubungkan Telegram lain" : "Hubungkan Telegram saya"}</>}
          </button>
          <p className="text-[11px] text-muted-foreground">Link berlaku 15 menit. Buka di Telegram lalu tekan Start.</p>
        </section>
      )}
    </div>
  );
}
