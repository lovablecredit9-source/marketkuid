import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Ban duration choices in days; 0 = permanent. */
export const BAN_DURATIONS = [
  { days: 1, label: "1 hari" },
  { days: 3, label: "3 hari" },
  { days: 7, label: "7 hari" },
  { days: 14, label: "14 hari" },
  { days: 30, label: "30 hari" },
  { days: 0, label: "Permanen" },
] as const;

/** Wallet / payment providers admin can add for manual top up. */
export const PAYMENT_PROVIDERS = [
  { provider: "QRIS", kind: "qris", color: "#E11D48" },
  { provider: "DANA", kind: "ewallet", color: "#118EEA" },
  { provider: "GoPay", kind: "ewallet", color: "#00AA13" },
  { provider: "OVO", kind: "ewallet", color: "#4C3494" },
  { provider: "ShopeePay", kind: "ewallet", color: "#EE4D2D" },
  { provider: "LinkAja", kind: "ewallet", color: "#E82127" },
  { provider: "BCA", kind: "bank", color: "#0060AF" },
  { provider: "BRI", kind: "bank", color: "#00529C" },
  { provider: "Mandiri", kind: "bank", color: "#003D79" },
  { provider: "BNI", kind: "bank", color: "#F15A23" },
] as const;
export type PaymentKind = "qris" | "ewallet" | "bank";
export const providerColor = (p: string) => PAYMENT_PROVIDERS.find((x) => x.provider === p)?.color ?? "#2563EB";
export const KIND_LABEL: Record<PaymentKind, string> = { qris: "QRIS", ewallet: "E-Wallet", bank: "Transfer Bank" };

/** "Permanen" or "s/d 12 Nov 2026 14.00". */
export function banUntilLabel(until: string | null | undefined) {
  if (!until) return "Permanen";
  return `s/d ${new Date(until).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

/** Days left (rounded up) for a timed ban; null for permanent. */
export function banDaysLeft(until: string | null | undefined, now = Date.now()) {
  if (!until) return null;
  return Math.max(0, Math.ceil((new Date(until).getTime() - now) / 86_400_000));
}

export type MyBan = { kind: "account" | "store"; reason: string | null; banned_until: string | null };

/** Active account/store bans of the signed-in user. */
export function useMyBans(uid: string | undefined) {
  return useQuery({
    queryKey: ["my_bans", uid], enabled: !!uid, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_bans");
      if (error) throw error;
      return (data ?? []) as MyBan[];
    },
  });
}

export function usePaymentMethods(enabled = true) {
  return useQuery({
    queryKey: ["payment_methods"], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("*").order("sort").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const ADMIN_ACTION_LABEL: Record<string, string> = {
  ban_user: "Blokir akun", unban_user: "Buka blokir akun", ban_store: "Blokir toko", unban_store: "Buka blokir toko",
  wallet_add: "Tambah saldo", wallet_sub: "Kurangi saldo", hide_product: "Turunkan produk", show_product: "Tampilkan produk",
  approve_deposit: "Setujui deposit", reject_deposit: "Tolak deposit",
};
