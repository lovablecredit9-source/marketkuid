import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, ClipboardPaste, Eye, EyeOff, Loader2, Lock, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorText } from "@/lib/auth";
import { unlockSeller } from "@/lib/chat";
import { AUTH_RESEND_SECONDS, normalizeTgUsername } from "@/lib/auth-bot";
import { getAuthBotPublic, requestTelegramLogin, verifyTelegramLogin } from "@/lib/auth-bot.functions";

const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan");
type Step = "email" | "password" | "tg" | "code";

/** Exchanges a one-time server token for a browser session and unlocks Seller Center. */
export async function finishTokenLogin(tokenHash: string, via = "telegram_code") {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error || !data.user) throw new Error(error ? authErrorText(error.message) : "Gagal masuk");
  unlockSeller(data.user.id, via);
  return data.user.id;
}

export function SellerAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="seller-auth flex min-h-screen items-center justify-center px-4 py-10">
      <div className="seller-auth-card w-full max-w-[400px] rounded-2xl border bg-card px-6 pb-6 pt-5 animate-in fade-in-0 zoom-in-95">
        <div className="flex items-baseline justify-center gap-2.5 border-b pb-4">
          <span className="text-[19px] font-extrabold tracking-tight">Marketku</span>
          <span className="text-[11px] font-bold tracking-[0.16em] text-muted-foreground">SELLER CENTER</span>
        </div>
        {children}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Dengan login, kamu setuju ke <Link to="/syarat" className="underline underline-offset-2">Ketentuan</Link> & <Link to="/privasi" className="underline underline-offset-2">Privasi</Link>.
        </p>
      </div>
    </div>
  );
}

function Field({ icon, children, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <label className="flex h-[52px] items-center gap-3 rounded-xl border bg-card px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
      <span className="text-primary">{icon}</span>
      <input {...p} className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/80" />
      {children}
    </label>
  );
}

/** Seller Center sign-in: email + password, or a Telegram code from the Auth Marketku bot. */
export function SellerAuth({ presetEmail, onDone }: { presetEmail?: string; onDone: (userId: string) => void }) {
  const botQ = useQuery({ queryKey: ["auth_bot_public"], queryFn: useServerFn(getAuthBotPublic), staleTime: 60_000 });
  const requestFn = useServerFn(requestTelegramLogin);
  const verifyFn = useServerFn(verifyTelegramLogin);
  const [step, setStep] = useState<Step>(presetEmail ? "password" : "email");
  const [email, setEmail] = useState(presetEmail ?? "");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [tgUser, setTgUser] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const bot = botQ.data?.bot ?? null;

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    const u = normalizeTgUsername(tgUser);
    if (!u) throw new Error("Masukkan username Telegram yang valid");
    await requestFn({ data: { username: u } });
    toast.success("Kode login dikirim ke Telegram");
    setCode(""); setWait(AUTH_RESEND_SECONDS); setStep("code");
  });

  const submit = () => {
    if (step === "email") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast.error("Masukkan email yang valid"); return; }
      setStep("password");
      return;
    }
    if (step === "password") return run(async () => {
      if (!pass) throw new Error("Masukkan password");
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error || !data.user) throw new Error(authErrorText(error?.message ?? "Gagal masuk"));
      unlockSeller(data.user.id);
      toast.success("Masuk ke Seller Center");
      onDone(data.user.id);
    });
    if (step === "tg") return sendCode();
    return run(async () => {
      const r = await verifyFn({ data: { username: tgUser, code: code.trim() } });
      const id = await finishTokenLogin(r.token_hash);
      toast.success("Login berhasil");
      onDone(id);
    });
  };

  const titles: Record<Step, [string, string]> = {
    email: ["Masuk ke Akun", "Masukkan email untuk masuk atau buat akun baru."],
    password: ["Masukkan Password", email],
    tg: ["Masuk via Telegram", "Login dengan kode dari bot Telegram."],
    code: ["Masuk via Telegram", "Login dengan kode dari bot Telegram."],
  };
  const [title, sub] = titles[step];
  const primaryLabel = { email: "Lanjutkan", password: "Masuk", tg: "Kirim Kode Login", code: "Verifikasi & Masuk" }[step];
  const soft = (step === "tg" && !normalizeTgUsername(tgUser)) || (step === "code" && code.length !== 6);

  return (
    <SellerAuthShell>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <h1 className="mt-6 text-center text-[26px] font-extrabold leading-tight">{title}</h1>
        <p className="mt-2 break-all text-center text-[14px] text-muted-foreground">{sub}</p>
        <div className="mt-5 space-y-3">
          {step === "email" && <Field icon={<Mail className="h-5 w-5" />} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com" aria-label="Email" />}
          {step === "password" && (
            <Field icon={<Lock className="h-5 w-5" />} autoFocus type={show ? "text" : "password"} autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password" aria-label="Password">
              <button type="button" aria-label={show ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShow(!show)} className="text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </Field>
          )}
          {step === "tg" && <Field icon={<Send className="h-5 w-5" />} autoFocus value={tgUser} onChange={(e) => setTgUser(e.target.value)} placeholder="Username Telegram" aria-label="Username Telegram" autoCapitalize="none" autoCorrect="off" />}
          {step === "code" && (
            <>
              <p className="flex items-center gap-2.5 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-[14px] font-medium text-success"><CheckCircle2 className="h-5 w-5 shrink-0" /> Kode login telah dikirim ke Telegram Anda.</p>
              <p className="mx-auto flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-[13px] font-semibold text-primary"><Send className="h-4 w-4" /> @{normalizeTgUsername(tgUser) ?? tgUser}</p>
              <p className="pt-1 text-center text-[14px] text-muted-foreground">Masukkan 6 digit kode dari bot Telegram.</p>
              <div className="relative mx-auto flex w-fit gap-2.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className={`grid h-11 w-10 place-items-center rounded-lg border text-lg font-bold transition ${i === Math.min(code.length, 5) ? "border-primary ring-2 ring-primary/15" : ""}`}>{code[i] ?? ""}</span>
                ))}
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="Kode login"
                  className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none" />
              </div>
              <p className="text-center text-[13px] text-muted-foreground">Belum melihat kode? <a href={bot ? `https://t.me/${bot}` : "#"} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-primary">Buka @{bot}</a></p>
              <button type="button" onClick={async () => { try { const t = await navigator.clipboard.readText(); const d = t.replace(/\D/g, "").slice(0, 6); if (d.length === 6) setCode(d); else toast.error("Tidak ada kode 6 angka di clipboard"); } catch { toast.error("Izinkan akses clipboard atau ketik kodenya"); } }}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold transition active:scale-[0.98]"><ClipboardPaste className="h-4 w-4" /> Tempel Kode</button>
            </>
          )}
          <button disabled={busy} className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[17px] font-bold transition active:scale-[0.98] disabled:opacity-70 ${soft ? "seller-auth-btn-soft" : "seller-auth-btn"}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {primaryLabel}
          </button>
        </div>

        {step === "email" && (
          <>
            <div className="my-6 flex items-center gap-4 text-xs font-semibold tracking-[0.18em] text-muted-foreground"><span className="h-px flex-1 bg-border" />ATAU<span className="h-px flex-1 bg-border" /></div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={!bot} onClick={() => setStep("tg")} className="flex h-[52px] items-center justify-center gap-2 rounded-xl border text-[16px] font-semibold transition active:scale-95 disabled:opacity-50">
                <Send className="h-5 w-5" /> {bot ? "Telegram" : <span className="text-sm leading-tight text-muted-foreground">Telegram<br />offline</span>}
              </button>
              <button type="button" disabled className="flex h-[52px] items-center justify-center gap-2 rounded-xl border text-muted-foreground opacity-60">
                <MessageCircle className="h-5 w-5" /> <span className="text-sm leading-tight">WhatsApp<br />offline</span>
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">Belum punya akun? <Link to="/register" className="font-semibold text-primary">Daftar</Link></p>
          </>
        )}
        {step === "password" && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setPass(""); setStep("email"); }} className="flex items-center gap-1.5 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Ganti email</button>
            {bot && <button type="button" onClick={() => setStep("tg")} className="flex items-center gap-1.5 font-semibold text-primary"><Send className="h-4 w-4" /> Telegram</button>}
          </div>
        )}
        {step === "tg" && (
          <>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Wajib <a href={bot ? `https://t.me/${bot}?start=login` : "#"} target="_blank" rel="noreferrer" className="font-semibold text-primary">/start</a> dulu di{" "}
              <a href={bot ? `https://t.me/${bot}` : "#"} target="_blank" rel="noreferrer" className="font-semibold text-primary">@{bot ?? "…"}</a>.
            </p>
            <button type="button" onClick={() => setStep(presetEmail ? "password" : "email")} className="mx-auto mt-5 flex items-center gap-1.5 text-[15px] text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Gunakan Email</button>
          </>
        )}
        {step === "code" && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
              <button type="button" onClick={() => setStep("tg")} className="flex h-[44px] items-center justify-center gap-1.5 rounded-xl border font-semibold transition active:scale-95"><ArrowLeft className="h-4 w-4" /> Ganti username</button>
              <button type="button" disabled={wait > 0 || busy} onClick={() => void sendCode()} className="flex h-[44px] items-center justify-center rounded-xl border font-semibold text-primary transition active:scale-95 disabled:text-muted-foreground disabled:opacity-60">
                {wait > 0 ? `Kirim ulang (${wait}s)` : "Kirim ulang"}
              </button>
            </div>
            <button type="button" onClick={() => setStep(presetEmail ? "password" : "email")} className="mx-auto mt-5 flex items-center gap-1.5 text-[15px] text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Gunakan Email</button>
          </>
        )}
        {presetEmail && step !== "code" && (
          <Link to="/akun" className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke akun pembeli</Link>
        )}
      </form>
    </SellerAuthShell>
  );
}
