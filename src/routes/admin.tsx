import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban, Check, ChevronRight, Copy, Eye, EyeOff, History, ImagePlus, LayoutDashboard, Loader2, LogOut, MessageCircle, Minus, Package,
  Plus, QrCode, Receipt, RefreshCw, Search, ShieldCheck, ShieldOff, Store, Trash2, TrendingUp, Users, Wallet, X, CreditCard, UserX, AlertTriangle, Landmark, Send,
} from "lucide-react";
import { toast } from "sonner";
import { rupiah } from "@/components/marketku/shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { clearSellerLocks } from "@/lib/chat";
import { pageMeta } from "@/lib/meta";
import { depositStatus, uploadPaymentImage, useIsAdmin, usePaymentSettings, usePaymentUrls } from "@/lib/wallet";
import { DISPUTE_STATUS, isDisputeActive, useDispute, useDisputes, type DisputeStatus } from "@/lib/disputes";
import { DisputeThread } from "@/components/marketku/dispute-thread";
import { AdminBotTab } from "@/components/marketku/admin-bot-tab";
import { HubBotAdminCard } from "@/components/marketku/seller-hub-ui";
import { ADMIN_ACTION_LABEL, BAN_DURATIONS, KIND_LABEL, PAYMENT_PROVIDERS, banDaysLeft, banUntilLabel, providerColor, usePaymentMethods, type PaymentKind } from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  head: () => {
    const m = pageMeta("Admin Console — Marketku", "Panel admin Marketku: deposit, metode pembayaran, blokir akun & toko, produk, pesanan.");
    return { ...m, meta: [...m.meta, { name: "robots", content: "noindex" }] };
  },
  component: Admin,
});

const TABS = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  { key: "deposit", label: "Deposit", icon: Wallet },
  { key: "bayar", label: "Bayar Order", icon: QrCode },
  { key: "withdraw", label: "Withdraw", icon: Landmark },
  { key: "rekber", label: "Rekber", icon: ShieldCheck },
  { key: "dispute", label: "Dispute", icon: AlertTriangle },
  { key: "pembayaran", label: "Metode", icon: CreditCard },
  { key: "pengguna", label: "Pengguna", icon: Users },
  { key: "toko", label: "Toko", icon: Store },
  { key: "produk", label: "Produk", icon: Package },
  { key: "pesanan", label: "Pesanan", icon: Receipt },
  { key: "kategori", label: "Kategori", icon: Plus },
  { key: "bot", label: "Bot", icon: Send },
  { key: "log", label: "Log", icon: History },
] as const;
type Tab = (typeof TABS)[number]["key"];
const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan");

type Stats = Record<"users" | "users_today" | "stores" | "products" | "products_hidden" | "orders" | "orders_done" | "orders_pending" | "gmv" | "deposits_pending" | "deposits_approved" | "deposits_today" | "wallet_total" | "banned_users" | "banned_stores", number>;
function useStats() {
  return useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_stats"); if (error) throw error; return data as unknown as Stats; },
  });
}

function Admin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, ready } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const [tab, setTab] = useState<Tab>("ringkasan");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as Tab);
  }, []);
  const denied = ready && (!user || isAdmin.data === false);
  useEffect(() => { if (denied) navigate({ to: "/admin/login", replace: true }); }, [denied, navigate]);
  const stats = useStats();
  const orderPayCount = useQuery({
    queryKey: ["admin_order_pay_count"], enabled: !!isAdmin.data, refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("order_payments").select("id", { count: "exact", head: true }).eq("status", "pending")).count ?? 0,
  });

  const wdCount = useQuery({
    queryKey: ["admin_wd_count"], enabled: !!isAdmin.data, refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending")).count ?? 0,
  });

  if (!isAdmin.data) return <div className="admin-panel grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear(); clearSellerLocks();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  };
  const pending = stats.data?.deposits_pending ?? 0;
  const payPending = orderPayCount.data ?? 0;
  const wdPending = wdCount.data ?? 0;

  return (
    <div className="admin-panel min-h-screen">
      <div className="mx-auto max-w-2xl">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-lg shadow-primary/30"><ShieldCheck className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-[0.2em] text-primary">MARKETKU ADMIN</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Link to="/" className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">Lihat situs</Link>
            <button aria-label="Keluar" onClick={() => void signOut()} className="grid h-9 w-9 place-items-center rounded-lg border text-destructive"><LogOut className="h-4 w-4" /></button>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${tab === t.key ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-card text-muted-foreground"}`}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {t.key === "deposit" && pending > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] text-white">{pending}</span>}
                {t.key === "withdraw" && wdPending > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] text-white">{wdPending}</span>}
                {t.key === "bayar" && payPending > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] text-white">{payPending}</span>}
              </button>
            ))}
          </nav>
        </header>
        <main className="mk-fade-in space-y-3 px-4 pb-16 pt-4" key={tab}>
          {tab === "ringkasan" && <Overview onGo={setTab} />}
          {tab === "deposit" && <Deposits />}
          {tab === "bayar" && <OrderPaymentsTab />}
          {tab === "withdraw" && <WithdrawalsTab />}
          {tab === "rekber" && <RekberTab />}
          {tab === "dispute" && <DisputesTab />}
          {tab === "pembayaran" && <PaymentMethods />}
          {tab === "pengguna" && <UsersTab />}
          {tab === "toko" && <StoresTab />}
          {tab === "produk" && <ProductsTab />}
          {tab === "pesanan" && <OrdersTab />}
          {tab === "kategori" && <CategoryRequestsTab />}
          {tab === "bot" && <div className="space-y-3"><AdminBotTab /><HubBotAdminCard /></div>}
          {tab === "log" && <LogsTab />}
        </main>
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Loading({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> {label}</div>;
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed py-14 text-center text-sm text-muted-foreground">{text}</p>;
}
function Refresh({ q }: { q: { refetch: () => unknown; isFetching: boolean } }) {
  return <button aria-label="Muat ulang" onClick={() => q.refetch()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-card"><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></button>;
}
function SearchBar({ value, onChange, q, placeholder }: { value: string; onChange: (v: string) => void; q: { refetch: () => unknown; isFetching: boolean }; placeholder: string }) {
  return (
    <div className="flex gap-2">
      <label className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 focus-within:border-primary"><Search className="h-4 w-4 text-muted-foreground" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>
      <Refresh q={q} />
    </div>
  );
}
function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {items.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${value === k ? "border-primary bg-accent text-primary" : "bg-card text-muted-foreground"}`}>{l}</button>
      ))}
    </div>
  );
}
function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "bad" | "warn" }) {
  const cls = { muted: "bg-muted text-muted-foreground", ok: "bg-primary/15 text-primary", bad: "bg-destructive/15 text-destructive", warn: "bg-amber-500/15 text-amber-400" }[tone];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="mk-fade-in max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-card p-4 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button aria-label="Tutup" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
const inputCls = "mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";
const btnPrimary = "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow py-2.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60";

/* ---------- Ringkasan ---------- */

function Stat({ icon: Icon, label, value, sub, onClick, tone = "primary" }: { icon: typeof Users; label: string; value: string | number; sub?: string; onClick?: () => void; tone?: "primary" | "bad" | "warn" }) {
  const t = { primary: "bg-primary/15 text-primary", bad: "bg-destructive/15 text-destructive", warn: "bg-amber-500/15 text-amber-400" }[tone];
  return (
    <button onClick={onClick} className="rounded-2xl border bg-card p-3 text-left transition active:scale-[0.98]">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${t}`}><Icon className="h-4 w-4" /></span>
      <p className="mt-2 text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
      <p className="mk-acc-mono mt-0.5 truncate text-lg">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </button>
  );
}

function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const stats = useStats();
  if (stats.isPending) return <Loading label="Memuat ringkasan..." />;
  const s: Partial<Stats> = stats.data ?? {};
  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-accent via-card to-card p-4">
        <div aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Nilai transaksi dibayar</p>
            <p className="mk-acc-mono mt-1 text-2xl">{rupiah(s.gmv ?? 0)}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-primary"><TrendingUp className="h-3.5 w-3.5" /> Deposit hari ini {rupiah(s.deposits_today ?? 0)}</p>
          </div>
          <Refresh q={stats} />
        </div>
      </section>
      {(s.deposits_pending ?? 0) > 0 && (
        <button onClick={() => onGo("deposit")} className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-left">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <span className="flex-1 text-sm font-semibold text-amber-300">{s.deposits_pending} deposit menunggu dicek</span>
          <ChevronRight className="h-4 w-4 text-amber-400" />
        </button>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon={Users} label="PENGGUNA" value={s.users ?? 0} sub={`+${s.users_today ?? 0} hari ini`} onClick={() => onGo("pengguna")} />
        <Stat icon={Store} label="TOKO" value={s.stores ?? 0} onClick={() => onGo("toko")} />
        <Stat icon={Package} label="PRODUK" value={s.products ?? 0} sub={`${s.products_hidden ?? 0} diturunkan`} onClick={() => onGo("produk")} />
        <Stat icon={Receipt} label="PESANAN" value={s.orders ?? 0} sub={`${s.orders_done ?? 0} selesai • ${s.orders_pending ?? 0} belum bayar`} onClick={() => onGo("pesanan")} />
        <Stat icon={Wallet} label="DEPOSIT MASUK" value={rupiah(s.deposits_approved ?? 0)} onClick={() => onGo("deposit")} />
        <Stat icon={Wallet} label="TOTAL SALDO USER" value={rupiah(s.wallet_total ?? 0)} />
        <Stat icon={UserX} tone="bad" label="AKUN DIBLOKIR" value={s.banned_users ?? 0} onClick={() => onGo("pengguna")} />
        <Stat icon={Ban} tone="bad" label="TOKO DIBLOKIR" value={s.banned_stores ?? 0} onClick={() => onGo("toko")} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onGo("pembayaran")} className="flex items-center gap-2 rounded-2xl border bg-card p-3 text-sm font-semibold"><CreditCard className="h-4 w-4 text-primary" /> Atur QRIS & E-Wallet</button>
        <button onClick={() => onGo("log")} className="flex items-center gap-2 rounded-2xl border bg-card p-3 text-sm font-semibold"><History className="h-4 w-4 text-primary" /> Log Aktivitas</button>
      </div>
    </>
  );
}

/* ---------- Deposit ---------- */

function useProfilesMap(ids: string[]) {
  return useQuery({
    queryKey: ["admin_profiles", ids], enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, username, whatsapp").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
    },
  });
}

function Deposits() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const list = useQuery({
    queryKey: ["admin_deposits", filter],
    queryFn: async () => {
      let q = supabase.from("deposit_requests").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    },
  });
  const rows = list.data ?? [];
  const profiles = useProfilesMap([...new Set(rows.map((r) => r.user_id))]);
  const proofs = usePaymentUrls(rows.map((r) => r.proof_path));
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reject, setReject] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const review = async (id: string, approve: boolean, n?: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_deposit", { p_id: id, p_approve: approve, ...(n?.trim() ? { p_note: n.trim() } : {}) });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Deposit disetujui, saldo/credits ditambahkan" : "Deposit ditolak");
    setReject(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin_deposits"] });
    qc.invalidateQueries({ queryKey: ["admin_stats"] });
  };
  const total = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden"><Chips value={filter} onChange={setFilter} items={[["pending", "Menunggu"], ["approved", "Disetujui"], ["rejected", "Ditolak"], ["all", "Semua"]]} /></div>
        <Refresh q={list} />
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} deposit • total <span className="mk-acc-mono">{rupiah(total)}</span></p>
      {list.isPending ? <Loading label="Memuat deposit..." /> : rows.length === 0 ? <Empty text="Belum ada deposit." /> : rows.map((d) => {
        const p = profiles.data?.[d.user_id]; const s = depositStatus(d.status); const url = proofs.data?.[d.proof_path];
        return (
          <div key={d.id} className="rounded-2xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p?.full_name || p?.username || "Pengguna"} {p?.username && <span className="font-normal text-muted-foreground">@{p.username}</span>}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}{p?.whatsapp ? ` • WA ${p.whatsapp}` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => url && setView(url)} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">{url ? <img src={url} alt="Bukti transfer" className="h-full w-full object-cover" /> : null}</button>
              <div className="min-w-0 flex-1">
                <p className="mk-acc-mono text-lg">{rupiah(d.amount)} <span className={`ml-1 rounded-full px-2 py-0.5 align-middle font-sans text-[10px] font-bold ${d.purpose === "credits" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{d.purpose === "credits" ? "Credits Seller" : "Saldo"}</span></p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: providerColor(d.method_label ?? "QRIS") }} /> via {d.method_label ?? "QRIS"}</p>
                {d.admin_note && <p className="text-xs text-muted-foreground">Catatan: {d.admin_note}</p>}
              </div>
            </div>
            {d.status === "pending" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={busy === d.id} onClick={() => setReject(d.id)} className="flex items-center justify-center gap-1 rounded-xl border border-destructive/40 py-2 text-sm font-semibold text-destructive disabled:opacity-50"><X className="h-4 w-4" /> Tolak</button>
                <button disabled={busy === d.id} onClick={() => review(d.id, true)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Check className="h-4 w-4" /> Setujui</button>
              </div>
            )}
          </div>
        );
      })}
      {reject && (
        <Sheet title="Tolak deposit" onClose={() => setReject(null)}>
          <label className="block text-xs font-semibold text-muted-foreground">Alasan (dilihat pembeli)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. Nominal tidak sesuai bukti" className={inputCls} /></label>
          <div className="mt-2 flex flex-wrap gap-1.5">{["Nominal tidak sesuai", "Bukti tidak jelas", "Dana belum masuk", "Bukti duplikat"].map((r) => <button key={r} onClick={() => setNote(r)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{r}</button>)}</div>
          <button disabled={busy === reject} onClick={() => review(reject, false, note)} className="mt-4 w-full rounded-xl bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-60">Tolak Deposit</button>
        </Sheet>
      )}
      {view && <button onClick={() => setView(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"><img src={view} alt="Bukti transfer" className="max-h-full max-w-full rounded-xl" /></button>}
    </>
  );
}

/* ---------- Bayar Order (QRIS proof for orders) ---------- */

function OrderPaymentsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const list = useQuery({
    queryKey: ["admin_order_payments", filter],
    queryFn: async () => {
      let q = supabase.from("order_payments").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q; if (error) throw error;
      const ids = [...new Set((data ?? []).map((p) => p.checkout_id))];
      const { data: os } = ids.length ? await supabase.from("orders").select("checkout_id, order_no, store_name, buyer_name, status").in("checkout_id", ids) : { data: [] };
      return (data ?? []).map((p) => ({ ...p, orders: (os ?? []).filter((o) => o.checkout_id === p.checkout_id) }));
    },
  });
  const rows = list.data ?? [];
  const proofs = usePaymentUrls(rows.map((r) => r.proof_path));
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reject, setReject] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const review = async (id: string, approve: boolean, n?: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_order_payment", { p_id: id, p_approve: approve, ...(n?.trim() ? { p_note: n.trim() } : {}) });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Pembayaran disetujui, pesanan diproses" : "Pembayaran ditolak");
    setReject(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin_order_payments"] });
    qc.invalidateQueries({ queryKey: ["admin_order_pay_count"] });
    qc.invalidateQueries({ queryKey: ["admin_stats"] });
  };
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden"><Chips value={filter} onChange={setFilter} items={[["pending", "Menunggu"], ["approved", "Disetujui"], ["rejected", "Ditolak"], ["all", "Semua"]]} /></div>
        <Refresh q={list} />
      </div>
      <p className="text-xs text-muted-foreground">Bukti bayar pesanan via QRIS / e-wallet. Cocokkan nominal (termasuk kode unik) dengan mutasi masuk.</p>
      {list.isPending ? <Loading label="Memuat pembayaran..." /> : rows.length === 0 ? <Empty text="Belum ada bukti pembayaran pesanan." /> : rows.map((p) => {
        const s = depositStatus(p.status); const url = proofs.data?.[p.proof_path];
        return (
          <div key={p.id} className="rounded-2xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.orders[0]?.buyer_name || "Pembeli"}</p>
                <p className="truncate text-xs text-muted-foreground">{fmtDate(p.created_at)} • {p.orders.map((o) => `M-${o.order_no} ${o.store_name ?? ""}`).join(", ")}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => url && setView(url)} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">{url ? <img src={url} alt="Bukti bayar" className="h-full w-full object-cover" /> : null}</button>
              <div className="min-w-0 flex-1">
                <p className="mk-acc-mono text-lg">{rupiah(Number(p.amount))}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: providerColor(p.method_label) }} /> via {p.method_label}</p>
                {p.admin_note && <p className="text-xs text-muted-foreground">Catatan: {p.admin_note}</p>}
              </div>
            </div>
            {p.status === "pending" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={busy === p.id} onClick={() => setReject(p.id)} className="flex items-center justify-center gap-1 rounded-xl border border-destructive/40 py-2 text-sm font-semibold text-destructive disabled:opacity-50"><X className="h-4 w-4" /> Tolak</button>
                <button disabled={busy === p.id} onClick={() => review(p.id, true)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Check className="h-4 w-4" /> Setujui</button>
              </div>
            )}
          </div>
        );
      })}
      {reject && (
        <Sheet title="Tolak pembayaran" onClose={() => setReject(null)}>
          <label className="block text-xs font-semibold text-muted-foreground">Alasan (dilihat pembeli)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. Nominal tidak sesuai" className={inputCls} /></label>
          <div className="mt-2 flex flex-wrap gap-1.5">{["Nominal tidak sesuai", "Bukti tidak jelas", "Dana belum masuk", "Bukti duplikat"].map((r) => <button key={r} onClick={() => setNote(r)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{r}</button>)}</div>
          <button disabled={busy === reject} onClick={() => review(reject, false, note)} className="mt-4 w-full rounded-xl bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-60">Tolak Pembayaran</button>
        </Sheet>
      )}
      {view && <button onClick={() => setView(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"><img src={view} alt="Bukti bayar" className="max-h-full max-w-full rounded-xl" /></button>}
    </>
  );
}

/* ---------- Withdraw seller ---------- */

function WithdrawalsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "sent" | "rejected" | "all">("pending");
  const list = useQuery({
    queryKey: ["admin_withdrawals", filter],
    queryFn: async () => {
      let q = supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q; if (error) throw error;
      const ids = [...new Set((data ?? []).map((w) => w.user_id))];
      const { data: ss } = ids.length ? await supabase.from("seller_stores").select("owner_id, store_name").in("owner_id", ids) : { data: [] };
      return (data ?? []).map((w) => ({ ...w, store: ss?.find((s) => s.owner_id === w.user_id)?.store_name ?? "Seller" }));
    },
  });
  const rows = list.data ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [reject, setReject] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const review = async (id: string, approve: boolean, n?: string) => {
    if (approve && !window.confirm("Tandai sudah ditransfer ke rekening seller?")) return;
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_withdrawal", { p_id: id, p_approve: approve, ...(n?.trim() ? { p_note: n.trim() } : {}) });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Penarikan ditandai terkirim" : "Penarikan ditolak, saldo dikembalikan");
    setReject(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin_withdrawals"] });
    qc.invalidateQueries({ queryKey: ["admin_wd_count"] });
  };
  const copy = (t: string) => { void navigator.clipboard.writeText(t); toast.success("Disalin"); };
  const label = { pending: ["Diproses", "bg-amber-500/15 text-amber-400"], sent: ["Selesai", "bg-emerald-500/15 text-emerald-400"], rejected: ["Ditolak", "bg-destructive/15 text-destructive"] } as Record<string, [string, string]>;
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden"><Chips value={filter} onChange={setFilter} items={[["pending", "Diproses"], ["sent", "Selesai"], ["rejected", "Ditolak"], ["all", "Semua"]]} /></div>
        <Refresh q={list} />
      </div>
      <p className="text-xs text-muted-foreground">Transfer "Dana diterima" ke rekening seller secara manual, lalu tandai terkirim. Jika ditolak, saldo otomatis kembali ke seller.</p>
      {list.isPending ? <Loading label="Memuat penarikan..." /> : rows.length === 0 ? <Empty text="Belum ada permintaan penarikan." /> : rows.map((w) => {
        const [l, cls] = label[w.status] ?? ["-", ""];
        return (
          <div key={w.id} className="rounded-2xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{w.store}</p>
                <p className="truncate text-xs text-muted-foreground">{fmtDate(w.created_at)} • {w.same_day ? "Same day" : w.auto ? "Auto" : "Reguler"}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{l}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-muted/50 p-2"><p className="text-muted-foreground">Nominal</p><p className="font-semibold">{rupiah(Number(w.amount))}</p></div>
              <div className="rounded-xl bg-muted/50 p-2"><p className="text-muted-foreground">Biaya</p><p className="font-semibold">{rupiah(Number(w.fee))}</p></div>
              <div className="rounded-xl bg-primary/10 p-2"><p className="text-muted-foreground">Transfer</p><p className="font-bold text-primary">{rupiah(Number(w.net))}</p></div>
            </div>
            <button onClick={() => copy(w.bank_number)} className="mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: providerColor(w.bank_provider) }} />
              <span className="flex-1"><b>{w.bank_provider}</b> {w.bank_number}{w.bank_holder ? ` • a.n. ${w.bank_holder}` : ""}</span>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {w.admin_note && <p className="mt-1.5 text-xs text-muted-foreground">Catatan: {w.admin_note}</p>}
            {w.status === "pending" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={busy === w.id} onClick={() => setReject(w.id)} className="flex items-center justify-center gap-1 rounded-xl border border-destructive/40 py-2 text-sm font-semibold text-destructive disabled:opacity-50"><X className="h-4 w-4" /> Tolak</button>
                <button disabled={busy === w.id} onClick={() => void review(w.id, true)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /> Terkirim</button>
              </div>
            )}
          </div>
        );
      })}
      {reject && (
        <Sheet title="Tolak penarikan" onClose={() => setReject(null)}>
          <label className="block text-xs font-semibold text-muted-foreground">Alasan (dilihat seller)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. nama tidak sesuai" className={inputCls} /></label>
          <div className="mt-2 flex flex-wrap gap-1.5">{["nama tidak sesuai", "Nomor rekening salah", "Rekening tidak aktif", "Indikasi penipuan"].map((r) => <button key={r} onClick={() => setNote(r)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{r}</button>)}</div>
          <button disabled={busy === reject || !note.trim()} onClick={() => void review(reject, false, note)} className="mt-4 w-full rounded-xl bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-60">Tolak & Kembalikan Saldo</button>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Pembayaran (QRIS & e-wallet) ---------- */

type Method = { id: string; kind: string; provider: string; account_number: string | null; account_name: string | null; qr_path: string | null; is_active: boolean; sort: number };

function PaymentMethods() {
  const qc = useQueryClient();
  const methods = usePaymentMethods();
  const urls = usePaymentUrls((methods.data ?? []).map((m) => m.qr_path));
  const [edit, setEdit] = useState<Partial<Method> | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["payment_methods"] });

  const toggle = async (m: Method) => {
    const { error } = await supabase.from("payment_methods").update({ is_active: !m.is_active }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(m.is_active ? `${m.provider} dinonaktifkan` : `${m.provider} diaktifkan`); refresh();
  };
  const remove = async (m: Method) => {
    if (!window.confirm(`Hapus metode ${m.provider}?`)) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Metode dihapus"); refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div><h1 className="text-base font-bold">Metode Top Up</h1><p className="text-xs text-muted-foreground">QRIS, DANA, GoPay, OVO, ShopeePay, dan bank</p></div>
        <button onClick={() => setEdit({ kind: "ewallet", provider: "DANA", is_active: true })} className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus className="h-4 w-4" /> Tambah</button>
      </div>
      {methods.isPending ? <Loading label="Memuat metode..." /> : (methods.data ?? []).length === 0 ? <Empty text="Belum ada metode. Tambahkan QRIS atau e-wallet agar pembeli bisa top up." /> : (methods.data as Method[]).map((m) => {
        const img = m.qr_path ? urls.data?.[m.qr_path] : undefined;
        return (
          <div key={m.id} className={`flex items-center gap-3 rounded-2xl border bg-card p-3 ${m.is_active ? "" : "opacity-60"}`}>
            {img ? <img src={img} alt={m.provider} className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-0.5" /> : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[11px] font-black text-white" style={{ background: providerColor(m.provider) }}>{m.provider.slice(0, 4)}</span>
            )}
            <button onClick={() => setEdit(m)} className="min-w-0 flex-1 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold">{m.provider} <Pill>{KIND_LABEL[m.kind as PaymentKind] ?? m.kind}</Pill></p>
              <p className="mk-acc-mono truncate text-xs text-muted-foreground">{m.account_number || (m.qr_path ? "Kode QR" : "-")}{m.account_name ? ` • a.n. ${m.account_name}` : ""}</p>
            </button>
            <button aria-label={m.is_active ? "Nonaktifkan" : "Aktifkan"} onClick={() => toggle(m)} className="grid h-9 w-9 place-items-center rounded-lg border">{m.is_active ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}</button>
            <button aria-label="Hapus" onClick={() => remove(m)} className="grid h-9 w-9 place-items-center rounded-lg border text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        );
      })}
      <DepositSettings />
      {edit && <MethodSheet initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
    </>
  );
}

function MethodSheet({ initial, onClose, onSaved }: { initial: Partial<Method>; onClose: () => void; onSaved: () => void }) {
  const [provider, setProvider] = useState(initial.provider ?? "DANA");
  const [kind, setKind] = useState<string>(initial.kind ?? "ewallet");
  const [num, setNum] = useState(initial.account_number ?? "");
  const [name, setName] = useState(initial.account_name ?? "");
  const [qr, setQr] = useState<string | null>(initial.qr_path ?? null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = usePaymentUrls([qr]);

  const pick = (p: (typeof PAYMENT_PROVIDERS)[number]) => { setProvider(p.provider); setKind(p.kind); };
  const upload = async (f?: File) => {
    if (!f) return;
    try { setBusy(true); setQr(await uploadPaymentImage("qris", f)); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const save = async () => {
    if (kind === "qris" && !qr) { toast.error("Upload gambar QRIS dulu"); return; }
    if (kind !== "qris" && !num.trim()) { toast.error("Isi nomor akun / rekening"); return; }
    setBusy(true);
    const row = { provider, kind, account_number: num.trim() || null, account_name: name.trim() || null, qr_path: qr };
    const { error } = initial.id ? await supabase.from("payment_methods").update(row).eq("id", initial.id) : await supabase.from("payment_methods").insert(row);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Metode pembayaran disimpan"); onSaved();
  };

  return (
    <Sheet title={initial.id ? `Edit ${initial.provider}` : "Tambah metode top up"} onClose={onClose}>
      <p className="text-xs font-semibold text-muted-foreground">Pilih penyedia</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {PAYMENT_PROVIDERS.map((p) => (
          <button key={p.provider} onClick={() => pick(p)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition ${provider === p.provider ? "border-primary bg-accent" : "bg-background"}`}>
            <span className="grid h-8 w-8 place-items-center rounded-lg text-[9px] font-black text-white" style={{ background: p.color }}>{p.provider.slice(0, 3)}</span>{p.provider}
          </button>
        ))}
      </div>
      {kind !== "qris" && <label className="mt-3 block text-xs font-semibold text-muted-foreground">{kind === "bank" ? "Nomor rekening" : "Nomor HP e-wallet"}<input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/[^\d -]/g, ""))} placeholder={kind === "bank" ? "1234567890" : "08xxxxxxxxxx"} className={inputCls} /></label>}
      <label className="mt-3 block text-xs font-semibold text-muted-foreground">Atas nama<input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. MARKETKU" className={inputCls} /></label>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()} className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-accent/40 p-4 text-sm text-muted-foreground">
        {qr && url.data?.[qr] ? <img src={url.data[qr]} alt="QR" className="w-40 rounded-lg bg-white p-1" /> : <ImagePlus className="h-7 w-7 text-primary" />}
        {qr ? "Ganti gambar QR" : kind === "qris" ? "Upload gambar QRIS (wajib)" : "Upload kode QR (opsional)"}
      </button>
      <button disabled={busy} onClick={save} className={`mt-4 ${btnPrimary}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</button>
    </Sheet>
  );
}

function DepositSettings() {
  const qc = useQueryClient();
  const settings = usePaymentSettings();
  const [instr, setInstr] = useState("");
  const [min, setMin] = useState("10000");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (settings.data) { setInstr(settings.data.instructions ?? ""); setMin(String(settings.data.min_deposit)); } }, [settings.data]);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("payment_settings").update({ instructions: instr.trim() || null, min_deposit: Math.max(1000, Number(min || "10000")), updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pengaturan deposit disimpan"); qc.invalidateQueries({ queryKey: ["payment_settings"] });
  };
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-bold">Aturan Deposit</h2>
      <label className="block text-xs font-semibold text-muted-foreground">Minimal deposit (Rp)<input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className={inputCls} /></label>
      <label className="block text-xs font-semibold text-muted-foreground">Petunjuk untuk pembeli<textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={3} placeholder="cth. Transfer sesuai nominal, lalu upload bukti." className={inputCls} /></label>
      <button disabled={busy} onClick={save} className={btnPrimary}>{busy ? "Menyimpan..." : "Simpan Aturan"}</button>
    </section>
  );
}

/* ---------- Ban sheet ---------- */

function BanSheet({ title, target, onClose, onConfirm }: { title: string; target: string; onClose: () => void; onConfirm: (days: number, reason: string) => Promise<void> }) {
  const [days, setDays] = useState(7);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const d = custom ? Number(custom) : days;
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-sm text-muted-foreground">Target: <b className="text-foreground">{target}</b></p>
      <p className="mt-3 text-xs font-semibold text-muted-foreground">Durasi</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {BAN_DURATIONS.map((b) => (
          <button key={b.days} onClick={() => { setDays(b.days); setCustom(""); }} className={`rounded-xl border py-2 text-xs font-semibold ${!custom && days === b.days ? (b.days === 0 ? "border-destructive bg-destructive/15 text-destructive" : "border-primary bg-accent text-primary") : "bg-background"}`}>{b.label}</button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground">Atau jumlah hari lain<input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="cth. 60" className={inputCls} /></label>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground">Alasan<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="cth. Penipuan / spam" className={inputCls} /></label>
      <div className="mt-2 flex flex-wrap gap-1.5">{["Penipuan", "Spam", "Produk ilegal", "Melanggar aturan", "Laporan pembeli"].map((r) => <button key={r} onClick={() => setReason(r)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{r}</button>)}</div>
      <button disabled={busy} onClick={async () => { setBusy(true); await onConfirm(d, reason); setBusy(false); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Blokir {d === 0 ? "Permanen" : `${d} hari`}
      </button>
    </Sheet>
  );
}

/* ---------- Pengguna ---------- */

type AdminUser = { id: string; email: string | null; full_name: string; username: string | null; whatsapp: string | null; created_at: string; last_seen_at: string | null; balance: number; is_admin: boolean; has_store: boolean; ban_reason: string | null; banned_until: string | null; is_banned: boolean };

function UsersTab() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "banned" | "seller" | "saldo">("all");
  const [open, setOpen] = useState<AdminUser | null>(null);
  const list = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_users"); if (error) throw error; return (data ?? []) as AdminUser[]; },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((p) => (f === "all" || (f === "banned" && p.is_banned) || (f === "seller" && p.has_store) || (f === "saldo" && p.balance > 0))
    && (!t || [p.full_name, p.username, p.whatsapp, p.email].some((v) => v?.toLowerCase().includes(t))));
  const current = open ? (list.data ?? []).find((u) => u.id === open.id) ?? open : null;
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari nama, email, username, WA" />
      <Chips value={f} onChange={setF} items={[["all", "Semua"], ["banned", "Diblokir"], ["seller", "Seller"], ["saldo", "Punya saldo"]]} />
      <p className="text-xs text-muted-foreground">{rows.length} pengguna</p>
      {list.isPending ? <Loading label="Memuat pengguna..." /> : rows.length === 0 ? <Empty text="Tidak ada pengguna." /> : rows.map((p) => (
        <button key={p.id} onClick={() => setOpen(p)} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition active:scale-[0.99]">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${p.is_banned ? "bg-destructive/20 text-destructive" : "bg-primary text-primary-foreground"}`}>{(p.full_name || p.username || "?").charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">{p.full_name || "-"} {p.is_admin && <Pill tone="ok">Admin</Pill>}{p.has_store && <Pill>Seller</Pill>}{p.is_banned && <Pill tone="bad">Diblokir</Pill>}</p>
            <p className="truncate text-xs text-muted-foreground">{p.email ?? "-"}{p.username ? ` • @${p.username}` : ""}</p>
          </div>
          <p className="mk-acc-mono shrink-0 text-sm">{rupiah(p.balance)}</p>
        </button>
      ))}
      {current && <UserSheet u={current} onClose={() => setOpen(null)} />}
    </>
  );
}

function UserSheet({ u, onClose }: { u: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [ban, setBan] = useState(false);
  const [adj, setAdj] = useState<1 | -1 | null>(null);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ledger = useQuery({
    queryKey: ["admin_ledger", u.id],
    queryFn: async () => { const { data, error } = await supabase.from("wallet_ledger").select("id, amount, kind, note, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(15); if (error) throw error; return data ?? []; },
  });
  const done = () => { qc.invalidateQueries({ queryKey: ["admin_users"] }); qc.invalidateQueries({ queryKey: ["admin_stats"] }); qc.invalidateQueries({ queryKey: ["admin_ledger", u.id] }); };

  const unban = async () => {
    setBusy(true); const { error } = await supabase.rpc("admin_unban_user", { p_user: u.id }); setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Blokir akun dibuka"); done();
  };
  const adjust = async () => {
    const n = Number(amt.replace(/\D/g, "") || "0");
    if (!n) { toast.error("Isi nominal"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_adjust_wallet", { p_user: u.id, p_amount: n * (adj ?? 1), p_note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(adj === 1 ? "Saldo ditambahkan" : "Saldo dikurangi"); setAdj(null); setAmt(""); setNote(""); done();
  };
  const left = banDaysLeft(u.banned_until);

  return (
    <Sheet title="Detail Pengguna" onClose={onClose}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{(u.full_name || "?").charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{u.full_name || "-"} {u.username && <span className="text-sm font-normal text-muted-foreground">@{u.username}</span>}</p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted p-2.5"><p className="text-muted-foreground">Saldo</p><p className="mk-acc-mono text-base">{rupiah(u.balance)}</p></div>
        <div className="rounded-xl bg-muted p-2.5"><p className="text-muted-foreground">Bergabung</p><p className="font-semibold">{new Date(u.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p></div>
        <div className="rounded-xl bg-muted p-2.5"><p className="text-muted-foreground">Terakhir aktif</p><p className="font-semibold">{u.last_seen_at ? fmtDate(u.last_seen_at) : "-"}</p></div>
        <div className="rounded-xl bg-muted p-2.5"><p className="text-muted-foreground">WhatsApp</p><p className="font-semibold">{u.whatsapp || "-"}</p></div>
      </div>
      {u.is_banned && (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <p className="font-bold text-destructive">Akun diblokir • {banUntilLabel(u.banned_until)}{left !== null ? ` (${left} hari lagi)` : ""}</p>
          {u.ban_reason && <p className="mt-0.5 text-muted-foreground">Alasan: {u.ban_reason}</p>}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {u.is_banned ? (
          <button disabled={busy} onClick={unban} className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/50 py-2.5 text-sm font-semibold text-primary"><ShieldOff className="h-4 w-4" /> Buka Blokir</button>
        ) : (
          <button disabled={u.is_admin} onClick={() => setBan(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-destructive/50 py-2.5 text-sm font-semibold text-destructive disabled:opacity-40"><Ban className="h-4 w-4" /> Blokir Akun</button>
        )}
        {u.whatsapp ? (
          <a href={`https://wa.me/${u.whatsapp.replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
        ) : <button onClick={() => { void navigator.clipboard.writeText(u.email ?? ""); toast.success("Email disalin"); }} className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold"><Copy className="h-4 w-4" /> Salin Email</button>}
        <button onClick={() => setAdj(1)} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary/15 py-2.5 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Tambah Saldo</button>
        <button onClick={() => setAdj(-1)} className="flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2.5 text-sm font-semibold"><Minus className="h-4 w-4" /> Kurangi Saldo</button>
      </div>
      {adj && (
        <div className="mt-3 space-y-2 rounded-xl border p-3">
          <p className="text-xs font-bold">{adj === 1 ? "Tambah saldo" : "Kurangi saldo"}</p>
          <input inputMode="numeric" value={amt} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setAmt(d ? Number(d).toLocaleString("id-ID") : ""); }} placeholder="Nominal (Rp)" className={inputCls} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (wajib), cth. Refund pesanan #123" className={inputCls} />
          <button disabled={busy} onClick={adjust} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</button>
        </div>
      )}
      <h3 className="mt-4 text-sm font-bold">Riwayat Saldo</h3>
      {ledger.isPending ? <Loading label="Memuat..." /> : (ledger.data ?? []).length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Belum ada mutasi.</p> : (
        <ul className="mt-1 divide-y">
          {ledger.data!.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-xs">
              <div className="min-w-0"><p className="truncate font-semibold">{l.note || l.kind}</p><p className="text-muted-foreground">{fmtDate(l.created_at)}</p></div>
              <span className={`mk-acc-mono shrink-0 ${l.amount >= 0 ? "text-primary" : "text-destructive"}`}>{l.amount >= 0 ? "+" : "-"}{rupiah(Math.abs(Number(l.amount)))}</span>
            </li>
          ))}
        </ul>
      )}
      {ban && <BanSheet title="Blokir akun" target={u.full_name || u.email || "Pengguna"} onClose={() => setBan(false)} onConfirm={async (days, reason) => {
        const { error } = await supabase.rpc("admin_ban_user", { p_user: u.id, p_days: days, p_reason: reason });
        if (error) { toast.error(error.message); return; }
        toast.success(days === 0 ? "Akun diblokir permanen" : `Akun diblokir ${days} hari`); setBan(false); done();
      }} />}
    </Sheet>
  );
}

/* ---------- Toko ---------- */

type AdminStore = { owner_id: string; store_name: string; slug: string | null; is_open: boolean; telegram_username: string | null; contact_phone: string | null; created_at: string; owner_email: string | null; products: number; orders: number; revenue: number; ban_reason: string | null; banned_until: string | null; is_banned: boolean };

function StoresTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "open" | "banned">("all");
  const [ban, setBan] = useState<AdminStore | null>(null);
  const list = useQuery({
    queryKey: ["admin_stores"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_stores"); if (error) throw error; return (data ?? []) as AdminStore[]; },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((s) => (f === "all" || (f === "open" && s.is_open && !s.is_banned) || (f === "banned" && s.is_banned))
    && (!t || [s.store_name, s.slug, s.telegram_username, s.owner_email].some((v) => v?.toLowerCase().includes(t))));
  const done = () => { qc.invalidateQueries({ queryKey: ["admin_stores"] }); qc.invalidateQueries({ queryKey: ["admin_stats"] }); };
  const unban = async (s: AdminStore) => {
    const { error } = await supabase.rpc("admin_unban_store", { p_owner: s.owner_id });
    if (error) { toast.error(error.message); return; }
    toast.success(`Blokir ${s.store_name} dibuka`); done();
  };
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari toko, slug, email pemilik" />
      <Chips value={f} onChange={setF} items={[["all", "Semua"], ["open", "Buka"], ["banned", "Diblokir"]]} />
      <p className="text-xs text-muted-foreground">{rows.length} toko</p>
      {list.isPending ? <Loading label="Memuat toko..." /> : rows.length === 0 ? <Empty text="Tidak ada toko." /> : rows.map((s) => {
        const left = banDaysLeft(s.banned_until);
        return (
          <div key={s.owner_id} className={`rounded-2xl border bg-card p-3 ${s.is_banned ? "border-destructive/40" : ""}`}>
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.is_banned ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}><Store className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.store_name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.owner_email ?? "-"}{s.slug ? ` • /${s.slug}` : ""}</p>
              </div>
              {s.is_banned ? <Pill tone="bad">Diblokir</Pill> : <Pill tone={s.is_open ? "ok" : "muted"}>{s.is_open ? "Buka" : "Tutup"}</Pill>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-muted py-1.5"><p className="text-muted-foreground">Produk</p><p className="mk-acc-mono text-sm">{s.products}</p></div>
              <div className="rounded-lg bg-muted py-1.5"><p className="text-muted-foreground">Pesanan</p><p className="mk-acc-mono text-sm">{s.orders}</p></div>
              <div className="rounded-lg bg-muted py-1.5"><p className="text-muted-foreground">Omzet</p><p className="mk-acc-mono truncate px-1 text-sm">{rupiah(s.revenue)}</p></div>
            </div>
            {s.is_banned && <p className="mt-2 text-xs text-destructive">{banUntilLabel(s.banned_until)}{left !== null ? ` (${left} hari lagi)` : ""}{s.ban_reason ? ` • ${s.ban_reason}` : ""}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to="/toko/$slug" params={{ slug: s.slug || s.owner_id }} className="rounded-xl border py-2 text-center text-xs font-semibold">Lihat Toko</Link>
              {s.is_banned
                ? <button onClick={() => unban(s)} className="rounded-xl border border-primary/50 py-2 text-xs font-semibold text-primary">Buka Blokir</button>
                : <button onClick={() => setBan(s)} className="rounded-xl border border-destructive/50 py-2 text-xs font-semibold text-destructive">Blokir Toko</button>}
            </div>
          </div>
        );
      })}
      {ban && <BanSheet title="Blokir toko" target={ban.store_name} onClose={() => setBan(null)} onConfirm={async (days, reason) => {
        const { error } = await supabase.rpc("admin_ban_store", { p_owner: ban.owner_id, p_days: days, p_reason: reason });
        if (error) { toast.error(error.message); return; }
        toast.success(days === 0 ? "Toko diblokir permanen" : `Toko diblokir ${days} hari`); setBan(null); done();
      }} />}
    </>
  );
}

/* ---------- Produk ---------- */

function ProductsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "active" | "draft" | "hidden">("all");
  const [take, setTake] = useState<{ id: string; name: string } | null>(null);
  const [note, setNote] = useState("");
  const list = useQuery({
    queryKey: ["admin_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, status, sold_count, owner_id, created_at, admin_hidden, admin_note").order("created_at", { ascending: false }).limit(500);
      if (error) throw error; return data ?? [];
    },
  });
  const stores = useQuery({
    queryKey: ["admin_store_names"],
    queryFn: async () => { const { data } = await supabase.from("seller_stores").select("owner_id, store_name"); return Object.fromEntries((data ?? []).map((s) => [s.owner_id, s.store_name])); },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((p) => (f === "all" || (f === "hidden" ? p.admin_hidden : p.status === f && !p.admin_hidden)) && (!t || p.name.toLowerCase().includes(t) || stores.data?.[p.owner_id]?.toLowerCase().includes(t)));
  const setHidden = async (id: string, hidden: boolean, n: string | null) => {
    const { error } = await supabase.rpc("admin_set_product_hidden", { p_id: id, p_hidden: hidden, p_note: n ?? "" });
    if (error) { toast.error(error.message); return; }
    toast.success(hidden ? "Produk diturunkan" : "Produk ditampilkan lagi"); setTake(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin_products"] }); qc.invalidateQueries({ queryKey: ["admin_stats"] });
  };
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari produk atau toko" />
      <Chips value={f} onChange={setF} items={[["all", "Semua"], ["active", "Aktif"], ["draft", "Draft"], ["hidden", "Diturunkan"]]} />
      <p className="text-xs text-muted-foreground">{rows.length} produk</p>
      {list.isPending ? <Loading label="Memuat produk..." /> : rows.length === 0 ? <Empty text="Tidak ada produk." /> : rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
          <Package className={`h-5 w-5 shrink-0 ${p.admin_hidden ? "text-destructive" : "text-primary"}`} />
          <Link to="/produk/$id" params={{ id: p.id }} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{stores.data?.[p.owner_id] ?? "Toko"} • Terjual {p.sold_count}{p.admin_note ? ` • ${p.admin_note}` : ""}</p>
          </Link>
          {p.admin_hidden ? <button onClick={() => setHidden(p.id, false, null)} className="shrink-0 rounded-lg border border-primary/50 px-2.5 py-1.5 text-[11px] font-semibold text-primary">Tampilkan</button>
            : <button onClick={() => setTake({ id: p.id, name: p.name })} className="shrink-0 rounded-lg border border-destructive/50 px-2.5 py-1.5 text-[11px] font-semibold text-destructive">Turunkan</button>}
        </div>
      ))}
      {take && (
        <Sheet title="Turunkan produk" onClose={() => setTake(null)}>
          <p className="text-sm text-muted-foreground">Produk <b className="text-foreground">{take.name}</b> tidak akan tampil di Marketku dan tidak bisa dibeli. Seller tidak bisa menampilkannya sendiri.</p>
          <label className="mt-3 block text-xs font-semibold text-muted-foreground">Alasan<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. Produk melanggar aturan" className={inputCls} /></label>
          <button onClick={() => setHidden(take.id, true, note)} className="mt-4 w-full rounded-xl bg-destructive py-2.5 text-sm font-bold text-white">Turunkan Produk</button>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Pesanan ---------- */

const ORDER_STATUS: Record<string, [string, "muted" | "ok" | "bad" | "warn"]> = {
  pending: ["Belum bayar", "warn"], paid: ["Dibayar", "ok"], processing: ["Diproses", "ok"], completed: ["Selesai", "ok"],
  cancelled: ["Dibatalkan", "bad"], refunded: ["Refund", "muted"], failed: ["Gagal", "bad"],
};

function OrdersTab() {
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const list = useQuery({
    queryKey: ["admin_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id, order_no, buyer_name, store_name, status, total, created_at, voucher_code").order("created_at", { ascending: false }).limit(300);
      if (error) throw error; return data ?? [];
    },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((o) => (f === "all" || o.status === f) && (!t || [o.order_no, o.buyer_name, o.store_name].some((v) => String(v ?? "").toLowerCase().includes(t))));
  const total = useMemo(() => rows.reduce((a, o) => a + Number(o.total), 0), [rows]);
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari no. order, pembeli, toko" />
      <Chips value={f} onChange={setF} items={[["all", "Semua"], ...Object.entries(ORDER_STATUS).map(([k, v]) => [k, v[0]] as [string, string])]} />
      <p className="text-xs text-muted-foreground">{rows.length} pesanan • <span className="mk-acc-mono">{rupiah(total)}</span></p>
      {list.isPending ? <Loading label="Memuat pesanan..." /> : rows.length === 0 ? <Empty text="Belum ada pesanan." /> : rows.map((o) => {
        const st = ORDER_STATUS[o.status] ?? [o.status, "muted"];
        return (
          <div key={o.id} className="rounded-2xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2"><p className="mk-acc-mono truncate text-sm">#{o.order_no}</p><Pill tone={st[1]}>{st[0]}</Pill></div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{o.buyer_name || "Pembeli"} → {o.store_name || "Toko"} • {fmtDate(o.created_at)}{o.voucher_code ? ` • ${o.voucher_code}` : ""}</p>
            <p className="mk-acc-mono mt-1 text-base">{rupiah(o.total)}</p>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Log ---------- */

function CategoryRequestsTab() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin_category_requests"],
    queryFn: async () => { const { data, error } = await supabase.from("category_requests").select("*").order("created_at", { ascending: false }).limit(200); if (error) throw error; return data ?? []; },
  });
  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_category_request", { _id: id, _approve: approve });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Kategori disetujui dan ditambahkan" : "Pengajuan ditolak");
    qc.invalidateQueries({ queryKey: ["admin_category_requests"] });
    qc.invalidateQueries({ queryKey: ["product_categories"] });
  };
  const label = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" } as Record<string, string>;
  return (
    <>
      <div className="flex items-center justify-between"><h1 className="text-base font-bold">Pengajuan Kategori</h1><Refresh q={list} /></div>
      {list.isPending ? <Loading label="Memuat pengajuan..." /> : (list.data ?? []).length === 0 ? <Empty text="Belum ada pengajuan kategori." /> : (
        <div className="space-y-2">
          {list.data!.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold">{label[r.status] ?? r.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</p>
              {r.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <button disabled={busy === r.id} onClick={() => review(r.id, true)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><Check className="h-3.5 w-3.5" /> Setujui</button>
                  <button disabled={busy === r.id} onClick={() => review(r.id, false)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><X className="h-3.5 w-3.5" /> Tolak</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LogsTab() {
  const list = useQuery({
    queryKey: ["admin_logs"],
    queryFn: async () => { const { data, error } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200); if (error) throw error; return data ?? []; },
  });
  return (
    <>
      <div className="flex items-center justify-between"><h1 className="text-base font-bold">Log Aktivitas Admin</h1><Refresh q={list} /></div>
      {list.isPending ? <Loading label="Memuat log..." /> : (list.data ?? []).length === 0 ? <Empty text="Belum ada aktivitas admin." /> : (
        <ol className="relative space-y-2 border-l border-border pl-4">
          {list.data!.map((l) => (
            <li key={l.id} className="relative rounded-2xl border bg-card p-3">
              <span className="absolute -left-[22px] top-4 h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-sm font-semibold">{ADMIN_ACTION_LABEL[l.action] ?? l.action}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(l.created_at)} • {l.target_type}{l.note ? ` • ${l.note}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/* ---------- Rekber (escrow) ---------- */

function RekberTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"aktif" | "sengketa" | "all">("aktif");
  const [pick, setPick] = useState<{ id: string; release: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["admin_rekber", filter],
    queryFn: async () => {
      let q = supabase.from("rekber_deals").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter === "aktif") q = q.in("status", ["ditahan", "sengketa"]);
      if (filter === "sengketa") q = q.eq("status", "sengketa");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const resolve = async () => {
    if (!pick) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_resolve_rekber", { p_id: pick.id, p_release: pick.release, p_note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(pick.release ? "Dana dicairkan ke penjual" : "Dana dikembalikan ke pembeli");
    setPick(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin_rekber"] });
  };
  const label: Record<string, [string, "muted" | "ok" | "bad" | "warn"]> = {
    menunggu_deposit: ["Perlu deposit", "warn"], ditahan: ["Ditahan", "ok"], sengketa: ["Sengketa", "bad"],
    selesai: ["Selesai", "ok"], dikembalikan: ["Dikembalikan", "muted"], dibatalkan: ["Dibatalkan", "muted"],
  };
  const rows = list.data ?? [];
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden"><Chips value={filter} onChange={setFilter} items={[["aktif", "Dana ditahan"], ["sengketa", "Sengketa"], ["all", "Semua"]]} /></div>
        <Refresh q={list} />
      </div>
      <p className="text-xs text-muted-foreground">Rekber yang sedang ditahan atau disengketakan. Cairkan ke penjual bila transaksi beres, atau kembalikan ke Saldo Marketku pembeli.</p>
      {list.isPending ? <Loading label="Memuat rekber..." /> : rows.length === 0 ? <Empty text="Tidak ada rekber di sini." /> : rows.map((d) => {
        const [l, tone] = label[d.status] ?? ["-", "muted"];
        return (
          <div key={d.id} className="rounded-2xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{d.title}</p><p className="text-xs text-muted-foreground">{d.code} • {fmtDate(d.created_at)}</p></div>
              <Pill tone={tone}>{l}</Pill>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-muted/50 p-2"><p className="text-muted-foreground">Dibayar</p><p className="font-semibold">{rupiah(Number(d.buyer_pays))}</p></div>
              <div className="rounded-xl bg-muted/50 p-2"><p className="text-muted-foreground">Biaya</p><p className="font-semibold">{rupiah(Number(d.fee))}</p></div>
              <div className="rounded-xl bg-primary/10 p-2"><p className="text-muted-foreground">Ke penjual</p><p className="font-bold text-primary">{rupiah(Number(d.seller_receives))}</p></div>
            </div>
            {d.details && <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{d.details}</p>}
            {d.dispute_reason && <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs"><b className="text-destructive">Sengketa ({d.dispute_by === d.seller_id ? "penjual" : "pembeli"}):</b> {d.dispute_reason}</p>}
            {d.admin_note && <p className="mt-1.5 text-xs text-muted-foreground">Catatan: {d.admin_note}</p>}
            {(d.status === "ditahan" || d.status === "sengketa") && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setPick({ id: d.id, release: false })} className="flex items-center justify-center gap-1 rounded-xl border border-destructive/40 py-2 text-sm font-semibold text-destructive"><X className="h-4 w-4" /> Kembalikan</button>
                <button onClick={() => setPick({ id: d.id, release: true })} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"><Check className="h-4 w-4" /> Cairkan</button>
              </div>
            )}
          </div>
        );
      })}
      {pick && (
        <Sheet title={pick.release ? "Cairkan ke penjual" : "Kembalikan ke pembeli"} onClose={() => setPick(null)}>
          <label className="block text-xs font-semibold text-muted-foreground">Catatan (dilihat kedua pihak)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. bukti serah terima lengkap" className={inputCls} /></label>
          <button disabled={busy} onClick={() => void resolve()} className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 ${pick.release ? "bg-primary text-primary-foreground" : "bg-destructive text-white"}`}>{busy ? "Memproses..." : pick.release ? "Cairkan Dana" : "Kembalikan Dana"}</button>
        </Sheet>
      )}
    </>
  );
}

function DisputesTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"aktif" | "ditinjau" | "all">("aktif");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useDisputes("admin", user?.id);
  const one = useDispute(openId ?? undefined);
  const rows = (list.data ?? []).filter((d) => filter === "all" ? true : filter === "ditinjau" ? d.status === "ditinjau" : isDisputeActive(d.status));
  const tone = (t: string) => (t === "ok" ? "ok" : t === "bad" ? "bad" : t === "warn" || t === "info" ? "warn" : "muted") as "muted" | "ok" | "bad" | "warn";
  const resolve = async (refund: boolean) => {
    if (!openId) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_resolve_dispute", { p_id: openId, p_refund: refund, p_note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(refund ? "Dana dikembalikan ke pembeli" : "Dana dilepas ke seller");
    setNote("");
    qc.invalidateQueries({ queryKey: ["disputes"] });
    qc.invalidateQueries({ queryKey: ["dispute", openId] });
  };
  const d = one.data?.dispute;
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden"><Chips value={filter} onChange={setFilter} items={[["aktif", "Aktif"], ["ditinjau", "Diteruskan seller"], ["all", "Semua"]]} /></div>
        <Refresh q={list} />
      </div>
      <p className="text-xs text-muted-foreground">Laporan pembeli atas pesanan. Dana pesanan ditahan selama dispute aktif. Refund mengembalikan dana ke Saldo Marketku pembeli; lepas dana meneruskannya ke seller.</p>
      {list.isPending ? <Loading label="Memuat dispute..." /> : rows.length === 0 ? <Empty text="Tidak ada dispute di sini." /> : rows.map((r) => {
        const st = DISPUTE_STATUS[r.status as DisputeStatus] ?? DISPUTE_STATUS.ditutup;
        return (
          <button key={r.id} onClick={() => setOpenId(r.id)} className="w-full rounded-2xl border bg-card p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{r.orders?.order_items.map((i) => i.product_name).join(", ")}</p><p className="text-xs text-muted-foreground">M-{r.orders?.order_no} • {r.code} • {fmtDate(r.created_at)}</p></div>
              <Pill tone={tone(st.tone)}>{st.label}</Pill>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{r.orders?.buyer_name ?? "Pembeli"} → {r.orders?.store_name ?? "Seller"} • {rupiah(Number(r.orders?.total ?? 0))}</p>
            <p className="mt-1 line-clamp-2 text-xs">{r.reasons.join(", ")}</p>
          </button>
        );
      })}
      {openId && (
        <Sheet title={d ? `Dispute M-${d.orders?.order_no}` : "Dispute"} onClose={() => setOpenId(null)}>
          {!d ? <Loading label="Memuat..." /> : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{d.reasons.join(", ")}{d.note ? ` · ${d.note}` : ""}</p>
              <div className="rounded-xl border p-2"><DisputeThread disputeId={d.id} status={d.status} messages={one.data?.messages ?? []} uid={user?.id} compact /></div>
              {isDisputeActive(d.status) && (
                <>
                  <label className="block text-xs font-semibold text-muted-foreground">Catatan keputusan<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. bukti pembeli valid" className={inputCls} /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={busy} onClick={() => void resolve(true)} className="flex items-center justify-center gap-1 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive"><X className="h-4 w-4" /> Refund pembeli</button>
                    <button disabled={busy} onClick={() => void resolve(false)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"><Check className="h-4 w-4" /> Lepas ke seller</button>
                  </div>
                </>
              )}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
