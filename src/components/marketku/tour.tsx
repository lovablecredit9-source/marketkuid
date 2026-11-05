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
  const vw = window.innerWidth;
  const below = !rect || vh - rect.bottom > 220 || rect.top < 220;
  const cardW = Math.min(300, vw - 20);
  const cx = rect ? rect.left + rect.width / 2 : vw / 2;
  const left = Math.max(10, Math.min(cx - cardW / 2, vw - cardW - 10));
  const arrowX = Math.max(14, Math.min(cx - left, cardW - 14));
  const cardStyle = rect
    ? below ? { top: Math.min(rect.bottom + 10, vh - 200), left, width: cardW } : { bottom: vh - rect.top + 10, left, width: cardW }
    : { top: "30%", left, width: cardW };

  return createPortal(
    <div className={`${panel ? "seller-panel !bg-transparent" : ""} fixed inset-0 z-[60]`}>
      {rect ? (
        <div aria-hidden className="pointer-events-none fixed rounded-lg transition-all duration-300"
          style={{ top: rect.top - 3, left: rect.left - 3, width: rect.width + 6, height: rect.height + 6, boxShadow: "0 0 0 9999px var(--tour-overlay)" }} />
      ) : (
        <div aria-hidden className="fixed inset-0" style={{ background: "var(--tour-overlay)" }} />
      )}
      <div role="dialog" aria-label={step.title} style={cardStyle}
        className="fixed rounded-lg border bg-card px-4 pb-3.5 pt-4 text-card-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
        {rect && <span aria-hidden className={`absolute h-3 w-3 rotate-45 bg-card ${below ? "-top-1.5 border-l border-t" : "-bottom-1.5 border-b border-r"}`} style={{ left: arrowX - 6 }} />}
        <button aria-label="Tutup panduan" onClick={close} className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-md text-muted-foreground"><X className="h-4 w-4" strokeWidth={2.25} /></button>
        <h3 className="pr-6 text-[15px] font-bold leading-5">{step.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-[1.45] text-foreground/85">{step.desc}</p>
        <div className="mt-3.5 flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">{i + 1} / {steps.length}</span>
          <button disabled={i === 0} onClick={() => setI(i - 1)} className="ml-auto rounded-md border bg-card px-3 py-1.5 text-[13px] font-semibold disabled:text-muted-foreground">Kembali</button>
          <button onClick={() => (last ? close() : setI(i + 1))} className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground">{last ? "Selesai" : "Lanjut"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
