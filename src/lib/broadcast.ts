export const BROADCAST_MAX = 4000;
/** Max recipients per broadcast send (Telegram allows ~30 msgs/s; we send 20 per second). */
export const BROADCAST_BATCH = 500;

/** Keeps only the HTML tags Telegram supports in broadcasts (<b>, <i>, <a href>); escapes everything else. */
export function cleanBroadcastHtml(input: string) {
  const esc = (s: string) => s.replace(/&(?!(amp|lt|gt|quot);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const out: string[] = [];
  const re = /<\/?(b|i|a)(\s+href="(https?:\/\/[^"<>\s]+)")?\s*>/gi;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    out.push(esc(input.slice(last, m.index)));
    const closing = m[0].startsWith("</");
    const tag = m[1]!.toLowerCase();
    if (closing) out.push(`</${tag}>`);
    else if (tag === "a") out.push(m[3] ? `<a href="${m[3]}">` : esc(m[0]));
    else out.push(`<${tag}>`);
    last = m.index + m[0].length;
  }
  out.push(esc(input.slice(last)));
  return out.join("");
}
