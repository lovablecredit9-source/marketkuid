import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorText, useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/meta";
import { useIsAdmin } from "@/lib/wallet";

export const Route = createFileRoute("/admin_/login")({
  head: () => {
    const m = pageMeta("Login Admin — Marketku", "Halaman masuk khusus admin Marketku.");
    return { ...m, meta: [...m.meta, { name: "robots", content: "noindex" }] };
  },
  component: AdminLogin,
});

/** Admin-only sign in, separate from the buyer login page. */
function AdminLogin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, ready } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isAdmin.data) navigate({ to: "/admin", replace: true }); }, [isAdmin.data, navigate]);

  const submit = async () => {
    if (busy || !email || !pass) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
    if (error || !data.user) { setBusy(false); toast.error(authErrorText(error?.message ?? "")); return; }
    const { data: ok } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!ok) {
      await supabase.auth.signOut();
      qc.clear();
      setBusy(false);
      toast.error("Akun ini bukan admin. Pembeli masuk lewat halaman login biasa.");
      return;
    }
    qc.setQueryData(["is_admin", data.user.id], true);
    setBusy(false);
    toast.success("Selamat datang, Admin");
    navigate({ to: "/admin", replace: true });
  };

  return (
    <div className="admin-panel relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-primary-glow/10 blur-3xl" />
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mk-fade-in relative w-full max-w-sm rounded-3xl border bg-card/90 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-lg shadow-primary/30"><ShieldCheck className="h-6 w-6" /></span>
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-primary">MARKETKU</p>
            <h1 className="text-xl font-bold">Admin Console</h1>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Khusus pengelola Marketku. Akun pembeli dan seller tidak bisa masuk di sini.</p>
        {ready && user && isAdmin.data === false && (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">Kamu sedang masuk sebagai akun non-admin. Masuk dengan akun admin untuk lanjut.</p>
        )}
        <label className="mt-5 block text-xs font-semibold text-muted-foreground">Email admin</label>
        <div className="mt-1 flex items-center rounded-xl border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Mail className="ml-3 h-4 w-4 text-muted-foreground" />
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@email.com" className="w-full bg-transparent px-3 py-3 text-sm outline-none" />
        </div>
        <label className="mt-3 block text-xs font-semibold text-muted-foreground">Password</label>
        <div className="mt-1 flex items-center rounded-xl border bg-background pr-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <KeyRound className="ml-3 h-4 w-4 text-muted-foreground" />
          <input type={show ? "text" : "password"} autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password admin" className="w-full bg-transparent px-3 py-3 text-sm outline-none" />
          <button type="button" aria-label={show ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShow(!show)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
        <button disabled={busy || !email || !pass} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Masuk Admin
        </button>
        <Link to="/" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Kembali ke Marketku</Link>
      </form>
    </div>
  );
}
