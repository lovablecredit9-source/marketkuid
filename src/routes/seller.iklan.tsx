import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, LayoutGrid, ListChecks, PlusCircle, BarChart3, Wallet, Pause, Play, Trash2, Eye, MousePointerClick, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProducts, fmtThousands, parsePrice } from "@/lib/products";
import { Chips, SellerCard, SellerEmpty, SellerInput, SellerPageTitle, StatCell, rpSeller } from "@/components/marketku/seller-ui";
import { dbError } from "@/lib/market";
import { validateCampaign } from "@/lib/ads";
import { pageMeta } from "@/lib/meta";

const TABS = ["dashboard", "campaign", "buat", "performa", "saldo"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/seller/iklan")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (TABS.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {}),
  head: () => pageMeta("Iklan — Seller Center Marketku", "Buat dan pantau campaign iklan produk toko kamu di Marketku."),
  component: Iklan,
});

const STATUS_LABEL: Record<string, string> = { menunggu_saldo: "Menunggu saldo", aktif: "Aktif", dijeda: "Dijeda", selesai: "Selesai" };

function Iklan() {
  const { tab = "dashboard" } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const camps = useQuery({
    queryKey: ["ad_campaigns", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("ad_campaigns").select("*, products(name)").eq("owner_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const rows = camps.data ?? [];
  const sum = (k: "impressions" | "clicks" | "spend") => rows.reduce((a, r) => a + Number(r[k]), 0);
  const imp = sum("impressions"), clk = sum("clicks"), spend = sum("spend");
  const go = (t: Tab) => navigate({ to: "/seller/iklan", search: t === "dashboard" ? {} : { tab: t } });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ad_campaigns", user?.id] });

  const setStatus = async (id: string, status: "dijeda" | "menunggu_saldo") => {
    const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", id);
    if (error) toast.error(dbError(error)); else { toast.success("Status campaign diperbarui"); void refresh(); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Hapus campaign ini?")) return;
    const { error } = await supabase.from("ad_campaigns").delete().eq("id", id);
    if (error) toast.error(dbError(error)); else { toast.success("Campaign dihapus"); void refresh(); }
  };

  return (
    <>
      <SellerPageTitle icon={Megaphone} title="Iklan" desc="Promosikan produkmu di beranda dan pencarian Marketku." />
      <Chips value={tab} onChange={go} items={[
        { value: "dashboard", label: "Dashboard Iklan", icon: LayoutGrid }, { value: "campaign", label: "Campaign", icon: ListChecks },
        { value: "buat", label: "Buat Iklan", icon: PlusCircle }, { value: "performa", label: "Performa", icon: BarChart3 }, { value: "saldo", label: "Saldo Iklan", icon: Wallet },
      ]} />

      {tab === "dashboard" && (
        <>
          <SellerCard className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
            <StatCell icon={Wallet} label="Saldo Iklan" value={rpSeller(0)} />
            <StatCell icon={ListChecks} label="Campaign" value={String(rows.length)} sub={`${rows.filter((r) => r.status === "aktif").length} aktif`} />
            <StatCell icon={Eye} label="Tayangan" value={imp.toLocaleString("id-ID")} />
            <StatCell icon={MousePointerClick} label="Klik" value={clk.toLocaleString("id-ID")} />
          </SellerCard>
          <SellerCard className="p-4 text-sm text-muted-foreground">
            Campaign baru tersimpan dengan status <b className="text-foreground">Menunggu saldo</b>. Iklan mulai tayang setelah saldo iklan diisi — pengisian saldo iklan memakai QRIS dan akan aktif setelah pembayaran Marketku terhubung.
          </SellerCard>
          <button onClick={() => go("buat")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground transition active:scale-[0.98]"><PlusCircle className="h-4 w-4" /> Buat Iklan</button>
        </>
      )}

      {tab === "campaign" && (
        <SellerCard className="divide-y overflow-hidden">
          {rows.length === 0 ? <SellerEmpty icon={Megaphone} title="Belum ada campaign" desc="Buat iklan pertama untuk mempromosikan produkmu." action={<button onClick={() => go("buat")} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Buat Iklan Pertama</button>} /> : rows.map((r) => (
            <div key={r.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><b className="block truncate">{r.name}</b><span className="text-xs text-muted-foreground">{r.products?.name} · {r.placement}</span></div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${r.status === "aktif" ? "border-success/40 text-success" : "border-warning/40 text-warning"}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <p className="text-sm">Anggaran harian <b>{rpSeller(Number(r.daily_budget))}</b>{r.starts_at ? ` · ${r.starts_at}${r.ends_at ? ` s/d ${r.ends_at}` : ""}` : ""}</p>
              <div className="flex gap-2">
                {r.status === "dijeda"
                  ? <button onClick={() => void setStatus(r.id, "menunggu_saldo")} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Play className="h-3.5 w-3.5" /> Lanjutkan</button>
                  : <button onClick={() => void setStatus(r.id, "dijeda")} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Pause className="h-3.5 w-3.5" /> Jeda</button>}
                <button onClick={() => void remove(r.id)} className="flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
              </div>
            </div>
          ))}
        </SellerCard>
      )}

      {tab === "buat" && <CreateAd onDone={() => { void refresh(); go("campaign"); }} />}

      {tab === "performa" && (
        <>
          <SellerCard className="grid grid-cols-2 divide-x divide-y overflow-hidden [&>*:nth-child(2)]:border-t-0 [&>*:first-child]:border-t-0">
            <StatCell icon={Eye} label="Tayangan" value={imp.toLocaleString("id-ID")} />
            <StatCell icon={MousePointerClick} label="Klik" value={clk.toLocaleString("id-ID")} />
            <StatCell icon={BarChart3} label="CTR" value={`${imp ? ((clk / imp) * 100).toFixed(1) : "0"}%`} />
            <StatCell icon={Coins} label="Biaya" value={rpSeller(spend)} />
          </SellerCard>
          <SellerCard className="divide-y overflow-hidden">
            {rows.length === 0 ? <SellerEmpty icon={BarChart3} title="Belum ada data performa" desc="Performa tampil setelah iklan mulai tayang." /> : rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm"><span className="min-w-0 truncate font-semibold">{r.name}</span><span className="text-muted-foreground">{r.impressions} tayang · {r.clicks} klik</span></div>
            ))}
          </SellerCard>
        </>
      )}

      {tab === "saldo" && (
        <SellerCard className="space-y-3 p-5">
          <p className="text-sm text-muted-foreground">Saldo iklan</p>
          <p className="text-3xl font-bold">{rpSeller(0)}</p>
          <p className="text-sm text-muted-foreground">Total terpakai {rpSeller(spend)}</p>
          <button onClick={() => toast("Top up saldo iklan memakai QRIS dan aktif setelah pembayaran Marketku terhubung")} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">Top Up Saldo Iklan</button>
          <SellerEmpty icon={Wallet} title="Belum ada riwayat saldo" desc="Riwayat top up dan pemakaian saldo iklan muncul di sini." />
        </SellerCard>
      )}
    </>
  );
}

function CreateAd({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const products = useMyProducts(user?.id);
  const active = (products.data ?? []).filter((p) => p.status === "active");
  const [d, setD] = useState({ name: "", product_id: "", placement: "beranda" as "beranda" | "pencarian" | "semua", budget: "", starts_at: "", ends_at: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const errs = validateCampaign({ name: d.name, product_id: d.product_id, budget: parsePrice(d.budget), starts_at: d.starts_at, ends_at: d.ends_at });
    if (errs.length) { toast.error(errs[0]); return; }
    setBusy(true);
    const { error } = await supabase.from("ad_campaigns").insert({
      owner_id: user!.id, product_id: d.product_id, name: d.name.trim(), placement: d.placement, daily_budget: parsePrice(d.budget),
      starts_at: d.starts_at || null, ends_at: d.ends_at || null,
    });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Campaign dibuat — menunggu saldo iklan");
    onDone();
  };
  return (
    <SellerCard className="space-y-3 p-4">
      <label className="block text-sm font-semibold">Nama campaign<SellerInput value={d.name} onChange={(e) => setD({ ...d, name: e.target.value.slice(0, 60) })} placeholder="Contoh: Promo Akhir Bulan" className="mt-1" /></label>
      <label className="block text-sm font-semibold">Produk
        <select value={d.product_id} onChange={(e) => setD({ ...d, product_id: e.target.value })} className="mt-1 w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary">
          <option value="">{active.length ? "Pilih produk aktif" : "Belum ada produk aktif"}</option>
          {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <div className="text-sm font-semibold">Penempatan
        <div className="mt-1"><Chips value={d.placement} onChange={(v) => setD({ ...d, placement: v })} items={[{ value: "beranda", label: "Beranda" }, { value: "pencarian", label: "Pencarian" }, { value: "semua", label: "Semua" }]} /></div>
      </div>
      <label className="block text-sm font-semibold">Anggaran harian (Rp)<SellerInput inputMode="numeric" value={fmtThousands(d.budget)} onChange={(e) => setD({ ...d, budget: e.target.value })} placeholder="Min. 5.000" className="mt-1" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-semibold">Mulai<SellerInput type="date" value={d.starts_at} onChange={(e) => setD({ ...d, starts_at: e.target.value })} className="mt-1" /></label>
        <label className="block text-sm font-semibold">Selesai<SellerInput type="date" value={d.ends_at} onChange={(e) => setD({ ...d, ends_at: e.target.value })} className="mt-1" /></label>
      </div>
      <button disabled={busy} onClick={() => void save()} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">Simpan Campaign</button>
    </SellerCard>
  );
}
