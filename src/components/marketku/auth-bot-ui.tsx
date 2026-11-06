import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { connectAuthBot, deleteAuthBot, getAuthBotAdmin, setAuthBotActive } from "@/lib/auth-bot.functions";

const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan");

/** Admin Console: install the "Auth Marketku" bot that sends Seller Center login codes. */
export function AuthBotAdminCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAuthBotAdmin);
  const connectFn = useServerFn(connectAuthBot);
  const activeFn = useServerFn(setAuthBotActive);
  const delFn = useServerFn(deleteAuthBot);
  const q = useQuery({ queryKey: ["auth_bot_admin"], queryFn: () => getFn() });
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (k: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(k);
    try { await fn(); if (ok) toast.success(ok); await qc.invalidateQueries({ queryKey: ["auth_bot_admin"] }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const bot = q.data?.bot;
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary to-primary-glow p-4 text-primary-foreground">
        <p className="text-[10px] font-bold tracking-[0.2em] opacity-80">TELEGRAM · LOGIN</p>
        <p className="text-lg font-extrabold">Auth Marketku</p>
        <p className="text-xs opacity-90">Kirim kode login Seller Center + link Login Otomatis, dan pemberitahuan “Login Berhasil” (IP, device, browser, waktu).</p>
      </div>
      {q.isLoading ? <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : bot ? (
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{bot.name}</p>
              <a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">@{bot.username}</a>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${bot.is_active && bot.webhook_ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {bot.is_active ? (bot.webhook_ok ? "Aktif" : "Webhook gagal") : "Nonaktif"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Pengguna /start: <b className="text-foreground">{q.data?.users ?? 0}</b> · Kode dikirim: <b className="text-foreground">{q.data?.logins ?? 0}</b></p>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!!busy} onClick={() => void run("a", () => activeFn({ data: { active: !bot.is_active } }), bot.is_active ? "Bot dinonaktifkan" : "Bot diaktifkan")} className="rounded-xl border px-3 py-2.5 text-xs font-bold active:scale-95">
              {busy === "a" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : bot.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
            <button disabled={!!busy} onClick={() => void run("h", () => activeFn({ data: { active: true } }), "Webhook diperbarui")} className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold active:scale-95">
              {busy === "h" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> Perbarui webhook</>}
            </button>
          </div>
          <button disabled={!!busy} onClick={() => { if (confirm("Hapus bot Auth Marketku? Login via Telegram berhenti.")) void run("d", () => delFn(), "Bot dihapus"); }} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2.5 text-xs font-bold text-destructive active:scale-95">
            <Trash2 className="h-3.5 w-3.5" /> Hapus bot
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 p-4">
          <p className="text-sm font-bold">Pasang bot Auth Marketku</p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Di @BotFather kirim /newbot, beri nama "Auth Marketku".</li>
            <li>Tempel token di bawah (harus bot baru, bukan bot toko/admin/Seller Center).</li>
          </ol>
          <div className="relative">
            <input value={token} onChange={(e) => setToken(e.target.value)} type={show ? "text" : "password"} placeholder="123456789:AA..." autoComplete="off" aria-label="Token bot Auth Marketku"
              className="h-11 w-full rounded-xl border bg-background px-3 pr-10 text-sm outline-none focus:border-primary" />
            <button type="button" aria-label={show ? "Sembunyikan token" : "Tampilkan token"} onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button disabled={!token.trim() || !!busy}
            onClick={() => void run("c", async () => { const r = await connectFn({ data: { token } }); setToken(""); if (!r.webhook) toast.error(`Bot tersimpan, webhook gagal: ${r.message ?? ""}`); }, "Bot Auth Marketku terpasang")}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-95">
            {busy === "c" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pasang bot Auth Marketku"}
          </button>
        </div>
      )}
    </section>
  );
}
