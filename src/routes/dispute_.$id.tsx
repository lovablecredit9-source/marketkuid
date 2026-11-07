import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ShieldCheck, Store, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, PrimaryLink } from "@/components/marketku/shell";
import { DisputeThread } from "@/components/marketku/dispute-thread";
import { rpBuyer } from "@/components/marketku/product-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DISPUTE_STATUS, isDisputeActive, useDispute, type DisputeStatus } from "@/lib/disputes";
import { dbError } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/dispute_/$id")({
  staticData: { sitemap: false },
  head: () => pageMeta("Dispute Room — Marketku", "Ruang penyelesaian masalah pesanan antara pembeli, seller, dan admin Marketku."),
  component: DisputeRoom,
});

function DisputeRoom() {
  const { id } = Route.useParams();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const q = useDispute(user ? id : undefined);
  const [busy, setBusy] = useState(false);

  if (ready && !user) return <AppShell><div className="p-3"><EmptyState icon={ShieldCheck} title="Masuk untuk melihat dispute" desc="Ruang dispute hanya untuk pihak terkait." action={<PrimaryLink to="/login">Masuk</PrimaryLink>} /></div></AppShell>;
  if (!ready || q.isLoading) return <AppShell><div className="m-3 h-96 animate-pulse rounded-2xl border bg-card" /></AppShell>;
  const d = q.data?.dispute;
  if (!d) return <AppShell><div className="p-3"><EmptyState icon={ShieldCheck} title="Dispute tidak ditemukan" desc="Laporan ini tidak ada atau bukan milikmu." action={<PrimaryLink to="/">Kembali ke Beranda</PrimaryLink>} /></div></AppShell>;

  const st = DISPUTE_STATUS[d.status as DisputeStatus] ?? DISPUTE_STATUS.ditutup;
  const isBuyer = user?.id === d.buyer_id;
  const close = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("buyer_close_dispute", { p_id: d.id });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    toast.success("Laporan ditutup");
    void qc.invalidateQueries({ queryKey: ["dispute", d.id] });
  };
  const created = new Date(d.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const parties = [
    { icon: User, t: "Pembeli", s: d.orders?.buyer_name ?? "Pembeli", cls: "border-primary text-primary" },
    { icon: ShieldCheck, t: "Admin Marketku", s: "Moderator", cls: "border-primary/60 text-primary" },
    { icon: Store, t: "Seller", s: d.orders?.store_name ?? "Seller", cls: "border-success text-success" },
  ];

  return (
    <AppShell showSupport={false}>
      <div className="flex min-h-[calc(100dvh-140px)] flex-col gap-3 px-3 pb-4 pt-3">
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div><h1 className="text-xl font-bold">Dispute Room</h1><p className="text-xs text-muted-foreground">{d.code}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.tone === "warn" ? "bg-warning/15 text-warning" : st.tone === "ok" ? "bg-success/15 text-success" : st.tone === "bad" ? "bg-destructive/10 text-destructive" : st.tone === "info" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{st.label}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border text-sm">
            <Cell a="Order" b={<Link to="/pesanan/$id" params={{ id: d.order_id }} className="text-primary">M-{d.orders?.order_no}</Link>} />
            <Cell a="Produk" b={d.orders?.order_items.map((i) => i.product_name).join(", ") ?? "-"} />
            <Cell a="Nilai Pesanan" b={rpBuyer(Number(d.orders?.total ?? 0))} />
            <Cell a="Dibuat" b={created} />
          </div>
          <div className="mt-4 grid grid-cols-3 text-center">
            {parties.map((p) => (
              <div key={p.t} className="flex flex-col items-center gap-1 px-1">
                <span className={`grid h-11 w-11 place-items-center rounded-full border-2 ${p.cls}`}><p.icon className="h-5 w-5" /></span>
                <b className={`max-w-full truncate text-xs ${p.cls.split(" ").pop()}`}>{p.t}</b>
                <span className="max-w-full truncate text-xs text-muted-foreground">{p.s}</span>
              </div>
            ))}
          </div>
          {d.resolution_note && !isDisputeActive(d.status) && <p className="mt-3 rounded-xl bg-muted/60 p-2.5 text-xs">Hasil: <b>{d.resolution_note}</b></p>}
        </section>

        <section className="flex min-h-[22rem] flex-1 flex-col rounded-2xl border bg-card p-3">
          <DisputeThread disputeId={d.id} status={d.status} messages={q.data?.messages ?? []} uid={user?.id} />
        </section>

        {isBuyer && isDisputeActive(d.status) && (
          <button disabled={busy} onClick={() => void close()} className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-success" />} Masalah sudah selesai, tutup laporan
          </button>
        )}
      </div>
    </AppShell>
  );
}

const Cell = ({ a, b }: { a: string; b: React.ReactNode }) => (
  <div className="border-b border-r p-3 [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
    <p className="text-xs text-muted-foreground">{a}</p><p className="mt-1 line-clamp-2 font-bold">{b}</p>
  </div>
);
