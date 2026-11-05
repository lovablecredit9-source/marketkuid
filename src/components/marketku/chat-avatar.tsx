import { Check, CheckCheck } from "lucide-react";
import type { TickState } from "@/lib/chat";

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

const hhmm = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** "Online" within 2 minutes; else "Terakhir dilihat 14.30" (today) / "kemarin 14.30" / "27 Okt 2026 14.30". */
export function lastSeenLabel(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "Belum pernah online";
  const t = new Date(iso).getTime();
  if (now - t < 2 * 60_000) return "Online";
  const d = new Date(iso);
  const days = Math.round((dayStart(now) - dayStart(t)) / 86_400_000);
  if (days <= 0) return `Terakhir dilihat ${hhmm(d)}`;
  if (days === 1) return `Terakhir dilihat kemarin ${hhmm(d)}`;
  return `Terakhir dilihat ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} ${hhmm(d)}`;
}

/** Short stamp: "14.30" today, "Kemarin 14.30", else "27 Okt 14.30" (year added if not this year). */
export function stampLabel(iso: string, now = Date.now()) {
  const d = new Date(iso);
  const days = Math.round((dayStart(now) - dayStart(d.getTime())) / 86_400_000);
  if (days <= 0) return hhmm(d);
  if (days === 1) return `Kemarin ${hhmm(d)}`;
  const sameYear = new Date(now).getFullYear() === d.getFullYear();
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })} ${hhmm(d)}`;
}

/** WhatsApp-style ticks: 1 grey = terkirim, 2 grey = diterima, 2 blue = dibaca. */
export function MsgTicks({ state, className = "" }: { state: TickState; className?: string }) {
  const label = state === "read" ? "Dibaca" : state === "delivered" ? "Diterima" : "Terkirim";
  const Icon = state === "sent" ? Check : CheckCheck;
  return <Icon aria-label={label} className={`inline h-3.5 w-3.5 transition-colors duration-300 ${state === "read" ? "text-chat-read" : "opacity-80"} ${className}`} strokeWidth={2.5} />;
}

/** Bouncing three dots shown while the partner types. */
/** marketku.id-style typing pill: three bouncing dots and "<name> sedang mengetik…". */
export function TypingPill({ name }: { name: string }) {
  return (
    <div className="mk-pop-in flex justify-start" role="status" aria-live="polite">
      <div className="inline-flex max-w-[85%] items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-3 shadow-sm">
        <span className="inline-flex items-center gap-[3px]" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="mk-typing-bounce h-[7px] w-[7px] rounded-full bg-primary/40" style={{ animationDelay: `${i * 0.16 - 0.32}s` }} />)}
        </span>
        <span className="truncate text-[12px] text-muted-foreground">{name} sedang mengetik…</span>
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Sedang mengetik">
      {[0, 1, 2].map((i) => <span key={i} className="mk-typing-dot h-2 w-2 rounded-full bg-muted-foreground/70" style={{ animationDelay: `${i * 0.15}s` }} />)}
    </span>
  );
}
