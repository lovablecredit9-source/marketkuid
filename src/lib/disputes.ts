import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Reasons a buyer can tick when reporting an order (same list as marketku.id). */
export const DISPUTE_REASONS = [
  "Produk atau akses tidak dapat digunakan",
  "Produk tidak sesuai deskripsi",
  "Produk belum diterima",
  "Seller tidak merespons",
  "Ada masalah keamanan akun",
  "Alasan lainnya",
] as const;

export const MAX_DISPUTE_PHOTOS = 3;

export type DisputeStatus = "terbuka" | "ditinjau" | "dilepas" | "refund" | "ditutup";
export const DISPUTE_STATUS: Record<DisputeStatus, { label: string; tone: "warn" | "info" | "ok" | "bad" | "muted" }> = {
  terbuka: { label: "Terbuka", tone: "warn" },
  ditinjau: { label: "Sedang ditinjau", tone: "info" },
  dilepas: { label: "Dana dilepas", tone: "ok" },
  refund: { label: "Refund", tone: "bad" },
  ditutup: { label: "Ditutup", tone: "muted" },
};
export const isDisputeActive = (s: string) => s === "terbuka" || s === "ditinjau";

/** Buyer may report only paid orders whose funds are still held (not confirmed / not released). */
export function canReportOrder(o: { status: string; paid_at: string | null; buyer_confirmed_at: string | null }, released = false) {
  return !!o.paid_at && ["paid", "processing", "completed"].includes(o.status) && !o.buyer_confirmed_at && !released;
}

export function disputeStats(rows: { status: string }[]) {
  const c = (s: DisputeStatus) => rows.filter((r) => r.status === s).length;
  return { total: rows.length, aktif: c("terbuka") + c("ditinjau"), terbuka: c("terbuka"), ditinjau: c("ditinjau"), selesai: c("dilepas") + c("refund") + c("ditutup") };
}

export type DisputeRow = {
  id: string; code: string; order_id: string; buyer_id: string; seller_id: string; reasons: string[]; note: string | null;
  status: string; resolution_note: string | null; created_at: string; updated_at: string;
  orders: { order_no: number; total: number; buyer_name: string | null; store_name: string | null; order_items: { product_name: string }[] } | null;
};

const SELECT = "*, orders(order_no, total, buyer_name, store_name, order_items(product_name))";

export function useDisputes(role: "buyer" | "seller" | "admin", uid: string | undefined) {
  return useQuery({
    queryKey: ["disputes", role, uid], enabled: !!uid, refetchInterval: 15_000,
    queryFn: async () => {
      let q = supabase.from("order_disputes").select(SELECT).order("updated_at", { ascending: false }).limit(200);
      if (role === "buyer") q = q.eq("buyer_id", uid!);
      if (role === "seller") q = q.eq("seller_id", uid!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DisputeRow[];
    },
  });
}

export function useDispute(id: string | undefined) {
  return useQuery({
    queryKey: ["dispute", id], enabled: !!id, refetchInterval: 5_000,
    queryFn: async () => {
      const [d, m] = await Promise.all([
        supabase.from("order_disputes").select(SELECT).eq("id", id!).maybeSingle(),
        supabase.from("dispute_messages").select("*").eq("dispute_id", id!).order("created_at"),
      ]);
      if (d.error) throw d.error;
      if (m.error) throw m.error;
      return { dispute: d.data as unknown as DisputeRow | null, messages: m.data ?? [] };
    },
  });
}

export function useDisputeFiles(paths: string[]) {
  return useQuery({
    queryKey: ["dispute_files", paths], enabled: paths.length > 0, staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("dispute-evidence").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      for (const r of data ?? []) if (r.path && r.signedUrl) m[r.path] = r.signedUrl;
      return m;
    },
  });
}

export async function uploadDisputePhoto(disputeId: string, file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Bukti harus berupa foto JPG, PNG, atau WebP");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB");
  const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const path = `${disputeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("dispute-evidence").upload(path, file, { contentType: file.type });
  if (error) throw new Error("Gagal mengunggah foto");
  return path;
}
