/**
 * Tiny pure-JS card renderer (no AI, no wasm): vector shapes + real font glyphs
 * rasterised with anti-aliasing, encoded as PNG. Runs on Node and Workers.
 */
import opentype from "opentype.js";

type Font = opentype.Font;
const FONT_URLS = {
  bold: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf",
  medium: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Medium.ttf",
} as const;
const fontCache = new Map<string, Promise<Font>>();
function font(kind: keyof typeof FONT_URLS) {
  let p = fontCache.get(kind);
  if (!p) {
    p = fetch(FONT_URLS[kind]).then(async (r) => {
      if (!r.ok) throw new Error(`font ${r.status}`);
      return opentype.parse(await r.arrayBuffer());
    });
    p.catch(() => fontCache.delete(kind));
    fontCache.set(kind, p);
  }
  return p;
}

export type RGBA = [number, number, number, number?];
export const hex = (h: string, a = 1): RGBA => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
};

type Poly = number[]; // flat x,y list (closed)

export class Canvas {
  readonly px: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number, bg: RGBA = [255, 255, 255, 1]) {
    this.px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { this.px[i * 4] = bg[0]; this.px[i * 4 + 1] = bg[1]; this.px[i * 4 + 2] = bg[2]; this.px[i * 4 + 3] = 255; }
  }

  private blend(i: number, c: RGBA, cov: number) {
    const a = Math.min(1, cov) * (c[3] ?? 1);
    if (a <= 0) return;
    const p = this.px; const k = i * 4;
    p[k] = p[k]! + (c[0] - p[k]!) * a;
    p[k + 1] = p[k + 1]! + (c[1] - p[k + 1]!) * a;
    p[k + 2] = p[k + 2]! + (c[2] - p[k + 2]!) * a;
  }

  /** Non-zero winding fill with 4 sub-scanlines and exact horizontal coverage. */
  fill(polys: Poly[], color: RGBA | ((x: number, y: number) => RGBA)) {
    const edges: [number, number, number, number, number][] = [];
    let minY = Infinity, maxY = -Infinity;
    for (const pl of polys) {
      const n = pl.length / 2;
      for (let i = 0; i < n; i++) {
        const x0 = pl[i * 2]!, y0 = pl[i * 2 + 1]!, x1 = pl[((i + 1) % n) * 2]!, y1 = pl[((i + 1) % n) * 2 + 1]!;
        if (y0 === y1) continue;
        const dir = y1 > y0 ? 1 : -1;
        const [ax, ay, bx, by] = dir === 1 ? [x0, y0, x1, y1] : [x1, y1, x0, y0];
        edges.push([ax, ay, bx, by, dir]);
        minY = Math.min(minY, ay); maxY = Math.max(maxY, by);
      }
    }
    if (!edges.length) return;
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const acc = new Float32Array(this.w + 2);
    const SS = 4;
    for (let y = y0; y <= y1; y++) {
      acc.fill(0);
      let lo = this.w, hi = -1;
      for (let s = 0; s < SS; s++) {
        const sy = y + (s + 0.5) / SS;
        const xs: [number, number][] = [];
        for (const e of edges) {
          if (sy < e[1] || sy >= e[3]) continue;
          xs.push([e[0] + ((sy - e[1]) / (e[3] - e[1])) * (e[2] - e[0]), e[4]]);
        }
        if (xs.length < 2) continue;
        xs.sort((a, b) => a[0] - b[0]);
        let wind = 0;
        for (let i = 0; i < xs.length - 1; i++) {
          wind += xs[i]![1];
          if (wind === 0) continue;
          const a = Math.max(0, xs[i]![0]), b = Math.min(this.w, xs[i + 1]![0]);
          if (b <= a) continue;
          const ia = Math.floor(a), ib = Math.floor(b);
          lo = Math.min(lo, ia); hi = Math.max(hi, ib);
          if (ia === ib) { acc[ia]! += (b - a) / SS; continue; }
          acc[ia]! += (ia + 1 - a) / SS;
          for (let x = ia + 1; x < ib; x++) acc[x]! += 1 / SS;
          if (ib < this.w) acc[ib]! += (b - ib) / SS;
        }
      }
      for (let x = Math.max(0, lo); x <= Math.min(this.w - 1, hi); x++) {
        if (acc[x]! > 0) this.blend(y * this.w + x, typeof color === "function" ? color(x, y) : color, acc[x]!);
      }
    }
  }

  rect(x: number, y: number, w: number, h: number, color: RGBA | ((x: number, y: number) => RGBA), r = 0) {
    this.fill([roundRect(x, y, w, h, r)], color);
  }
  /** Rounded outline drawn as ring (outer minus inner). */
  stroke(x: number, y: number, w: number, h: number, color: RGBA, r = 0, t = 1.5) {
    const inner = roundRect(x + t, y + t, w - 2 * t, h - 2 * t, Math.max(0, r - t));
    const rev: Poly = [];
    for (let i = inner.length - 2; i >= 0; i -= 2) rev.push(inner[i]!, inner[i + 1]!);
    this.fill([roundRect(x, y, w, h, r), rev], color);
  }
  circle(cx: number, cy: number, r: number, color: RGBA) {
    const p: Poly = [];
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    this.fill([p], color);
  }

  async png() { return encodePng(this.w, this.h, this.px); }
}

export function vgrad(y0: number, y1: number, a: RGBA, b: RGBA) {
  return (_x: number, y: number): RGBA => {
    const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];
  };
}
export function hgrad(x0: number, x1: number, a: RGBA, b: RGBA) {
  return (x: number): RGBA => {
    const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];
  };
}

function roundRect(x: number, y: number, w: number, h: number, r: number): Poly {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return [x, y, x + w, y, x + w, y + h, x, y + h];
  const p: Poly = [];
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) { const a = a0 + (i / 8) * (Math.PI / 2); p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return p;
}

/* ---------------- text ---------------- */

export type TextOpts = { size: number; color: RGBA; weight?: "bold" | "medium"; align?: "left" | "center" | "right"; maxWidth?: number };

export async function measure(text: string, o: Pick<TextOpts, "size" | "weight">) {
  const f = await font(o.weight ?? "medium");
  return f.getAdvanceWidth(text, o.size);
}

/** Draws one line at baseline y; truncates with … to maxWidth. Returns drawn width. */
export async function text(c: Canvas, s: string, x: number, y: number, o: TextOpts) {
  const f = await font(o.weight ?? "medium");
  let str = s;
  if (o.maxWidth) {
    while (str.length > 1 && f.getAdvanceWidth(str, o.size) > o.maxWidth) str = str.slice(0, -2) + "…";
  }
  const w = f.getAdvanceWidth(str, o.size);
  const sx = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  const path = f.getPath(str, sx, y, o.size);
  const polys: Poly[] = [];
  let cur: Poly = []; let lx = 0, ly = 0;
  for (const cmd of path.commands) {
    if (cmd.type === "M") { if (cur.length > 4) polys.push(cur); cur = [cmd.x, cmd.y]; lx = cmd.x; ly = cmd.y; }
    else if (cmd.type === "L") { cur.push(cmd.x, cmd.y); lx = cmd.x; ly = cmd.y; }
    else if (cmd.type === "Q") {
      for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t; cur.push(u * u * lx + 2 * u * t * cmd.x1 + t * t * cmd.x, u * u * ly + 2 * u * t * cmd.y1 + t * t * cmd.y); }
      lx = cmd.x; ly = cmd.y;
    } else if (cmd.type === "C") {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8, u = 1 - t;
        cur.push(u * u * u * lx + 3 * u * u * t * cmd.x1 + 3 * u * t * t * cmd.x2 + t * t * t * cmd.x, u * u * u * ly + 3 * u * u * t * cmd.y1 + 3 * u * t * t * cmd.y2 + t * t * t * cmd.y);
      }
      lx = cmd.x; ly = cmd.y;
    } else if (cmd.type === "Z") { if (cur.length > 4) polys.push(cur); cur = []; }
  }
  if (cur.length > 4) polys.push(cur);
  c.fill(polys, o.color);
  return w;
}

/** Word-wraps into at most maxLines lines. */
export async function wrap(s: string, maxWidth: number, o: Pick<TextOpts, "size" | "weight">, maxLines = 3) {
  const f = await font(o.weight ?? "medium");
  const words = s.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (f.getAdvanceWidth(t, o.size) <= maxWidth || !line) line = t;
    else { lines.push(line); line = w; if (lines.length === maxLines) break; }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1]!.replace(/.{0,2}$/, "…");
  return lines;
}

/* ---------------- PNG ---------------- */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

async function zlib(data: Uint8Array) {
  const cs = new CompressionStream("deflate");
  const out = new Blob([data as BlobPart]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

async function encodePng(w: number, h: number, rgba: Uint8ClampedArray) {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (w * 3 + 1) + 1 + x * 3;
      raw[d] = rgba[s]!; raw[d + 1] = rgba[s + 1]!; raw[d + 2] = rgba[s + 2]!;
    }
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", await zlib(raw)), chunk("IEND", new Uint8Array())];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const png = new Uint8Array(total);
  let o = 0; for (const p of parts) { png.set(p, o); o += p.length; }
  return png;
}
