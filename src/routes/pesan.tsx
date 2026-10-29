import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SquareCheck, Search, RefreshCw, MessageCircle, X, Trash2, Store, User, Repeat2 } from "lucide-react";
import { useSellerStore } from "@/lib/seller";
import { useImageUrls, useStoreMedia } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/marketku/shell";
import { pageMeta } from "@/lib/meta";
import { ChatAvatar } from "@/components/marketku/chat-avatar";
import { useUnreadChats } from "@/lib/chat";

export const Route = createFileRoute("/pesan")({
  head: () => pageMeta("Chat — Marketku", "Ruang chat pembeli dan seller Marketku."),
  component: Pesan,
});

const MODE_KEY = "marketku-chat-mode";

const timeLabel = (s: string) => {
  const d = new Date(s);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

function Pesan() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"semua" | "belum">("semua");
  const store = useSellerStore(user?.id);
  const isSeller = !!store.data;
  const [mode, setMode] = useState<"pembeli" | "seller">("pembeli");
  useEffect(() => { if (window.localStorage.getItem(MODE_KEY) === "seller") setMode("seller"); }, []);
  const role = isSeller ? mode : "pembeli";
  const [search, setSearch] = useState(false);
  const [select, setSelect] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [spin, setSpin] = useState(0);
  const totals = useUnreadChats(user?.id).data;
  const otherUnread = role === "seller" ? totals?.buyer ?? 0 : totals?.seller ?? 0;
  const convs = useQuery({
    queryKey: ["conversations", user?.id], enabled: !!user, refetchInterval: 8000,
    queryFn: async () => (await supabase.from("conversations").select("*").order("last_at", { ascending: false }).limit(200)).data ?? [],
  });
  const rows = (convs.data ?? []).map((c) => {
    const buyer = c.buyer_id === user?.id;
    const senderName = c.last_sender_id ? (c.last_sender_id === c.seller_id ? c.store_name : c.buyer_name) : null;
    return {
      ...c, buyer, name: (buyer ? c.store_name : c.buyer_name) ?? "Pengguna",
      preview: c.last_message ? (senderName ? `${senderName}: ${c.last_message}` : c.last_message) : "Belum ada pesan",
      unread: buyer ? c.buyer_unread : c.seller_unread, hidden: buyer ? c.buyer_hidden : c.seller_hidden,
    };
  }).filter((c) => !c.hidden && (c.last_message || c.buyer) && (role === "pembeli") === c.buyer);
  const ql = q.trim().toLowerCase();
  const list = rows.filter((c) => (tab === "semua" || c.unread > 0) && (!ql || `${c.name} ${c.last_message ?? ""}`.toLowerCase().includes(ql)));
  const unread = rows.reduce((a, c) => a + c.unread, 0);
  const media = useStoreMedia([...new Set(rows.filter((c) => c.buyer).map((c) => c.seller_id))]);
  const avatarPaths = Object.values(media.data ?? {}).map((m) => m.avatar_path ?? "").filter(Boolean);
  const avatarUrls = useImageUrls(avatarPaths);
  const avatarOf = (c: (typeof rows)[number]) => {
    if (!c.buyer) return undefined;
    const p = media.data?.[c.seller_id]?.avatar_path;
    return p ? avatarUrls.data?.[p] : undefined;
  };
  const btn = (on: boolean) => `grid h-9 w-9 place-items-center rounded-full border transition active:scale-90 ${on ? "border-primary text-primary ring-2 ring-primary/20" : ""}`;
  const remove = async () => {
    const { error } = await supabase.rpc("hide_conversations", { p_ids: picked });
    if (error) { toast.error("Gagal menghapus chat"); return; }
    toast.success(`${picked.length} chat dihapus`);
    setPicked([]); setSelect(false);
    void qc.invalidateQueries({ queryKey: ["conversations"] });
  };
  const switchRole = () => {
    const next = role === "seller" ? "pembeli" : "seller";
    setMode(next); window.localStorage.setItem(MODE_KEY, next);
    setPicked([]); setSelect(false);
    toast(next === "seller" ? "Chat sebagai seller" : "Chat sebagai pembeli");
  };
  const RoleIcon = role === "seller" ? Store : User;

  return (
    <AppShell>
      <div className="px-3 pt-3">
        <div className="min-h-[70vh] rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <h1 className="text-2xl font-bold">Chat</h1>
            <span key={unread} className="mk-badge-pop grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{unread}</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">{role === "seller" ? "Seller" : "Pembeli"}</span>
            <div className="ml-auto flex gap-1.5">
              {isSeller && (
                <button aria-label={role === "seller" ? "Ganti ke chat pembeli" : "Ganti ke chat seller"} onClick={switchRole} className={`relative ${btn(false)}`}>
                  <RoleIcon className="h-4 w-4" />
                  <Repeat2 className="absolute bottom-1 right-1 h-3 w-3 text-primary" />
                  {otherUnread > 0 && <span aria-label={`${otherUnread} pesan belum dibaca sebagai ${role === "seller" ? "pembeli" : "seller"}`} className="mk-ping-dot absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />}
                </button>
              )}
              <button aria-label="Pilih chat" onClick={() => { setSelect(!select); setPicked([]); }} className={btn(select)}><SquareCheck className="h-4 w-4" /></button>
              <button aria-label="Cari chat" onClick={() => setSearch(!search)} className={btn(search || select)}><Search className="h-4 w-4" /></button>
              <button aria-label="Muat ulang" onClick={() => { setSpin((n) => n + 1); void qc.invalidateQueries({ queryKey: ["conversations"] }); void qc.invalidateQueries({ queryKey: ["unread_chats"] }); }} className={`${btn(convs.isFetching)} active:bg-accent`}>
                <RefreshCw key={spin} className={`h-4 w-4 ${spin ? "mk-spin-once" : ""} ${convs.isFetching ? "text-primary" : ""}`} />
              </button>
            </div>
          </div>
          {select && (
            <div className="mx-4 mt-3 flex gap-2 rounded-xl border p-2">
              <button onClick={() => { setSelect(false); setPicked([]); }} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold"><X className="h-3.5 w-3.5" /> Batal</button>
              <button onClick={() => setPicked(list.map((c) => c.id))} className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Pilih semua</button>
              <button disabled={!picked.length} onClick={() => void remove()} className="ml-auto flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-semibold text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Hapus ({picked.length})</button>
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
          <div className="space-y-2 px-3 pb-3">
            {list.map((c) => {
              const on = picked.includes(c.id);
              const inner = (
                <>
                  {select && <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 ${on ? "border-primary bg-primary" : ""}`} />}
                  <ChatAvatar name={c.name} url={avatarOf(c)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2"><b className={`truncate text-[15px] ${c.unread > 0 ? "text-primary" : ""}`}>{c.name}</b><span className="shrink-0 text-xs text-muted-foreground">{timeLabel(c.last_at)}</span></span>
                    <span className="mt-0.5 flex items-start gap-2"><span className="line-clamp-2 flex-1 text-sm text-muted-foreground">{c.preview}</span>{c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{c.unread}</span>}</span>
                  </span>
                </>
              );
              const cls = `flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${c.unread > 0 ? "border-primary/20 bg-accent/60" : "border-transparent"}`;
              return select
                ? <button key={c.id} onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])} className={cls}>{inner}</button>
                : <Link key={c.id} to="/chat/$id" params={{ id: c.id }} className={cls}>{inner}</Link>;
            })}
          </div>
          {list.length === 0 && (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <MessageCircle className="h-6 w-6 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">{user ? "Inbox masih kosong. Mulai chat dari halaman produk." : "Masuk untuk melihat chat kamu."}</p>
              <Link to={user ? "/cari" : "/login"} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition active:scale-95">{user ? "Cari produk" : "Masuk"}</Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
