import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, LayoutDashboard, Package, QrCode, Receipt, RefreshCw, Search, ShieldCheck, Store, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, rupiah } from "@/components/marketku/shell";
import { LoadingLine } from "@/components/marketku/loading";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/meta";
import { DEPOSIT_STATUS, uploadPaymentImage, useIsAdmin, usePaymentSettings, usePaymentUrls } from "@/lib/wallet";

export const Route = createFileRoute("/admin")({
  head: () => ({ ...pageMeta("Admin Panel — Marketku", "Panel admin Marketku untuk deposit, QRIS, pengguna, toko, produk, dan pesanan."), meta: [...pageMeta("Admin Panel — Marketku", "Panel admin Marketku.").meta, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const TABS = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  { key: "deposit", label: "Deposit", icon: Wallet },
  { key: "qris", label: "QRIS", icon: QrCode },
  { key: "pengguna", label: "Pengguna", icon: Users },
  { key: "toko", label: "Toko", icon: Store },
  { key: "produk", label: "Produk", icon: Package },
  { key: "pesanan", label: "Pesanan", icon: Receipt },
] as const;
type Tab = (typeof TABS)[number]["key"];
const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function Admin() {
  const { user, ready } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const [tab, setTab] = useState<Tab>("ringkasan");

  if (!ready || (user && isAdmin.isPending)) return <AppShell title="Admin Panel" nav={false}><LoadingLine label="Memuat panel admin..." className="py-24" /></AppShell>;
  if (!user || !isAdmin.data) return (
    <AppShell title="Admin Panel" nav={false}>
      <div className="px-6 py-20 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">{user ? "Akun ini bukan admin." : "Masuk dengan akun admin untuk membuka panel ini."}</p>
        <Link to={user ? "/" : "/login"} className="mt-4 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">{user ? "Ke Beranda" : "Masuk"}</Link>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Admin Panel" nav={false}>
      <div className="sticky top-[76px] z-20 -mt-1 overflow-x-auto border-b bg-background px-3 py-2">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mk-fade-in space-y-3 px-4 pb-10 pt-3" key={tab}>
        {tab === "ringkasan" && <Overview onGo={setTab} />}
        {tab === "deposit" && <Deposits />}
        {tab === "qris" && <QrisSettings />}
        {tab === "pengguna" && <UsersTab />}
        {tab === "toko" && <StoresTab />}
        {tab === "produk" && <ProductsTab />}
        {tab === "pesanan" && <OrdersTab />}
      </div>
    </AppShell>
  );
}

function Card({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border bg-card p-3 text-left shadow-sm transition active:scale-[0.98]">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground">{label}</p>
      <p className="mk-acc-mono mt-1 text-lg">{value}</p>
    </button>
  );
}

function Refresh({ q }: { q: { refetch: () => unknown; isFetching: boolean } }) {
  return <button aria-label="Muat ulang" onClick={() => q.refetch()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border bg-card"><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></button>;
}

function SearchBar({ value, onChange, q, placeholder }: { value: string; onChange: (v: string) => void; q: { refetch: () => unknown; isFetching: boolean }; placeholder: string }) {
  return (
    <div className="flex gap-2">
      <label className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent py-2 text-sm outline-none" /></label>
      <Refresh q={q} />
    </div>
  );
}

function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const stats = useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_stats"); if (error) throw error; return data as Record<string, number>; },
  });
  if (stats.isPending) return <LoadingLine label="Memuat ringkasan..." className="py-16" />;
  const s = stats.data ?? {};
  return (
    <>
      <div className="flex items-center justify-between"><h1 className="text-base font-semibold">Ringkasan</h1><Refresh q={stats} /></div>
      {(s.deposits_pending ?? 0) > 0 && (
        <button onClick={() => onGo("deposit")} className="w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm font-semibold text-amber-600">{s.deposits_pending} deposit menunggu dicek →</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Card label="PENGGUNA" value={s.users ?? 0} onClick={() => onGo("pengguna")} />
        <Card label="TOKO" value={s.stores ?? 0} onClick={() => onGo("toko")} />
        <Card label="PRODUK" value={s.products ?? 0} onClick={() => onGo("produk")} />
        <Card label="PESANAN" value={s.orders ?? 0} onClick={() => onGo("pesanan")} />
        <Card label="PESANAN SELESAI" value={s.orders_done ?? 0} />
        <Card label="NILAI TRANSAKSI" value={rupiah(s.gmv ?? 0)} />
        <Card label="DEPOSIT MASUK" value={rupiah(s.deposits_approved ?? 0)} onClick={() => onGo("deposit")} />
        <Card label="TOTAL SALDO USER" value={rupiah(s.wallet_total ?? 0)} />
      </div>
    </>
  );
}

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
  const [filter, setFilter] = useState("pending");
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

  const review = async (id: string, approve: boolean) => {
    const note = approve ? null : window.prompt("Alasan ditolak (opsional)") ?? null;
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_deposit", { p_id: id, p_approve: approve, p_note: note ?? undefined });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Deposit disetujui, saldo ditambahkan" : "Deposit ditolak");
    qc.invalidateQueries({ queryKey: ["admin_deposits"] });
    qc.invalidateQueries({ queryKey: ["admin_stats"] });
  };

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto">
        {[["pending", "Menunggu"], ["approved", "Disetujui"], ["rejected", "Ditolak"], ["all", "Semua"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k!)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${filter === k ? "border-primary bg-accent text-primary" : "bg-card text-muted-foreground"}`}>{l}</button>
        ))}
        <div className="ml-auto"><Refresh q={list} /></div>
      </div>
      {list.isPending ? <LoadingLine label="Memuat deposit..." className="py-16" /> : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Belum ada deposit.</p>
      ) : rows.map((d) => {
        const p = profiles.data?.[d.user_id]; const s = DEPOSIT_STATUS[d.status] ?? DEPOSIT_STATUS.pending!; const url = proofs.data?.[d.proof_path];
        return (
          <div key={d.id} className="rounded-2xl border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p?.full_name || p?.username || "Pengguna"} {p?.username && <span className="font-normal text-muted-foreground">@{p.username}</span>}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}{p?.whatsapp ? ` • WA ${p.whatsapp}` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => url && setView(url)} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {url ? <img src={url} alt="Bukti transfer" className="h-full w-full object-cover" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className="mk-acc-mono text-lg">{rupiah(d.amount)}</p>
                {d.admin_note && <p className="text-xs text-muted-foreground">Catatan: {d.admin_note}</p>}
              </div>
            </div>
            {d.status === "pending" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={busy === d.id} onClick={() => review(d.id, false)} className="flex items-center justify-center gap-1 rounded-xl border py-2 text-sm font-semibold text-destructive disabled:opacity-50"><X className="h-4 w-4" /> Tolak</button>
                <button disabled={busy === d.id} onClick={() => review(d.id, true)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Check className="h-4 w-4" /> Setujui</button>
              </div>
            )}
          </div>
        );
      })}
      {view && (
        <button onClick={() => setView(null)} className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 p-4">
          <img src={view} alt="Bukti transfer" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </>
  );
}

function QrisSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = usePaymentSettings();
  const url = usePaymentUrls([settings.data?.qris_path]);
  const [name, setName] = useState("");
  const [instr, setInstr] = useState("");
  const [min, setMin] = useState("10000");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!settings.data) return;
    setName(settings.data.account_name ?? ""); setInstr(settings.data.instructions ?? ""); setMin(String(settings.data.min_deposit));
  }, [settings.data]);

  const save = async (patch: { qris_path?: string }) => {
    setBusy(true);
    const { error } = await supabase.from("payment_settings").update({ account_name: name.trim() || null, instructions: instr.trim() || null, min_deposit: Math.max(1000, Number(min.replace(/\D/g, "") || "10000")), updated_at: new Date().toISOString(), ...patch }).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pengaturan QRIS disimpan");
    qc.invalidateQueries({ queryKey: ["payment_settings"] });
  };
  const upload = async (f: File | undefined) => {
    if (!f || !user) return;
    try { const path = await uploadPaymentImage("qris", f); await save({ qris_path: path }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal upload"); }
  };

  if (settings.isPending) return <LoadingLine label="Memuat QRIS..." className="py-16" />;
  const img = settings.data?.qris_path ? url.data?.[settings.data.qris_path] : undefined;
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <h1 className="text-base font-semibold">QRIS Deposit Manual</h1>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-accent/30 p-4 text-sm text-muted-foreground">
        {img ? <img src={img} alt="QRIS" className="w-full max-w-[220px] rounded-lg bg-white p-2" /> : <ImagePlus className="h-8 w-8 text-primary" />}
        {img ? "Ganti gambar QRIS" : "Upload gambar QRIS"}
      </button>
      <label className="block text-xs font-semibold text-muted-foreground">Nama penerima<input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. MARKETKU" className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></label>
      <label className="block text-xs font-semibold text-muted-foreground">Minimal deposit (Rp)<input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></label>
      <label className="block text-xs font-semibold text-muted-foreground">Petunjuk untuk pembeli<textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={3} placeholder="cth. Transfer sesuai nominal, lalu upload bukti." className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></label>
      <button disabled={busy} onClick={() => save({})} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Menyimpan..." : "Simpan"}</button>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const [{ data: ps, error }, { data: ws }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, whatsapp, created_at, last_seen_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("wallets").select("user_id, balance"),
      ]);
      if (error) throw error;
      const bal = Object.fromEntries((ws ?? []).map((w) => [w.user_id, Number(w.balance)]));
      return (ps ?? []).map((p) => ({ ...p, balance: bal[p.id] ?? 0 }));
    },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((p) => !t || [p.full_name, p.username, p.whatsapp].some((v) => v?.toLowerCase().includes(t)));
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari nama, username, WA" />
      <p className="text-xs text-muted-foreground">{rows.length} pengguna</p>
      {list.isPending ? <LoadingLine label="Memuat pengguna..." className="py-16" /> : rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{(p.full_name || p.username || "?").charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.full_name || "-"} {p.username && <span className="font-normal text-muted-foreground">@{p.username}</span>}</p>
            <p className="truncate text-xs text-muted-foreground">{p.whatsapp ? `WA ${p.whatsapp} • ` : ""}Gabung {new Date(p.created_at).toLocaleDateString("id-ID")}</p>
          </div>
          <p className="mk-acc-mono shrink-0 text-sm">{rupiah(p.balance)}</p>
        </div>
      ))}
    </>
  );
}

function StoresTab() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin_stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_stores").select("owner_id, store_name, slug, is_open, telegram_username, contact_phone, created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw error; return data ?? [];
    },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((s) => !t || [s.store_name, s.slug, s.telegram_username].some((v) => v?.toLowerCase().includes(t)));
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari nama toko" />
      <p className="text-xs text-muted-foreground">{rows.length} toko</p>
      {list.isPending ? <LoadingLine label="Memuat toko..." className="py-16" /> : rows.map((s) => (
        <Link key={s.owner_id} to="/toko/$slug" params={{ slug: s.slug || s.owner_id }} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
          <Store className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{s.store_name}</p>
            <p className="truncate text-xs text-muted-foreground">{s.slug ? `/${s.slug}` : "Tanpa slug"}{s.telegram_username ? ` • @${s.telegram_username}` : ""} • {new Date(s.created_at).toLocaleDateString("id-ID")}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.is_open ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{s.is_open ? "Buka" : "Tutup"}</span>
        </Link>
      ))}
    </>
  );
}

function ProductsTab() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, status, sold_count, owner_id, created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw error; return data ?? [];
    },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((p) => !t || p.name.toLowerCase().includes(t));
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari produk" />
      <p className="text-xs text-muted-foreground">{rows.length} produk</p>
      {list.isPending ? <LoadingLine label="Memuat produk..." className="py-16" /> : rows.map((p) => (
        <Link key={p.id} to="/produk/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
          <Package className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-muted-foreground">Terjual {p.sold_count} • {new Date(p.created_at).toLocaleDateString("id-ID")}</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">{p.status}</span>
        </Link>
      ))}
    </>
  );
}

function OrdersTab() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id, order_no, buyer_name, store_name, status, total, created_at").order("created_at", { ascending: false }).limit(300);
      if (error) throw error; return data ?? [];
    },
  });
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((o) => !t || [o.order_no, o.buyer_name, o.store_name].some((v) => String(v ?? "").toLowerCase().includes(t)));
  return (
    <>
      <SearchBar value={q} onChange={setQ} q={list} placeholder="Cari no. order, pembeli, toko" />
      <p className="text-xs text-muted-foreground">{rows.length} pesanan</p>
      {list.isPending ? <LoadingLine label="Memuat pesanan..." className="py-16" /> : rows.map((o) => (
        <div key={o.id} className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="mk-acc-mono truncate text-sm">#{o.order_no}</p>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">{o.status}</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{o.buyer_name || "Pembeli"} → {o.store_name || "Toko"} • {fmtDate(o.created_at)}</p>
          <p className="mk-acc-mono mt-1 text-base">{rupiah(o.total)}</p>
        </div>
      ))}
    </>
  );
}
