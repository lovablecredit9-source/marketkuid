import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { countdown, flashPhase, type FlashSale } from "@/lib/flash";

/** Ticking clock (1s) for countdowns; starts after hydration. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return now;
}

/** Red flash-sale bar on the product page: live countdown or "starts in". */
export function FlashStrip({ sales }: { sales: FlashSale[] }) {
  const now = useNow();
  const live = sales.filter((f) => flashPhase(f, now) === "live").sort((a, b) => b.percent - a.percent)[0];
  const next = sales.filter((f) => flashPhase(f, now) === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const f = live ?? next;
  if (!f) return null;
  const left = f.quota !== null ? Math.max(0, f.quota - f.sold) : null;
  return (
    <div className="flex items-center justify-between gap-2 bg-destructive px-3.5 py-2 text-destructive-foreground">
      <span className="flex items-center gap-1.5 text-[13px] font-bold"><Zap className="h-4 w-4 fill-current" /> FLASH SALE -{f.percent}%</span>
      <span className="text-right text-[11.5px] leading-tight">
        {live ? "Berakhir dalam" : "Mulai dalam"} <b className="font-mono text-[12.5px]">{countdown(+new Date(live ? f.ends_at : f.starts_at) - now)}</b>
        {left !== null && <span className="block opacity-90">Sisa kuota {left}</span>}
      </span>
    </div>
  );
}
