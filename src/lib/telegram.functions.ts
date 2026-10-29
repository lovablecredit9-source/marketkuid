import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MAX_BOTS, isAdminUsername, isAdminWa, isBotToken, isChatRef } from "@/lib/telegram";

const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/** Loads the caller's own bot (RLS proves ownership) and then its token via the admin client. */
async function ownBot(supabase: SupabaseClient<Database>, id: string) {
  const { data } = await supabase.from("telegram_bots").select("id").eq("id", id).maybeSingle();
  if (!data) throw new Error("Bot tidak ditemukan");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: bot, error } = await supabaseAdmin.from("telegram_bots").select("*").eq("id", id).single();
  if (error || !bot) throw new Error("Bot tidak ditemukan");
  return { bot, supabaseAdmin };
}

export const connectBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string; name: string; admin: string; wa: string }) => {
    const token = String(d?.token ?? "").trim();
    const name = String(d?.name ?? "").trim().slice(0, 60);
    const admin = String(d?.admin ?? "").trim().replace(/^@/, "");
    const wa = String(d?.wa ?? "").trim();
    if (!isBotToken(token)) throw new Error("Token bot tidak valid. Salin token dari @BotFather");
    if (admin && !isAdminUsername(admin)) throw new Error("Username admin tidak valid");
    if (wa && !isAdminWa(wa)) throw new Error("Nomor WhatsApp admin harus diawali 62");
    return { token, name, admin, wa };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("seller_stores").select("owner_id").eq("owner_id", userId).maybeSingle();
    if (!store) throw new Error("Buka toko dulu sebelum menghubungkan bot");
    const { count } = await supabase.from("telegram_bots").select("id", { count: "exact", head: true }).eq("owner_id", userId);
    if ((count ?? 0) >= MAX_BOTS) throw new Error(`Maksimal ${MAX_BOTS} bot per toko`);

    const { tg, randomSecret, registerWebhook } = await import("@/lib/telegram-bot.server");
    const me = await tg<{ id: number; username: string; first_name: string; is_bot: boolean }>(data.token, "getMe");
    if (!me.ok || !me.result?.is_bot) throw new Error("Token ditolak Telegram. Pastikan token dari @BotFather masih berlaku");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin.from("telegram_bots").select("owner_id").eq("tg_bot_id", me.result.id).maybeSingle();
    if (taken) throw new Error(taken.owner_id === userId ? "Bot ini sudah terhubung" : "Bot ini sudah terhubung ke toko lain");

    const { data: bot, error } = await supabaseAdmin.from("telegram_bots").insert({
      owner_id: userId, tg_bot_id: me.result.id, username: me.result.username, name: data.name || me.result.first_name.slice(0, 60),
      admin_username: data.admin || null, admin_wa: data.wa || null, token: data.token, webhook_secret: randomSecret(),
    }).select("id, token, webhook_secret").single();
    if (error || !bot) { console.error("insert bot", error); throw new Error("Gagal menyimpan bot"); }

    const hook = await registerWebhook(bot);
    await supabaseAdmin.from("telegram_bots").update({ webhook_ok: hook.ok, webhook_at: new Date().toISOString() }).eq("id", bot.id);
    if (!hook.ok) console.error("setWebhook failed", hook.description);
    return { username: me.result.username, webhook: hook.ok, message: hook.ok ? null : hook.description ?? null };
  });

export const setBotActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) => { if (!isId(d?.id)) throw new Error("Bot tidak valid"); return { id: d.id, active: !!d.active }; })
  .handler(async ({ data, context }) => {
    const { bot, supabaseAdmin } = await ownBot(context.supabase, data.id);
    const { tg, registerWebhook } = await import("@/lib/telegram-bot.server");
    const r = data.active ? await registerWebhook(bot) : await tg(bot.token, "deleteWebhook", { drop_pending_updates: true });
    if (!r.ok) throw new Error(`Telegram menolak: ${r.description ?? "coba lagi"}`);
    await supabaseAdmin.from("telegram_bots").update({ is_active: data.active, webhook_ok: data.active, webhook_at: new Date().toISOString() }).eq("id", bot.id);
    return { username: bot.username };
  });

export const refreshBotWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => { if (!isId(d?.id)) throw new Error("Bot tidak valid"); return { id: d.id }; })
  .handler(async ({ data, context }) => {
    const { bot, supabaseAdmin } = await ownBot(context.supabase, data.id);
    const { registerWebhook } = await import("@/lib/telegram-bot.server");
    const r = await registerWebhook(bot);
    await supabaseAdmin.from("telegram_bots").update({ webhook_ok: r.ok, webhook_at: new Date().toISOString(), is_active: r.ok ? true : bot.is_active }).eq("id", bot.id);
    if (!r.ok) throw new Error(`Telegram menolak: ${r.description ?? "coba lagi"}`);
    return { username: bot.username };
  });

export const deleteBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => { if (!isId(d?.id)) throw new Error("Bot tidak valid"); return { id: d.id }; })
  .handler(async ({ data, context }) => {
    const { bot, supabaseAdmin } = await ownBot(context.supabase, data.id);
    const { tg } = await import("@/lib/telegram-bot.server");
    await tg(bot.token, "deleteWebhook", { drop_pending_updates: true });
    const { error } = await supabaseAdmin.from("telegram_bots").delete().eq("id", bot.id);
    if (error) throw new Error("Gagal menghapus bot");
    return { username: bot.username };
  });

export const testBotJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; chat: string }) => {
    if (!isId(d?.id)) throw new Error("Bot tidak valid");
    const chat = String(d?.chat ?? "").trim();
    if (!isChatRef(chat)) throw new Error("Isi @username channel atau ID -100xxxxxxxxxx");
    return { id: d.id, chat };
  })
  .handler(async ({ data, context }) => {
    const { bot } = await ownBot(context.supabase, data.id);
    const { tg } = await import("@/lib/telegram-bot.server");
    const chat = await tg<{ title?: string }>(bot.token, "getChat", { chat_id: data.chat });
    if (!chat.ok) return { ok: false, message: "Channel/grup tidak ditemukan atau bot belum ditambahkan" };
    const me = await tg<{ status: string }>(bot.token, "getChatMember", { chat_id: data.chat, user_id: bot.tg_bot_id });
    const admin = me.ok && ["administrator", "creator"].includes(me.result?.status ?? "");
    return { ok: admin, title: chat.result?.title ?? data.chat, message: admin ? null : "Bot belum dijadikan admin di channel/grup" };
  });
