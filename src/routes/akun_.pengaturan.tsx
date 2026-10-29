import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Settings, ShieldCheck, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSellerStore } from "@/lib/seller";
import { pageMeta } from "@/lib/meta";
import { validateAccountProfile } from "@/lib/account";
import { AppShell } from "@/components/marketku/shell";

export const Route = createFileRoute("/akun_/pengaturan")({
  head: () => pageMeta("Pengaturan Akun — Marketku", "Ubah nama, username, nomor HP, dan password akun Marketku."),
  component: PengaturanAkun,
});

function Card({ label, title, icon: I, children }: { label: string; title: string; icon: typeof Settings; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-[11px] font-bold tracking-widest text-muted-foreground">{label}</p><h2 className="font-bold">{title}</h2></div>
        <I className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold">{label}</span>{children}</label>;
}
const inp = "w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-70";

function PengaturanAkun() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const store = useSellerStore(user?.id);
  const profile = useQuery({
    queryKey: ["profile-full", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("full_name, username, whatsapp").eq("id", user!.id).maybeSingle()).data,
  });
  const [f, setF] = useState({ full_name: "", username: "", whatsapp: "" });
  const [pw, setPw] = useState({ old: "", next: "", confirm: "" });
  const [busy, setBusy] = useState<"profile" | "pw" | null>(null);
  useEffect(() => {
    if (profile.data) setF({ full_name: profile.data.full_name ?? "", username: profile.data.username ?? "", whatsapp: profile.data.whatsapp ?? "" });
  }, [profile.data]);

  if (ready && !user) return <AppShell title="Akun Saya"><div className="px-6 pt-24 text-center"><p>Masuk dulu untuk mengatur akun.</p><Link to="/login" className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground">Masuk</Link></div></AppShell>;

  const saveProfile = async () => {
    const errs = validateAccountProfile(f);
    if (errs.length) { toast.error(errs[0]); return; }
    setBusy("profile");
    const { error } = await supabase.from("profiles").update({ full_name: f.full_name.trim(), username: f.username.trim() || null, whatsapp: f.whatsapp.trim() || null }).eq("id", user!.id);
    setBusy(null);
    if (error) { toast.error(error.code === "23505" ? "Username sudah dipakai" : "Gagal menyimpan profil"); return; }
    toast.success("Profil disimpan");
    void qc.invalidateQueries({ queryKey: ["profile"] });
    void qc.invalidateQueries({ queryKey: ["profile-full", user!.id] });
  };
  const savePw = async () => {
    if (pw.next.length < 8) { toast.error("Password baru minimal 8 karakter"); return; }
    if (pw.next !== pw.confirm) { toast.error("Konfirmasi password tidak cocok"); return; }
    if (pw.next === pw.old) { toast.error("Password baru harus beda dari password lama"); return; }
    setBusy("pw");
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: user!.email!, password: pw.old });
    if (e1) { setBusy(null); toast.error("Password lama salah"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setBusy(null);
    if (error) { toast.error("Gagal mengganti password"); return; }
    toast.success("Password berhasil diganti");
    setPw({ old: "", next: "", confirm: "" });
  };

  return (
    <AppShell title="Akun Saya">
      <div className="space-y-4 px-3 pt-3">
        <Link to="/akun" className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" /> Kembali ke Akun</Link>
        {store.data && (
          <Card label="CREDIT SELLER" title="Saldo fee dan markup" icon={CreditCard}>
            {[["Credit", "Rp 0"], ["Saldo tersedia", "Rp 0"], ["Saldo tertahan", "Rp 0"]].map(([k, v]) => (
              <div key={k} className="rounded-lg border px-3 py-2"><p className="text-xs text-muted-foreground">{k}</p><p className="font-mono">{v}</p></div>
            ))}
            <button onClick={() => navigate({ to: "/seller/saldo" })} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]">Top up credit</button>
            <p className="text-center text-xs text-muted-foreground">Belum ada mutasi credit.</p>
          </Card>
        )}
        <Card label="PENGATURAN AKUN" title="Data akun" icon={Settings}>
          <Field label="Nama"><input className={inp} value={f.full_name} maxLength={60} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Username"><input className={inp} value={f.username} maxLength={30} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "") })} /></Field>
          <Field label="Email"><input className={inp} value={user?.email ?? ""} disabled /></Field>
          <Field label="No HP"><input className={inp} inputMode="tel" value={f.whatsapp} placeholder="08xxxxxxxxxx" onChange={(e) => setF({ ...f, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 15) })} /></Field>
          <button disabled={busy === "profile"} onClick={() => void saveProfile()} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60">{busy === "profile" ? "Menyimpan..." : "Simpan profil"}</button>
        </Card>
        <Card label="KEAMANAN" title="Password" icon={ShieldCheck}>
          <Field label="Password lama"><input type="password" autoComplete="current-password" className={inp} value={pw.old} placeholder="Password saat ini" onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
          <Field label="Password baru"><input type="password" autoComplete="new-password" className={inp} value={pw.next} placeholder="Minimal 8 karakter" onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Field label="Konfirmasi password"><input type="password" autoComplete="new-password" className={inp} value={pw.confirm} placeholder="Ulangi password baru" onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          <button disabled={busy === "pw"} onClick={() => void savePw()} className="w-full rounded-lg border border-primary/40 py-2.5 text-sm font-semibold text-primary transition active:scale-[0.98] disabled:opacity-60">{busy === "pw" ? "Menyimpan..." : "Ganti password"}</button>
          <button onClick={() => toast("Untuk menonaktifkan akun, hubungi tim support lewat halaman Kontak.")} className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive">Nonaktifkan akun</button>
        </Card>
      </div>
    </AppShell>
  );
}
