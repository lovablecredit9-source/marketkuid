import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MessageCircle, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", uid!).maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });
}

const waLink = (n: string) => {
  const d = n.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${d}`;
};

export function HoldsSheet({ open, onClose, uid }: { open: boolean; onClose: () => void; uid?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const holds = useSellerHolds(uid);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!open) return; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [open]);
  if (!open) return null;
  const chat = async (buyer: string) => {
    const { data, error } = await supabase.rpc("seller_start_conversation", { p_buyer: buyer });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/chat/$id", params: { id: data as string } });
  };
  const list = holds.data ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70" onClick={onClose}>
      <div className="seller-panel max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border bg-card p-4 text-foreground" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-semibold">Saldo Tertahan</h3>
          <button onClick={onClose} aria-label="Tutup"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Dana ditahan maksimal {HOLD_HOURS} jam setelah pesanan selesai, lalu masuk Saldo Penjualan dipotong admin {SELLER_FEE_PERCENT}%.</p>
        {holds.isLoading ? <p className="py-6 text-center text-xs text-muted-foreground">Memuat…</p> : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada saldo tertahan.</p>
        ) : (
          <div className="space-y-2.5">
            {list.map((h) => (
              <div key={h.order_id} className="rounded-xl border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h.buyer_name || "Pembeli"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">M-{h.order_no} · {h.product_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warning">{rpSeller(Number(h.amount))}</p>
                    <p className="text-[11px] text-muted-foreground">Bersih {rpSeller(sellerNet(Number(h.amount)))}</p>
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1 text-[11px] text-warning"><Clock className="h-3 w-3" /> {holdLeft(h.release_at, now)}</p>
                <div className="mt-2.5 flex gap-2">
                  {h.buyer_whatsapp && (
                    <a href={waLink(h.buyer_whatsapp)} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success/20 py-2 text-xs font-medium text-success">
                      <Phone className="h-3.5 w-3.5" /> WA {h.buyer_whatsapp}
                    </a>
                  )}
                  <button onClick={() => chat(h.buyer_id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/20 py-2 text-xs font-medium text-primary">
                    <MessageCircle className="h-3.5 w-3.5" /> Chat via web
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
