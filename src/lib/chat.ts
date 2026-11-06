import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ---------- Seller Center session (separate "login" on top of the buyer session) ---------- */
const UNLOCK_PREFIX = "marketku-seller-unlock:";

export const isSellerUnlocked = (uid: string | undefined) =>
  !!uid && typeof window !== "undefined" && window.localStorage.getItem(UNLOCK_PREFIX + uid) === "1";
const SESSION_PENDING = "marketku-seller-session-pending:";
/** Unlocks Seller Center and queues one login-history entry (recorded by the Seller Center layout). */
export const unlockSeller = (uid: string, via = "password") => {
  window.localStorage.setItem(UNLOCK_PREFIX + uid, "1");
  window.localStorage.setItem(SESSION_PENDING + uid, via);
};
export const takePendingSellerSession = (uid: string) => {
  const v = window.localStorage.getItem(SESSION_PENDING + uid);
  if (v) window.localStorage.removeItem(SESSION_PENDING + uid);
  return v;
};
export const SELLER_SESSION_ID_KEY = "marketku-seller-session-id:";
export const lockSeller = (uid: string) => window.localStorage.removeItem(UNLOCK_PREFIX + uid);
export function clearSellerLocks() {
  for (const k of Object.keys(window.localStorage)) if (k.startsWith(UNLOCK_PREFIX)) window.localStorage.removeItem(k);
}
/** Seller presence only counts while the seller is inside an unlocked Seller Center. */
export const inSellerCenter = (uid: string | undefined) =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/seller") && isSellerUnlocked(uid);

/* ---------- Message status ticks (WhatsApp style) ---------- */
export type TickState = "sent" | "delivered" | "read";
export function tickState(m: { delivered_at: string | null; read_at: string | null }): TickState {
  if (m.read_at) return "read";
  if (m.delivered_at) return "delivered";
  return "sent";
}

/* ---------- Delete message: "untuk semua orang" only by the sender, max 1 hour after sending ---------- */
export const DELETE_FOR_ALL_MS = 60 * 60_000;
export function canDeleteForAll(m: { mine: boolean; created_at: string; deleted_at: string | null }, now = Date.now()) {
  return m.mine && !m.deleted_at && now - new Date(m.created_at).getTime() <= DELETE_FOR_ALL_MS;
}

/* ---------- Unread counters for nav badge and role switch dot ---------- */
export function unreadTotals(rows: { buyer_id: string; seller_id: string; buyer_unread: number; seller_unread: number; buyer_hidden: boolean; seller_hidden: boolean }[], uid: string) {
  let buyer = 0, seller = 0;
  for (const c of rows) {
    if (c.buyer_id === uid && !c.buyer_hidden) buyer += c.buyer_unread;
    if (c.seller_id === uid && !c.seller_hidden) seller += c.seller_unread;
  }
  return { buyer, seller, total: buyer + seller };
}

export function useUnreadChats(uid: string | undefined) {
  return useQuery({
    queryKey: ["unread_chats", uid], enabled: !!uid, refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase.from("conversations").select("buyer_id, seller_id, buyer_unread, seller_unread, buyer_hidden, seller_hidden").limit(500);
      return unreadTotals(data ?? [], uid!);
    },
  });
}
