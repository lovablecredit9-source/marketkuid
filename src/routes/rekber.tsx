import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake, ShieldCheck, Wallet, Inbox, Loader2, X, Store } from "lucide-react";
import { AppShell, rupiah } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { supabase } from "@/integrations/supabase/client";
import { RekberCard, RekberDetail } from "@/components/marketku/rekber-detail";
import { BEARER_LABEL, errText, fmtRekberDate, rekberStats, rekberView, useMyRekber, type FeeBearer } from "@/lib/rekber";

export const Route = createFileRoute("/rekber")({
  validateSearch: (s: Record<string, unknown>): { t?: string } => (typeof s.t === "string" && /^[a-f0-9]{32}$/.test(s.t) ? { t: s.t } : {}),
  head: () => pageMeta("Rekber Marketku — Rekening Bersama", "Titipkan dana ke Marketku sampai pembeli dan penjual selesai bertransaksi."),
  component: Rekber,
});

const TABS = [["semua", "Semua"], ["deposit", "Perlu deposit"], ["ditahan", "Ditahan"], ["sengketa", "Sengketa"], ["selesai", "Selesai"]] as const;

function Rekber() {
  const { t } = Route.useSearch();
  const { user, ready } = useAuth();
  const uid = user?.id;
  const list = useMyRekber(uid);
  const rows = list.data ?? [];
  const stats = useMemo(() => rekberStats(rows, uid), [rows, uid]);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("semua");
  const [detail, setDetail] = useState<string | null>(null);
  const shown = rows.filter((d) => tab === "semua" || rekberView(d) === tab);
  const current = rows.find((d) => d.id === detail) ?? null;

  return (
    <AppShell>
      <div className="space-y-3 px-3 pt-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Handshake className="h-6 w-6 text-primary" /> Rekber Marketku</h1>
          <p className="mt-1 text-sm text-muted-foreground">Titipkan dana ke Marketku sampai kedua pihak selesai. Pencairan saldo rekber selalu diperiksa admin.</p>
        </div>
        {t && <JoinCard token={t} />}
        {ready && !user ? (
          <div className="rounded-2xl border bg-card px-6 py-10 text-center">
            <p className="font-bold">Masuk untuk melihat rekber</p>
            <Link to="/masuk" className="mt-3 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Masuk</Link>
          </div>
        ) : (
          <>
            {([[ShieldCheck, "Dana ditahan", rupiah(stats.held), "Total nilai rekber yang sedang dititipkan"], [Wallet, "Saldo rekber", rupiah(stats.saldo), "Pencairan diperiksa admin"], [Inbox, "Perlu tindakan", String(stats.action), "Rekber yang menunggu langkah Anda"]] as const).map(([I, title, v, d]) => (
              <div key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="flex items-center gap-2 text-sm"><I className="h-4 w-4 text-primary" /> {title}</p>
                <p className="mt-1 text-lg font-bold">{v}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            ))}
            <div className="flex gap-1.5 overflow-x-auto rounded-2xl border bg-card p-2">
              {TABS.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition active:scale-95 ${tab === k ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>
              ))}
            </div>
            {list.isPending ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : shown.length === 0 ? (
              <div className="rounded-2xl border bg-card px-6 py-10 text-center">
                <p className="font-bold">Belum ada rekber</p>
                <p className="mt-1 text-sm text-muted-foreground">Rekber yang dibagikan seller kepadamu akan muncul di sini.</p>
              </div>
            ) : shown.map((d) => <RekberCard key={d.id} d={d} uid={uid} onOpen={() => setDetail(d.id)} />)}
          </>
        )}
      </div>
      {current && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70" onClick={() => setDetail(null)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border bg-background p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="font-bold">Detail rekber</p><button aria-label="Tutup" onClick={() => setDetail(null)} className="grid h-8 w-8 place-items-center rounded-full"><X className="h-5 w-5" /></button></div>
            <RekberDetail d={current} uid={uid} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

/** Shown when a buyer opens a rekber link shared by a seller. */
function JoinCard({ token }: { token: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, ready } = useAuth();
  const wallet = useWallet(user?.id);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["rekber_token", token, user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rekber_by_token", { p_token: token });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  if (!ready) return null;
  if (!user) return (
    <div className="rounded-2xl border border-primary/40 bg-card p-4 text-sm">
      <p className="font-bold">Kamu diundang ke rekber</p>
      <p className="mt-1 text-muted-foreground">Masuk dulu untuk melihat dan membayar rekber ini.</p>
      <Link to="/masuk" className="mt-3 inline-block rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Masuk</Link>
    </div>
  );
  if (q.isPending) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const d = q.data;
  if (!d) return <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">Link rekber tidak ditemukan.</div>;
  const expired = d.status === "menunggu_deposit" && new Date(d.deposit_deadline).getTime() < Date.now();
  const canPay = d.status === "menunggu_deposit" && !d.taken && !d.is_seller && !expired;
  const bal = wallet.data ?? 0;

  const pay = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("pay_rekber", { p_token: token });
    setBusy(false);
    if (error) { toast.error(errText(error)); return; }
    toast.success("Deposit dibayar. Dana ditahan Marketku sampai kamu konfirmasi selesai.");
    void qc.invalidateQueries({ queryKey: ["rekber"] });
    void qc.invalidateQueries({ queryKey: ["rekber_token"] });
    void qc.invalidateQueries({ queryKey: ["wallet"] });
    navigate({ to: "/rekber", search: {}, replace: true });
  };

  return (
    <div className="space-y-2 rounded-2xl border border-primary/40 bg-card p-4">
      <p className="text-xs font-semibold text-primary">Undangan rekber · {d.code}</p>
      <p className="text-base font-bold">{d.title}</p>
      {d.store_name && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Store className="h-3.5 w-3.5" /> Penjual: {d.store_name}</p>}
      {d.details && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{d.details}</p>}
      <div className="rounded-xl bg-muted/40 p-3 text-sm">
        <p className="flex justify-between"><span className="text-muted-foreground">Nilai kesepakatan</span><b>{rupiah(Number(d.amount))}</b></p>
        <p className="flex justify-between"><span className="text-muted-foreground">Biaya layanan · {BEARER_LABEL[d.fee_bearer as FeeBearer]}</span><b>{rupiah(Number(d.fee))}</b></p>
        <p className="mt-1 flex justify-between border-t pt-1"><span className="font-semibold">Total bayar</span><b className="text-primary">{rupiah(Number(d.buyer_pays))}</b></p>
        <p className="mt-1 text-xs text-muted-foreground">Batas deposit {fmtRekberDate(d.deposit_deadline)}</p>
      </div>
      {canPay ? (
        <>
          <p className="text-xs text-muted-foreground">Saldo Marketku kamu: <b>{rupiah(bal)}</b></p>
          {bal < Number(d.buyer_pays) ? (
            <Link to="/topup" className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-primary-foreground">Top up saldo dulu</Link>
          ) : (
            <button disabled={busy} onClick={() => void pay()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Bayar {rupiah(Number(d.buyer_pays))} dengan Saldo</button>
          )}
        </>
      ) : (
        <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          {d.is_seller ? "Ini rekber milikmu. Bagikan link ini ke pembeli." : d.is_buyer ? "Kamu sudah membayar rekber ini. Lihat di daftar di bawah." : expired ? "Batas deposit sudah lewat." : "Rekber ini sudah dibayar pihak lain atau ditutup."}
        </p>
      )}
    </div>
  );
}
