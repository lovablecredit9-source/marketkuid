import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { REFERRAL_STATUS, type ReferralRules } from "@/lib/referral";

const rp = (n: number) => `Rp ${Number(n).toLocaleString("id-ID")}`;

/** Admin: referral rules (audited via admin_update_referral_settings) + referral list with reject. */
export function AdminReferralTab() {
  const qc = useQueryClient();
  const rules = useQuery({
    queryKey: ["referral_settings"],
    queryFn: async () => { const { data, error } = await supabase.from("referral_settings").select("*").eq("id", 1).maybeSingle(); if (error) throw error; return data as ReferralRules | null; },
  });
  const list = useQuery({
    queryKey: ["admin_referrals"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_referrals"); if (error) throw error; return data ?? []; },
  });
  const [f, setF] = useState<ReferralRules | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (rules.data && !f) setF(rules.data); }, [rules.data, f]);

  const save = async () => {
    if (!f) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_referral_settings", {
      p_enabled: f.is_enabled, p_referrer_reward: f.referrer_reward, p_referee_reward: f.referee_reward,
      p_min_order: f.min_order, p_max_rewards: f.max_rewards_per_referrer, p_window_days: f.claim_window_days,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Aturan referral disimpan");
    void qc.invalidateQueries({ queryKey: ["referral_settings"] });
  };
  const reject = async (id: string) => {
    const note = window.prompt("Alasan menolak referral ini?");
    if (!note?.trim()) return;
    const { error } = await supabase.rpc("admin_reject_referral", { p_referee: id, p_note: note });
    if (error) { toast.error(error.message); return; }
    toast.success("Referral ditolak");
    void qc.invalidateQueries({ queryKey: ["admin_referrals"] });
  };

  const num = (k: keyof ReferralRules, label: string, hint: string) => (
    <label className="block">
      <span className="text-xs font-semibold">{label}</span>
      <input type="number" min={0} value={f ? Number(f[k]) : 0} onChange={(e) => f && setF({ ...f, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary" />
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </label>
  );
  const rows = list.data ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-base font-bold">Program Referral</h1>
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        {!f ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> : (
          <>
            <label className="flex items-center justify-between gap-3">
              <span><span className="block text-sm font-bold">Program aktif</span><span className="text-[11px] text-muted-foreground">Kalau mati, kode baru tidak bisa dipakai dan hadiah tidak diberikan.</span></span>
              <input type="checkbox" checked={f.is_enabled} onChange={(e) => setF({ ...f, is_enabled: e.target.checked })} className="h-5 w-5 accent-primary" aria-label="Program aktif" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {num("referrer_reward", "Hadiah pengundang (Rp)", "Masuk ke Saldo Marketku")}
              {num("referee_reward", "Bonus teman baru (Rp)", "0 = tidak ada bonus")}
              {num("min_order", "Minimal pesanan (Rp)", "Total pesanan pertama teman")}
              {num("max_rewards_per_referrer", "Maks hadiah / akun", "Batas anti penyalahgunaan")}
              {num("claim_window_days", "Batas pakai kode (hari)", "Setelah akun teman dibuat (1–90)")}
            </div>
            <p className="rounded-xl bg-accent p-2.5 text-[11.5px] leading-relaxed text-muted-foreground">Hadiah hanya diberikan otomatis setelah pesanan teman selesai dan dana diteruskan ke seller (tanpa dispute). Pesanan dari toko pengundang sendiri, akun tamu, dan akun yang dibatasi tidak dihitung. Setiap perubahan tercatat di Log.</p>
            <button disabled={busy} onClick={() => void save()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan aturan</button>
          </>
        )}
      </section>

      <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Daftar referral ({rows.length})</h2>
        <button aria-label="Muat ulang" onClick={() => void list.refetch()} className="grid h-8 w-8 place-items-center rounded-lg border bg-card"><RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} /></button>
      </div>
      {list.isPending ? <div className="h-20 animate-pulse rounded-2xl border bg-card" /> : list.error ? <p className="text-sm text-destructive">{list.error.message}</p> : rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-center text-sm text-muted-foreground">Belum ada pengguna yang memakai kode undangan.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const st = REFERRAL_STATUS[r.status] ?? { label: r.status, tone: "bg-muted" };
            return (
              <li key={r.referee_id} className="rounded-2xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm"><p className="truncate font-semibold">{r.referee ?? "—"} <span className="font-normal text-muted-foreground">diundang</span> {r.referrer ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">Kode {r.code} • {new Date(r.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{r.status === "rewarded" ? ` • ${rp(r.referrer_reward)} + ${rp(r.referee_reward)}` : ""}</p>
                    {r.note && <p className="mt-0.5 text-[11px] text-destructive">{r.note}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${st.tone}`}>{st.label}</span>
                </div>
                {r.status === "pending" && <button onClick={() => void reject(r.referee_id)} className="mt-2 rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive">Tolak</button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
