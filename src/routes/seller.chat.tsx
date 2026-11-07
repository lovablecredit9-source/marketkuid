import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Search, RefreshCw, SquareCheck, X, Trash2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SellerCard, SellerEmpty, SellerPageTitle } from "@/components/marketku/seller-ui";
import { ChatAvatar } from "@/components/marketku/chat-avatar";
import { LoadingLine } from "@/components/marketku/loading";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/chat")({
  staticData: { sitemap: false },
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
  const convIds = rows.map((c) => c.id);
  const prodNames = useQuery({
    queryKey: ["inbox_products", convIds], enabled: convIds.length > 0, staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("conversation_id, product_id, created_at").in("conversation_id", convIds).not("product_id", "is", null).order("created_at", { ascending: false }).limit(500);
      const byConv: Record<string, string> = {};
      for (const m of data ?? []) if (m.product_id && !byConv[m.conversation_id]) byConv[m.conversation_id] = m.product_id;
      const ids = [...new Set(Object.values(byConv))];
      const names: Record<string, string> = {};
      if (ids.length) for (const p of (await supabase.from("products").select("id, name").in("id", ids)).data ?? []) names[p.id] = p.name;
      const out: Record<string, string> = {};
      for (const [cid, pid] of Object.entries(byConv)) if (names[pid]) out[cid] = names[pid];
      return out;
    },
  });
  const ql = q.trim().toLowerCase();
  const list = rows.filter((c) => (tab === "semua" || c.unread > 0) && (!ql || `${c.name} ${c.last_message ?? ""} ${prodNames.data?.[c.id] ?? ""}`.toLowerCase().includes(ql)));
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
        <div className="space-y-2.5 border-b p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari buyer, produk, atau caption" className="w-full rounded-xl border bg-background/40 px-3 py-2.5 text-[13px] outline-none focus:border-primary" />
          <div className="flex items-center gap-2">
            <button onClick={() => setTab(tab === "belum" ? "semua" : "belum")} className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition active:scale-95 ${tab === "belum" ? "border-primary bg-accent text-primary" : "bg-background"}`}>Hanya belum dibaca</button>
            <button onClick={() => { setSelect(!select); setPicked([]); }} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition active:scale-95 ${select ? "border-primary text-primary" : "bg-background"}`}><SquareCheck className="h-3.5 w-3.5" /> Pilih</button>
            <span className="ml-auto text-[11.5px] text-muted-foreground">{unread} belum dibaca</span>
          </div>
          {select && (
            <div className="flex gap-2 rounded-lg border p-1.5">
              <button onClick={() => { setSelect(false); setPicked([]); }} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"><X className="h-3 w-3" /> Batal</button>
              <button onClick={() => setPicked(list.map((c) => c.id))} className="rounded-md border px-2.5 py-1 text-xs font-semibold">Pilih semua</button>
              <button disabled={!picked.length} onClick={() => void remove()} className="ml-auto flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive disabled:opacity-50"><Trash2 className="h-3 w-3" /> Hapus ({picked.length})</button>
            </div>
          )}
        </div>
        {!user || convs.isPending ? <LoadingLine label="Memuat inbox..." className="px-6 py-14" /> : list.length === 0 ? (
          <div className="p-3"><SellerEmpty icon={MessageCircle} title="Belum ada chat" desc="Chat dari pembeli tentang toko atau produkmu akan muncul di sini." /></div>
        ) : (
          <div className="space-y-2 p-2">
            {list.map((c) => {
              const on = picked.includes(c.id);
              const prod = prodNames.data?.[c.id];
              const inner = (
                <>
                  {select && <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded border-2 ${on ? "border-primary bg-primary" : ""}`} />}
                  <span className="w-6 shrink-0 pt-3 text-center text-[15px] font-bold text-primary">{c.name.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2"><b className="truncate text-[14px]">{c.name}</b><span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(c.last_at)}</span></span>
                    <span className="mt-0.5 flex items-start gap-2"><span className="truncate flex-1 text-[13px] text-muted-foreground">{c.preview}</span>{c.unread > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{c.unread}</span>}</span>
                    {prod && <span className="mt-1 flex items-center gap-1.5 text-[11.5px] uppercase text-muted-foreground"><Store className="h-3 w-3 shrink-0" /><span className="truncate">{prod}</span></span>}
                  </span>
                </>
              );
              const cls = `flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${c.unread > 0 || on ? "border-foreground/70" : "border-transparent bg-background/60"}`;
              return select
                ? <button key={c.id} onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])} className={cls}>{inner}</button>
                : <Link key={c.id} to="/seller/chat/$id" params={{ id: c.id }} className={cls}>{inner}</Link>;
            })}
          </div>
        )}
      </SellerCard>
    </>
  );
}
