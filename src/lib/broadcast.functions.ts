import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BROADCAST_MAX, BROADCAST_BATCH, cleanBroadcastHtml } from "@/lib/broadcast";

const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

type Input = { botId: string; message: string; imagePath: string | null };
function validate(d: Input, userId?: string) {
  if (!isId(d?.botId)) throw new Error("Pilih bot dulu");
  const message = cleanBroadcastHtml(String(d?.message ?? "")).trim();
  if (!message) throw new Error("Tulis pesan broadcast dulu");
  if (message.length > BROADCAST_MAX) throw new Error(`Pesan maksimal ${BROADCAST_MAX} karakter`);
  const imagePath = d?.imagePath ? String(d.imagePath) : null;
  if (imagePath && (!/^[0-9a-f-]{36}\/broadcast\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(imagePath) || (userId && !imagePath.startsWith(userId)))) throw new Error("Gambar tidak valid");
  return { botId: d.botId, message, imagePath };
}

/** Caller's own bot (RLS proves ownership), then its token via admin. */
async function loadBot(supabase: any, botId: string) {
  const { data } = await supabase.from("telegram_bots").select("id").eq("id", botId).maybeSingle();
  if (!data) throw new Error("Bot tidak ditemukan");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: bot } = await supabaseAdmin.from("telegram_bots").select("id, owner_id, token, username, is_active").eq("id", botId).single();
  if (!bot) throw new Error("Bot tidak ditemukan");
  return { bot, admin: supabaseAdmin };
}

async function photoUrl(admin: any, path: string | null) {
  if (!path) return null;
  const { data } = await admin.storage.from("product-images").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function sendOne(token: string, chatId: number, message: string, photo: string | null) {
  const { tg } = await import("@/lib/telegram-bot.server");
  if (photo && message.length <= 1024) return tg(token, "sendPhoto", { chat_id: chatId, photo, caption: message, parse_mode: "HTML" });
  if (photo) {
    const p = await tg(token, "sendPhoto", { chat_id: chatId, photo });
    if (!p.ok) return p;
  }
  return tg(token, "sendMessage", { chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true });
}

/** Recipient count + whether the seller's own Telegram has started the bot (needed for the test send). */
export const broadcastPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string }) => { if (!isId(d?.botId)) throw new Error("Pilih bot dulu"); return { botId: d.botId }; })
  .handler(async ({ data, context }) => {
    const { bot, admin } = await loadBot(context.supabase, data.botId);
    const { count } = await admin.from("telegram_bot_users").select("tg_user_id", { count: "exact", head: true }).eq("bot_id", bot.id);
    const self = await ownChat(admin, context.userId, bot.id);
    return { recipients: count ?? 0, selfReady: !!self, selfName: self?.username ?? null, active: bot.is_active };
  });

async function ownChat(admin: any, userId: string, botId: string) {
  const { data: prof } = await admin.from("profiles").select("telegram_username").eq("id", userId).maybeSingle();
  const uname = String(prof?.telegram_username ?? "").replace(/^@/, "").trim();
  if (!uname) return null;
  const { data } = await admin.from("telegram_bot_users").select("tg_user_id, username").eq("bot_id", botId).ilike("username", uname).maybeSingle();
  return data as { tg_user_id: number; username: string } | null;
}

/** Sends the broadcast only to the seller's own Telegram account. */
export const broadcastTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => validate(d))
  .handler(async ({ data, context }) => {
    const { bot, admin } = await loadBot(context.supabase, data.botId);
    if (data.imagePath && !data.imagePath.startsWith(context.userId)) throw new Error("Gambar tidak valid");
    const self = await ownChat(admin, context.userId, bot.id);
    if (!self) throw new Error(`Buka @${bot.username} dari Telegram kamu dan tekan /start dulu (username Telegram di profil harus sama)`);
    const r = await sendOne(bot.token, Number(self.tg_user_id), data.message, await photoUrl(admin, data.imagePath));
    if (!r.ok) throw new Error(`Telegram menolak: ${r.description ?? "coba lagi"}`);
    return { to: self.username };
  });

/** Sends to every bot user (up to BROADCAST_BATCH) and records the result in history. */
export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => validate(d))
  .handler(async ({ data, context }) => {
    const { bot, admin } = await loadBot(context.supabase, data.botId);
    if (data.imagePath && !data.imagePath.startsWith(context.userId)) throw new Error("Gambar tidak valid");
    if (!bot.is_active) throw new Error("Aktifkan bot dulu");
    const { data: users } = await admin.from("telegram_bot_users").select("tg_user_id").eq("bot_id", bot.id).limit(BROADCAST_BATCH);
    const list = users ?? [];
    if (!list.length) throw new Error("Belum ada pelanggan bot. Minta pembeli tekan /start di bot kamu");
    const { data: row, error } = await admin.from("telegram_broadcasts").insert({
      owner_id: context.userId, bot_id: bot.id, message: data.message, image_path: data.imagePath, recipients: list.length,
    }).select("id").single();
    if (error || !row) { console.error("insert broadcast", error); throw new Error("Gagal menyimpan broadcast"); }
    const photo = await photoUrl(admin, data.imagePath);
    let sent = 0, failed = 0;
    for (let i = 0; i < list.length; i += 20) {
      const res = await Promise.all(list.slice(i, i + 20).map((u) => sendOne(bot.token, Number(u.tg_user_id), data.message, photo)));
      for (const r of res) r.ok ? sent++ : failed++;
      if (i + 20 < list.length) await new Promise((ok) => setTimeout(ok, 1000));
    }
    await admin.from("telegram_broadcasts").update({ sent, failed, status: sent ? "done" : "failed", finished_at: new Date().toISOString() }).eq("id", row.id);
    return { sent, failed, recipients: list.length };
  });
