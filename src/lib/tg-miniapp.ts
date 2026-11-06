/** Telegram Mini App launch data (browser only). Kept in sessionStorage so in-app navigation and logout re-login keep working. */
export const ADMIN_TG_INIT_KEY = "marketku-tg-admin-initdata";

export function readTgInitData(storageKey: string) {
  if (typeof window === "undefined") return "";
  const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData");
  const v = w.Telegram?.WebApp?.initData || fromHash || window.sessionStorage.getItem(storageKey) || "";
  if (v) window.sessionStorage.setItem(storageKey, v);
  return v;
}

export function hasTgInitData(storageKey: string) {
  return typeof window !== "undefined" && !!window.sessionStorage.getItem(storageKey);
}
