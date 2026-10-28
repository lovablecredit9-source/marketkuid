import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Store, SquareCheck, Search, RefreshCw, MessageCircle } from "lucide-react";
import { AppShell, EmptyState, soon } from "@/components/marketku/shell";

export const Route = createFileRoute("/pesan")({
  head: () => ({
    meta: [
      { title: "Chat — Marketku" },
      { name: "description", content: "Ruang chat pembeli dan seller Marketku." },
      { property: "og:title", content: "Chat — Marketku" },
      { property: "og:description", content: "Ruang chat Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pesan,
});

function Pesan() {
  const [tab, setTab] = useState<"semua" | "belum">("semua");
  return (
    <AppShell>
      <div className="px-3 pt-3">
        <div className="rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <h1 className="text-2xl font-bold">Chat</h1>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">0</span>
            <div className="ml-auto flex gap-1.5">
              {[{ I: Store, l: "Ganti mode toko" }, { I: SquareCheck, l: "Tandai dibaca" }, { I: Search, l: "Cari chat" }, { I: RefreshCw, l: "Muat ulang" }].map(({ I, l }) => (
                <button key={l} aria-label={l} onClick={() => soon(l)} className="grid h-9 w-9 place-items-center rounded-full border"><I className="h-4 w-4" /></button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 p-4 pb-2">
            {(["semua", "belum"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-accent text-primary" : "bg-card"}`}>
                {t === "semua" ? "Semua" : "Belum dibaca"}
              </button>
            ))}
          </div>
          <div className="p-3">
            <EmptyState icon={MessageCircle} title="Belum ada chat" desc="Percakapan dengan seller atau pembeli akan muncul di sini." />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
