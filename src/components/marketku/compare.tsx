import { useEffect, useState } from "react";
import { toast } from "sonner";
import { COMPARE_KEY, COMPARE_MAX, readCompare, toggleCompareList, writeCompare } from "@/lib/buyer-tools";

/** Compare list on this device (max 3), read after hydration and synced across components. */
export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readCompare());
    sync();
    window.addEventListener(`${COMPARE_KEY}:change`, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(`${COMPARE_KEY}:change`, sync); window.removeEventListener("storage", sync); };
  }, []);
  const toggle = (id: string) => {
    const r = toggleCompareList(readCompare(), id);
    if (r.full) { toast.error(`Maksimal ${COMPARE_MAX} produk untuk dibandingkan`); return false; }
    writeCompare(r.list);
    toast.success(r.list.includes(id) ? "Ditambahkan ke Bandingkan" : "Dihapus dari Bandingkan");
    return true;
  };
  const clear = () => writeCompare([]);
  return { ids, toggle, clear, has: (id: string) => ids.includes(id) };
}
