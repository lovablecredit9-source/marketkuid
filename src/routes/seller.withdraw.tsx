import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  Wallet, Repeat, Landmark, Clock, CircleCheck, CircleX, Coins, ListChecks, ChevronRight, Inbox,
  ReceiptText, History, Send, X, Search, CalendarDays, Loader2, Hourglass,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSellerStore } from "@/lib/seller";
import { pageMeta } from "@/lib/meta";
import { supabase } from "@/integrations/supabase/client";
import { SellerCard, SellerEmpty, SellerSheet, rpSeller } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";
import { useSellerBalance, useSellerHolds } from "@/components/marketku/seller-holds";
import {
  MIN_WITHDRAW, WITHDRAW_STATUS, fmtWDate, fmtWDateTime, maskNumber, regularQuotaLeft, useWithdrawals, withdrawQuote, type Withdrawal,
} from "@/lib/withdraw";

export const Route = createFileRoute("/seller/withdraw")({
  head: () => pageMeta("Withdraw — Seller Center Marketku", "Kelola dan pantau penarikan saldo penjualan toko."),
  component: Withdraw,
});

const tour = [
  { title: "Saldo tersedia", desc: "Saldo hasil penjualan yang bisa kamu tarik ke rekening.", target: "w-hero" },
  { title: "Riwayat penarikan", desc: "Semua permintaan tarik dana tercatat di sini.", target: "w-history" },
  { title: "Status saldo", desc: "Lihat komposisi saldo tersedia dan ditahan.", target: "w-status" },
];

type WTab = "semua" | "diproses" | "selesai" | "ditolak";
type ETab = "semua" | "tersedia" | "ditahan" | "sengketa" | "freeze";
const W_MAP: Record<WTab, Withdrawal["status"] | null> = { semua: null, diproses: "pending", selesai: "sent", ditolak: "rejected" };

function useEarnings(uid?: string) {
  return useQuery({
    queryKey: ["seller-earnings", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("wallet_ledger").select("id, amount, ref_id, created_at").eq("user_id", uid!).eq("kind", "sale").order("created_at", { ascending: false }).limit(100);
      const rows = data ?? [];
      const ids = rows.map((r) => r.ref_id).filter(Boolean) as string[];
      const [{ data: os }, { data: items }] = ids.length
        ? await Promise.all([
            supabase.from("orders").select("id, order_no").in("id", ids),
            supabase.from("order_items").select("order_id, product_name").in("order_id", ids),
          ])
        : [{ data: [] }, { data: [] }];
      return rows.map((r) => ({
        id: r.id, amount: Number(r.amount), at: r.created_at,
        order_no: os?.find((o) => o.id === r.ref_id)?.order_no ?? null,
        product: items?.find((i) => i.order_id === r.ref_id)?.product_name ?? "Penjualan",
      }));
    },
  });
}

function Withdraw() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const storeQ = useSellerStore(user?.id);
  const store = storeQ.data;
  const balance = useSellerBalance(user?.id).data ?? 0;
  const holdsList = useSellerHolds(user?.id).data ?? [];
  const held = holdsList.reduce((a, h) => a + Number(h.amount ?? 0), 0);
  const wq = useWithdrawals(user?.id);
  const list = wq.data ?? [];
  const earnings = useEarnings(user?.id).data ?? [];

  const [view, setView] = useState<"penarikan" | "pendapatan">("penarikan");
  const [tab, setTab] = useState<WTab>("semua");
  const [days, setDays] = useState<7 | 30 | 0>(7);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [etab, setEtab] = useState<ETab>("semua");
  const [open, setOpen] = useState(false);
  const [sameDay, setSameDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Withdrawal | null>(null);
  const [saldoDetail, setSaldoDetail] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

  const quota = regularQuotaLeft(list);
  const pending = list.some((w) => w.status === "pending");
  const quote = withdrawQuote(balance, sameDay);
  const bankShort = store?.bank_number ? maskNumber(store.bank_number) : "Belum diisi";
  const bankFull = store?.bank_number ? `${store.bank_provider} ${maskNumber(store.bank_number)}` : "Belum terdaftar";
  const auto = !!(store as { auto_withdraw?: boolean } | undefined)?.auto_withdraw;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
    qc.invalidateQueries({ queryKey: ["seller-balance"] });
  };

  // Auto withdraw runs when Seller Center is opened (after 08:00 WIB, once per day).
  useEffect(() => {
    if (!auto || !user?.id) return;
    void supabase.rpc("auto_withdraw_tick").then(({ data }) => { if (data) { toast.success("Auto Withdraw: permintaan penarikan dibuat"); refresh(); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, user?.id]);

  useEffect(() => { if (open) setSameDay(quota === 0); }, [open, quota]);

  const startTarik = () => {
    if (!store?.bank_number) { toast.error("Daftarkan rekening dulu di Pengaturan → Keuangan"); return; }
    if (pending) { toast.error("Masih ada penarikan yang diproses"); return; }
    if (balance < MIN_WITHDRAW) { toast.error(`Saldo minimal ${rpSeller(MIN_WITHDRAW)} untuk tarik dana`); return; }
    setOpen(true);
  };
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("request_withdrawal", { p_same_day: sameDay });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Permintaan tarik saldo dikirim");
    setOpen(false); refresh();
  };
  const toggleAuto = async () => {
    if (!user?.id) return;
    if (!auto && !store?.bank_number) { toast.error("Daftarkan rekening dulu di Pengaturan → Keuangan"); return; }
    setAutoBusy(true);
    const { error } = await supabase.from("seller_stores").update({ auto_withdraw: !auto } as never).eq("owner_id", user.id);
    setAutoBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(auto ? "Auto Withdraw dinonaktifkan" : "Auto Withdraw diaktifkan");
    qc.invalidateQueries({ queryKey: ["seller-store"] }); void storeQ.refetch?.();
  };

  const filtered = useMemo(() => {
    const st = W_MAP[tab]; const since = days ? Date.now() - days * 864e5 : 0;
    const s = q.replace(/\D/g, "");
    return list.filter((w) => (!st || w.status === st) && new Date(w.created_at).getTime() >= since && (!s || String(w.net).includes(s) || String(w.amount).includes(s)));
  }, [list, tab, days, q]);

  const earnRows = useMemo(() => {
    const avail = earnings.map((e) => ({ key: e.id, amount: e.amount, name: e.product, no: e.order_no, at: e.at, kind: "tersedia" as const }));
    const hold = holdsList.map((h) => ({ key: `h-${h.order_id}`, amount: Number(h.amount), name: h.product_name, no: h.order_no, at: h.completed_at, kind: "ditahan" as const }));
    const all = [...hold, ...avail].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return etab === "semua" ? all : all.filter((r) => r.kind === etab);
  }, [earnings, holdsList, etab]);

  const total = balance + held;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <>
      <div><h2 className="text-lg font-bold">Withdraw</h2><p className="text-xs text-muted-foreground">Kelola dan pantau saldo penjualan toko Anda</p></div>

      <SellerCard className="overflow-hidden">
        <div data-tour="w-hero" className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground">
          <Wallet aria-hidden className="pointer-events-none absolute -right-6 -top-4 h-36 w-36 opacity-15" />
          <p className="relative flex items-center gap-2 text-xs font-semibold"><Wallet className="h-3.5 w-3.5" /> Saldo tersedia</p>
          <p className="relative mt-1.5 text-2xl font-bold">{rpSeller(balance)}</p>
          <button onClick={startTarik} className="relative mt-3 rounded-lg bg-background px-3.5 py-1.5 text-xs font-semibold text-primary shadow transition active:scale-95">Tarik Dana</button>
        </div>
        <div className="grid grid-cols-3 divide-x bg-accent/60 text-center">
          <Mini icon={Hourglass} label="Saldo ditahan" value={rpSeller(held)} sub="Menunggu penyelesaian" />
          <Mini icon={Coins} label="Kuota reguler" value={`${quota}x`} sub={quota ? "Tersedia hari ini" : "Habis, pakai same day"} />
          <Mini icon={Landmark} label="Rekening terdaftar" value={store?.bank_number ? store.bank_provider ?? "" : "Belum diisi"} sub={bankShort} />
        </div>
      </SellerCard>

      {!store?.bank_number && (
        <Link to="/seller/pengaturan" search={{ tab: "keuangan" }} className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <Landmark className="h-4 w-4" /> <span className="flex-1">Daftarkan rekening pencairan dulu</span> <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      <SellerCard data-tour="w-history" className="overflow-hidden">
        <div className="flex justify-end gap-1 border-b p-2">
          <SegBtn on={view === "penarikan"} onClick={() => setView("penarikan")} icon={ReceiptText}>Penarikan</SegBtn>
          <SegBtn on={view === "pendapatan"} onClick={() => setView("pendapatan")} icon={Wallet}>Pendapatan</SegBtn>
        </div>

        {view === "penarikan" ? (
          <>
            <div className="flex items-center gap-3 p-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-primary"><ReceiptText className="h-4 w-4" /></span>
              <div><h3 className="text-sm font-bold">Riwayat penarikan</h3><p className="text-xs text-muted-foreground">Permintaan pencairan dana toko.</p></div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto px-3 pb-3">
              <div className="flex shrink-0 rounded-xl border bg-background/60 p-0.5">
                {(["semua", "diproses", "selesai", "ditolak"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize transition active:scale-95 ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
                ))}
              </div>
              <button onClick={() => setDays((d) => (d === 7 ? 30 : d === 30 ? 0 : 7))} className="flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> {days ? `${days} hari` : "Semua"}
              </button>
              <button aria-label="Cari" onClick={() => setSearching((s) => !s)} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-muted-foreground"><Search className="h-3.5 w-3.5" /></button>
            </div>
            {searching && (
              <div className="px-3 pb-3"><input autoFocus inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nominal…" className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div>
            )}
            <div className="space-y-2 border-t p-3">
              {wq.isPending ? <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</p>
                : filtered.length === 0 ? <SellerEmpty icon={Inbox} title="Belum ada penarikan" desc="Permintaan dengan status ini akan muncul di sini." />
                : filtered.map((w) => {
                  const s = WITHDRAW_STATUS[w.status];
                  return (
                    <button key={w.id} onClick={() => setDetail(w)} className="flex w-full items-center gap-2 rounded-xl border border-primary/60 bg-background/40 p-3 text-left transition active:scale-[0.98]">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{rpSeller(w.net)}</p>
                        <p className="truncate text-xs text-muted-foreground">{w.bank_provider} {maskNumber(w.bank_number)} · {fmtWDate(w.created_at)}</p>
                      </div>
                      <StatusPill s={w.status} label={s.label} cls={s.cls} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
            </div>
            <p className="border-t px-3 py-2.5 text-xs text-muted-foreground">{filtered.length} penarikan</p>
          </>
        ) : (
          <div className="p-3">
            <div className="grid grid-cols-2 gap-2">
              {([["Saldo tersedia", balance], ["Saldo ditahan", held], ["Saldo sengketa", 0], ["Saldo freeze", 0]] as const).map(([l, v]) => (
                <div key={l} className="rounded-xl border bg-background/40 p-2.5"><p className="text-[11px] text-muted-foreground">{l}</p><p className="mt-0.5 text-sm font-bold">{rpSeller(v)}</p></div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Saldo dompet adalah nilai otoritatif. Alokasi transaksi dapat tidak sama dengan saldo freeze setelah pelepasan sebagian oleh admin.</p>
            <div className="mt-2 flex gap-1 overflow-x-auto rounded-xl border bg-background/60 p-0.5">
              {(["semua", "tersedia", "ditahan", "sengketa", "freeze"] as const).map((t) => (
                <button key={t} onClick={() => setEtab(t)} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize transition active:scale-95 ${etab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
            <div className="mt-2 space-y-2">
              {earnRows.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Belum ada pendapatan.</p> : earnRows.map((r) => (
                <div key={r.key} className="rounded-xl border bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold">{rpSeller(r.amount)}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${r.kind === "ditahan" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>{r.kind === "ditahan" ? "Ditahan" : "Tersedia"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold uppercase">{r.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{r.no ? `${r.no} · ` : ""}{fmtWDate(r.at)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{earnRows.length} pendapatan</p>
          </div>
        )}
      </SellerCard>

      <SellerCard className="overflow-hidden">
        <div className="flex items-center gap-3 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-primary"><Repeat className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">Auto Withdraw <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${auto ? "bg-success/15 text-success" : "bg-background"}`}>{auto ? "Aktif" : "Nonaktif"}</span></h3>
            <p className="text-xs text-muted-foreground">Tarik saldo otomatis ke rekening toko.</p>
          </div>
          <button role="switch" aria-checked={auto} aria-label="Auto Withdraw" disabled={autoBusy} onClick={() => void toggleAuto()}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition ${auto ? "border-primary bg-primary" : "bg-background"} disabled:opacity-60`}>
            <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-foreground/80 transition-all ${auto ? "left-[22px] bg-primary-foreground" : "left-0.5"}`} style={{ height: 18, width: 18 }} />
          </button>
        </div>
        <div className="divide-y border-t text-xs">
          <Info icon={Clock} k="Jadwal" v="08:00 WIB · setiap hari" />
          <Info icon={Wallet} k="Minimum saldo" v={`Rp${MIN_WITHDRAW.toLocaleString("id-ID")}`} />
          <Link to="/seller/pengaturan" search={{ tab: "keuangan" }} className="block"><Info icon={Landmark} k="Rekening penerima" v={bankFull} /></Link>
        </div>
        <ul className="m-3 space-y-1.5 rounded-xl bg-success/10 p-3 text-[11px] text-success">
          {["Saldo di bawah Rp50.000 tidak diproses.", "Request pending menunggu persetujuan admin.", "Pengaturan dapat dinonaktifkan kapan saja."].map((t) => <li key={t} className="flex gap-2"><CircleCheck className="h-3.5 w-3.5 shrink-0" />{t}</li>)}
        </ul>
      </SellerCard>

      <SellerCard data-tour="w-status" className="p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-primary"><Coins className="h-4 w-4" /></span>
          <div><h3 className="text-sm font-bold">Status saldo</h3><p className="text-xs text-muted-foreground">Komposisi saldo toko.</p></div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Donut pctAvail={total ? balance / total : 1} label={rpSeller(total)} />
          <div className="flex-1 space-y-2 text-xs">
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" /> <span className="flex-1 text-muted-foreground">Tersedia</span><b>{rpSeller(balance)} · {total ? pct(balance) : 100}%</b></p>
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> <span className="flex-1 text-muted-foreground">Ditahan</span><b>{rpSeller(held)} · {pct(held)}%</b></p>
          </div>
        </div>
        <button onClick={() => setSaldoDetail(true)} className="mt-3 flex w-full items-center justify-between rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-primary transition active:scale-[0.98]">Lihat detail saldo <ChevronRight className="h-4 w-4" /></button>
      </SellerCard>

      <SellerCard className="p-3">
        <h3 className="flex items-center gap-2 text-sm font-bold"><ListChecks className="h-4 w-4 text-primary" /> Cara kerja Auto Withdraw</h3>
        <ol className="mt-3 space-y-2.5 text-xs">
          {["Aktifkan Auto Withdraw.", "Saldo mencapai minimum.", "Sistem memproses jadwal harian.", "Dana dikirim ke rekening terdaftar."].map((t, i) => (
            <li key={t} className="flex items-center gap-2.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>{t}</li>
          ))}
        </ol>
      </SellerCard>

      {/* Tarik saldo */}
      <CenterModal open={open} onClose={() => setOpen(false)} title="Tarik saldo" desc="Seluruh saldo tersedia akan ditarik ke rekening terdaftar.">
        <button onClick={() => quota && setSameDay((s) => !s)} className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${sameDay ? "border-primary" : ""}`}>
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded ${sameDay ? "bg-primary text-primary-foreground" : "border bg-foreground"}`}>{sameDay && <CircleCheck className="h-3.5 w-3.5" />}</span>
          <span>
            <span className="block text-sm font-bold">Same day processing</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{sameDay ? "Diproses di hari yang sama, tiba lebih cepat." : "Penarikan diproses pukul 10.00 WIB. Penarikan setelah jam tersebut diproses keesokan harinya."}</span>
            {!quota && <span className="mt-1 block text-[11px] text-warning">Kuota reguler hari ini sudah dipakai.</span>}
          </span>
        </button>
        <div className="mt-3 space-y-2.5 rounded-xl border p-3 text-sm">
          <Row k="Nominal permintaan" v={rpSeller(quote.amount)} bold />
          <Row k="Komisi" v={rpSeller(quote.commission)} />
          <Row k="Biaya penarikan" v={rpSeller(quote.fee)} />
          <div className="border-t pt-2.5"><Row k="Dana diterima" v={rpSeller(quote.net)} bold strong /></div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Ke {bankFull}{store?.bank_holder ? ` a.n. ${store.bank_holder}` : ""}</p>
        <button disabled={busy} onClick={() => void submit()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Tarik saldo
        </button>
      </CenterModal>

      {/* Detail penarikan */}
      <CenterModal open={!!detail} onClose={() => setDetail(null)} title="Detail penarikan" desc={detail ? `Diajukan ${fmtWDateTime(detail.created_at)}` : ""}>
        {detail && (
          <>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div><p className="text-[11px] text-muted-foreground">Dana diterima</p><p className="text-base font-bold">{rpSeller(detail.net)}</p></div>
              <StatusPill s={detail.status} label={WITHDRAW_STATUS[detail.status].label} cls={WITHDRAW_STATUS[detail.status].cls} />
            </div>
            <div className="mt-2 divide-y rounded-xl border text-xs">
              {([
                ["Nama penerima", detail.bank_holder || "-"],
                ["Nomor rekening", `${detail.bank_provider} ${maskNumber(detail.bank_number)}`],
                ["Nominal permintaan", rpSeller(detail.amount)],
                ["Biaya penarikan", rpSeller(detail.fee)],
                ["Dana diterima", rpSeller(detail.net)],
                ["Metode penarikan", detail.same_day ? "Instant" : detail.auto ? "Auto Withdraw" : "Reguler"],
                ...(detail.admin_note ? [["Catatan", detail.admin_note]] : []),
                ["Diajukan", fmtWDateTime(detail.created_at)],
                ...(detail.reviewed_at ? [[detail.status === "rejected" ? "Ditolak" : "Dikirim", fmtWDateTime(detail.reviewed_at)]] : []),
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="text-muted-foreground">{k}</span><span className="text-right font-semibold">{v}</span></div>
              ))}
            </div>
            {detail.status === "rejected" && <p className="mt-2 text-[11px] text-muted-foreground">Dana penarikan yang ditolak sudah dikembalikan ke saldo tersedia.</p>}
          </>
        )}
      </CenterModal>

      <SellerSheet open={saldoDetail} onOpenChange={setSaldoDetail} title="Detail saldo">
        <div className="space-y-2 text-sm">
          <Row k="Saldo tersedia" v={rpSeller(balance)} bold />
          <Row k="Saldo ditahan" v={rpSeller(held)} />
          <Row k="Saldo sengketa" v={rpSeller(0)} />
          <Row k="Saldo freeze" v={rpSeller(0)} />
          <div className="border-t pt-2"><Row k="Total saldo" v={rpSeller(total)} bold strong /></div>
        </div>
        {holdsList.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Dana ditahan</p>
            {holdsList.map((h) => (
              <div key={h.order_id} className="rounded-xl border p-2.5 text-xs">
                <p className="font-semibold">{rpSeller(Number(h.amount))} · M-{h.order_no}</p>
                <p className="truncate text-muted-foreground">{h.product_name}</p>
                <p className="text-muted-foreground">Cair {fmtWDateTime(h.release_at)}</p>
              </div>
            ))}
          </div>
        )}
      </SellerSheet>

      <PageTour id="seller-withdraw" steps={tour} panel />
    </>
  );
}

function CenterModal({ open, onClose, title, desc, children }: { open: boolean; onClose: () => void; title: string; desc?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/75 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined} className="seller-panel fixed left-1/2 top-4 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 overflow-y-auto rounded-2xl border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div><Dialog.Title className="text-base font-bold">{title}</Dialog.Title>{desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}</div>
            <Dialog.Close aria-label="Tutup" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground/80 transition active:scale-90"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <div className="p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatusPill({ s, label, cls }: { s: Withdrawal["status"]; label: string; cls: string }) {
  const I = s === "sent" ? CircleCheck : s === "rejected" ? CircleX : History;
  return <span className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${cls}`}><I className="h-3.5 w-3.5" />{label}</span>;
}
function SegBtn({ on, onClick, icon: I, children }: { on: boolean; onClick: () => void; icon: typeof Wallet; children: ReactNode }) {
  return <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><I className="h-3.5 w-3.5" />{children}</button>;
}
function Row({ k, v, bold, strong }: { k: string; v: string; bold?: boolean; strong?: boolean }) {
  return <div className="flex items-center justify-between"><span className={strong ? "font-bold" : "text-muted-foreground"}>{k}</span><span className={bold ? "font-bold" : ""}>{v}</span></div>;
}
function Donut({ pctAvail, label }: { pctAvail: number; label: string }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-primary" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" strokeDasharray={`${c * pctAvail} ${c}`} className="stroke-success" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-[9px] text-muted-foreground">Total saldo</p><p className="text-[11px] font-bold">{label}</p></div></div>
    </div>
  );
}
function Mini({ icon: I, label, value, sub }: { icon: typeof Wallet; label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary/50 text-primary"><I className="h-4 w-4" /></span>
      <p className="mt-1.5 text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-bold">{value}</p>
      <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
function Info({ icon: I, k, v }: { icon: typeof Wallet; k: string; v: string }) {
  return <div className="flex items-center gap-3 px-3 py-2.5"><I className="h-4 w-4 text-muted-foreground" /><div className="flex-1"><p className="text-[11px] text-muted-foreground">{k}</p><p className="font-semibold">{v}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>;
}
