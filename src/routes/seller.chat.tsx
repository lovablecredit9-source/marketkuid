import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Search, RefreshCw, SquareCheck, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SellerCard, SellerEmpty, SellerPageTitle } from "@/components/marketku/seller-ui";
import { ChatAvatar } from "@/components/marketku/chat-avatar";
import { LoadingLine } from "@/components/marketku/loading";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/chat")({
  head: () => pageMeta("Inbox Chat — Seller Center Marketku", "Balas chat pembeli langsung dari Seller Center Marketku."),
  component: SellerInbox,
});

const timeLabel = (s: string) => {
  const d = new Date(s);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

/** Seller-side inbox inside Seller Center — opening it never leaves the seller panel. */
function SellerInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"semua" | "belum">("semua");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState(false);
  const [select, setSelect] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [spin, setSpin] = useState(0);
  const convs = useQuery({
    queryKey: ["conversations", user?.id], enabled: !!user, refetchInterval: 8000,
    queryFn: async () => (await supabase.from("conversations").select("*").order("last_at", { ascending: false }).limit(200)).data ?? [],
  });
  const rows = (convs.data ?? [])
    .filter((c) => c.seller_id === user?.id && !c.seller_hidden && c.last_message)
    .map((c) => {
      const senderName = c.last_sender_id ? (c.last_sender_id === c.seller_id ? "Kamu" : c.buyer_name) : null;
      return { ...c, name: c.buyer_name ?? "Pembeli", preview: senderName ? `${senderName}: ${c.last_message}` : c.last_message ?? "", unread: c.seller_unread };
    });
  const ql = q.trim().toLowerCase();
  const list = rows.filter((c) => (tab === "semua" || c.unread > 0) && (!ql || `${c.name} ${c.last_message ?? ""}`.toLowerCase().includes(ql)));
  const unread = rows.reduce((a, c) => a + c.unread, 0);

  const refresh = () => {
    setSpin((n) => n + 1);
    void qc.invalidateQueries({ queryKey: ["conversations"] });
    void qc.invalidateQueries({ queryKey: ["unread_chats"] });
  };
  const remove = async () => {
    const { error } = await supabase.rpc("hide_conversations", { p_ids: picked });
    if (error) { toast.error("Gagal menghapus chat"); return; }
    toast.success(`${picked.length} chat dihapus`);
    setPicked([]); setSelect(false);
    void qc.invalidateQueries({ queryKey: ["conversations"] });
  };
  const btn = (on: boolean) => `grid h-8 w-8 place-items-center rounded-lg border transition active:scale-90 ${on ? "border-primary text-primary" : "text-foreground/80"}`;

  return (
    <>
      <SellerPageTitle icon={MessageCircle} title="Inbox Chat" desc="Balas pertanyaan pembeli tanpa keluar dari Seller Center."
        right={
          <div className="flex gap-1.5">
            <button aria-label="Pilih chat" onClick={() => { setSelect(!select); setPicked([]); }} className={btn(select)}><SquareCheck className="h-4 w-4" /></button>
            <button aria-label="Cari chat" onClick={() => setSearch(!search)} className={btn(search)}><Search className="h-4 w-4" /></button>
            <button aria-label="Muat ulang" onClick={refresh} className={btn(convs.isFetching)}><RefreshCw key={spin} className={`h-4 w-4 ${spin ? "mk-spin-once" : ""}`} /></button>
          </div>
        } />
      <SellerCard className="p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          {(["semua", "belum"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg border px-3 py-1 text-[12.5px] font-semibold transition ${tab === t ? "border-primary/40 bg-accent text-primary" : "text-foreground/80"}`}>
              {t === "semua" ? "Semua" : "Belum dibaca"}
            </button>
          ))}
          <span className="ml-auto text-[11.5px] text-muted-foreground">{unread} belum dibaca</span>
        </div>
        {select && (
          <div className="mx-3 mt-2.5 flex gap-2 rounded-lg border p-1.5">
            <button onClick={() => { setSelect(false); setPicked([]); }} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"><X className="h-3 w-3" /> Batal</button>
            <button onClick={() => setPicked(list.map((c) => c.id))} className="rounded-md border px-2.5 py-1 text-xs font-semibold">Pilih semua</button>
            <button disabled={!picked.length} onClick={() => void remove()} className="ml-auto flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive disabled:opacity-50"><Trash2 className="h-3 w-3" /> Hapus ({picked.length})</button>
          </div>
        )}
        {search && (
          <label className="mx-3 mt-2.5 flex items-center gap-2 rounded-lg border border-primary px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pembeli atau pesan..." className="w-full bg-transparent text-[13px] outline-none" />
          </label>
        )}
        {!user || convs.isPending ? <LoadingLine label="Memuat inbox..." className="px-6 py-14" /> : list.length === 0 ? (
          <div className="p-3"><SellerEmpty icon={MessageCircle} title="Belum ada chat" desc="Chat dari pembeli tentang toko atau produkmu akan muncul di sini." /></div>
        ) : (
          <div className="divide-y divide-border/60 p-1.5">
            {list.map((c) => {
              const on = picked.includes(c.id);
              const inner = (
                <>
                  {select && <span className={`mt-2.5 grid h-4 w-4 shrink-0 place-items-center rounded border-2 ${on ? "border-primary bg-primary" : ""}`} />}
                  <ChatAvatar name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2"><b className={`truncate text-[13.5px] ${c.unread > 0 ? "text-primary" : ""}`}>{c.name}</b><span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(c.last_at)}</span></span>
                    <span className="mt-0.5 flex items-start gap-2"><span className="line-clamp-2 flex-1 text-[12.5px] text-muted-foreground">{c.preview}</span>{c.unread > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{c.unread}</span>}</span>
                  </span>
                </>
              );
              const cls = `flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left transition active:bg-accent ${c.unread > 0 ? "bg-accent/50" : ""}`;
              return select
                ? <button key={c.id} onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])} className={cls}>{inner}</button>
                : <Link key={c.id} to="/chat/$id" params={{ id: c.id }} className={cls}>{inner}</Link>;
            })}
          </div>
        )}
      </SellerCard>
    </>
  );
}
