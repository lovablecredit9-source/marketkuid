import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { KeyRound, Mail, MessageCircle, User } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthFooter, AuthLayout, AuthTitle, Field, GradientButton, isEmail } from "@/components/marketku/auth";

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
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const blur = (k: string) => () => setTouched({ ...touched, [k]: true });

  const uname = f.username.trim();
  const unameErr = !uname ? "Username wajib diisi." : !/^[a-z0-9_]{3,20}$/i.test(uname) ? "Username 3–20 karakter: huruf, angka, atau _." : "";
  const emailErr = !f.email ? "Email wajib diisi." : !isEmail(f.email) ? "Format email belum benar." : "";
  const passErr = f.pass && f.pass.length < 8 ? "Password minimal 8 karakter." : "";
  const confirmErr = f.confirm && f.confirm !== f.pass ? "Password konfirmasi belum sama." : "";
  const s = strength(f.pass);
  const valid = f.name.trim() && !emailErr && !unameErr && f.pass.length >= 8 && f.confirm === f.pass;

  return (
    <AuthLayout>
      <AuthCard>
        <AuthTitle title="Buat akun" />
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); toast("Pendaftaran segera aktif"); }}>
          <Field label="Nama Lengkap" icon={User} name="name" placeholder="Nama lengkap kamu" value={f.name} onChange={set("name")} autoComplete="name" />
          <Field label="Email" icon={Mail} name="email" type="email" placeholder="nama@email.com" value={f.email} onChange={set("email")} onBlur={blur("email")} autoComplete="email"
            status={emailErr ? "error" : "ok"} message={f.email && !emailErr ? "Email siap dipakai untuk registrasi." : touched["email"] ? emailErr : undefined} />
          <Field label="Username" icon={User} name="username" placeholder="username_login" value={f.username} onChange={set("username")} onBlur={blur("username")} autoComplete="username"
            status={unameErr ? "error" : "ok"} message={!unameErr ? `Username ${uname} siap dipakai untuk login.` : touched["username"] || f.username ? unameErr : undefined} />
          <Field label="Nomor WhatsApp (opsional)" icon={MessageCircle} name="wa" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" value={f.wa} onChange={(e) => setF({ ...f, wa: e.target.value.replace(/\D/g, "") })}
            hint="Buat notif pesanan, refund, dan dispute via WhatsApp. Bisa dilewati & ditambahkan nanti." />
          <div className="space-y-2">
            <Field label="Password" icon={KeyRound} name="pass" password placeholder="Min. 8 karakter" value={f.pass} onChange={set("pass")} autoComplete="new-password" status="error" message={passErr || undefined} />
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(s / 4) * 100}%` }} />
            </div>
          </div>
          <Field label="Konfirmasi Password" icon={KeyRound} name="confirm" password placeholder="Ulangi password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" status="error" message={confirmErr || undefined} />
          <GradientButton type="submit" disabled={!valid}>Daftarkan akun</GradientButton>
          <p className="text-center text-sm text-muted-foreground">
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
