import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RekberDeal = Database["public"]["Tables"]["rekber_deals"]["Row"];
export type FeeBearer = "pembeli" | "penjual" | "dibagi";

export const REKBER_MIN = 10000;
export const REKBER_MAX = 50000000;
/** Mirrors create_rekber: 1% of the amount, rounded up. */
export const REKBER_FEE_RATE = 0.01;

export function rekberFees(amount: number, bearer: FeeBearer) {
  const fee = Math.ceil(amount * REKBER_FEE_RATE);
  const buyerShare = bearer === "pembeli" ? fee : bearer === "dibagi" ? Math.ceil(fee / 2) : 0;
  const sellerShare = bearer === "penjual" ? fee : bearer === "dibagi" ? Math.floor(fee / 2) : 0;
  return { fee, buyerPays: amount + buyerShare, sellerReceives: amount - sellerShare };
}

export const BEARER_LABEL: Record<FeeBearer, string> = { pembeli: "Pembeli", penjual: "Penjual", dibagi: "Dibagi dua" };

export type RekberView = "deposit" | "ditahan" | "sengketa" | "selesai" | "dikembalikan" | "dibatalkan" | "kedaluwarsa";

export function rekberView(d: Pick<RekberDeal, "status" | "deposit_deadline">): RekberView {
  if (d.status === "menunggu_deposit") return new Date(d.deposit_deadline).getTime() < Date.now() ? "kedaluwarsa" : "deposit";
  return d.status as RekberView;
}

export const VIEW_LABEL: Record<RekberView, [string, string]> = {
  deposit: ["Perlu deposit", "bg-amber-500/15 text-amber-500"],
  ditahan: ["Ditahan", "bg-primary/15 text-primary"],
  sengketa: ["Sengketa", "bg-destructive/15 text-destructive"],
  selesai: ["Selesai", "bg-emerald-500/15 text-emerald-500"],
  dikembalikan: ["Dikembalikan", "bg-muted text-muted-foreground"],
  dibatalkan: ["Dibatalkan", "bg-muted text-muted-foreground"],
  kedaluwarsa: ["Kedaluwarsa", "bg-muted text-muted-foreground"],
};

export const rekberLink = (token: string) => `${window.location.origin}/rekber?t=${token}`;

export const fmtRekberDate = (s: string) =>
  new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function useMyRekber(uid: string | undefined) {
  return useQuery({
    queryKey: ["rekber", uid],
    enabled: !!uid,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("rekber_deals").select("*")
        .or(`seller_id.eq.${uid},buyer_id.eq.${uid}`).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as RekberDeal[];
    },
  });
}

export function rekberStats(rows: RekberDeal[], uid: string | undefined) {
  let held = 0, saldo = 0, action = 0;
  for (const d of rows) {
    const v = rekberView(d);
    if (v === "ditahan" || v === "sengketa") held += d.amount;
    if (v === "selesai" && d.seller_id === uid) saldo += d.seller_receives;
    if (d.buyer_id === uid && v === "ditahan") action++;
    if (d.seller_id === uid && v === "sengketa") action++;
  }
  return { held, saldo, action };
}

export const errText = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan");
