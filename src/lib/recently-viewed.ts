/** Products the buyer opened on this device (newest first), kept in localStorage. */
export const RECENT_KEY = "mk-recent-products";
export const RECENT_MAX = 20;

export function pushRecent(list: string[], id: string, max = RECENT_MAX): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

export function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberViewed(id: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(readRecent(), id))); } catch { /* storage off */ }
}

export function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* storage off */ }
}

/** Keep the stored order (newest view first) for products that still exist. */
export function orderByRecent<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is T => !!p);
}

/** Suggestions: unseen products in the categories the buyer viewed, most-viewed category first. */
export function recommendFromViewed<T extends { id: string; category: string | null; sold_count: number }>(
  pool: T[], viewed: T[], limit = 10,
): T[] {
  const weight = new Map<string, number>();
  viewed.forEach((p, i) => { if (p.category) weight.set(p.category, (weight.get(p.category) ?? 0) + (viewed.length - i)); });
  const seen = new Set(viewed.map((p) => p.id));
  return pool
    .filter((p) => !seen.has(p.id) && p.category && weight.has(p.category))
    .sort((a, b) => (weight.get(b.category!) ?? 0) - (weight.get(a.category!) ?? 0) || b.sold_count - a.sold_count)
    .slice(0, limit);
}
