import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Copy, Download, Send, Share2, X, MessageCircle, Check } from "lucide-react";

/** Bottom sheet to share a link: WhatsApp, Telegram, X, Facebook, copy link, native share, and a downloadable QR code. */
export function ShareSheet({ open, onOpenChange, title, url, text }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; url: string; text?: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const msg = text ?? `Cek ${title} di Marketku`;
  useEffect(() => {
    if (!open || !url) return;
    let alive = true;
    void import("qrcode").then((m) => m.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" })).then((d) => { if (alive) setQr(d); }).catch(() => setQr(null));
    return () => { alive = false; };
  }, [open, url]);

  const enc = encodeURIComponent;
  const targets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${msg}\n${url}`)}`, cls: "bg-tone-green/15 text-tone-green", icon: MessageCircle },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(msg)}`, cls: "bg-tone-blue/15 text-tone-blue", icon: Send },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(msg)}`, cls: "bg-foreground/10 text-foreground", glyph: "𝕏" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, cls: "bg-tone-blue/15 text-tone-blue", glyph: "f" },
  ];
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link disalin"); window.setTimeout(() => setCopied(false), 2000); } catch { toast(url); }
  };
  const native = async () => { try { await navigator.share({ title, text: msg, url }); } catch { /* dibatalkan */ } };
  const canNative = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
          <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-bold">Bagikan</Dialog.Title>
            <Dialog.Close aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition active:scale-90"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{title}</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {targets.map((t) => (
              <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-[11px] font-semibold transition active:scale-95">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl text-lg font-black ${t.cls}`}>{t.icon ? <t.icon className="h-5 w-5" /> : t.glyph}</span>{t.label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border bg-muted/40 p-1.5 pl-3">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</span>
            <button onClick={() => void copy()} className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition active:scale-95">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Disalin" : "Salin"}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border p-3">
            {qr ? <img src={qr} alt="Kode QR link" className="h-24 w-24 rounded-lg bg-background p-1" /> : <span className="h-24 w-24 animate-pulse rounded-lg bg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Kode QR</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Teman tinggal scan pakai kamera HP untuk membuka link ini.</p>
              {qr && <a href={qr} download="marketku-qr.png" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary"><Download className="h-3.5 w-3.5" /> Simpan gambar</a>}
            </div>
          </div>
          {canNative && (
            <button onClick={() => void native()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98]"><Share2 className="h-4 w-4" /> Aplikasi lain</button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
