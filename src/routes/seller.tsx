import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Store, Lock, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { beatPresence, useAuth, authErrorText } from "@/lib/auth";
import { useSellerStore } from "@/lib/seller";
import { isSellerUnlocked, unlockSeller } from "@/lib/chat";
import { supabase } from "@/integrations/supabase/client";
import { SellerBottomNav, SellerHeader, SellerMenuSheet, useSellerTheme } from "@/components/marketku/seller-ui";
import { SellerLoading } from "@/components/marketku/loading";
import { SellerBanBanner } from "@/components/marketku/ban-gate";
import { SellerAuth, finishTokenLogin } from "@/components/marketku/seller-auth";
import { useServerFn } from "@tanstack/react-start";
import { miniAppLogin, verifyTelegramLogin } from "@/lib/auth-bot.functions";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller Center — Marketku" },
      { name: "description", content: "Kelola toko, produk, saldo, dan transaksi di Seller Center Marketku." },
      { property: "og:title", content: "Seller Center — Marketku" },
      { property: "og:description", content: "Dashboard penjual Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerLayout,
});

function Gate({ children }: { children: ReactNode }) {
  return <div className="seller-panel flex min-h-screen items-center justify-center px-6 text-center">{children}</div>;
}

/** Seller Center has its own login on top of the buyer session. */
function SellerLogin({ email, storeName, passwordAccount, onDone }: { email: string; storeName: string; passwordAccount: boolean; onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (passwordAccount) {
      if (!pass || busy) return;
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      setBusy(false);
      if (error) { toast.error(authErrorText(error.message)); return; }
    }
    toast.success("Masuk ke Seller Center");
    onDone();
  };
  return (
    <Gate>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="w-full max-w-sm rounded-2xl border bg-card p-6 text-left animate-in fade-in-0 zoom-in-95">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary"><Store className="h-7 w-7" /></span>
        <h1 className="mt-4 text-center text-xl font-bold">Masuk Seller Center</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Toko <b className="text-foreground">{storeName}</b></p>
        <label className="mt-5 block text-xs font-semibold text-muted-foreground">Email</label>
        <input value={email} readOnly className="mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm opacity-80 outline-none" />
        {passwordAccount && (
          <>
            <label className="mt-3 block text-xs font-semibold text-muted-foreground">Password</label>
            <div className="mt-1 flex items-center rounded-xl border bg-background pr-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Lock className="ml-3 h-4 w-4 text-muted-foreground" />
              <input autoFocus type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password akunmu" className="w-full bg-transparent px-3 py-3 text-sm outline-none" />
              <button type="button" aria-label={show ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShow(!show)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition active:scale-90">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </>
        )}
        <button disabled={busy || (passwordAccount && !pass)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {passwordAccount ? "Masuk" : "Lanjutkan ke Seller Center"}
        </button>
        <Link to="/akun" className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Kembali ke akun pembeli</Link>
      </form>
    </Gate>
  );
}

const TG_INIT_KEY = "marketku-tg-initdata";
/** Telegram Mini App initData from the launch hash (kept for in-app navigation). */
function readMiniAppInitData() {
  const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData");
  const v = w.Telegram?.WebApp?.initData || fromHash || window.sessionStorage.getItem(TG_INIT_KEY) || "";
  if (v) window.sessionStorage.setItem(TG_INIT_KEY, v);
  return v;
}

function SellerLayout() {
  const { user, ready } = useAuth();
  const store = useSellerStore(user?.id);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useSellerTheme();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState<string | null>(null);
  const verifyFn = useServerFn(verifyTelegramLogin);
  const miniFn = useServerFn(miniAppLogin);
  useEffect(() => { setUnlocked(isSellerUnlocked(user?.id)); }, [user?.id, tick]);
  // Mark the seller online (2 ticks for buyers) as soon as Seller Center opens.
  useEffect(() => { if (unlocked && user) beatPresence(user.id); }, [unlocked, user]);

  // One-time "Login Otomatis" link from the Auth bot, or a Telegram Mini App launch: sign in without typing.
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    const magic = url.searchParams.get("magic");
    const initData = magic ? "" : readMiniAppInitData();
    if (!magic && (!initData || (user && isSellerUnlocked(user.id)))) return;
    if (magic) { url.searchParams.delete("magic"); window.history.replaceState(null, "", url.pathname + url.search + url.hash); }
    setAuto(magic ? "Memproses link login" : "Masuk lewat Telegram");
    void (async () => {
      try {
        const r = magic ? await verifyFn({ data: { magic } }) : await miniFn({ data: { initData } });
        await finishTokenLogin(r.token_hash);
        toast.success("Login berhasil");
        setTick((t) => t + 1);
      } catch (e) {
        if (!magic) window.sessionStorage.removeItem(TG_INIT_KEY);
        toast.error(e instanceof Error ? e.message : "Gagal masuk");
      } finally { setAuto(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (auto) return <Gate><SellerLoading label={auto} className="py-0" /></Gate>;
  if (!ready || unlocked === null || (user && store.isLoading)) return <Gate><SellerLoading label="Memuat Seller Center" className="py-0" /></Gate>;
  if (!user) return <SellerAuth onDone={() => setTick((t) => t + 1)} />;
  if (!store.data) {
    return (
      <Gate>
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6">
          <Store className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-xl font-bold">{user ? "Kamu belum punya toko" : "Masuk dulu ke akunmu"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user ? "Buka akun seller dari halaman Akun untuk memakai Seller Center." : "Seller Center hanya untuk akun yang sudah membuka toko."}</p>
          <Link to={user ? "/akun" : "/login"} className="mt-5 inline-flex w-full justify-center rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 font-bold text-primary-foreground">
            {user ? "Ke halaman Akun" : "Masuk"}
          </Link>
        </div>
      </Gate>
    );
  }
  if (!unlocked) {
    // Ask for the password unless the account is known to have no password sign-in (e.g. Google only).
    const providers = user.app_metadata?.["providers"] as string[] | undefined;
    if (!providers?.length || providers.includes("email")) return <SellerAuth presetEmail={user.email ?? ""} onDone={() => setTick((t) => t + 1)} />;
    return (
      <SellerLogin email={user.email ?? ""} storeName={store.data.store_name} passwordAccount={!providers?.length || providers.includes("email")}
        onDone={() => { unlockSeller(user.id); setUnlocked(true); }} />
    );
  }

  return (
    <div className="seller-panel min-h-screen">
      <div className="seller-compact mx-auto min-h-screen max-w-md">
        <SellerHeader store={store.data} email={user.email ?? ""} onMenu={() => setMenu(true)} theme={theme} onTheme={setTheme} menuOpen={menu} />
        <main className="space-y-4 px-3 pb-28 pt-3"><SellerBanBanner /><Outlet /></main>
        <SellerBottomNav onMenu={() => setMenu(true)} menuOpen={menu} />
        <SellerMenuSheet open={menu} onOpenChange={setMenu} />
      </div>
    </div>
  );
}
