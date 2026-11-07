import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Mic button: speak a product name (Bahasa Indonesia), then `onResult` receives the text. Hidden where unsupported. */
export function VoiceSearchButton({ onResult, className = "" }: { onResult: (text: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => { setSupported(!!ctor()); return () => rec.current?.stop(); }, []);
  if (!supported) return null;

  const start = () => {
    const C = ctor();
    if (!C) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new C();
    r.lang = "id-ID"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript?.trim(); if (t) onResult(t); };
    r.onerror = (e) => { if (e.error === "not-allowed") toast.error("Izinkan akses mikrofon untuk cari pakai suara"); else if (e.error !== "aborted" && e.error !== "no-speech") toast.error("Suara tidak terdengar, coba lagi"); };
    r.onend = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); toast("Silakan ucapkan nama produk…"); } catch { setListening(false); }
  };

  return (
    <button type="button" aria-label={listening ? "Berhenti mendengarkan" : "Cari pakai suara"} onClick={start}
      className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full transition active:scale-90 ${listening ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"} ${className}`}>
      {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />}
      <Mic className="relative h-4 w-4" />
    </button>
  );
}
