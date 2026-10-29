import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

/** Spinner + label used while a page section is loading (e.g. "Memuat inbox..."). */
export function LoadingLine({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`mk-fade-in flex items-center justify-center gap-3 text-sm text-muted-foreground ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

/** Full-screen "Memuat Marketku..." shown on a fresh page load until the sign-in check finishes. */
export function BootScreen() {
  const { ready } = useAuth();
  const [shown, setShown] = useState(true);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t1 = window.setTimeout(() => setLeaving(true), 350);
    const t2 = window.setTimeout(() => setShown(false), 650);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [ready]);
  if (!shown) return null;
  return (
    <div
      role="status"
      aria-label="Memuat Marketku"
      className={`fixed inset-0 z-[100] grid place-items-center bg-background transition-opacity duration-300 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <p className="mk-boot-text text-base font-bold text-muted-foreground">Memuat Marketku...</p>
    </div>
  );
}
