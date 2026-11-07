/** "2 rb+ dilihat" style view counter like marketku.id (exact below 1.000). */
export function viewsLabel(n: number): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 1_000_000) return `${Math.floor(v / 1_000_000)} jt+ dilihat`;
  if (v >= 1_000) return `${Math.floor(v / 1_000)} rb+ dilihat`;
  return `${v} dilihat`;
}
