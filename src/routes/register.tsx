import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { AtSign, CircleCheck, KeyRound, Mail, MailCheck, MessageCircle, ShoppingBag, Store, User } from "lucide-react";
import { AuthAlert, AuthCard, AuthFooter, AuthLayout, AuthTitle, Field, GradientButton, OutlineButton, StrengthBar } from "@/components/marketku/auth";
import { supabase } from "@/integrations/supabase/client";
import { authErrorText } from "@/lib/auth";
import { unlockSeller } from "@/lib/chat";
import { normalizeTelegram, validStoreName, validTelegram } from "@/components/marketku/seller-sheet";
import { isEmailFormat, normalizeUsername, passwordStrength, PASSWORD_MIN, usernameError } from "@/lib/register-rules";

type RegSearch = { email?: string; dari?: "login"; role?: "seller" };

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): RegSearch => ({
    ...(typeof s["email"] === "string" && s["email"] ? { email: s["email"] } : {}),
    ...(s["dari"] === "login" ? { dari: "login" as const } : {}),
    ...(s["role"] === "seller" ? { role: "seller" as const } : {}),
  }),
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

type Avail = { email: string; username: string; emailTaken: boolean; usernameTaken: boolean } | null;

/** Live "already used?" check for email + username (debounced), like the original form. */
function useAvailability(email: string, username: string) {
  const [res, setRes] = useState<Avail>(null);
  useEffect(() => {
    const e = isEmailFormat(email) ? email.trim().toLowerCase() : "";
    const u = usernameError(username) ? "" : username;
    if (!e && !u) return;
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc("registration_availability", { p_email: e, p_username: u });
      const row = data?.[0];
      if (row) setRes({ email: e, username: u, emailTaken: row.email_taken, usernameTaken: row.username_taken });
    }, 350);
    return () => window.clearTimeout(t);
  }, [email, username]);
  return res;
}

function Register() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const seller = search.role === "seller";
  const setRole = (r: "customer" | "seller") => navigate({ search: (p: RegSearch) => { const { role: _r, ...rest } = p; return r === "seller" ? { ...rest, role: "seller" as const } : rest; }, replace: true });
  const [f, setF] = useState({ name: "", email: search.email ?? "", username: "", wa: "", pass: "", confirm: "", store: "", tg: "" });
  const [storeErr, setStoreErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"in" | "confirm" | null>(null);
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const email = f.email.trim().toLowerCase();
  const uname = f.username;
  const avail = useAvailability(f.email, uname);
  const emailChecked = avail && avail.email === email;
  const unameChecked = avail && avail.username === uname;

  const emailFmtErr = f.email && !isEmailFormat(f.email) ? "Format email belum valid." : "";
  const emailMsg = emailFmtErr || (emailChecked ? (avail.emailTaken ? "Email sudah terdaftar. Pakai login atau email lain." : "Email siap dipakai untuk registrasi.") : "");
  const emailBad = !!emailFmtErr || !!(emailChecked && avail.emailTaken);
  const unameFmtErr = usernameError(uname);
  const unameMsg = unameFmtErr || (unameChecked ? (avail.usernameTaken ? "Username sudah dipakai akun lain." : `Username ${uname} siap dipakai untuk login.`) : "");
  const unameBad = !!unameFmtErr || !!(unameChecked && avail.usernameTaken);
  const confirmErr = f.confirm && f.confirm !== f.pass ? "Password konfirmasi belum sama." : "";

  // Like marketku.id the button unlocks once everything is filled and matches; the 8-character
  // minimum is enforced by the browser's own "please lengthen this text" bubble on submit.
  const telegram = normalizeTelegram(f.tg);
  const storeMsg = f.store && !validStoreName(f.store) ? "Nama toko minimal 3 karakter." : "";
  const tgMsg = !validTelegram(telegram) ? "Username Telegram 5–32 huruf, angka, atau _." : "";
  const sellerOk = !seller || (validStoreName(f.store) && validTelegram(telegram));
  const valid = !!f.name.trim() && !!emailChecked && !emailBad && !!unameChecked && !unameBad && !!f.pass && f.confirm === f.pass && sellerOk;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password: f.pass,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: f.name.trim(), username: uname, whatsapp: f.wa || null },
      },
    });
    if (err) { setLoading(false); setError(authErrorText(err.message)); return; }
    if (data.user && data.user.identities?.length === 0) { setLoading(false); setError("Email sudah terdaftar. Pakai login atau email lain."); return; }
    if (seller && data.session && data.user) {
      const { error: sErr } = await supabase.from("seller_stores").insert({ owner_id: data.user.id, store_name: f.store.trim(), telegram_username: telegram || null });
      if (sErr) setStoreErr("Akun sudah dibuat, tapi toko belum berhasil dibuat. Buka toko lagi dari menu Akun → Mulai Jualan.");
      else unlockSeller(data.user.id, "register");
    }
    setLoading(false);
    setDone(data.session ? "in" : "confirm");
  };

  if (done === "in") {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="mk-pop-in rounded-2xl border border-success/30 bg-success/5 p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><CircleCheck className="h-5 w-5" /></span>
            <h1 className="mt-3 text-[22px] font-normal leading-tight">{seller && !storeErr ? "Akun seller berhasil dibuat" : "Akun customer berhasil dibuat"}</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-foreground/80">{seller && !storeErr
              ? <>Toko <b>{f.store.trim()}</b> sudah siap. Lanjutkan ke Seller Center untuk upload produk pertama kamu.</>
              : "Akun pembeli kamu sudah siap. Kamu bisa langsung menjelajah produk dan membuat pesanan di Marketku."}</p>
            {storeErr && <p className="mt-3 rounded-lg bg-destructive/10 p-2.5 text-[12px] text-destructive">{storeErr}</p>}
            <div className="mt-5 space-y-2.5">
              {seller && !storeErr && <Link to="/seller" className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 text-[13.5px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.98]">Lanjut ke Seller Center</Link>}
              <Link to="/" className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 text-[13.5px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.98]">Masuk ke Marketku</Link>
              <Link to="/bantuan" className="flex w-full items-center justify-center rounded-xl border bg-card py-3 text-[13px] font-bold transition active:scale-[0.98]">Pusat Bantuan</Link>
            </div>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (done === "confirm") {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-primary"><MailCheck className="h-8 w-8" /></span>
            <h1 className="mt-5 text-2xl font-bold">Cek email kamu</h1>
            <p className="mt-2 text-sm text-muted-foreground">Link konfirmasi sudah dikirim ke <b className="text-foreground">{email}</b>. Klik link itu untuk mengaktifkan akun, lalu masuk.</p>
          </div>
          <div className="mt-6"><OutlineButton onClick={() => { window.location.href = "/login"; }}>Ke halaman Masuk</OutlineButton></div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthTitle title={seller ? "Daftar seller" : "Buat akun"} desc={seller ? "Buat toko dan slug seller sejak awal registrasi." : undefined} />
        <div role="tablist" aria-label="Jenis akun" className="mb-4 grid grid-cols-2 gap-2">
          {([["customer", ShoppingBag, "Customer", "Daftar untuk belanja"], ["seller", Store, "Seller", "Daftar untuk jualan"]] as const).map(([r, Icon, t, d]) => {
            const on = (r === "seller") === seller;
            return (
              <button key={r} type="button" role="tab" aria-selected={on} onClick={() => setRole(r)}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition active:scale-[0.98] ${on ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "bg-card"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><b className="block text-[12.5px]">{t}</b><span className="block truncate text-[10.5px] text-muted-foreground">{d}</span></span>
              </button>
            );
          })}
        </div>
        {seller && (
          <ul className="mb-4 space-y-1 rounded-xl bg-accent/60 p-3 text-[11.5px] text-foreground/80">
            <li>• Buat toko dan slug seller sejak awal registrasi</li>
            <li>• Alur seller rapi tanpa mengganggu akun pembeli</li>
            <li>• Lanjutkan ke Seller Center setelah akun berhasil dibuat</li>
          </ul>
        )}
        {search.dari === "login" && !error && <AuthAlert>Email belum terdaftar, melanjut pendaftaran untuk login.</AuthAlert>}
        {error && <AuthAlert>{error}</AuthAlert>}
        <form className="space-y-3.5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Nama Lengkap" icon={User} name="name" placeholder="Nama lengkap kamu" value={f.name} onChange={set("name")} autoComplete="name" required />
          <Field label="Email" icon={Mail} name="email" type="email" placeholder="nama@email.com" value={f.email} onChange={set("email")} autoComplete="email" required
            status={emailBad ? "error" : "ok"} message={emailMsg || undefined} />
          <Field label="Username" icon={User} name="username" placeholder="username_login" value={f.username} autoComplete="username" required minLength={3} maxLength={30}
            onChange={(e) => setF({ ...f, username: normalizeUsername(e.target.value) })}
            status={unameBad ? "error" : "ok"} message={unameMsg || undefined} />
          {seller && <>
            <Field label="Username Telegram (opsional)" icon={AtSign} name="tg" placeholder="username_telegram" value={f.tg} onChange={set("tg")} autoComplete="off"
              status="error" message={tgMsg || undefined} hint="Bisa dihubungkan nanti dari menu seller." />
            <Field label="Nama Toko" icon={Store} name="store" placeholder="Nama toko kamu" value={f.store} onChange={set("store")} maxLength={40} required
              status="error" message={storeMsg || undefined} />
          </>}
          <Field label="Nomor WhatsApp (opsional)" icon={MessageCircle} name="wa" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" value={f.wa} onChange={(e) => setF({ ...f, wa: e.target.value.replace(/\D/g, "").slice(0, 20) })}
            hint="Buat notif pesanan, refund, dan dispute via WhatsApp. Bisa dilewati & ditambahkan nanti." />
          <div className="space-y-1.5">
            <Field label="Password" icon={KeyRound} name="pass" password placeholder="Min. 8 karakter" value={f.pass} onChange={set("pass")} autoComplete="new-password" required minLength={PASSWORD_MIN} />
            <StrengthBar level={passwordStrength(f.pass)} />
          </div>
          <Field label="Konfirmasi Password" icon={KeyRound} name="confirm" password placeholder="Ulangi password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" required minLength={PASSWORD_MIN}
            status="error" message={confirmErr || undefined} />
          <GradientButton type="submit" disabled={!valid || loading}>{loading ? "Mendaftarkan..." : seller ? "Daftarkan seller" : "Daftarkan akun"}</GradientButton>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Dengan mendaftar, kamu menyetujui <Link to="/syarat" className="text-primary underline">Syarat & Ketentuan</Link> dan{" "}
            <Link to="/privasi" className="text-primary underline">Kebijakan Privasi</Link>.
          </p>
        </form>
        <AuthFooter>
          Sudah punya akun? <Link to="/login" className="font-bold text-primary">Masuk</Link>
        </AuthFooter>
      </AuthCard>
    </AuthLayout>
  );
}
