import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot, Plus, RefreshCw, Search, Link2, Power, Pencil, LayoutGrid, ShieldCheck, Trash2, Package, Users, Gift, Globe, DollarSign,
  Settings, Smartphone, Check, X, RotateCcw, Info, Save, Loader2, Bell, type LucideIcon,
} from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useMyProducts } from "@/lib/products";
import { SellerCard, SellerInput, SellerSheet } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { dbError, fmtDate } from "@/lib/market";
import {
  BOT_ACTIONS, BOT_ACTION_KEYS, BUYER_MODES, DEFAULT_GATE, MAX_BOTS, MAX_PER_ROW, MAX_ROWS, cleanKeyboard, isAdminUsername, isAdminWa,
  isBotToken, isChatRef, type BotAction, type ForceJoin,
} from "@/lib/telegram";
import { connectBot, createOwnerLink, deleteBot, refreshBotWebhook, setBotActive, testBotJoin, unlinkOwner } from "@/lib/telegram.functions";

export const Route = createFileRoute("/seller/bot")({
  head: () => pageMeta("Bot Telegram — Seller Center Marketku", "Hubungkan dan kelola bot Telegram untuk jualan otomatis."),
  component: BotPage,
});

const tour = [
  { title: "Hubungkan bot", desc: "Klik untuk menghubungkan bot Telegram baru ke tokomu.", target: "b-add" },
  { title: "Cari bot", desc: "Temukan bot dengan cepat saat punya banyak.", target: "b-search" },
  { title: "Daftar bot", desc: "Bot terhubung tampil di sini dengan statistik dan tombol kelola.", target: "b-list" },
  { title: "Selesai", desc: "Buat bot lewat @BotFather, lalu hubungkan tokennya di sini." },
];

const COLS = "id, owner_id, tg_bot_id, username, name, admin_username, admin_wa, is_active, webhook_ok, webhook_at, buyer_mode, keyboard, force_join, crypto_enabled, created_at, owner_tg_id, owner_tg_name, owner_linked_at";
type BotRow = {
  id: string; owner_id: string; tg_bot_id: number; username: string; name: string; admin_username: string | null; admin_wa: string | null;
  is_active: boolean; webhook_ok: boolean; webhook_at: string | null; buyer_mode: number; keyboard: unknown; force_join: unknown;
  crypto_enabled: boolean; created_at: string; owner_tg_id: number | null; owner_tg_name: string | null; owner_linked_at: string | null;
};
const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Terjadi kesalahan, coba lagi");

function SheetTitle({ icon: I, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-warning/15 text-warning"><I className="h-4 w-4" /></span>
      <span className="font-serif">{title}<span className="block font-sans text-xs font-normal text-muted-foreground">{sub}</span></span>
    </span>
  );
}
const GoldBtn = ({ busy, onClick, children, disabled }: { busy?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) => (
  <button disabled={busy || disabled} onClick={onClick} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-warning/70 to-warning py-3 text-sm font-semibold text-background transition active:scale-95 disabled:opacity-60">
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{children}
  </button>
);
const CancelBtn = ({ onClick, label = "Batal" }: { onClick: () => void; label?: string }) => (
  <button onClick={onClick} className="flex-1 rounded-xl border bg-background/60 py-3 text-sm font-semibold">{label}</button>
);
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full border transition ${on ? "border-primary bg-primary" : "bg-background"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${on ? "left-6 bg-primary-foreground" : "left-1"}`} />
    </button>
  );
}

function BotPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const bots = useQuery({
    queryKey: ["telegram_bots", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("telegram_bots").select(COLS).eq("owner_id", user!.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as BotRow[];
    },
  });
  const ids = (bots.data ?? []).map((b) => b.id);
  const users = useQuery({
    queryKey: ["telegram_bot_users", ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("telegram_bot_users").select("bot_id, referred_by").in("bot_id", ids)).data ?? [],
  });
  const products = useMyProducts(user?.id);
  const activeProducts = (products.data ?? []).filter((p) => p.status === "active").length;
  const [q, setQ] = useState("");
  const [connect, setConnect] = useState(false);
  const [edit, setEdit] = useState<BotRow | null>(null);
  const [menu, setMenu] = useState<BotRow | null>(null);
  const [join, setJoin] = useState<BotRow | null>(null);
  const [del, setDel] = useState<BotRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["telegram_bots", user?.id] });

  const activeFn = useServerFn(setBotActive);
  const hookFn = useServerFn(refreshBotWebhook);
  const delFn = useServerFn(deleteBot);
  const linkFn = useServerFn(createOwnerLink);
  const unlinkFn = useServerFn(unlinkOwner);
  const openLink = async (b: BotRow) => {
    setBusy(`l${b.id}`);
    try {
      const r = await linkFn({ data: { id: b.id } });
      if (!window.open(r.url, "_blank", "noopener")) window.location.href = r.url;
      toast.success("Tekan Start di bot, lalu kembali ke sini dan muat ulang");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await refresh(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const list = (bots.data ?? []).filter((b) => !q.trim() || `${b.name} ${b.username}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <div className="flex items-start gap-3">
        <Bot className="mt-1 h-5 w-5 text-primary" />
        <div><h2 className="text-lg font-bold">Bot Telegram</h2><p className="text-xs text-muted-foreground">Kelola bot store Anda • {bots.data?.length ?? 0}/{MAX_BOTS} bot</p></div>
      </div>
      <div className="flex gap-2">
        <button aria-label="Muat ulang" onClick={() => { void refresh(); void users.refetch(); }} className="grid h-11 w-11 place-items-center rounded-xl border bg-card"><RefreshCw className={`h-4 w-4 ${bots.isFetching ? "animate-spin" : ""}`} /></button>
        <button data-tour="b-add" disabled={(bots.data?.length ?? 0) >= MAX_BOTS} onClick={() => setConnect(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-50"><Plus className="h-4 w-4" /> Hubungkan Bot</button>
      </div>
      <label data-tour="b-search" className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bot..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>

      <div data-tour="b-list" className="space-y-3">
        {bots.isLoading ? <div className="h-64 animate-pulse rounded-2xl border bg-card" /> : list.length === 0 ? (
          <SellerCard className="flex flex-col items-center px-6 py-14 text-center">
            <Bot className="h-8 w-8 text-primary" />
            <p className="mt-4 font-bold">{bots.data?.length ? "Bot tidak ditemukan" : "Belum ada bot"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{bots.data?.length ? "Coba kata kunci lain." : "Hubungkan bot Telegram Anda untuk mulai berjualan secara mandiri."}</p>
            {!bots.data?.length && <button onClick={() => setConnect(true)} className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95"><Plus className="h-4 w-4" /> Hubungkan Bot Pertama</button>}
          </SellerCard>
        ) : list.map((b) => {
          const us = (users.data ?? []).filter((u) => u.bot_id === b.id);
          const fj = (b.force_join ?? {}) as ForceJoin;
          const Stat = ({ icon: I, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) => (
            <div className="flex gap-2"><I className={`mt-0.5 h-3.5 w-3.5 ${tone}`} /><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-bold">{value}</p></div></div>
          );
          const Line = ({ icon: I, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) => (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><I className="h-3.5 w-3.5" /> {label}: {children}</p>
          );
          return (
            <SellerCard key={b.id} className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${b.is_active ? "text-primary" : "bg-destructive/10 text-destructive"}`}><Bot className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><b className="block truncate">{b.name}</b><span className="text-xs text-muted-foreground">@{b.username}</span></div>
                <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${b.is_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />{b.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={Package} label="Produk" value={String(activeProducts)} tone="text-primary" />
                <Stat icon={Users} label="Pelanggan" value={String(us.length)} tone="text-primary" />
                <Stat icon={Gift} label="Dari referral" value={String(us.filter((u) => u.referred_by != null).length)} tone="text-warning" />
                <Stat icon={Smartphone} label="Buyer UI" value={`Mode ${b.buyer_mode}`} tone="text-primary" />
              </div>
              <div className="space-y-1.5">
                <Line icon={Globe} label="Webhook"><span className={b.webhook_ok && b.is_active ? "text-success" : "text-destructive"}>{b.is_active ? (b.webhook_ok ? "Aktif" : "Gagal") : "Mati"}</span>{b.webhook_at ? ` • ${fmtDate(b.webhook_at)}` : ""}</Line>
                <Line icon={ShieldCheck} label="Wajib join"><b className="text-foreground">{fj.enabled ? `Aktif (${fj.title || fj.chat})` : "Nonaktif"}</b></Line>
                <Line icon={DollarSign} label="Crypto Mini App"><span className="rounded-md border px-1.5 py-0.5">{b.crypto_enabled ? "Aktif" : "Nonaktif"}</span></Line>
              </div>
              <div className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${b.owner_tg_id ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}><Bell className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Notifikasi pesanan</p>
                  <p className="truncate text-xs text-muted-foreground">{b.owner_tg_id ? `Terhubung ke ${b.owner_tg_name || "Telegram kamu"} • menu seller aktif di bot` : "Hubungkan Telegram kamu untuk notif pesanan & menu seller"}</p>
                </div>
                {b.owner_tg_id ? (
                  <button disabled={!!busy} onClick={() => void run(`u${b.id}`, () => unlinkFn({ data: { id: b.id } }), "Telegram diputus dari bot")} className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive transition active:scale-95">
                    {busy === `u${b.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Putuskan"}
                  </button>
                ) : (
                  <button disabled={!!busy || !b.is_active} onClick={() => void openLink(b)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-50">
                    {busy === `l${b.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}Hubungkan
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 border-t pt-3">
                <button disabled={!!busy} onClick={() => void run(`a${b.id}`, () => activeFn({ data: { id: b.id, active: !b.is_active } }), b.is_active ? `Bot @${b.username} berhasil dinonaktifkan` : `Bot @${b.username} berhasil diaktifkan`)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition active:scale-95 ${b.is_active ? "border-destructive/40 text-destructive" : "border-success/40 text-success"}`}>
                  {busy === `a${b.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}{b.is_active ? "Matikan" : "Hidupkan"}
                </button>
                {([
                  ["Refresh webhook", RefreshCw, () => void run(`h${b.id}`, () => hookFn({ data: { id: b.id } }), `Webhook @${b.username} berhasil di-refresh`), `h${b.id}`],
                  ["Edit bot", Pencil, () => setEdit(b), ""],
                  ["Menu selector", LayoutGrid, () => setMenu(b), ""],
                  ["Wajib join", ShieldCheck, () => setJoin(b), ""],
                ] as const).map(([label, I, fn, key]) => (
                  <button key={label} aria-label={label} disabled={!!busy} onClick={fn} className="grid h-9 w-9 place-items-center rounded-lg border transition active:scale-90">
                    {key && busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <I className="h-4 w-4" />}
                  </button>
                ))}
                <button aria-label="Hapus bot" onClick={() => setDel(b)} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border transition active:scale-90"><Trash2 className="h-4 w-4" /></button>
              </div>
            </SellerCard>
          );
        })}
      </div>

      <ConnectSheet open={connect} onOpenChange={setConnect} onDone={() => void refresh()} />
      {edit && <EditSheet bot={edit} onClose={() => setEdit(null)} onDone={() => void refresh()} />}
      {menu && <MenuSheet bot={menu} onClose={() => setMenu(null)} onDone={() => void refresh()} />}
      {join && <JoinSheet bot={join} onClose={() => setJoin(null)} onDone={() => void refresh()} />}
      <SellerSheet open={!!del} onOpenChange={(v) => !v && setDel(null)} title={<SheetTitle icon={Trash2} title="Hapus Bot?" sub="Tindakan ini tidak bisa dibatalkan" />}
        footer={<>
          <CancelBtn onClick={() => setDel(null)} />
          <button disabled={!!busy} onClick={() => { const b = del!; void run(`d${b.id}`, () => delFn({ data: { id: b.id } }), `Bot @${b.username} berhasil dihapus`).then(() => setDel(null)); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground transition active:scale-95 disabled:opacity-60">
            {busy?.startsWith("d") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Hapus
          </button>
        </>}>
        <p className="text-center text-sm text-muted-foreground">Bot <b className="text-foreground">@{del?.username}</b> akan dihapus permanen beserta pengaturan dan data pelanggannya. Produk toko tidak ikut terhapus.</p>
      </SellerSheet>
      <PageTour id="seller-bot" steps={tour} panel />
    </>
  );
}

function ConnectSheet({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const fn = useServerFn(connectBot);
  const [f, setF] = useState({ token: "", name: "", admin: "", wa: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!isBotToken(f.token)) { toast.error("Token bot tidak valid. Salin token dari @BotFather"); return; }
    if (f.admin && !isAdminUsername(f.admin.replace(/^@/, ""))) { toast.error("Username admin tidak valid"); return; }
    if (f.wa && !isAdminWa(f.wa)) { toast.error("Nomor WhatsApp admin harus diawali 62"); return; }
    setBusy(true);
    try {
      const r = await fn({ data: f });
      if (r.webhook) toast.success("Bot berhasil terhubung!");
      else toast.warning(`Bot @${r.username} tersimpan, tapi webhook gagal dipasang. Tekan tombol refresh webhook.`);
      setF({ token: "", name: "", admin: "", wa: "" });
      onOpenChange(false); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <SellerSheet open={open} onOpenChange={onOpenChange} title={<SheetTitle icon={Link2} title="Hubungkan Bot Baru" sub="Dapatkan token dari @BotFather di Telegram" />}
      footer={<><CancelBtn onClick={() => onOpenChange(false)} /><GoldBtn busy={busy} onClick={() => void submit()}>{busy ? "Menghubungkan..." : <><Link2 className="h-4 w-4" /> Hubungkan</>}</GoldBtn></>}>
      <div className="space-y-3">
        <SellerInput type="password" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value.trim() })} placeholder="Bot Token *" autoComplete="off" />
        <p className="text-xs text-muted-foreground">@BotFather → /newbot → salin token</p>
        <div className="grid grid-cols-2 gap-2">
          <SellerInput value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nama Bot" />
          <SellerInput value={f.admin} onChange={(e) => setF({ ...f, admin: e.target.value.replace(/[^A-Za-z0-9_@]/g, "") })} placeholder="Username Admin" />
        </div>
        <SellerInput inputMode="numeric" value={f.wa} onChange={(e) => setF({ ...f, wa: e.target.value.replace(/\D/g, "").slice(0, 15) })} placeholder="Nomor WhatsApp Admin (62xxx)" />
        <p className="text-xs text-muted-foreground">Gunakan kode negara 62, bukan diawali 0</p>
      </div>
    </SellerSheet>
  );
}

function EditSheet({ bot, onClose, onDone }: { bot: BotRow; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: bot.name, admin: bot.admin_username ?? "", wa: bot.admin_wa ?? "", crypto: bot.crypto_enabled });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.name.trim()) { toast.error("Nama bot wajib diisi"); return; }
    const admin = f.admin.replace(/^@/, "");
    if (admin && !isAdminUsername(admin)) { toast.error("Username admin tidak valid"); return; }
    if (f.wa && !isAdminWa(f.wa)) { toast.error("Nomor WhatsApp admin harus diawali 62"); return; }
    setBusy(true);
    const { error } = await supabase.from("telegram_bots").update({ name: f.name.trim().slice(0, 60), admin_username: admin || null, admin_wa: f.wa || null, crypto_enabled: f.crypto }).eq("id", bot.id);
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success(`Bot @${bot.username} diperbarui`); onDone(); onClose();
  };
  return (
    <SellerSheet open onOpenChange={(v) => !v && onClose()} title={<SheetTitle icon={Settings} title="Edit Bot" sub={`@${bot.username}`} />}
      footer={<><CancelBtn onClick={onClose} /><GoldBtn busy={busy} onClick={() => void save()}><Check className="h-4 w-4" /> Simpan</GoldBtn></>}>
      <div className="space-y-3">
        <label className="block text-xs text-primary">Nama Bot<SellerInput value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-primary">Username Admin<SellerInput value={f.admin} onChange={(e) => setF({ ...f, admin: e.target.value.replace(/[^A-Za-z0-9_@]/g, "") })} className="mt-1" /></label>
          <label className="block text-xs text-muted-foreground">WhatsApp Admin<SellerInput inputMode="numeric" value={f.wa} placeholder="62xxx" onChange={(e) => setF({ ...f, wa: e.target.value.replace(/\D/g, "").slice(0, 15) })} className="mt-1" /></label>
        </div>
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <div className="flex-1"><b className="text-sm">Terima crypto di Mini App</b><p className="text-xs text-muted-foreground">Izinkan buyer membayar checkout Mini App dengan saldo crypto. Berlaku setelah Mini App Marketku tersedia.</p></div>
          <Toggle on={f.crypto} onChange={(v) => setF({ ...f, crypto: v })} label="Terima crypto" />
        </div>
      </div>
    </SellerSheet>
  );
}

function MenuSheet({ bot, onClose, onDone }: { bot: BotRow; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState(bot.buyer_mode);
  const [rows, setRows] = useState<BotAction[][]>(() => cleanKeyboard(bot.keyboard));
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const used = useMemo(() => new Set(rows.flat()), [rows]);
  const addRow = () => { if (rows.length >= MAX_ROWS) { toast.error(`Maksimal ${MAX_ROWS} baris`); return; } setRows([...rows, []]); setSel(rows.length); };
  const addAction = (a: BotAction) => {
    if (!rows.length) { setRows([[a]]); setSel(0); return; }
    const i = Math.min(sel, rows.length - 1);
    if (rows[i]!.length >= MAX_PER_ROW) { toast.error(`Maksimal ${MAX_PER_ROW} tombol per baris`); return; }
    setRows(rows.map((r, n) => (n === i ? [...r, a] : r)));
  };
  const removeAt = (ri: number, ci: number) => setRows(rows.map((r, n) => (n === ri ? r.filter((_, k) => k !== ci) : r)));
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("telegram_bots").update({ buyer_mode: mode, keyboard: cleanKeyboard(rows) }).eq("id", bot.id);
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Menu bot disimpan"); onDone(); onClose();
  };
  const buttons = rows.flat().length;
  return (
    <SellerSheet open onOpenChange={(v) => !v && onClose()} title={<SheetTitle icon={LayoutGrid} title="Menu Selector" sub={`@${bot.username} • Keyboard bot`} />}
      footer={<>
        <button onClick={() => { setRows([]); setMode(1); }} className="flex items-center gap-1.5 rounded-xl border px-3 py-3 text-sm"><RotateCcw className="h-4 w-4" /> Reset</button>
        <div className="flex flex-1 gap-2"><CancelBtn onClick={onClose} /><GoldBtn busy={busy} onClick={() => void save()}><Save className="h-4 w-4" /> Simpan</GoldBtn></div>
      </>}>
      <div className="space-y-4">
        <p className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary"><Info className="h-3.5 w-3.5" /> Kategori produk otomatis. Ini untuk tombol tetap.</p>
        <div className="rounded-xl border p-3">
          <b className="text-sm">Mode Buyer</b>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border p-1">
            {BUYER_MODES.map((m) => (
              <button key={m.value} onClick={() => setMode(m.value)} className={`rounded-lg py-2.5 text-sm transition ${mode === m.value ? "border border-primary bg-primary/15 font-semibold" : "text-muted-foreground"}`}>{m.label}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{BUYER_MODES.find((m) => m.value === mode)?.desc}</p>
        </div>
        <div className="flex gap-3 rounded-xl border p-3">
          <Smartphone className="mt-1 h-4 w-4 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-xs"><b>Preview</b> <span className="text-muted-foreground">• {rows.filter((r) => r.length).length} baris • {buttons} tombol</span></p>
            <div className="mt-2 space-y-1">
              {buttons ? rows.filter((r) => r.length).map((r, i) => (
                <div key={i} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${r.length}, minmax(0, 1fr))` }}>
                  {r.map((a, k) => <span key={k} className="truncate rounded-md bg-muted px-2 py-1.5 text-center text-[11px]">{BOT_ACTIONS[a]}</span>)}
                </div>
              )) : <span className="inline-block rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Belum ada tombol — bot memakai menu bawaan</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <b className="text-sm">Layout Keyboard</b>
          <button onClick={addRow} className="flex items-center gap-1 rounded-xl bg-warning/15 px-3 py-2 text-xs font-semibold text-warning"><Plus className="h-3.5 w-3.5" /> Tambah Baris</button>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"><LayoutGrid className="h-6 w-6" /><p className="mt-2">Belum ada baris. Klik "Tambah Baris".</p></div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} onClick={() => setSel(i)} className={`rounded-xl border p-2 ${sel === i ? "border-warning" : ""}`}>
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Baris {i + 1}{sel === i ? " • dipilih" : ""}</span>
                  <button aria-label={`Hapus baris ${i + 1}`} onClick={(e) => { e.stopPropagation(); setRows(rows.filter((_, n) => n !== i)); setSel(0); }}><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.length ? r.map((a, k) => (
                    <button key={k} onClick={(e) => { e.stopPropagation(); removeAt(i, k); }} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">{BOT_ACTIONS[a]} <X className="h-3 w-3" /></button>
                  )) : <span className="text-xs text-muted-foreground">Pilih aksi di bawah untuk mengisi baris ini.</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Aksi tersedia</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BOT_ACTION_KEYS.map((a) => (
              <button key={a} disabled={used.has(a)} onClick={() => addAction(a)} className="rounded-md border px-2 py-1 text-[11px] transition active:scale-95 disabled:opacity-40">{BOT_ACTIONS[a]}</button>
            ))}
          </div>
        </div>
      </div>
    </SellerSheet>
  );
}

function JoinSheet({ bot, onClose, onDone }: { bot: BotRow; onClose: () => void; onDone: () => void }) {
  const init = (bot.force_join ?? {}) as ForceJoin;
  const [f, setF] = useState({ enabled: !!init.enabled, chat: init.chat ?? "", invite: init.invite ?? "", title: init.title ?? "", message: init.message ?? "" });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const test = useServerFn(testBotJoin);
  const doTest = async () => {
    setTesting(true);
    try {
      const r = await test({ data: { id: bot.id, chat: f.chat.trim() } });
      if (r.ok) { toast.success(`Terhubung ke ${r.title}`); if (!f.title) setF((x) => ({ ...x, title: r.title ?? "" })); }
      else toast.error(r.message ?? "Koneksi gagal");
    } catch (e) { toast.error(errMsg(e)); } finally { setTesting(false); }
  };
  const save = async () => {
    const chat = f.chat.trim();
    if (f.enabled && !isChatRef(chat)) { toast.error("Isi @username channel atau ID -100xxxxxxxxxx"); return; }
    if (f.invite && !/^https:\/\/t\.me\/\S+$/.test(f.invite.trim())) { toast.error("Link undangan harus diawali https://t.me/"); return; }
    if (f.enabled && /^-100/.test(chat) && !f.invite.trim()) { toast.error("Channel privat wajib punya link undangan"); return; }
    setBusy(true);
    const { error } = await supabase.from("telegram_bots").update({
      force_join: { enabled: f.enabled, chat, invite: f.invite.trim(), title: f.title.trim().slice(0, 60), message: f.message.trim().slice(0, 500) },
    }).eq("id", bot.id);
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success(f.enabled ? "Wajib join diaktifkan" : "Pengaturan wajib join disimpan"); onDone(); onClose();
  };
  return (
    <SellerSheet open onOpenChange={(v) => !v && onClose()} title={<SheetTitle icon={ShieldCheck} title="Wajib Join Channel/Grup" sub={`@${bot.username} • Force subscribe`} />}
      footer={<><CancelBtn onClick={onClose} /><GoldBtn busy={busy} onClick={() => void save()}><Save className="h-4 w-4" /> Simpan</GoldBtn></>}>
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <div className="flex-1"><b className="text-sm">Aktifkan wajib join</b><p className="text-xs text-muted-foreground">Buyer harus join channel/grup sebelum dapat memesan.</p></div>
          <Toggle on={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Aktifkan wajib join" />
        </div>
        <SellerInput value={f.chat} onChange={(e) => setF({ ...f, chat: e.target.value.trim().slice(0, 40) })} placeholder="Chat ID / Username" />
        <p className="text-xs text-muted-foreground">Channel publik: @namachannel. Channel privat: -100xxxxxxxxxx. Bot HARUS dijadikan admin di channel/grup.</p>
        <button disabled={testing || !f.chat.trim()} onClick={() => void doTest()} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs disabled:opacity-50">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Test koneksi
        </button>
        <SellerInput value={f.invite} onChange={(e) => setF({ ...f, invite: e.target.value.trim().slice(0, 200) })} placeholder="Link undangan" />
        <p className="text-xs text-muted-foreground">Wajib untuk channel privat (tombol Join). Channel publik boleh dikosongkan.</p>
        <SellerInput value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Judul tampilan" />
        <textarea value={f.message} maxLength={500} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Pesan gate" rows={3} className="w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" />
        <p className="text-xs text-muted-foreground">Placeholder: {"{nama}"}, {"{username}"}, {"{channel}"}, {"{bot}"}. Kosongkan untuk teks default: "{DEFAULT_GATE}"</p>
      </div>
    </SellerSheet>
  );
}
