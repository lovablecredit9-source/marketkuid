import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type TourStep = { title: string; desc: string; target?: string };

const EVENT = "marketku-tour";
/** Restart the guided tour of whatever page is currently mounted. */
export const startTour = () => window.dispatchEvent(new CustomEvent(EVENT));

export function PageTour({ id, steps, panel = false, auto = true }: { id: string; steps: TourStep[]; panel?: boolean; auto?: boolean }) {
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const key = `marketku-tour:${id}`;

  useEffect(() => {
    const open = () => setI(0);
    window.addEventListener(EVENT, open);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (auto && !window.localStorage.getItem(key)) t = setTimeout(open, 700);
    return () => { window.removeEventListener(EVENT, open); if (t) clearTimeout(t); };
  }, [auto, key]);

  const measure = useCallback(() => {
    if (i === null) return;
    const target = steps[i]?.target;
    const el = target ? document.querySelector(`[data-tour="${target}"]`) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [i, steps]);

  useLayoutEffect(() => {
    if (i === null) return;
    const target = steps[i]?.target;
    const el = target ? document.querySelector(`[data-tour="${target}"]`) : null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(measure, 350);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [i, steps, measure]);

  const step = i === null ? undefined : steps[i];
  if (i === null || !step || typeof document === "undefined") return null;
  const last = i === steps.length - 1;
  const close = () => { window.localStorage.setItem(key, "1"); setI(null); };

  const vh = window.innerHeight;
  const below = !rect || vh - rect.bottom > 220 || rect.top < 220;
  const cardStyle = rect
    ? below ? { top: Math.min(rect.bottom + 12, vh - 200) } : { bottom: vh - rect.top + 12 }
    : { top: "30%" };

  return createPortal(
    <div className={`${panel ? "seller-panel bg-transparent" : ""} fixed inset-0 z-[60]`}>
      {rect ? (
        <div aria-hidden className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: "0 0 0 9999px color-mix(in oklch, var(--background) 72%, transparent)" }} />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-background/70" />
      )}
      <div role="dialog" aria-label={step.title} style={cardStyle}
        className="fixed inset-x-4 mx-auto max-w-sm rounded-xl border bg-card p-4 text-card-foreground shadow-2xl animate-in fade-in-0 zoom-in-95">
        <button aria-label="Tutup panduan" onClick={close} className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition active:scale-90"><X className="h-4 w-4" /></button>
        <h3 className="pr-6 text-base font-bold">{step.title}</h3>
        <p className="mt-1.5 text-sm text-foreground/85">{step.desc}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{i + 1} / {steps.length}</span>
          <button onClick={() => (i === 0 ? close() : setI(i - 1))} className="ml-auto rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold transition active:scale-95">Kembali</button>
          <button onClick={() => (last ? close() : setI(i + 1))} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition active:scale-95">{last ? "Selesai" : "Lanjut"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
