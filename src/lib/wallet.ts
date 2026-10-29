import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEPOSIT_MAX = 10_000_000;
export const DEFAULT_MIN_DEPOSIT = 10_000;

/** Mirrors the create_deposit checks so buyers see the error before uploading. */
export function depositAmountError(amount: number, min = DEFAULT_MIN_DEPOSIT): string | null {
  if (!Number.isFinite(amount) || amount < min) return `Minimal deposit Rp${min.toLocaleString("id-ID")}`;
  if (amount > DEPOSIT_MAX) return "Maksimal deposit Rp10.000.000";
  return null;
}

export const DEPOSIT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-500/15 text-amber-600" },
  approved: { label: "Disetujui", cls: "bg-emerald-500/15 text-emerald-600" },
  rejected: { label: "Ditolak", cls: "bg-destructive/15 text-destructive" },
};

export function useIsAdmin(uid: string | undefined) {
  return useQuery({
    queryKey: ["is_admin", uid], enabled: !!uid, staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: uid!, _role: "admin" });
      if (error) throw error;
      return !!data;
    },
  });
}

export function useWallet(uid: string | undefined) {
  return useQuery({
    queryKey: ["wallet", uid], enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("balance").eq("user_id", uid!).maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
    },
  });
}

export function usePaymentSettings(enabled = true) {
  return useQuery({
    queryKey: ["payment_settings"], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Signed URLs for files in the private payment-assets bucket. */
export function usePaymentUrls(paths: (string | null | undefined)[]) {
  const key = paths.filter((p): p is string => !!p);
  return useQuery({
    queryKey: ["pay_urls", key], enabled: key.length > 0, staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("payment-assets").createSignedUrls(key, 3600);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of data) if (r.path && r.signedUrl) m[r.path] = r.signedUrl;
      return m;
    },
  });
}

export async function uploadPaymentImage(folder: string, file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Format harus JPG, PNG, atau WebP");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB");
  const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("payment-assets").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}
