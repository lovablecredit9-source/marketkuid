import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Plus, Clock, XCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProducts } from "@/lib/products";
import { dbError, fmtDateTime } from "@/lib/market";
import { countdown, flashPhase, FLASH_MAX_HOURS, FLASH_MAX_PERCENT, validateFlash, type FlashPhase } from "@/lib/flash";
import { useNow } from "@/components/marketku/flash-strip";
import { Chips, SellerCard, SellerEmpty, SellerInput, SellerPageTitle, SellerSheet } from "@/components/marketku/seller-ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/flash-sale")({
  head: () => pageMeta("Flash Sale — Seller Center Marketku", "Jadwalkan flash sale produk dengan diskon, durasi, dan kuota terbatas."),
  component: SellerFlashSale,
});

type Filter = "semua" | "live" | "upcoming" | "ended";
type Row = { id: string; product_id: string; percent: number; starts_at: string; ends_at: string; quota: number | null; sold: number; status: string; created_at: string };
const PHASE_LABEL: Record<FlashPhase | "cancelled", [string, string]> = {
  live: ["Berlangsung", "bg-success/15 text-success"],
  upcoming: ["Terjadwal", "bg-primary/15 text-primary"],
  soldout: ["Kuota Habis", "bg-warning/20 text-warning"],
  ended: ["Selesai", "bg-muted text-muted-foreground"],
  cancelled: ["Dibatalkan", "bg-destructive/15 text-destructive"],
};

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function SellerFlashSale() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("semua");
  const [open, setOpen] = useState(false);
  const products = useMyProducts(user?.id);
  const list = useQuery({
    queryKey: ["my_flash_sales", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("flash_sales").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const names = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p.name])), [products.data]);
  const rows = list.data ?? [];
  const phaseOf = (r: Row): FlashPhase | "cancelled" => (r.status === "cancelled" ? "cancelled" : flashPhase(r, now));
  const counts = { live: 0, upcoming: 0, ended: 0 };
  for (const r of rows) { const ph = phaseOf(r); if (ph === "live" || ph === "soldout") counts.live++; else if (ph === "upcoming") counts.upcoming++; else counts.ended++; }
  const shown = rows.filter((r) => {
    const ph = phaseOf(r);
    if (filter === "live") return ph === "live" || ph === "soldout";
    if (filter === "upcoming") return ph === "upcoming";
    if (filter === "ended") return ph === "ended" || ph === "cancelled";
    return true;
  });

  const cancel = async (r: Row) => {
    if (!window.confirm("Batalkan flash sale ini? Harga kembali normal.")) return;
    const { error } = await supabase.rpc("cancel_flash_sale", { p_id: r.id });
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Flash sale dibatalkan");
    void qc.invalidateQueries({ queryKey: ["my_flash_sales"] });
    void qc.invalidateQueries({ queryKey: ["flash_sales"] });
    void qc.invalidateQueries({ queryKey: ["market_products"] });
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <SellerPageTitle icon={Zap} title="Flash Sale" desc="Jadwalkan diskon kilat dengan waktu & kuota terbatas. Tampil di halaman Flash Sale pembeli."
        right={<button onClick={() => setOpen(true)} className="seller-tap flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Buat</button>} />

      <SellerCard className="grid grid-cols-3 divide-x">
        {[["Berlangsung", counts.live], ["Terjadwal", counts.upcoming], ["Selesai", counts.ended]].map(([l, n]) => (
          <div key={l} className="px-3 py-3 text-center"><p className="text-lg font-semibold">{n}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
        ))}
      </SellerCard>

      <Chips<Filter> value={filter} onChange={setFilter} items={[
        { value: "semua", label: "Semua" }, { value: "live", label: "Berlangsung" }, { value: "upcoming", label: "Terjadwal" }, { value: "ended", label: "Selesai" },
      ]} />

      {list.isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl border bg-card" />)}</div>
      ) : shown.length ? (
        <div className="space-y-3">
          {shown.map((r) => {
            const ph = phaseOf(r);
            const [label, cls] = PHASE_LABEL[ph];
            const canCancel = ph === "live" || ph === "upcoming" || ph === "soldout";
            return (
              <SellerCard key={r.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold leading-snug">{names.get(r.product_id) ?? "Produk"}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Diskon</p><p className="font-semibold text-destructive">-{r.percent}%</p></div>
                  <div><p className="text-muted-foreground">Terjual</p><p className="font-semibold">{r.sold}{r.quota ? `/${r.quota}` : ""}</p></div>
                  <div><p className="text-muted-foreground">Kuota</p><p className="font-semibold">{r.quota ?? "Tanpa batas"}</p></div>
                </div>
                <p className="mt-2 text-[11.5px] text-muted-foreground">{fmtDateTime(r.starts_at)} – {fmtDateTime(r.ends_at)}</p>
                {(ph === "live" || ph === "upcoming") && (
                  <p className="mt-1 flex items-center gap-1 text-[11.5px]"><Clock className="h-3.5 w-3.5" /> {ph === "live" ? "Berakhir dalam" : "Mulai dalam"} <b className="font-mono">{countdown(+new Date(ph === "live" ? r.ends_at : r.starts_at) - now)}</b></p>
                )}
                {canCancel && (
                  <button onClick={() => void cancel(r)} className="seller-tap mt-3 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"><XCircle className="h-3.5 w-3.5" /> Batalkan</button>
                )}
              </SellerCard>
            );
          })}
        </div>
      ) : (
        <SellerCard>
          <SellerEmpty icon={Zap} title="Belum ada flash sale" desc="Buat flash sale untuk memberi diskon kilat pada produk aktif kamu."
            action={<button onClick={() => setOpen(true)} className="seller-tap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Buat Flash Sale</button>} />
        </SellerCard>
      )}

      <CreateSheet open={open} onOpenChange={setOpen} products={(products.data ?? []).filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}

function CreateSheet({ open, onOpenChange, products }: { open: boolean; onOpenChange: (v: boolean) => void; products: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [percent, setPercent] = useState("20");
  const [start, setStart] = useState(() => localInput(new Date()));
  const [hours, setHours] = useState("6");
  const [quota, setQuota] = useState("");
  const [busy, setBusy] = useState(false);
  const draft = { productId, percent: Number(percent), startsAt: new Date(start), hours: Number(hours), quota: quota.trim() ? Number(quota) : null };
  const err = validateFlash(draft);

  const submit = async () => {
    if (err) { toast.error(err); return; }
    setBusy(true);
    const { error } = await supabase.rpc("create_flash_sale", {
      p_product: productId, p_percent: draft.percent, p_starts: draft.startsAt.toISOString(), p_hours: draft.hours,
      // SQL takes NULL for "no quota"; generated types mark the arg as required number.
      p_quota: draft.quota ?? (null as unknown as number),
    });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Flash sale dijadwalkan");
    onOpenChange(false);
    setProductId(""); setQuota("");
    void qc.invalidateQueries({ queryKey: ["my_flash_sales"] });
    void qc.invalidateQueries({ queryKey: ["flash_sales"] });
    void qc.invalidateQueries({ queryKey: ["market_products"] });
  };

  return (
    <SellerSheet open={open} onOpenChange={onOpenChange} title="Buat Flash Sale"
      footer={<>
        <button onClick={() => onOpenChange(false)} className="seller-tap rounded-xl border px-4 py-2.5 text-sm font-semibold">Batal</button>
        <button onClick={() => void submit()} disabled={busy || !!err} className="seller-tap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Menyimpan…" : "Jadwalkan"}</button>
      </>}>
      {!products.length ? (
        <SellerEmpty icon={Package} title="Belum ada produk aktif" desc="Publish produk dulu sebelum membuat flash sale."
          action={<Link to="/seller/produk" className="seller-tap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Kelola Produk</Link>} />
      ) : (
        <div className="space-y-3.5">
          <label className="block text-sm font-medium">Produk
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary">
              <option value="">Pilih produk aktif</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Diskon flash (%)
            <SellerInput className="mt-1.5" type="number" min={1} max={FLASH_MAX_PERCENT} value={percent} onChange={(e) => setPercent(e.target.value)} />
            <span className="mt-1 block text-[11px] text-muted-foreground">1–{FLASH_MAX_PERCENT}%, berlaku setelah diskon varian.</span>
          </label>
          <label className="block text-sm font-medium">Mulai
            <SellerInput className="mt-1.5" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            <span className="mt-1 block text-[11px] text-muted-foreground">Waktu yang sudah lewat = mulai sekarang. Maksimal 30 hari ke depan.</span>
          </label>
          <label className="block text-sm font-medium">Durasi (jam)
            <SellerInput className="mt-1.5" type="number" min={1} max={FLASH_MAX_HOURS} value={hours} onChange={(e) => setHours(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1, 3, 6, 12, 24, 72].map((h) => (
                <button key={h} type="button" onClick={() => setHours(String(h))} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${hours === String(h) ? "border-primary bg-primary text-primary-foreground" : ""}`}>{h} jam</button>
              ))}
            </div>
          </label>
          <label className="block text-sm font-medium">Kuota (opsional)
            <SellerInput className="mt-1.5" type="number" min={1} placeholder="Tanpa batas" value={quota} onChange={(e) => setQuota(e.target.value)} />
            <span className="mt-1 block text-[11px] text-muted-foreground">Jumlah unit yang dapat harga flash. Setelah habis, harga kembali normal.</span>
          </label>
          {err && productId && <p className="text-xs font-medium text-destructive">{err}</p>}
        </div>
      )}
    </SellerSheet>
  );
}
