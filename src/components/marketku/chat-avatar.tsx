export function ChatAvatar({ name, url, size = "h-12 w-12" }: { name: string; url?: string | undefined; size?: string }) {
  return url
    ? <img src={url} alt={name} className={`${size} shrink-0 rounded-full border object-cover`} />
    : <span className={`${size} grid shrink-0 place-items-center rounded-full border-2 border-accent bg-gradient-to-br from-primary to-tone-cyan font-bold text-primary-foreground`}>{name.charAt(0).toUpperCase()}</span>;
}

export const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😉", "😍", "😘", "🥰", "🤗",
  "🤔", "🙏", "👍", "👌", "🙌", "🎉", "🔥", "💯", "✨", "😅",
  "😎", "😇", "😢", "😭", "😡", "😴", "🤝", "💪", "❤️", "💙",
];

/** "Online" within 2 minutes, otherwise "Terakhir online X lalu". */
export function lastSeenLabel(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "Belum pernah online";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 2) return "Online";
  if (min < 60) return `Terakhir online ${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Terakhir online ${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Terakhir online ${d} hari lalu`;
  return `Terakhir online ${new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
}
