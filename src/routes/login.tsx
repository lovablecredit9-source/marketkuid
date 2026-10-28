import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthFooter, AuthLayout, AuthTitle, Field, GradientButton, OutlineButton, isEmail } from "@/components/marketku/auth";

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
const notReady = () => toast("Fitur masuk segera aktif");

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
  const [email, setEmail] = useState("");
  return (
    <>
      <AuthTitle title="Masuk" desc="Masukkan email kamu untuk melanjutkan." />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); notReady(); }}>
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
  const valid = via === "telegram" ? tg.trim().length >= 3 : isEmail(email);
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
  return (
    <>
      <AuthTitle title="Pulihkan akun" desc="Reset password lewat OTP Telegram atau link email." />
      <div className="space-y-4">
        <Option id="telegram" icon={Bot} title="Telegram OTP" desc="Reset langsung dari gateway" />
        <Option id="email" icon={Mail} title="Email link" desc="Kirim instruksi ke inbox" />
        <form className="space-y-4 pt-2" onSubmit={(e) => { e.preventDefault(); notReady(); }}>
          <Field label={via === "telegram" ? "Email (opsional jika pakai username Telegram)" : "Email"} icon={Mail} name="email" type="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {via === "telegram" && (
            <Field label="Username Telegram" icon={MessageCircle} name="telegram" placeholder="tanpa @" value={tg} onChange={(e) => setTg(e.target.value.replace(/^@/, ""))} />
          )}
          <GradientButton type="submit" disabled={!valid}>
            <ArrowRight className="h-5 w-5" /> {via === "telegram" ? "Lanjutkan recovery Telegram" : "Kirim link reset"}
          </GradientButton>
          <OutlineButton onClick={onBack}>Kembali ke login</OutlineButton>
        </form>
      </div>
    </>
  );
}
