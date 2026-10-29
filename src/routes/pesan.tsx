import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { UserRoundSearch, SquareCheck, Search, RefreshCw, MessageCircle, X, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/pesan")({
  head: () => pageMeta("Chat — Marketku", "Ruang chat pembeli dan seller Marketku."),
  component: Pesan,
});

function Pesan() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"semua" | "belum">("semua");
  const [search, setSearch] = useState(false);
  const [select, setSelect] = useState(false);
  const [q, setQ] = useState("");
  const btn = (on: boolean) => `grid h-9 w-9 place-items-center rounded-full border transition active:scale-90 ${on ? "border-primary text-primary ring-2 ring-primary/20" : ""}`;
  return (
    <AppShell>
      <div className="px-3 pt-3">
        <div className="min-h-[70vh] rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <h1 className="text-2xl font-bold">Chat</h1>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">0</span>
            <div className="ml-auto flex gap-1.5">
              <button aria-label="Chat sebagai pembeli" className={btn(false)}><UserRoundSearch className="h-4 w-4" /></button>
              <button aria-label="Pilih chat" onClick={() => setSelect(!select)} className={btn(select)}><SquareCheck className="h-4 w-4" /></button>
              <button aria-label="Cari chat" onClick={() => setSearch(!search)} className={btn(search || select)}><Search className="h-4 w-4" /></button>
              <button aria-label="Muat ulang" onClick={() => void qc.invalidateQueries()} className={btn(false)}><RefreshCw className="h-4 w-4" /></button>
            </div>
          </div>
          {select && (
            <div className="mx-4 mt-3 flex gap-2 rounded-xl border p-2">
              <button onClick={() => setSelect(false)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold"><X className="h-3.5 w-3.5" /> Batal</button>
              <button className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Pilih semua</button>
              <button disabled className="ml-auto flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-semibold text-destructive/60"><Trash2 className="h-3.5 w-3.5" /> Hapus (0)</button>
            </div>
          )}
          {(search || select) && (
            <label className={`mx-4 mt-3 flex items-center gap-2 rounded-full border px-4 py-2.5 ${search ? "border-primary" : ""}`}>
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari seller atau produk..." className="w-full bg-transparent text-sm outline-none" />
            </label>
          )}
          <div className="flex gap-2 p-4 pb-2">
            {(["semua", "belum"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${tab === t ? "border-primary/30 bg-accent text-primary" : "bg-card"}`}>
                {t === "semua" ? "Semua" : "Belum dibaca"}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <MessageCircle className="h-6 w-6 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Inbox masih kosong. Mulai chat dari halaman produk.</p>
            <Link to="/cari" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition active:scale-95">Cari produk</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
