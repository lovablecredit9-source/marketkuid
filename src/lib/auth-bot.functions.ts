import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isBotToken } from "@/lib/telegram";
import { isLoginCode, isMagic, normalizeTgUsername } from "@/lib/auth-bot";

async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Khusus admin");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const reqMeta = () => ({
  ip: (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "").split(",")[0]!.trim(),
  ua: (getRequestHeader("user-agent") ?? "").slice(0, 400),
});

/* ---------- public: Seller Center login via Telegram ---------- */

export const getAuthBotPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("auth_bot").select("username, is_active").eq("id", 1).maybeSingle();
  return { bot: data?.is_active ? data.username : null };
});

export const requestTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string }) => {
    const username = normalizeTgUsername(String(d?.username ?? ""));
    if (!username) throw new Error("Masukkan username Telegram yang valid (5–32 huruf/angka/_)");
    return { username };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { siteBase } = await import("@/lib/telegram-bot.server");
    const { requestLoginCode } = await import("@/lib/auth-bot.server");
    return requestLoginCode(supabaseAdmin, data.username, siteBase());
  });

export const verifyTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { username?: string; code?: string; magic?: string }) => {
    const magic = String(d?.magic ?? "").trim();
    if (magic) { if (!isMagic(magic)) throw new Error("Link login tidak valid"); return { magic }; }
    const username = normalizeTgUsername(String(d?.username ?? ""));
    const code = String(d?.code ?? "").trim();
    if (!username) throw new Error("Username Telegram tidak valid");
    if (!isLoginCode(code)) throw new Error("Kode login berisi 6 angka");
    return { username, code };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyLoginCode } = await import("@/lib/auth-bot.server");
    return verifyLoginCode(supabaseAdmin, data, reqMeta());
  });

export const miniAppLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => {
    const initData = String(d?.initData ?? "");
    if (!initData || initData.length > 4096 || !initData.includes("hash=")) throw new Error("Data Mini App tidak valid");
    return { initData };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { miniAppSession } = await import("@/lib/auth-bot.server");
    return miniAppSession(supabaseAdmin, data.initData, reqMeta());
  });

/* ---------- admin: install the Auth Marketku bot ---------- */

export const getAuthBotAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("auth_bot").select("username, name, is_active, webhook_ok, webhook_at").eq("id", 1).maybeSingle();
    const [{ count: users }, { count: logins }] = await Promise.all([
      admin.from("auth_bot_chats").select("tg_user_id", { count: "exact", head: true }),
      admin.from("auth_login_codes").select("id", { count: "exact", head: true }),
    ]);
    return { bot, users: users ?? 0, logins: logins ?? 0 };
  });

export const connectAuthBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => {
    const token = String(d?.token ?? "").trim();
    if (!isBotToken(token)) throw new Error("Token bot tidak valid. Salin token dari @BotFather");
    return { token };
  })
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { tg, randomSecret } = await import("@/lib/telegram-bot.server");
    const me = await tg<{ id: number; username: string; first_name: string; is_bot: boolean }>(data.token, "getMe");
    if (!me.ok || !me.result?.is_bot) throw new Error("Token ditolak Telegram. Pastikan token dari @BotFather masih berlaku");
    const [{ data: shop }, { data: adm }, { data: hub }] = await Promise.all([
      admin.from("telegram_bots").select("id").eq("tg_bot_id", me.result.id).maybeSingle(),
      admin.from("admin_bot").select("tg_bot_id").eq("id", 1).maybeSingle(),
      admin.from("seller_hub_bot").select("tg_bot_id").eq("id", 1).maybeSingle(),
    ]);
    if (shop || adm?.tg_bot_id === me.result.id || hub?.tg_bot_id === me.result.id) throw new Error("Bot ini sudah dipakai bot lain. Buat bot baru khusus Auth Marketku");
    const { data: old } = await admin.from("auth_bot").select("token").eq("id", 1).maybeSingle();
    if (old && old.token !== data.token) await tg(old.token, "deleteWebhook", { drop_pending_updates: true });
    const row = {
      id: 1, tg_bot_id: me.result.id, username: me.result.username, name: me.result.first_name.slice(0, 60),
      token: data.token, webhook_secret: randomSecret(), is_active: true, created_by: context.userId,
    };
    const { error } = await admin.from("auth_bot").upsert(row);
    if (error) { console.error("auth_bot upsert", error); throw new Error("Gagal menyimpan bot"); }
    const { registerAuthWebhook } = await import("@/lib/auth-bot.server");
    const hook = await registerAuthWebhook(row);
    await admin.from("auth_bot").update({ webhook_ok: hook.ok, webhook_at: new Date().toISOString() }).eq("id", 1);
    return { username: me.result.username, webhook: hook.ok, message: hook.ok ? null : hook.description ?? null };
  });

export const setAuthBotActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { active: boolean }) => ({ active: !!d?.active }))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("auth_bot").select("*").eq("id", 1).maybeSingle();
    if (!bot) throw new Error("Bot belum dipasang");
    let ok = bot.webhook_ok;
    if (data.active) {
      const { registerAuthWebhook } = await import("@/lib/auth-bot.server");
      ok = (await registerAuthWebhook(bot)).ok;
    }
    await admin.from("auth_bot").update({ is_active: data.active, webhook_ok: ok, webhook_at: new Date().toISOString() }).eq("id", 1);
    return { ok };
  });

export const deleteAuthBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("auth_bot").select("token").eq("id", 1).maybeSingle();
    if (bot) {
      const { tg } = await import("@/lib/telegram-bot.server");
      await tg(bot.token, "deleteWebhook", { drop_pending_updates: true });
    }
    await admin.from("auth_bot").delete().eq("id", 1);
    return { ok: true };
  });
