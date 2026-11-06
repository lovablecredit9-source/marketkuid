import { isUuid } from "@/lib/market";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileText, Paperclip, SendHorizontal, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { tickState } from "@/lib/chat";
import { dbError } from "@/lib/market";
import { pageMeta } from "@/lib/meta";
import { TypingPill, lastSeenLabel } from "@/components/marketku/chat-avatar";
import { LoadingLine } from "@/components/marketku/loading";

export const Route = createFileRoute("/seller/chat_/$id")({
  head: () => pageMeta("Ruang Chat — Seller Center Marketku", "Balas chat pembeli tanpa keluar dari Seller Center Marketku."),
  component: SellerChatRoom,
});

const MAX = 1500;
const TEMPLATES = ["Halo kak, terima kasih sudah menghubungi toko kami 🙏", "Ready kak, silakan langsung order ya", "Pesanan sedang kami proses kak, mohon ditunggu", "Sudah dikirim ya kak, silakan dicek"];
const stamp = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
};
const tickLabel = { sent: "Terkirim", delivered: "Diterima", read: "Dibaca" } as const;

function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: ["chat_file_urls", paths], enabled: paths.length > 0, staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("chat-attachments").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      for (const r of data ?? []) if (r.path && r.signedUrl) m[r.path] = r.signedUrl;
      return m;
    },
  });
}

/** Seller-side chat room rendered inside the Seller Center layout (header + bottom nav stay). */
function SellerChatRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);

  const conv = useQuery({
    queryKey: ["conversation", id], enabled: !!user,
    queryFn: async () => !isUuid(id) ? null : (await supabase.from("conversations").select("*").eq("id", id).maybeSingle()).data,
  });
  const msgs = useQuery({
    queryKey: ["messages", id], enabled: !!user, refetchInterval: 3000,
    queryFn: async () => !isUuid(id) ? [] : (await supabase.from("messages").select("id, sender_id, body, created_at, attachment_path, product_id, delivered_at, read_at, deleted_at, hidden_for").eq("conversation_id", id).order("created_at").limit(500)).data ?? [],
  });
  const state = useQuery({
    queryKey: ["partner_state", id], enabled: !!user && !!conv.data, refetchInterval: 2500,
    queryFn: async () => (await supabase.rpc("chat_partner_state", { p_id: id })).data?.[0] ?? null,
  });
  const c = conv.data;
  const list = (msgs.data ?? []).filter((m) => !(user && (m.hidden_for ?? []).includes(user.id)));
  const productId = [...list].reverse().find((m) => m.product_id)?.product_id ?? null;
  const product = useQuery({
    queryKey: ["chat_product_name", productId], enabled: !!productId,
    queryFn: async () => (await supabase.from("products").select("name").eq("id", productId!).maybeSingle()).data?.name ?? null,
  });
  const urls = useSignedUrls(list.map((m) => m.attachment_path ?? "").filter(Boolean));
  const incoming = list.filter((m) => m.sender_id !== user?.id).length;
  const lastMine = [...list].reverse().find((m) => m.sender_id === user?.id);
  const typing = !!state.data?.typing;
  const status = typing ? "Online" : lastSeenLabel(state.data?.seen_at);
  const name = c?.buyer_name ?? "Pembeli";

  useEffect(() => {
    if (!c || !user) return;
    void supabase.rpc("mark_conversation_read", { p_id: id }).then(() => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["unread_chats"] });
    });
  }, [c, user, id, incoming, qc]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list.length, typing]);

  const onType = (v: string) => {
    setText(v.slice(0, MAX));
    const now = Date.now();
    if (v.trim() && now - lastTyping.current > 3000) { lastTyping.current = now; supabase.rpc("set_typing", { p_id: id }).then(() => {}, () => {}); }
  };
  const send = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setText(""); lastTyping.current = 0;
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body: body.slice(0, MAX) });
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
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body: (text.trim() || "📷 Foto").slice(0, MAX), attachment_path: path });
    setUploading(false);
    if (error) { await supabase.storage.from("chat-attachments").remove([path]); toast.error(dbError(error)); return; }
    setText("");
    void qc.invalidateQueries({ queryKey: ["messages", id] });
  };

  if (conv.isFetched && c === null) return (
    <div className="rounded-2xl border bg-card px-4 py-16 text-center">
      <p className="text-sm font-semibold">Percakapan tidak ditemukan</p>
      <p className="mt-1 text-xs text-muted-foreground">Chat ini sudah dihapus atau bukan milik toko kamu.</p>
      <button onClick={() => navigate({ to: "/seller/chat" })} className="mt-4 rounded-xl border px-4 py-2 text-xs font-semibold transition active:scale-95">Kembali ke Inbox</button>
    </div>
  );

  return (
    <div className="-mx-1 flex h-[calc(100dvh-170px)] flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="space-y-2.5 border-b px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button aria-label="Kembali ke inbox" onClick={() => navigate({ to: "/seller/chat" })} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-background transition active:scale-90"><ArrowLeft className="h-4 w-4" /></button>
          <span className="relative grid h-9 w-9 shrink-0 place-items-center text-[15px] font-bold text-primary">
            {name.charAt(0).toUpperCase()}
            <span className={`absolute bottom-0 right-0.5 h-1.5 w-1.5 rounded-full ${status === "Online" ? "bg-success" : "bg-muted-foreground/70"}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight">{c ? name : "Memuat..."}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">{state.isPending ? "Offline" : status === "Online" ? "Buyer sedang online" : status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-background px-2.5 py-1.5 text-[12px]">
          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate uppercase text-muted-foreground">{product.data ?? "Chat toko"} • Inbox</span>
          {lastMine && <span className="shrink-0 font-semibold text-primary">{tickLabel[tickState(lastMine)] === "Dibaca" ? "Terbaca" : tickLabel[tickState(lastMine)]}</span>}
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {msgs.isPending ? <LoadingLine label="Memuat pesan..." className="py-14" /> : list.length === 0 ? (
          <p className="py-14 text-center text-[12.5px] text-muted-foreground">Belum ada pesan.</p>
        ) : list.map((m) => {
          const mine = m.sender_id === user?.id;
          const url = m.attachment_path ? urls.data?.[m.attachment_path] : undefined;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl border px-3 py-2 ${mine ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
                {m.deleted_at ? <p className="text-[13px] italic opacity-70">Pesan ini telah dihapus</p> : (
                  <>
                    {url && <img src={url} alt="Lampiran" className="mb-1.5 max-h-56 rounded-lg object-cover" />}
                    {!(url && m.body === "📷 Foto") && <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.body}</p>}
                  </>
                )}
                <p className={`mt-1 text-[11px] ${mine ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{stamp(m.created_at)}{mine ? ` · ${tickLabel[tickState(m)]}` : ""}</p>
              </div>
            </div>
          );
        })}
        {typing && <TypingPill name={name} />}
        <div ref={end} />
      </div>

      <div className="border-t p-2.5">
        {tpl && (
          <div className="mb-2 space-y-1 rounded-xl border bg-background p-1.5">
            {TEMPLATES.map((t) => (
              <button key={t} onClick={() => { setText(t); setTpl(false); }} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12.5px] transition active:bg-accent">{t}</button>
            ))}
          </div>
        )}
        <div className="rounded-xl border bg-background p-2">
          <div className="flex items-center gap-1.5">
            <button aria-label="Template balasan" onClick={() => setTpl(!tpl)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition active:scale-90 ${tpl ? "border-primary text-primary" : ""}`}><FileText className="h-4 w-4" /></button>
            <button aria-label="Kirim foto" disabled={uploading} onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition active:scale-90">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendImage(f); }} />
            <textarea
              rows={1} value={text} onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Balas pertanyaan buyer di sini..."
              className="h-10 min-w-0 flex-1 resize-none rounded-xl border bg-card px-3 py-2.5 text-[13px] leading-tight outline-none focus:border-primary"
            />
            <button aria-label="Kirim" disabled={!text.trim()} onClick={() => void send()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition active:scale-90 disabled:opacity-50"><SendHorizontal className="h-4 w-4" /></button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Enter kirim • Shift+Enter baris baru • {text.length}/{MAX}</p>
        </div>
      </div>
    </div>
  );
}
