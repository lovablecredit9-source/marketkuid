import { isUuid } from "@/lib/market";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ArrowLeft, MoreVertical, MessageCircle, SendHorizontal, FileText, Bell, BellOff, Plus, Check, X, Paperclip, Smile, Loader2, Copy, Trash2, Ban } from "lucide-react";
import { ChatAvatar, EMOJIS, MsgTicks, TypingPill, lastSeenLabel, stampLabel } from "@/components/marketku/chat-avatar";
import { ProductImage, rpBuyer } from "@/components/marketku/product-card";
import { useImageUrls, useStoreMedia } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canDeleteForAll, tickState } from "@/lib/chat";
import { dbError } from "@/lib/market";
import { pageMeta } from "@/lib/meta";
import { LoadingLine } from "@/components/marketku/loading";

type S = { produk?: string };
export const Route = createFileRoute("/chat/$id")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): S => (typeof s["produk"] === "string" && s["produk"] ? { produk: s["produk"] } : {}),
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

type ChatProduct = { id: string; name: string; image: string | null; price: number | null };
function useChatProducts(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["chat_products", key], enabled: key.length > 0, staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, images, product_variants(price)").in("id", key);
      const m: Record<string, ChatProduct> = {};
      for (const p of data ?? []) {
        const prices = (p.product_variants ?? []).map((v) => Number(v.price));
        m[p.id] = { id: p.id, name: p.name, image: p.images?.[0] ?? null, price: prices.length ? Math.min(...prices) : null };
      }
      return m;
    },
  });
}

function ProductCard({ p, url, compact = false }: { p: ChatProduct; url?: string | undefined; compact?: boolean }) {
  if (compact) return (
    <Link to="/produk/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-xl border bg-card p-2 text-left text-foreground transition active:scale-[0.98]">
      <ProductImage url={url} path={p.image} alt={p.name} className="h-12 w-12 shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{p.name}</span>
        {p.price !== null && <span className="mt-0.5 block text-xs font-bold text-primary">{rpBuyer(p.price)}</span>}
      </span>
    </Link>
  );
  // Product sent with a message: photo, name, price and a "Beli sekarang" shortcut, like marketku.id's chat card.
  return (
    <div className="mb-1.5 flex gap-3 rounded-2xl border bg-card p-2 text-left text-foreground shadow-sm">
      <Link to="/produk/$id" params={{ id: p.id }} className="shrink-0"><ProductImage url={url} path={p.image} alt={p.name} className="h-16 w-16 rounded-xl" /></Link>
      <span className="min-w-0 flex-1">
        <Link to="/produk/$id" params={{ id: p.id }} className="line-clamp-2 text-[13px] font-bold uppercase leading-snug">{p.name}</Link>
        {p.price !== null && <span className="mt-0.5 block text-[13px] font-bold text-primary">{rpBuyer(p.price)}</span>}
        <Link to="/produk/$id" params={{ id: p.id }} className="mt-1.5 flex h-8 items-center justify-center rounded-lg bg-primary text-[12px] font-bold text-primary-foreground transition active:scale-95">Beli sekarang</Link>
      </span>
    </div>
  );
}

function ChatRoom() {
  const { id } = Route.useParams();
  const { produk } = Route.useSearch();
  const { user, ready } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<string | null>(produk ?? null);
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);
  const pressTimer = useRef<number | null>(null);
  type Picked = { id: string; body: string; mine: boolean; created_at: string; deleted_at: string | null; attachment_path: string | null };
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setAttached(produk ?? null); }, [produk]);
  useEffect(() => { try { setMuted(JSON.parse(window.localStorage.getItem(PROMO_KEY) ?? "[]")); } catch { setMuted([]); } }, []);
  useEffect(() => { if (ready && !user) navigate({ to: "/login" }); }, [ready, user, navigate]);

  const conv = useQuery({
    queryKey: ["conversation", id], enabled: !!user,
    queryFn: async () => !isUuid(id) ? null : (await supabase.from("conversations").select("*").eq("id", id).maybeSingle()).data,
  });
  const msgs = useQuery({
    queryKey: ["messages", id], enabled: !!user, refetchInterval: 3000,
    queryFn: async () => !isUuid(id) ? [] : (await supabase.from("messages").select("id, sender_id, body, created_at, attachment_path, product_id, delivered_at, read_at, deleted_at, hidden_for").eq("conversation_id", id).order("created_at").limit(500)).data ?? [],
  });
  const c = conv.data;
  const isBuyer = c?.buyer_id === user?.id;
  const partner = c ? (isBuyer ? c.store_name : c.buyer_name) ?? "Pengguna" : "";
  const follow = useQuery({
    queryKey: ["follow", user?.id, c?.seller_id], enabled: !!user && !!c && isBuyer,
    queryFn: async () => !!(await supabase.from("store_follows").select("seller_id").eq("user_id", user!.id).eq("seller_id", c!.seller_id).maybeSingle()).data,
  });
  const list = (msgs.data ?? []).filter((m) => !(user && (m.hidden_for ?? []).includes(user.id)));
  const count = list.length;
  const incoming = list.filter((m) => m.sender_id !== user?.id).length;
  const partnerState = useQuery({
    queryKey: ["partner_state", id], enabled: !!user && !!c, refetchInterval: 2500,
    queryFn: async () => (await supabase.rpc("chat_partner_state", { p_id: id })).data?.[0] ?? null,
  });
  const typing = !!partnerState.data?.typing;
  const media = useStoreMedia(c && isBuyer ? [c.seller_id] : []);
  // Only the buyer side can tap the header to visit the seller's store; buyers have no store page.
  // store_by_slug also accepts the owner id, so stores without a slug are still reachable.
  const store = useQuery({
    queryKey: ["chat_store_slug", c?.seller_id], enabled: !!c && isBuyer,
    queryFn: async () => (await supabase.rpc("public_stores", { p_ids: [c!.seller_id] })).data?.[0]?.slug || c!.seller_id,
  });
  const storeSlug = c && isBuyer ? store.data || c.seller_id : null;
  const storeAvatar = c ? media.data?.[c.seller_id]?.avatar_path ?? null : null;
  const attachPaths = list.map((m) => m.attachment_path ?? "").filter(Boolean);
  const avatarUrl = useImageUrls(storeAvatar ? [storeAvatar] : []).data?.[storeAvatar ?? ""];
  const attachUrls = useChatFileUrls(attachPaths);
  const productIds = [...list.map((m) => m.product_id ?? "").filter(Boolean), ...(attached ? [attached] : [])];
  const products = useChatProducts(productIds);
  const productImgs = useImageUrls(Object.values(products.data ?? {}).map((p) => p.image ?? "").filter(Boolean));
  // Typing shows as a pill in the thread (like marketku.id); the header keeps the Online / last-seen status.
  const status = typing ? "Online" : lastSeenLabel(partnerState.data?.seen_at);
  const pending = attached ? products.data?.[attached] : undefined;

  // Opening the chat (and each new incoming message) marks it read → blue ticks for the sender.
  useEffect(() => {
    if (!c || !user) return;
    void supabase.rpc("mark_conversation_read", { p_id: id }).then(() => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["unread_chats"] });
    });
  }, [c, user, id, incoming, qc]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [count, typing]);

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v.trim() && now - lastTyping.current > 3000) { lastTyping.current = now; supabase.rpc("set_typing", { p_id: id }).then(() => {}, () => {}); }
  };
  const send = async () => {
    const body = text.trim() || (attached ? "Halo, saya mau tanya produk ini" : "");
    if (!body || !user) return;
    const prod = attached;
    setText(""); setAttached(null); lastTyping.current = 0;
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body: body.slice(0, 2000), product_id: prod });
    if (error) { toast.error(dbError(error)); setText(body); setAttached(prod); return; }
    if (prod) navigate({ to: "/chat/$id", params: { id }, search: {}, replace: true });
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
  const startPress = (m: Picked) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => { pressTimer.current = null; navigator.vibrate?.(15); setPicked(m); }, 450);
  };
  const cancelPress = () => { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const copyMsg = async () => {
    if (!picked) return;
    try { await navigator.clipboard.writeText(picked.body); toast.success("Pesan disalin"); } catch { toast.error("Gagal menyalin pesan"); }
    setPicked(null);
  };
  const deleteMsg = async (forAll: boolean) => {
    if (!picked) return;
    if (forAll && !canDeleteForAll(picked)) { toast.error("Pesan lebih dari 1 jam tidak bisa dihapus untuk semua orang"); return; }
    setBusy(true);
    const path = forAll ? picked.attachment_path : null;
    const { error } = await supabase.rpc("delete_message", { p_id: picked.id, p_for_all: forAll });
    setBusy(false);
    if (error) { toast.error(dbError(error)); return; }
    if (path) void supabase.storage.from("chat-attachments").remove([path]);
    toast.success(forAll ? "Pesan dihapus untuk semua orang" : "Pesan dihapus untuk kamu");
    setPicked(null);
    void qc.invalidateQueries({ queryKey: ["messages", id] });
    void qc.invalidateQueries({ queryKey: ["conversations"] });
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
        <button
          type="button"
          disabled={!storeSlug}
          aria-label={storeSlug ? `Kunjungi toko ${partner}` : undefined}
          onClick={() => storeSlug && navigate({ to: "/toko/$slug", params: { slug: storeSlug } })}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left ${storeSlug ? "transition active:scale-[0.98]" : "cursor-default"}`}
        >
          {c ? <ChatAvatar name={partner || "?"} url={isBuyer ? avatarUrl : undefined} /> : <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted" />}
          {c ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold leading-tight">{partner}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === "Online" ? "bg-success" : "bg-muted-foreground/60"}`} />
                <span key={status} className="truncate animate-in fade-in-0">{partnerState.isPending ? "Offline" : status}</span>
              </p>
            </div>
          ) : (
            <div className="min-w-0 flex-1 space-y-1.5">
              <span className="block h-4 w-32 animate-pulse rounded bg-muted" />
              <span className="block h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
          )}
        </button>
        <button aria-label="Opsi chat" onClick={() => setMenu(true)} className={`grid h-10 w-10 place-items-center rounded-xl border transition active:scale-90 ${menu ? "border-primary text-primary" : ""}`}><MoreVertical className="h-5 w-5" /></button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 px-3 py-4">
        {(!ready || conv.isPending || msgs.isPending) ? <LoadingLine label="Memuat percakapan..." className="pt-12" /> : <>
        {c === null && <p className="pt-20 text-center text-sm text-muted-foreground">Percakapan tidak ditemukan.</p>}
        {count === 0 && c && !typing && (
          <div className="flex flex-col items-center pt-32 text-center text-muted-foreground"><MessageCircle className="h-6 w-6 text-primary" /><p className="mt-3 text-sm">Tulis pesan pertamamu untuk memulai chat{isBuyer ? " dengan seller" : ""}.</p></div>
        )}
        {list.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const prod = m.product_id ? products.data?.[m.product_id] : undefined;
          const lastMine = mine && !list.slice(i + 1).some((x) => x.sender_id === user?.id);
          const gone = !!m.deleted_at;
          const pick: Picked = { id: m.id, body: m.body, mine, created_at: m.created_at, deleted_at: m.deleted_at, attachment_path: m.attachment_path };
          return (
            <div key={m.id} className={`mk-pop-in flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                onPointerDown={() => startPress(pick)} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerMove={cancelPress}
                onContextMenu={(e) => { e.preventDefault(); cancelPress(); setPicked(pick); }}
                className={`max-w-[78%] select-none rounded-2xl px-3.5 py-2 text-sm shadow-sm transition ${picked?.id === m.id ? "scale-[0.98] ring-2 ring-primary/40" : ""} ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card"}`}>
                {gone ? (
                  <p className={`flex items-center gap-1.5 italic ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}><Ban className="h-3.5 w-3.5" /> {mine ? "Kamu menghapus pesan ini" : "Pesan ini telah dihapus"}</p>
                ) : <>
                {prod && <ProductCard p={prod} url={prod.image ? productImgs.data?.[prod.image] : undefined} />}
                {m.attachment_path && (
                  attachUrls.data?.[m.attachment_path]
                    ? <a href={attachUrls.data[m.attachment_path]} target="_blank" rel="noreferrer"><img src={attachUrls.data[m.attachment_path]} alt="Lampiran foto" className="mb-1 max-h-64 w-full rounded-xl object-cover" /></a>
                    : <span className="mb-1 block h-40 w-48 animate-pulse rounded-xl bg-muted" />
                )}
                {!(m.attachment_path && m.body === "📷 Foto") && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                </>}
                <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                  {stampLabel(m.created_at)}
                  {mine && !gone && <MsgTicks state={tickState(m)} />}
                </p>
              </div>
              {lastMine && (
                <p className="mt-1 pr-1 text-[11px] text-muted-foreground">
                  {m.read_at ? `Dilihat • ${stampLabel(m.read_at)}` : m.delivered_at ? `Diterima • ${stampLabel(m.delivered_at)}` : `Belum dilihat • ${stampLabel(m.created_at)}`}
                </p>
              )}
            </div>
          );
        })}
        {typing && <TypingPill name={partner} />}
        </>}
        <div ref={end} />
      </div>

      {pending && (
        <div className="mk-pop-in flex items-center gap-2 border-t bg-accent/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Tanyakan produk ini</p>
            <ProductCard compact p={pending} url={pending.image ? productImgs.data?.[pending.image] : undefined} />
          </div>
          <button type="button" aria-label="Lepas produk" onClick={() => { setAttached(null); navigate({ to: "/chat/$id", params: { id }, search: {}, replace: true }); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-card transition active:scale-90"><X className="h-4 w-4" /></button>
        </div>
      )}

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
          <textarea ref={inputRef} rows={1} value={text} onChange={(e) => onType(e.target.value)} placeholder="Ketik pesan..." maxLength={2000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); void send(); } }}
            className="max-h-28 flex-1 resize-none bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground" />
          <label aria-label="Lampirkan foto" className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition active:scale-90 ${uploading ? "pointer-events-none" : ""}`}>
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendImage(f); }} />
          </label>
          <button type="button" aria-label="Pilih emoji" onClick={() => setEmoji(!emoji)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-90 ${emoji ? "bg-accent text-primary" : "text-muted-foreground"}`}><Smile className="h-5 w-5" /></button>
        </div>
        <button aria-label="Kirim" disabled={(!text.trim() && !pending) || uploading} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-success text-primary-foreground transition active:scale-90 disabled:opacity-50"><SendHorizontal className="h-5 w-5" /></button>
      </form>

      <Dialog.Root open={!!picked} onOpenChange={(o) => { if (!o) setPicked(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card pb-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
            <Dialog.Title className="sr-only">Opsi pesan</Dialog.Title>
            <div className="mx-auto my-3 h-1 w-12 rounded-full bg-muted" />
            {picked && (
              <>
                <p className="mx-6 mb-2 line-clamp-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{picked.deleted_at ? "Pesan ini telah dihapus" : picked.body}</p>
                {!picked.deleted_at && <button onClick={() => void copyMsg()} className="flex w-full items-center gap-4 border-b px-6 py-4 text-left font-medium transition active:bg-muted"><Copy className="h-5 w-5" /> Salin pesan</button>}
                <button disabled={busy} onClick={() => void deleteMsg(false)} className="flex w-full items-center gap-4 border-b px-6 py-4 text-left font-medium transition active:bg-muted disabled:opacity-50"><Trash2 className="h-5 w-5" /> Hapus untuk saya</button>
                {picked.mine && !picked.deleted_at && (canDeleteForAll(picked)
                  ? <button disabled={busy} onClick={() => void deleteMsg(true)} className="flex w-full items-center gap-4 px-6 py-4 text-left font-medium text-destructive transition active:bg-muted disabled:opacity-50"><Trash2 className="h-5 w-5" /> Hapus untuk semua orang</button>
                  : <p className="flex items-center gap-4 px-6 py-4 text-sm text-muted-foreground"><Trash2 className="h-5 w-5" /> Hapus untuk semua orang hanya bisa maksimal 1 jam setelah dikirim</p>)}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
