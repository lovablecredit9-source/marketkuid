import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Bot, KeyRound, Mail, MailCheck, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthFooter, AuthLayout, AuthTitle, Field, GradientButton, OutlineButton, isEmail } from "@/components/marketku/auth";
import { supabase } from "@/integrations/supabase/client";
import { authErrorText } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk — Marketku" },
      { name: "description", content: "Masuk ke akun Marketku dengan email, Telegram, atau kode email." },
      { property: "og:title", content: "Masuk — Marketku" },
      { property: "og:description", content: "Masuk ke akun Marketku kamu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

type Mode = "email" | "telegram" | "kode" | "lupa";
const notReady = () => toast("Fitur ini segera aktif");

function Login() {
  const [mode, setMode] = useState<Mode>("email");
  return (
    <AuthLayout>
      <AuthCard>
        {mode === "email" && <EmailStep onMode={setMode} />}
        {mode === "telegram" && <CodeStep kind="telegram" onBack={() => setMode("email")} />}
        {mode === "kode" && <CodeStep kind="kode" onBack={() => setMode("email")} />}
        {mode === "lupa" && <Recovery onBack={() => setMode("email")} />}
        {mode !== "lupa" && (
          <AuthFooter>
            Belum punya akun? <Link to="/register" className="font-bold text-primary">Daftar</Link>
          </AuthFooter>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

function EmailStep({ onMode }: { onMode: (m: Mode) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "pass">("email");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (loading || pass.length < 1) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
    setLoading(false);
    if (error) { toast.error(authErrorText(error.message)); return; }
    toast.success("Berhasil masuk");
    navigate({ to: "/akun", replace: true });
  };

  if (step === "pass") {
    return (
      <>
        <AuthTitle title="Masukkan password" desc={email.trim()} />
        <button type="button" onClick={() => { setStep("email"); setPass(""); }} className="mb-5 flex items-center gap-2 font-semibold text-muted-foreground">
          <ArrowLeft className="h-5 w-5" /> Ganti email
        </button>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void signIn(); }}>
          <Field label="Password" icon={KeyRound} name="password" password placeholder="Password kamu" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" autoFocus />
          <GradientButton type="submit" disabled={!pass || loading}>{loading ? "Memproses..." : "Masuk"}</GradientButton>
        </form>
        <button type="button" onClick={() => onMode("lupa")} className="mx-auto mt-4 block font-bold text-primary">Lupa password?</button>
      </>
    );
  }

  return (
    <>
      <AuthTitle title="Masuk" desc="Masukkan email kamu untuk melanjutkan." />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (isEmail(email)) setStep("pass"); }}>
        <Field label="Alamat email" icon={Mail} name="email" type="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <GradientButton type="submit" disabled={!isEmail(email)}>Lanjutkan</GradientButton>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs tracking-[0.2em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ATAU MASUK DENGAN <span className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-3">
        <OutlineButton onClick={() => onMode("telegram")}><Send className="h-5 w-5" /> Masuk dengan Telegram</OutlineButton>
        <OutlineButton onClick={() => onMode("kode")}><Mail className="h-5 w-5" /> Masuk dengan kode email</OutlineButton>
      </div>
      <button type="button" onClick={() => onMode("lupa")} className="mx-auto mt-4 block font-bold text-primary">Lupa password?</button>
    </>
  );
}

function CodeStep({ kind, onBack }: { kind: "telegram" | "kode"; onBack: () => void }) {
  const [v, setV] = useState("");
  const tg = kind === "telegram";
  const valid = tg ? v.replace(/^@/, "").trim().length >= 3 : isEmail(v);
  return (
    <>
      <AuthTitle title="Cek kotak masuk" desc="Kode 6 digit dikirim ke" />
      <button type="button" onClick={onBack} className="mb-6 flex items-center gap-2 font-semibold text-muted-foreground">
        <ArrowLeft className="h-5 w-5" /> Kembali
      </button>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); notReady(); }}>
        {tg ? (
          <Field label="Username Telegram" icon={Send} name="telegram" placeholder="@username" value={v} onChange={(e) => setV(e.target.value)} autoFocus
            hint="Pastikan akun Telegram sudah terhubung; kode dikirim ke Telegram kamu." />
        ) : (
          <Field label="Alamat email" icon={Mail} name="email" type="email" placeholder="nama@email.com" value={v} onChange={(e) => setV(e.target.value)} autoFocus
            hint="Kode 6 digit akan dikirim ke email kamu." />
        )}
        <GradientButton type="submit" disabled={!valid}>{tg ? "Kirim kode Telegram" : "Kirim kode email"}</GradientButton>
      </form>
    </>
  );
}

function Recovery({ onBack }: { onBack: () => void }) {
  const [via, setVia] = useState<"telegram" | "email">("telegram");
  const [email, setEmail] = useState("");
  const [tg, setTg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const valid = via === "telegram" ? tg.trim().length >= 3 : isEmail(email);
  const submit = async () => {
    if (via === "telegram") { notReady(); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) { toast.error(authErrorText(error.message)); return; }
    setSent(true);
  };
  const Option = ({ id, icon: I, title, desc }: { id: "telegram" | "email"; icon: typeof Bot; title: string; desc: string }) => (
    <button type="button" onClick={() => setVia(id)}
      className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left transition ${via === id ? "border-primary/50 bg-card ring-1 ring-primary/20" : "bg-muted/40"}`}>
      <span className="grid h-12 w-12 place-items-center rounded-xl border bg-card text-primary"><I className="h-5 w-5" /></span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm">{desc}</span>
      </span>
    </button>
  );
  if (sent) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-primary"><MailCheck className="h-8 w-8" /></span>
        <h1 className="mt-5 text-2xl font-bold">Cek email kamu</h1>
        <p className="mt-2 text-sm text-muted-foreground">Kalau email <b className="text-foreground">{email.trim()}</b> terdaftar, link reset password sudah dikirim.</p>
        <div className="mt-6 w-full"><OutlineButton onClick={onBack}>Kembali ke login</OutlineButton></div>
      </div>
    );
  }
  return (
    <>
      <AuthTitle title="Pulihkan akun" desc="Reset password lewat OTP Telegram atau link email." />
      <div className="space-y-4">
        <Option id="telegram" icon={Bot} title="Telegram OTP" desc="Reset langsung dari gateway" />
        <Option id="email" icon={Mail} title="Email link" desc="Kirim instruksi ke inbox" />
        <form className="space-y-4 pt-2" onSubmit={(e) => { e.preventDefault(); if (valid && !loading) void submit(); }}>
          <Field label={via === "telegram" ? "Email (opsional jika pakai username Telegram)" : "Email"} icon={Mail} name="email" type="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {via === "telegram" && (
            <Field label="Username Telegram" icon={MessageCircle} name="telegram" placeholder="tanpa @" value={tg} onChange={(e) => setTg(e.target.value.replace(/^@/, ""))} />
          )}
          <GradientButton type="submit" disabled={!valid || loading}>
            <ArrowRight className="h-5 w-5" /> {via === "telegram" ? "Lanjutkan recovery Telegram" : "Kirim link reset"}
          </GradientButton>
          <OutlineButton onClick={onBack}>Kembali ke login</OutlineButton>
        </form>
      </div>
    </>
  );
}
