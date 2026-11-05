import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { rpSeller } from "./seller-ui";

export const SELLER_FEE_PERCENT = 3;
export const HOLD_HOURS = 5;
export const sellerNet = (gross: number) => gross - Math.ceil((gross * SELLER_FEE_PERCENT) / 100);

export function holdLeft(releaseAt: string, now = Date.now()) {
  const ms = Math.max(0, new Date(releaseAt).getTime() - now);
  const m = Math.ceil(ms / 60000);
  if (m <= 0) return "Segera cair";
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} jam ${m % 60} menit lagi` : `${m} menit lagi`;
}

export function useSellerHolds(uid?: string) {
  return useQuery({
    queryKey: ["seller-holds", uid],
    enabled: !!uid,
    refetchInterval: 60000,
    queryFn: async () => {
      await supabase.rpc("release_seller_holds");
      const { data, error } = await supabase.rpc("seller_holds");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSellerBalance(uid?: string) {
  return useQuery({
    queryKey: ["seller-balance", uid],
    enabled: !!uid,
    refetchInterval: 60000,
    queryFn: async () => {
      if (!uid) return 0;
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", uid).maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });
}

const holdSpan = (h: { completed_at: string; release_at: string }) =>
  Math.max(1, new Date(h.release_at).getTime() - new Date(h.completed_at).getTime() || HOLD_HOURS * 3600000);

const waLink = (n: string) => {
  const d = n.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${d}`;
};

export type HoldKind = "biasa" | "garansi";
export const HOLD_TITLE: Record<HoldKind, string> = { biasa: "Saldo Tertahan Non-Garansi", garansi: "Saldo Menunggu Masa Garansi" };
/** Garansi orders stay held until the warranty window ends, at most this many days. */
export const WARRANTY_HOLD_MAX_DAYS = 3;
export const holdsOfKind = <T extends { kind?: string | null }>(list: T[], kind: HoldKind) =>
  list.filter((h) => (h.kind === "garansi" ? "garansi" : "biasa") === kind);

export function HoldsSheet({ open, onClose, uid, kind = "biasa" }: { open: boolean; onClose: () => void; uid?: string | undefined; kind?: HoldKind }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const holds = useSellerHolds(uid);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!open) return undefined; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [open]);
  if (!open) return null;
  const chat = async (buyer: string) => {
    const { data, error } = await supabase.rpc("seller_start_conversation", { p_buyer: buyer });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/chat/$id", params: { id: data as string } });
  };
  const list = holdsOfKind(holds.data ?? [], kind);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="holds-title" className="seller-panel max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border bg-card text-foreground" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 id="holds-title" className="text-[18px] font-semibold leading-6">{HOLD_TITLE[kind]}</h3>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup" className="h-7 w-7 shrink-0"><X /></Button>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Perkiraan waktu dapat berubah jika ada sengketa.</p>
        </div>
        <div className="p-4">
        {holds.isLoading ? <p className="py-6 text-center text-xs text-muted-foreground">Memuat…</p> : list.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Tidak ada transaksi pada kategori ini.</p>
        ) : (
          <div className="space-y-2.5">
            {list.map((h) => (
              <div key={h.order_id} className="rounded-xl border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[13px] font-semibold leading-5"><Package className="mr-1 inline-block h-3.5 w-3.5 align-middle" />{h.product_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">M-{h.order_no}</p>
                  </div>
                  <p className="shrink-0 text-right text-[13px] font-semibold leading-5">{rpSeller(Number(h.amount))}</p>
                </div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_118px] items-center gap-3">
                  <div className="min-w-0 text-xs leading-4">
                    <p className="text-muted-foreground">Pelanggan:</p>
                    <p className="break-words">{h.buyer_name || "Pembeli"}</p>
                  </div>
                  <div className="space-y-1.5">
                    {h.buyer_whatsapp && <Button asChild variant="outline" className="h-auto w-full justify-start whitespace-normal px-2.5 py-2 text-xs leading-4 text-primary">
                      <a href={waLink(h.buyer_whatsapp)} target="_blank" rel="noreferrer">Hubungi via WhatsApp</a>
                    </Button>}
                    <Button variant="outline" onClick={() => void chat(h.buyer_id)} className="h-auto w-full justify-start whitespace-normal px-2.5 py-2 text-xs leading-4 text-primary">Chat via web</Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] leading-4">
                  <span className="text-warning">{kind === "garansi" ? `Masa garansi ${h.warranty_days ?? WARRANTY_HOLD_MAX_DAYS} hari` : "Menunggu"}</span>
                  <span className="text-muted-foreground">{holdLeft(h.release_at, now).replace(/ lagi$/, "")}</span>
                </div>
                <progress aria-label={`Kemajuan pencairan M-${h.order_no}`} max={holdSpan(h)} value={Math.min(holdSpan(h), Math.max(0, holdSpan(h) - (new Date(h.release_at).getTime() - now)))} className="mt-2 block h-2 w-full overflow-hidden rounded-full border-0 bg-transparent [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary" />
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
