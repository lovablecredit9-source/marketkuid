import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Megaphone, Layers, Clock, BarChart3, Wallet, PlusCircle, ArrowRight, ArrowLeft, RefreshCw, Eye, MousePointerClick,
  TrendingUp, Info, Gift, QrCode, Ticket, Tag, AlertTriangle, AlertCircle, Lock, XCircle, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProducts } from "@/lib/products";
import { SellerCard, SellerInput, rpSeller } from "@/components/marketku/seller-ui";
import { dbError, fmtDateTime } from "@/lib/market";
import { AD_FILTERS, AD_MAX_DAYS, AD_MIN_DAYS, AD_MIN_TOPUP, AD_PRICE_PER_DAY, AD_STATUS, adCost, parseKeywords, validateAd, type MatchMode } from "@/lib/ads";
import { pageMeta } from "@/lib/meta";

const TABS = ["dashboard", "campaign", "buat", "performa", "saldo"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/seller/iklan")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (TABS.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {}),
  head: () => pageMeta("Dashboard Iklan — Seller Center Marketku", "Ringkasan campaign bersponsor, saldo iklan, dan performa iklan toko kamu."),
  component: Iklan,
});

function Head({ icon: I, title, desc, onReload }: { icon: LucideIcon; title: string; desc: string; onReload?: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-xl font-bold"><I className="h-5 w-5" /> {title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      {onReload && (
        <button onClick={onReload} className="flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm leading-tight transition active:scale-95">
          <RefreshCw className="h-3.5 w-3.5" /> <span>Muat<br />ulang</span>
        </button>
      )}
    </div>
  );
}

function Big({ icon: I, tone, label, value, desc }: { icon: LucideIcon; tone: string; label: string; value: string; desc?: string }) {
  return (
    <SellerCard className="p-5">
      <p className="flex items-center gap-2.5 text-xs font-semibold tracking-wider text-foreground/80"><I className={`h-4 w-4 ${tone}`} /> {label}</p>
      <p className="mt-4 text-xl font-bold">{value}</p>
      {desc && <p className="mt-2 text-sm text-foreground/75">{desc}</p>}
    </SellerCard>
  );
}

function Nav({ icon: I, title, desc, onClick }: { icon: LucideIcon; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl border bg-card px-5 py-4 text-left transition active:scale-[0.98]">
      <I className="h-5 w-5 shrink-0 text-primary" />
      <span className="flex-1"><span className="block font-semibold">{title}</span><span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span></span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return <div className="px-6 py-10 text-center"><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{desc}</p></div>;
}

function useAdData() {
  const { user } = useAuth();
  const camps = useQuery({
    queryKey: ["ad_campaigns", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("ad_campaigns").select("*, products(name)").eq("owner_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const wallet = useQuery({
    queryKey: ["ad_wallet", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("ad_wallets").select("paid, promo").eq("owner_id", user!.id).maybeSingle()).data ?? { paid: 0, promo: 0 },
  });
  const ledger = useQuery({
    queryKey: ["ad_ledger", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("ad_wallet_ledger").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  return { camps, wallet, ledger };
}
type Camp = NonNullable<ReturnType<typeof useAdData>["camps"]["data"]>[number];

function Iklan() {
  const { tab = "dashboard" } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { camps, wallet, ledger } = useAdData();
  const rows = camps.data ?? [];
  const paid = Number(wallet.data?.paid ?? 0), promo = Number(wallet.data?.promo ?? 0);
  const go = (t: Tab) => navigate({ to: "/seller/iklan", search: t === "dashboard" ? {} : { tab: t } });
  const reload = () => {
    for (const k of ["ad_campaigns", "ad_wallet", "ad_ledger"]) void qc.invalidateQueries({ queryKey: [k, user?.id] });
    toast.success("Data iklan dimuat ulang");
  };
  const live = rows.filter((r) => r.status === "aktif");
  const waiting = rows.filter((r) => r.status === "menunggu" || r.status === "menunggu_saldo");
  const spend = rows.reduce((a, r) => a + Number(r.spend), 0);
  const back = tab !== "dashboard" && (
    <button onClick={() => go("dashboard")} className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" /> Dashboard Iklan</button>
  );

  if (tab === "buat") return <>{back}<CreateAd balance={paid + promo} onDone={() => { reload(); go("campaign"); }} /></>;
  if (tab === "campaign") return <>{back}<Campaigns rows={rows} onReload={reload} /></>;
  if (tab === "saldo") return <>{back}<Saldo paid={paid} promo={promo} ledger={ledger.data ?? []} onReload={reload} /></>;

  if (tab === "performa") {
    const imp = rows.reduce((a, r) => a + r.impressions, 0), clk = rows.reduce((a, r) => a + r.clicks, 0);
    const held = waiting.reduce((a, r) => a + Number(r.total_cost), 0);
    const ranked = [...rows].filter((r) => Number(r.spend) > 0).sort((a, b) => Number(b.spend) - Number(a.spend));
    return (
      <>
        {back}
        <Head icon={TrendingUp} title="Performa Iklan" desc="Diukur dari belanja dan pemakaian anggaran tiap campaign." onReload={reload} />
        <Big icon={Eye} tone="text-primary" label="IMPRESI" value={imp.toLocaleString("id-ID")} desc="Berapa kali iklan kamu tampil ke pembeli." />
        <Big icon={MousePointerClick} tone="text-primary" label="KLIK" value={clk.toLocaleString("id-ID")} desc="Jumlah pembeli yang membuka produk dari iklan." />
        <Big icon={TrendingUp} tone="text-success" label="CTR" value={`${imp ? ((clk / imp) * 100).toFixed(1) : "0.0"}%`} desc="Klik dibagi impresi." />
        <Big icon={BarChart3} tone="text-primary" label="TOTAL BELANJA" value={rpSeller(spend)} desc="Gabungan belanja saldo dibayar dan promo." />
        <Big icon={Layers} tone="text-primary" label="DANA DITAHAN" value={rpSeller(held)} desc="Reservasi campaign yang belum terpakai." />
        <Big icon={TrendingUp} tone="text-success" label="CAMPAIGN AKTIF" value={String(live.length)} />
        <SellerCard className="flex gap-3 p-4 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0" /> Impresi dan klik mulai terkumpul setelah campaign kamu tayang di pencarian atau halaman utama. Sebelum itu, hanya belanja dan pemakaian anggaran yang tampil.</SellerCard>
        <SellerCard className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3"><b>Rincian per Campaign</b><span className="text-xs text-muted-foreground">Diurutkan dari belanja terbanyak</span></div>
          {ranked.length ? ranked.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0">
              <span className="min-w-0"><b className="block truncate">{r.products?.name ?? r.name}</b><span className="text-xs text-muted-foreground">{r.impressions} impresi · {r.clicks} klik</span></span>
              <span className="shrink-0 font-semibold">{rpSeller(Number(r.spend))}</span>
            </div>
          )) : <Empty title="Belum ada data performa" desc="Angka belanja akan muncul setelah campaign kamu mulai tayang." />}
        </SellerCard>
      </>
    );
  }

  return (
    <>
      <Head icon={Megaphone} title="Dashboard Iklan" desc="Ringkasan campaign bersponsor, saldo iklan, dan aksi cepat." onReload={reload} />
      <Big icon={Layers} tone="text-primary" label="TOTAL CAMPAIGN" value={String(rows.length)} />
      <Big icon={Megaphone} tone="text-success" label="CAMPAIGN AKTIF" value={String(live.length)} />
      <Big icon={Clock} tone="text-warning" label="MENUNGGU / ANTREAN" value={String(waiting.length)} />
      <Big icon={BarChart3} tone="text-primary" label="TOTAL BELANJA IKLAN" value={rpSeller(spend)} desc="Gabungan saldo dibayar dan promo yang sudah terpakai." />
      <Big icon={Wallet} tone="text-success" label="SALDO IKLAN TERSEDIA" value={rpSeller(paid + promo)} desc="Gabungan saldo dibayar dan saldo promo." />
      <Nav icon={PlusCircle} title="Buat Iklan" desc="Pesan slot bersponsor baru." onClick={() => go("buat")} />
      <Nav icon={Layers} title="Kelola Campaign" desc="Lihat dan batalkan campaign." onClick={() => go("campaign")} />
      <Nav icon={TrendingUp} title="Performa Iklan" desc="Impresi, klik, dan belanja tiap campaign." onClick={() => go("performa")} />
      <Nav icon={Wallet} title="Saldo Iklan" desc="Top up dan klaim voucher." onClick={() => go("saldo")} />
      <SellerCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <b>Campaign Terbaru</b>
          <button onClick={() => go("campaign")} className="flex items-center gap-1 text-sm font-semibold text-primary">Lihat semua <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        {rows.length ? rows.slice(0, 3).map((r) => <CampRow key={r.id} r={r} />) : <Empty title="" desc="Belum ada campaign. Mulai dengan membuat iklan pertama kamu." />}
      </SellerCard>
    </>
  );
}

function StatusPill({ s }: { s: string }) {
  const tone = s === "aktif" ? "border-success/40 text-success" : s === "dibatalkan" ? "border-destructive/40 text-destructive" : s === "selesai" ? "border-border text-muted-foreground" : "border-warning/40 text-warning";
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{AD_STATUS[s] ?? s}</span>;
}

function CampRow({ r, action }: { r: Camp; action?: ReactNode }) {
  return (
    <div className="space-y-1.5 border-b px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <b className="min-w-0 truncate">{r.products?.name ?? r.name}</b>
        <StatusPill s={r.status} />
      </div>
      <p className="text-xs text-muted-foreground">
        {r.duration_days ? `${r.duration_days} hari · ` : ""}{rpSeller(Number(r.total_cost || r.spend))} · {r.match_mode === "persis" ? "Sama persis" : "Frasa"}
      </p>
      {r.keywords.length > 0 && <div className="flex flex-wrap gap-1">{r.keywords.map((k) => <span key={k} className="rounded-md border px-1.5 py-0.5 text-[11px]">{k}</span>)}</div>}
      <p className="text-xs text-muted-foreground">{r.live_until ? `Tayang s/d ${fmtDateTime(r.live_until)}` : `Dibuat ${fmtDateTime(r.created_at)}`} · {r.impressions} impresi · {r.clicks} klik</p>
      {action}
    </div>
  );
}

function Campaigns({ rows, onReload }: { rows: Camp[]; onReload: () => void }) {
  const [f, setF] = useState<(typeof AD_FILTERS)[number]["value"]>("semua");
  const [busy, setBusy] = useState<string | null>(null);
  const shown = rows.filter((r) => { const st = AD_FILTERS.find((x) => x.value === f)!.statuses as readonly string[]; return !st.length || st.includes(r.status); });
  const cancel = async (r: Camp) => {
    if (!window.confirm(r.status === "aktif" ? "Batalkan campaign? Sisa hari penuh dikembalikan ke saldo iklan." : "Batalkan campaign? Dana dikembalikan ke saldo iklan.")) return;
    setBusy(r.id);
    const { data, error } = await supabase.rpc("cancel_ad_campaign", { p_id: r.id });
    setBusy(null);
    if (error) { toast.error(dbError(error)); return; }
    toast.success(Number(data) > 0 ? `Campaign dibatalkan, ${rpSeller(Number(data))} dikembalikan` : "Campaign dibatalkan");
    onReload();
  };
  return (
    <>
      <Head icon={Layers} title="Campaign Iklan" desc="Semua slot bersponsor yang pernah kamu pesan." onReload={onReload} />
      <div className="flex flex-wrap gap-2">
        {AD_FILTERS.map((x) => {
          const n = rows.filter((r) => !x.statuses.length || (x.statuses as readonly string[]).includes(r.status)).length;
          return (
            <button key={x.value} onClick={() => setF(x.value)} className={`rounded-full border px-3.5 py-2 text-sm transition active:scale-95 ${f === x.value ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
              {x.label} <span className="ml-1 opacity-80">{n}</span>
            </button>
          );
        })}
      </div>
      <SellerCard className="overflow-hidden">
        {shown.length ? shown.map((r) => (
          <CampRow key={r.id} r={r} action={["aktif", "menunggu", "menunggu_saldo", "dijeda"].includes(r.status) && (
            <button disabled={busy === r.id} onClick={() => void cancel(r)} className="mt-1 flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Batalkan</button>
          )} />
        )) : <Empty title="Belum ada campaign di kategori ini" desc="Ubah filter atau buat iklan baru." />}
      </SellerCard>
    </>
  );
}

function Saldo({ paid, promo, ledger, onReload }: { paid: number; promo: number; ledger: { id: string; kind: string; paid_delta: number; promo_delta: number; note: string | null; created_at: string }[]; onReload: () => void }) {
  const [nominal, setNominal] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const invoice = () => {
    const n = Number(nominal.replace(/\D/g, ""));
    if (!(n >= AD_MIN_TOPUP)) { toast.error(`Minimal top up ${rpSeller(AD_MIN_TOPUP)}`); return; }
    toast.error("Pembayaran QRIS Marketku belum terhubung, jadi invoice belum bisa dibuat. Gunakan voucher saldo iklan untuk sementara.");
  };
  const claim = async () => {
    if (!code.trim()) { toast.error("Masukkan kode voucher"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_ad_voucher", { p_code: code });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success(`Voucher diklaim, saldo promo +${rpSeller(Number(data))}`);
    setCode(""); onReload();
  };
  return (
    <>
      <Head icon={Megaphone} title="Saldo Iklan" desc="Saldo untuk membeli slot bersponsor di pencarian dan halaman utama." onReload={onReload} />
      <Big icon={Wallet} tone="text-success" label="SALDO DIBAYAR" value={rpSeller(paid)} desc="Dari top up. Dikembalikan ke saldo jika campaign dibatalkan sebelum tayang." />
      <Big icon={Gift} tone="text-primary" label="SALDO PROMO" value={rpSeller(promo)} desc="Dari voucher atau pemberian admin. Tidak bisa dicairkan." />
      <SellerCard className="space-y-3 p-4">
        <p className="flex items-center gap-2 font-semibold"><QrCode className="h-4 w-4" /> Top Up via QRIS</p>
        <p className="text-xs text-muted-foreground">Saldo bertambah otomatis setelah pembayaran terkonfirmasi.</p>
        <SellerInput inputMode="numeric" value={nominal} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 9); setNominal(d ? Number(d).toLocaleString("id-ID") : ""); }} placeholder="Nominal" />
        <p className="text-xs text-muted-foreground">Minimal {rpSeller(AD_MIN_TOPUP)}.</p>
        <button onClick={invoice} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]">Buat Invoice</button>
      </SellerCard>
      <SellerCard className="space-y-3 p-4">
        <p className="flex items-center gap-2 font-semibold"><Ticket className="h-4 w-4" /> Klaim Voucher</p>
        <p className="text-xs text-muted-foreground">Masukkan kode voucher saldo iklan yang kamu terima.</p>
        <SellerInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32))} placeholder="Kode voucher" />
        <button disabled={busy} onClick={() => void claim()} className="w-full rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50">{busy ? "Mengklaim..." : "Klaim"}</button>
      </SellerCard>
      <SellerCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3"><b>Riwayat Saldo Iklan</b><span className="text-xs text-muted-foreground">{ledger.length} mutasi</span></div>
        {ledger.length ? ledger.map((l) => {
          const d = Number(l.paid_delta) + Number(l.promo_delta);
          return (
            <div key={l.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0">
              <span className="min-w-0"><b className="block truncate">{l.note ?? l.kind}</b><span className="text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span></span>
              <span className={`shrink-0 font-semibold ${d >= 0 ? "text-success" : "text-destructive"}`}>{d >= 0 ? "+" : "-"}{rpSeller(Math.abs(d))}</span>
            </div>
          );
        }) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada mutasi saldo iklan.</p>}
      </SellerCard>
    </>
  );
}

function CreateAd({ balance, onDone }: { balance: number; onDone: () => void }) {
  const { user } = useAuth();
  const products = useMyProducts(user?.id);
  const opts = useMemo(() => (products.data ?? []).map((p) => {
    const stock = (p.product_stock ?? []).filter((s) => s.status === "available").length;
    const ok = p.status === "active" && (stock > 0 || p.product_type === "preorder");
    return { id: p.id, name: p.name, ok };
  }), [products.data]);
  const anyOk = opts.some((o) => o.ok);
  const [productId, setProductId] = useState("");
  const [kw, setKw] = useState("");
  const [mode, setMode] = useState<MatchMode>("frasa");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const d = Number(days);
  const total = adCost(d);
  const short = balance < total;
  const submit = async () => {
    const keywords = parseKeywords(kw);
    const errs = validateAd({ product_id: productId, keywords, days: d, balance });
    if (errs.length) { toast.error(errs[0]); return; }
    setBusy(true);
    const { error } = await supabase.rpc("create_ad_campaign", { p_product: productId, p_keywords: keywords, p_mode: mode, p_days: d });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Iklan dipesan. Campaign tayang begitu slot tersedia.");
    onDone();
  };
  const Mode = ({ v, title, desc }: { v: MatchMode; title: string; desc: string }) => (
    <button onClick={() => setMode(v)} className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${mode === v ? "border-primary" : ""}`}>
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${mode === v ? "border-primary" : "border-foreground/60"}`}>{mode === v && <span className="h-2 w-2 rounded-full bg-primary" />}</span>
      <span><b className="block text-sm">{title}</b><span className="text-xs text-muted-foreground">{desc}</span></span>
    </button>
  );
  return (
    <>
      <Head icon={PlusCircle} title="Buat Iklan" desc="Pesan slot bersponsor untuk produk kamu di pencarian dan halaman utama." />
      <SellerCard className="space-y-3 p-4">
        <div><b className="text-sm">Produk</b><p className="text-xs text-muted-foreground">Pilih produk yang mau diiklankan.</p></div>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-xl border border-primary/60 bg-background/60 px-3 py-3 text-sm outline-none">
          <option value="">— Pilih produk —</option>
          {opts.map((o) => <option key={o.id} value={o.id} disabled={!o.ok}>{o.name}{o.ok ? "" : " — Produk belum memenuhi syarat iklan"}</option>)}
        </select>
        {!products.isLoading && !anyOk && (
          <p className="flex gap-2 rounded-xl border border-warning/50 bg-warning/10 p-3 text-xs text-foreground/90"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> Belum ada produk yang memenuhi syarat iklan. Produk harus aktif dan punya stok tersedia.</p>
        )}
      </SellerCard>
      <SellerCard className="space-y-3 p-4">
        <div><b className="flex items-center gap-2 text-sm"><Tag className="h-4 w-4" /> Kata Kunci</b><p className="text-xs text-muted-foreground">Pisahkan dengan koma. Contoh: netflix, akun premium, streaming.</p></div>
        <SellerInput value={kw} onChange={(e) => setKw(e.target.value.slice(0, 400))} placeholder="kata kunci 1, kata kunci 2" />
      </SellerCard>
      <SellerCard className="space-y-2 p-4">
        <b className="text-sm">Mode Pencocokan</b>
        <Mode v="persis" title="Sama persis" desc="Tayang hanya jika pencarian sama persis dengan kata kunci." />
        <Mode v="frasa" title="Frasa" desc="Tayang jika kata kunci muncul di dalam pencarian." />
      </SellerCard>
      <SellerCard className="space-y-2 p-4">
        <b className="text-sm">Durasi (hari)</b>
        <SellerInput inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        <p className="text-xs text-muted-foreground">Antara {AD_MIN_DAYS} sampai {AD_MAX_DAYS} hari.</p>
      </SellerCard>
      <SellerCard className="p-4">
        <b className="text-sm">Mulai tayang otomatis</b>
        <p className="mt-1 text-xs text-muted-foreground">Campaign langsung tayang jika slot tersedia. Jika penuh, durasi dimulai setelah mendapat slot. Tidak perlu mengisi tanggal atau jam.</p>
      </SellerCard>
      <SellerCard className="space-y-3 p-4 text-sm">
        <b>Perkiraan Biaya</b>
        <p className="flex justify-between text-muted-foreground">Harga per hari <span className="font-semibold text-foreground">{rpSeller(AD_PRICE_PER_DAY)}</span></p>
        <p className="flex justify-between text-muted-foreground">Durasi <span className="font-semibold text-foreground">{d || 0} hari</span></p>
        <p className="flex justify-between border-t pt-3 font-bold">Total <span>{rpSeller(total)}</span></p>
        <p className="flex justify-between text-muted-foreground">Saldo iklan tersedia <span className={`font-semibold ${short ? "text-destructive" : "text-success"}`}>{rpSeller(balance)}</span></p>
        {short && total > 0 && <p className="flex gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs"><AlertCircle className="h-4 w-4 shrink-0 text-destructive" /> Saldo iklan belum cukup untuk total ini. Isi saldo iklan dulu di menu Saldo Iklan.</p>}
        <button disabled={busy || short || !total} onClick={() => void submit()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50">
          {short ? <><Lock className="h-4 w-4" /> Saldo tidak cukup</> : busy ? "Memesan..." : "Pasang Iklan"}
        </button>
        <p className="text-xs text-muted-foreground">Dana ditahan saat memesan dan dikembalikan bila campaign dibatalkan sebelum tayang.</p>
      </SellerCard>
    </>
  );
}
