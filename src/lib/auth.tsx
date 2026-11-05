import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inSellerCenter } from "@/lib/chat";

/** Buyer presence = any visit; seller presence only inside an unlocked Seller Center. */
export function beatPresence(uid: string | undefined) {
  if (!uid) return;
  // The query builder is lazy: it only sends the request once .then() is called.
  supabase.rpc("touch_presence", { p_seller: inSellerCenter(uid) }).then(() => {}, () => {});
}

/**
 * "Ingat saya" on the password step. Unchecked = the session lasts only while the browser is open:
 * a later fresh visit (new tab session) signs the user out.
 */
const SESSION_ONLY = "mk-session-only";
const ALIVE = "mk-session-alive";
export function setRememberMe(remember: boolean) {
  if (remember) window.localStorage.removeItem(SESSION_ONLY);
  else window.localStorage.setItem(SESSION_ONLY, "1");
  window.sessionStorage.setItem(ALIVE, "1");
}
function dropSessionIfNotRemembered() {
  if (window.localStorage.getItem(SESSION_ONLY) === "1" && !window.sessionStorage.getItem(ALIVE)) {
    window.localStorage.removeItem(SESSION_ONLY);
    void supabase.auth.signOut();
  }
  window.sessionStorage.setItem(ALIVE, "1");
}

type AuthState = { user: User | null; session: Session | null; ready: boolean };

const AuthContext = createContext<AuthState>({ user: null, session: null, ready: false });

// The single onAuthStateChange subscriber for the whole app.
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ user: null, session: null, ready: false });

  useEffect(() => {
    dropSessionIfNotRemembered();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ user: session?.user ?? null, session, ready: true });
      if (event === "SIGNED_IN" || event === "USER_UPDATED") queryClient.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, ready: true });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  // "Terakhir dilihat" heartbeat for chat partners (also marks incoming messages delivered).
  const uid = state.user?.id;
  useEffect(() => {
    if (!uid) return;
    const beat = () => { if (document.visibilityState === "visible") beatPresence(uid); };
    beat();
    const t = window.setInterval(beat, 45_000);
    document.addEventListener("visibilitychange", beat);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, [uid]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const authErrorText = (msg: string) => {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email atau password salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi. Cek kotak masuk kamu.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Email ini sudah terdaftar. Silakan masuk.";
  if (m.includes("rate limit") || m.includes("too many")) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  if (m.includes("weak") || m.includes("pwned")) return "Password terlalu lemah atau pernah bocor. Pakai password lain.";
  if (m.includes("email address is not allowed") || m.includes("invalid email") || m.includes("is invalid")) return "Alamat email tidak bisa dipakai. Pakai email asli yang aktif.";
  return "Terjadi kesalahan. Coba lagi.";
};
