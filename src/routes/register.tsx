import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { KeyRound, Mail, MailCheck, MessageCircle, User } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthFooter, AuthLayout, AuthTitle, Field, GradientButton, isEmail } from "@/components/marketku/auth";
import { supabase } from "@/integrations/supabase/client";
import { authErrorText } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Buat Akun — Marketku" },
      { name: "description", content: "Daftar akun pembeli Marketku untuk belanja produk digital." },
      { property: "og:title", content: "Buat Akun — Marketku" },
      { property: "og:description", content: "Daftar akun pembeli Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Register,
});

const strength = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
};

function Register() {
  const [f, setF] = useState({ name: "", email: "", username: "", wa: "", pass: "", confirm: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const blur = (k: string) => () => setTouched({ ...touched, [k]: true });

  const uname = f.username.trim();
  const unameErr = !uname ? "Username wajib diisi." : !/^[a-z0-9_]{3,20}$/i.test(uname) ? "Username 3–20 karakter: huruf, angka, atau _." : "";
  const emailErr = !f.email ? "Email wajib diisi." : !isEmail(f.email) ? "Format email belum benar." : "";
  const passErr = f.pass && f.pass.length < 8 ? "Password minimal 8 karakter." : "";
  const confirmErr = f.confirm && f.confirm !== f.pass ? "Password konfirmasi belum sama." : "";
  const s = strength(f.pass);
  const valid = f.name.trim() && !emailErr && !unameErr && f.pass.length >= 8 && f.confirm === f.pass;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    const email = f.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: f.pass,
      options: {
        emailRedirectTo: window.location.origin + "/akun",
        data: { full_name: f.name.trim(), username: uname.toLowerCase(), whatsapp: f.wa || null },
      },
    });
    setLoading(false);
    if (error) { toast.error(authErrorText(error.message)); return; }
    if (data.user && data.user.identities?.length === 0) { toast.error("Email ini sudah terdaftar. Silakan masuk."); return; }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-primary"><MailCheck className="h-8 w-8" /></span>
            <h1 className="mt-5 text-2xl font-bold">Cek email kamu</h1>
            <p className="mt-2 text-sm text-muted-foreground">Link konfirmasi sudah dikirim ke <b className="text-foreground">{sentTo}</b>. Klik link itu untuk mengaktifkan akun, lalu masuk.</p>
            <p className="mt-2 text-xs text-muted-foreground">Tidak ada di kotak masuk? Cek folder spam.</p>
          </div>
          <div className="mt-6"><Link to="/login" className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-primary-glow py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/20">Ke halaman Masuk</Link></div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthTitle title="Buat akun" />
        <form className="space-y-3.5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Nama Lengkap" icon={User} name="name" placeholder="Nama lengkap kamu" value={f.name} onChange={set("name")} autoComplete="name" />
          <Field label="Email" icon={Mail} name="email" type="email" placeholder="nama@email.com" value={f.email} onChange={set("email")} onBlur={blur("email")} autoComplete="email"
            status={emailErr ? "error" : "ok"} message={f.email && !emailErr ? "Email siap dipakai untuk registrasi." : touched["email"] ? emailErr : undefined} />
          <Field label="Username" icon={User} name="username" placeholder="username_login" value={f.username} onChange={set("username")} onBlur={blur("username")} autoComplete="username"
            status={unameErr ? "error" : "ok"} message={!unameErr ? `Username ${uname} siap dipakai untuk login.` : touched["username"] || f.username ? unameErr : undefined} />
          <Field label="Nomor WhatsApp (opsional)" icon={MessageCircle} name="wa" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" value={f.wa} onChange={(e) => setF({ ...f, wa: e.target.value.replace(/\D/g, "") })}
            hint="Buat notif pesanan, refund, dan dispute via WhatsApp. Bisa dilewati & ditambahkan nanti." />
          <div className="space-y-1.5">
            <Field label="Password" icon={KeyRound} name="pass" password placeholder="Min. 8 karakter" value={f.pass} onChange={set("pass")} autoComplete="new-password" status="error" message={passErr || undefined} />
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(s / 4) * 100}%` }} />
            </div>
          </div>
          <Field label="Konfirmasi Password" icon={KeyRound} name="confirm" password placeholder="Ulangi password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" status="error" message={confirmErr || undefined} />
          <GradientButton type="submit" disabled={!valid || loading}>{loading ? "Mendaftarkan..." : "Daftarkan akun"}</GradientButton>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Dengan mendaftar, kamu menyetujui <button type="button" onClick={() => toast("Syarat & Ketentuan segera hadir")} className="text-primary">Syarat & Ketentuan</button> dan{" "}
            <button type="button" onClick={() => toast("Kebijakan Privasi segera hadir")} className="text-primary">Kebijakan Privasi</button>.
          </p>
        </form>
        <AuthFooter>
          Sudah punya akun? <Link to="/login" className="font-bold text-primary">Masuk</Link>
        </AuthFooter>
      </AuthCard>
    </AuthLayout>
  );
}
