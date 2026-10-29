import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ArrowLeft, MoreVertical, MessageCircle, SendHorizontal, FileText, Bell, BellOff, Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dbError } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/chat/$id")({
  head: () => pageMeta("Ruang Chat — Marketku", "Percakapan antara pembeli dan seller di Marketku."),
  component: ChatRoom,
});

const PROMO_KEY = "marketku-mute-promo";

function ChatRoom() {
  const { id } = Route.useParams();
  const { user, ready } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { try { setMuted(JSON.parse(window.localStorage.getItem(PROMO_KEY) ?? "[]")); } catch { setMuted([]); } }, []);
  useEffect(() => { if (ready && !user) navigate({ to: "/login" }); }, [ready, user, navigate]);

  const conv = useQuery({
    queryKey: ["conversation", id], enabled: !!user,
    queryFn: async () => (await supabase.from("conversations").select("*").eq("id", id).maybeSingle()).data,
  });
  const msgs = useQuery({
    queryKey: ["messages", id], enabled: !!user, refetchInterval: 4000,
    queryFn: async () => (await supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at").limit(500)).data ?? [],
  });
  const c = conv.data;
  const isBuyer = c?.buyer_id === user?.id;
  const partner = c ? (isBuyer ? c.store_name : c.buyer_name) ?? "Pengguna" : "";
  const follow = useQuery({
    queryKey: ["follow", user?.id, c?.seller_id], enabled: !!user && !!c && isBuyer,
    queryFn: async () => !!(await supabase.from("store_follows").select("seller_id").eq("user_id", user!.id).eq("seller_id", c!.seller_id).maybeSingle()).data,
  });
  const count = msgs.data?.length ?? 0;

  useEffect(() => {
    if (!c || !user) return;
    void supabase.rpc("mark_conversation_read", { p_id: id }).then(() => qc.invalidateQueries({ queryKey: ["conversations"] }));
  }, [c, user, id, count, qc]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [count]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body: body.slice(0, 2000) });
    if (error) { toast.error(dbError(error)); setText(body); return; }
    void qc.invalidateQueries({ queryKey: ["messages", id] });
  };
  const toggleFollow = async () => {
    if (!user || !c) return;
    const { error } = follow.data
      ? await supabase.from("store_follows").delete().eq("user_id", user.id).eq("seller_id", c.seller_id)
      : await supabase.from("store_follows").insert({ user_id: user.id, seller_id: c.seller_id });
    if (error) { toast.error("Gagal memperbarui"); return; }
    toast.success(follow.data ? "Berhenti mengikuti seller" : "Mengikuti seller");
    void qc.invalidateQueries({ queryKey: ["follow", user.id, c.seller_id] });
  };
  const promoOff = c ? muted.includes(c.seller_id) : false;
  const togglePromo = () => {
    if (!c) return;
    const next = promoOff ? muted.filter((x) => x !== c.seller_id) : [...muted, c.seller_id];
    setMuted(next); window.localStorage.setItem(PROMO_KEY, JSON.stringify(next));
    toast.success(promoOff ? "Pesan promo diterima lagi" : "Pesan promo dimatikan");
  };

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-3 py-3">
        <button aria-label="Kembali" onClick={() => router.history.back()} className="grid h-10 w-10 place-items-center rounded-xl border transition active:scale-90"><ArrowLeft className="h-5 w-5" /></button>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{partner.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{partner}</p><p className="text-xs text-muted-foreground">{isBuyer ? "Seller" : "Pembeli"}</p></div>
        <button aria-label="Opsi chat" onClick={() => setMenu(true)} className={`grid h-10 w-10 place-items-center rounded-xl border transition active:scale-90 ${menu ? "border-primary text-primary" : ""}`}><MoreVertical className="h-5 w-5" /></button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {c === null && <p className="pt-20 text-center text-sm text-muted-foreground">Percakapan tidak ditemukan.</p>}
        {count === 0 && c && (
          <div className="flex flex-col items-center pt-32 text-center text-muted-foreground"><MessageCircle className="h-6 w-6 text-primary" /><p className="mt-3 text-sm">Tulis pesan pertamamu untuk memulai chat{isBuyer ? " dengan seller" : ""}.</p></div>
        )}
        {(msgs.data ?? []).map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2 border-t bg-card p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ketik pesan..." maxLength={2000} className="h-12 flex-1 rounded-full border bg-background px-5 text-sm outline-none focus:border-primary" />
        <button aria-label="Kirim" disabled={!text.trim()} className="grid h-12 w-12 place-items-center rounded-full bg-success text-primary-foreground transition active:scale-90 disabled:opacity-50"><SendHorizontal className="h-5 w-5" /></button>
      </form>

      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card pb-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <Dialog.Title className="sr-only">Opsi chat</Dialog.Title>
            <Dialog.Close aria-label="Tutup" className="absolute -top-16 right-4 grid h-12 w-12 place-items-center rounded-xl bg-card shadow"><X className="h-5 w-5" /></Dialog.Close>
            <div className="mx-auto my-3 h-1 w-12 rounded-full bg-muted" />
            <button onClick={() => { setMenu(false); navigate({ to: "/dispute" }); }} className="flex w-full items-center gap-4 border-b px-6 py-4 text-left font-medium"><FileText className="h-5 w-5" /> Laporkan {isBuyer ? "seller" : "pembeli"}</button>
            {isBuyer && (
              <>
                <button onClick={togglePromo} className="flex w-full items-center gap-4 border-b px-6 py-4 text-left font-medium">{promoOff ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />} {promoOff ? "Terima lagi pesan promo" : "Matikan pesan promo"}</button>
                <button onClick={() => void toggleFollow()} className="flex w-full items-center gap-4 px-6 py-4 text-left font-medium">{follow.data ? <><Check className="h-5 w-5" /> Berhenti ikuti seller</> : <><Plus className="h-5 w-5" /> Ikuti seller</>}</button>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
