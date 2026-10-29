import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ArrowLeft, MoreVertical, MessageCircle, SendHorizontal, FileText, Bell, BellOff, Plus, Check, X, Paperclip, Smile, Loader2 } from "lucide-react";
import { ChatAvatar, EMOJIS, lastSeenLabel } from "@/components/marketku/chat-avatar";
import { useImageUrls, useStoreMedia } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dbError } from "@/lib/market";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/chat/$id")({
  head: () => pageMeta("Ruang Chat — Marketku", "Percakapan antara pembeli dan seller di Marketku."),
  component: ChatRoom,
});

const PROMO_KEY = "marketku-mute-promo";

function useChatFileUrls(paths: string[]) {
  return useQuery({
    queryKey: ["chat_file_urls", paths], enabled: paths.length > 0, staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("chat-attachments").createSignedUrls(paths, 3600);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of data) if (r.path && r.signedUrl) m[r.path] = r.signedUrl;
      return m;
    },
  });
}

function ChatRoom() {
  const { id } = Route.useParams();
  const { user, ready } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  const seen = useQuery({
    queryKey: ["partner_seen", id], enabled: !!user && !!c, refetchInterval: 60_000,
    queryFn: async () => (await supabase.rpc("conversation_partner_seen", { p_id: id })).data ?? null,
  });
  const media = useStoreMedia(c && isBuyer ? [c.seller_id] : []);
  const storeAvatar = c ? media.data?.[c.seller_id]?.avatar_path ?? null : null;
  const attachPaths = (msgs.data ?? []).map((m) => m.attachment_path ?? "").filter(Boolean);
  const avatarUrl = useImageUrls(storeAvatar ? [storeAvatar] : []).data?.[storeAvatar ?? ""];
  const attachUrls = useChatFileUrls(attachPaths);
  const status = lastSeenLabel(seen.data);

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
  const sendImage = async (file: File) => {
    if (!user) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast.error("Lampiran harus berupa foto JPG, PNG, WebP, atau GIF"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5 MB"); return; }
    setUploading(true);
    const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type });
    if (up.error) { setUploading(false); toast.error("Gagal mengunggah foto"); return; }
    const caption = text.trim();
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body: (caption || "📷 Foto").slice(0, 2000), attachment_path: path });
    setUploading(false);
    if (error) { await supabase.storage.from("chat-attachments").remove([path]); toast.error(dbError(error)); return; }
    setText("");
    void qc.invalidateQueries({ queryKey: ["messages", id] });
  };
  const addEmoji = (e: string) => {
    setText((t) => (t + e).slice(0, 2000));
    setEmoji(false);
    inputRef.current?.focus();
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
      <header className="flex items-center gap-3 border-b bg-card px-3 py-2.5">
        <button aria-label="Kembali" onClick={() => router.history.back()} className="grid h-10 w-10 place-items-center rounded-xl border transition active:scale-90"><ArrowLeft className="h-5 w-5" /></button>
        <ChatAvatar name={partner || "?"} url={isBuyer ? avatarUrl : undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">{partner}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><span className={`h-2 w-2 rounded-full ${status === "Online" ? "bg-success" : "bg-muted-foreground/60"}`} />{status}</p>
        </div>
        <button aria-label="Opsi chat" onClick={() => setMenu(true)} className={`grid h-10 w-10 place-items-center rounded-xl border transition active:scale-90 ${menu ? "border-primary text-primary" : ""}`}><MoreVertical className="h-5 w-5" /></button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 px-3 py-4">
        {c === null && <p className="pt-20 text-center text-sm text-muted-foreground">Percakapan tidak ditemukan.</p>}
        {count === 0 && c && (
          <div className="flex flex-col items-center pt-32 text-center text-muted-foreground"><MessageCircle className="h-6 w-6 text-primary" /><p className="mt-3 text-sm">Tulis pesan pertamamu untuk memulai chat{isBuyer ? " dengan seller" : ""}.</p></div>
        )}
        {(msgs.data ?? []).map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card"}`}>
                {m.attachment_path && (
                  attachUrls.data?.[m.attachment_path]
                    ? <a href={attachUrls.data[m.attachment_path]} target="_blank" rel="noreferrer"><img src={attachUrls.data[m.attachment_path]} alt="Lampiran foto" className="mb-1 max-h-64 w-full rounded-xl object-cover" /></a>
                    : <span className="mb-1 block h-40 w-48 animate-pulse rounded-xl bg-muted" />
                )}
                {!(m.attachment_path && m.body === "📷 Foto") && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="relative flex items-center gap-2 border-t bg-card p-3">
        {emoji && (
          <>
            <button type="button" aria-label="Tutup emoji" onClick={() => setEmoji(false)} className="fixed inset-0 z-10 cursor-default" />
            <div className="absolute bottom-[calc(100%-4px)] right-16 z-20 grid grid-cols-5 gap-1 rounded-2xl border bg-card p-3 shadow-xl">
              {EMOJIS.map((e) => <button type="button" key={e} onClick={() => addEmoji(e)} className="grid h-11 w-11 place-items-center rounded-lg text-2xl transition active:scale-90">{e}</button>)}
            </div>
          </>
        )}
        <div className={`flex min-h-14 flex-1 items-center rounded-[28px] border bg-background pl-5 pr-2 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${emoji ? "border-primary ring-2 ring-primary/20" : ""}`}>
          <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ketik pesan..." maxLength={2000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); void send(); } }}
            className="max-h-28 flex-1 resize-none bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground" />
          <label aria-label="Lampirkan foto" className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition active:scale-90 ${uploading ? "pointer-events-none" : ""}`}>
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendImage(f); }} />
          </label>
          <button type="button" aria-label="Pilih emoji" onClick={() => setEmoji(!emoji)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-90 ${emoji ? "bg-accent text-primary" : "text-muted-foreground"}`}><Smile className="h-5 w-5" /></button>
        </div>
        <button aria-label="Kirim" disabled={!text.trim() || uploading} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-success text-primary-foreground transition active:scale-90 disabled:opacity-50"><SendHorizontal className="h-5 w-5" /></button>
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
