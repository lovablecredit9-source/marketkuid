import { useEffect, useState } from "react";
import { toast } from "sonner";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; window.dispatchEvent(new Event("mk-install-ready")); });
}

/** "Pasang Aplikasi": uses the browser install prompt when offered, otherwise explains Add to Home Screen. */
export function useInstallApp() {
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia?.("(display-mode: standalone)").matches ?? false);
    setReady(!!deferred);
    const on = () => setReady(true);
    window.addEventListener("mk-install-ready", on);
    return () => window.removeEventListener("mk-install-ready", on);
  }, []);
  const install = async () => {
    if (installed) { toast("Marketku sudah terpasang di HP kamu"); return; }
    if (deferred) {
      await deferred.prompt();
      const r = await deferred.userChoice;
      if (r.outcome === "accepted") { toast.success("Marketku dipasang di layar utama"); setInstalled(true); }
      deferred = null; setReady(false);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(ios ? "Ketuk tombol Bagikan di Safari, lalu pilih \"Tambah ke Layar Utama\"." : "Buka menu ⋮ di browser, lalu pilih \"Tambahkan ke layar utama\" / \"Instal aplikasi\".", { duration: 7000 });
  };
  return { installed, ready, install };
}
