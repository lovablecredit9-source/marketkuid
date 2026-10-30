import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Must match request_withdrawal() in the database. */
export const MIN_WITHDRAW = 50000;
export const FEE_REGULAR = 2000;
export const FEE_SAME_DAY = 3000;

export function withdrawQuote(balance: number, sameDay: boolean) {
  const fee = sameDay ? FEE_SAME_DAY : FEE_REGULAR;
  return { amount: balance, commission: 0, fee, net: Math.max(0, balance - fee), allowed: balance >= MIN_WITHDRAW };
}

export type WithdrawStatus = "pending" | "sent" | "rejected";
export const WITHDRAW_STATUS: Record<WithdrawStatus, { label: string; cls: string }> = {
  pending: { label: "Diproses", cls: "bg-warning/15 text-warning" },
  sent: { label: "Selesai", cls: "bg-success/15 text-success" },
  rejected: { label: "Ditolak", cls: "bg-destructive/20 text-destructive" },
};

export const maskNumber = (n?: string | null) => (n ? `••••${n.slice(-4)}` : "");

export type Withdrawal = {
  id: string; amount: number; fee: number; net: number; same_day: boolean; auto: boolean;
  bank_provider: string; bank_number: string; bank_holder: string | null; status: WithdrawStatus;
  admin_note: string | null; created_at: string; reviewed_at: string | null;
};

export function useWithdrawals(uid?: string) {
  return useQuery({
    queryKey: ["withdrawals", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawal_requests").select("*").eq("user_id", uid!).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Withdrawal[];
    },
  });
}

/** Regular withdrawals left today (1 per day, WIB). */
export function regularQuotaLeft(list: Withdrawal[], now = new Date()) {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const used = list.some((w) => !w.same_day && w.status !== "rejected" && day(new Date(w.created_at)) === day(now));
  return used ? 0 : 1;
}

export const fmtWDate = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
export const fmtWDateTime = (s: string) => `${fmtWDate(s)}, ${new Date(s).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(":", ".")}`;
