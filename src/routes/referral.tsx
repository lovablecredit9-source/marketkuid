import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, Gift, MessageCircle, Send, Ticket, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";
import {
  REFERRAL_STATUS, clearPendingReferral, isReferralCode, normalizeReferralCode, readPendingReferral,
  referralLink, referralRuleLines, referralShareText, type ReferralRules,
} from "@/lib/referral";

export const Route = createFileRoute("/referral")({
  head: () => pageMeta("Undang Teman — Marketku", "Ajak teman belanja produk digital di Marketku dan dapatkan Saldo Marketku setelah pesanan pertamanya selesai."),
  component: ReferralPage,
});

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

function useRules() {
  return useQuery({
    queryKey: ["referral_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("referral_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as ReferralRules | null;
    },
  });
}

function ReferralPage() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const rules = useRules();
  const code = useQuery({
    queryKey: ["my_referral_code", user?.id], enabled: !!user && !!rules.data?.is_enabled,
    queryFn: async () => { const { data, error } = await supabase.rpc("my_referral_code"); if (error) throw error; return data as string; },
  });
  const invited = useQuery({
    queryKey: ["my_referrals", user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.rpc("my_referrals"); if (error) throw error; return data ?? []; },
  });
  const mine = useQuery({
    queryKey: ["my_referral_claim", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("referrals").select("code, status").eq("referee_id", user!.id).maybeSingle()).data,
  });

  const [origin, setOrigin] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); const p = readPendingReferral(); if (p) setInput(p); }, []);

  const r = rules.data;
  const link = code.data && origin ? referralLink(origin, code.data) : "";
  const list = invited.data ?? [];
  const earned = list.reduce((a, x) => a + (x.status === "rewarded" ? Number(x.referrer_reward) : 0), 0);

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} disalin`); } catch { toast.error("Gagal menyalin"); }
  };
  const claim = async () => {
    const c = normalizeReferralCode(input);
    if (!isReferralCode(c)) { toast.error("Kode undangan tidak valid"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("claim_referral", { p_code: c });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    clearPendingReferral();
    toast.success("Kode undangan dipakai");
    void qc.invalidateQueries({ queryKey: ["my_referral_claim", user?.id] });
  };

  return (
    <AppShell>
      <div className="space-y-3 px-3 pb-6 pt-3">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-glow p-5 text-primary-foreground shadow-lg shadow-primary/25">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] opacity-90"><Gift className="h-3.5 w-3.5" /> Program Referral</p>
          <h1 className="mt-1.5 text-[22px] font-extrabold leading-tight">Undang teman, dapat Saldo Marketku</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed opacity-90">
            {r?.is_enabled && r.referrer_reward > 0 ? <>Hadiah {rp(r.referrer_reward)} untuk setiap teman yang menyelesaikan pesanan pertamanya.</> : "Bagikan link undanganmu ke teman yang belum punya akun Marketku."}
          </p>
        </section>

        {rules.isLoading ? <div className="h-40 animate-pulse rounded-2xl border bg-card" /> : !r?.is_enabled ? (
          <div className="rounded-2xl border bg-card p-5 text-center">
            <Gift className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-bold">Program referral belum dibuka</h2>
            <p className="mt-1 text-sm text-muted-foreground">Admin Marketku akan mengumumkan saat program ini aktif.</p>
          </div>
        ) : ready && !user ? (
          <div className="rounded-2xl border bg-card p-5 text-center">
            <Users className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 font-bold">Masuk untuk mendapatkan link undangan</h2>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/login" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Masuk</Link>
              <Link to="/register" className="rounded-full border px-5 py-2.5 text-sm font-bold">Daftar</Link>
            </div>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Kode undangan kamu</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 rounded-xl border-2 border-dashed border-primary/40 bg-accent px-3 py-2.5 text-center font-mono text-xl font-extrabold tracking-[0.2em] text-primary">{code.data ?? "······"}</span>
                <button aria-label="Salin kode" disabled={!code.data} onClick={() => code.data && void copy(code.data, "Kode")} className="grid h-12 w-12 place-items-center rounded-xl border bg-card transition active:scale-90 disabled:opacity-50"><Copy className="h-5 w-5" /></button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button disabled={!link} onClick={() => void copy(link, "Link")} className="flex flex-col items-center gap-1 rounded-xl border bg-card py-2.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-50"><Copy className="h-4 w-4 text-primary" />Salin link</button>
                <a aria-disabled={!link} href={link ? `https://wa.me/?text=${encodeURIComponent(referralShareText(link))}` : undefined} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 rounded-xl border bg-card py-2.5 text-[11px] font-semibold transition active:scale-95"><MessageCircle className="h-4 w-4 text-success" />WhatsApp</a>
                <a aria-disabled={!link} href={link ? `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Belanja produk digital di Marketku")}` : undefined} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 rounded-xl border bg-card py-2.5 text-[11px] font-semibold transition active:scale-95"><Send className="h-4 w-4 text-primary" />Telegram</a>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-2">
              {[{ l: "Diundang", v: String(list.length) }, { l: "Berhasil", v: String(list.filter((x) => x.status === "rewarded").length) }, { l: "Hadiah", v: rp(earned) }].map((s) => (
                <div key={s.l} className="rounded-2xl border bg-card p-3 text-center shadow-sm"><p className="text-[15px] font-extrabold">{s.v}</p><p className="text-[11px] text-muted-foreground">{s.l}</p></div>
              ))}
            </section>

            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-bold">Syarat & ketentuan</h2>
              <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {referralRuleLines(r).map((l) => <li key={l} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{l}</li>)}
              </ul>
            </section>

            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><Ticket className="h-4 w-4 text-primary" /> Punya kode undangan?</h2>
              {mine.data ? (
                <p className="mt-2 text-[12.5px] text-muted-foreground">Kamu sudah memakai kode <b className="text-foreground">{mine.data.code}</b> — {REFERRAL_STATUS[mine.data.status]?.label.toLowerCase()}.</p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input value={input} onChange={(e) => setInput(normalizeReferralCode(e.target.value))} placeholder="Contoh: MKAB12CD" aria-label="Kode undangan" className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 font-mono text-sm uppercase tracking-wider outline-none focus:border-primary" />
                  <button disabled={busy || !isReferralCode(input)} onClick={() => void claim()} className="h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition active:scale-95 disabled:opacity-50">Pakai</button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-bold">Teman yang kamu undang</h2>
              {invited.isLoading ? <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted" /> : list.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-muted-foreground">Belum ada teman yang memakai kodemu. Bagikan link di atas untuk mulai.</p>
              ) : (
                <ul className="mt-2 divide-y">
                  {list.map((x, i) => {
                    const st = REFERRAL_STATUS[x.status] ?? { label: x.status, tone: "bg-muted text-muted-foreground" };
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 py-2.5">
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{x.referee_label}</span><span className="text-[11px] text-muted-foreground">{new Date(x.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${st.tone}`}>{x.status === "rewarded" ? `+${rp(Number(x.referrer_reward))}` : st.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <Link to="/topup" className="flex items-center justify-between rounded-2xl border bg-card p-4 text-sm font-semibold shadow-sm">Lihat Saldo Marketku <ArrowRight className="h-4 w-4 text-primary" /></Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
