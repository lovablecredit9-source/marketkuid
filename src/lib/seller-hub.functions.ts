import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isBotToken } from "@/lib/telegram";
import { HUB_LINK_MINUTES, hubLinkParam } from "@/lib/seller-hub";

async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Khusus admin");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ---------- admin: install the platform seller bot ---------- */

export const getHubBotAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("seller_hub_bot").select("username, name, is_active, webhook_ok, webhook_at").eq("id", 1).maybeSingle();
    const [{ count: sellers }, { count: sent }] = await Promise.all([
      admin.from("seller_hub_links").select("owner_id", { count: "exact", head: true }),
      admin.from("seller_hub_notifications").select("id", { count: "exact", head: true }).not("sent_at", "is", null),
    ]);
    return { bot, sellers: sellers ?? 0, sent: sent ?? 0 };
  });

export const connectHubBot = createServerFn({ method: "POST" })
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
    const [{ data: shop }, { data: adm }] = await Promise.all([
      admin.from("telegram_bots").select("id").eq("tg_bot_id", me.result.id).maybeSingle(),
      admin.from("admin_bot").select("tg_bot_id").eq("id", 1).maybeSingle(),
    ]);
    if (shop || adm?.tg_bot_id === me.result.id) throw new Error("Bot ini sudah dipakai (bot toko / bot admin). Buat bot baru khusus Seller Center");
    const { data: old } = await admin.from("seller_hub_bot").select("token").eq("id", 1).maybeSingle();
    if (old && old.token !== data.token) await tg(old.token, "deleteWebhook", { drop_pending_updates: true });
    const row = {
      id: 1, tg_bot_id: me.result.id, username: me.result.username, name: me.result.first_name.slice(0, 60),
      token: data.token, webhook_secret: randomSecret(), is_active: true, created_by: context.userId,
    };
    const { error } = await admin.from("seller_hub_bot").upsert(row);
    if (error) { console.error("seller_hub_bot upsert", error); throw new Error("Gagal menyimpan bot"); }
    const { registerHubWebhook } = await import("@/lib/seller-hub.server");
    const hook = await registerHubWebhook(row);
    await admin.from("seller_hub_bot").update({ webhook_ok: hook.ok, webhook_at: new Date().toISOString() }).eq("id", 1);
    return { username: me.result.username, webhook: hook.ok, message: hook.ok ? null : hook.description ?? null };
  });

export const setHubBotActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { active: boolean }) => ({ active: !!d?.active }))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("seller_hub_bot").select("*").eq("id", 1).maybeSingle();
    if (!bot) throw new Error("Bot belum dipasang");
    let ok = bot.webhook_ok;
    if (data.active) {
      const { registerHubWebhook } = await import("@/lib/seller-hub.server");
      ok = (await registerHubWebhook(bot)).ok;
    }
    await admin.from("seller_hub_bot").update({ is_active: data.active, webhook_ok: ok, webhook_at: new Date().toISOString() }).eq("id", 1);
    return { ok };
  });

export const deleteHubBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("seller_hub_bot").select("token").eq("id", 1).maybeSingle();
    if (bot) {
      const { tg } = await import("@/lib/telegram-bot.server");
      await tg(bot.token, "deleteWebhook", { drop_pending_updates: true });
    }
    await admin.from("seller_hub_bot").delete().eq("id", 1);
    return { ok: true };
  });

/* ---------- seller: link own Telegram ---------- */

export const getMyHubLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: link } = await context.supabase.from("seller_hub_links").select("tg_name, linked_at").eq("owner_id", context.userId).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bot } = await supabaseAdmin.from("seller_hub_bot").select("username, name, is_active").eq("id", 1).maybeSingle();
    return { link, bot: bot?.is_active ? { username: bot.username, name: bot.name } : null };
  });

export const createHubLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: store } = await context.supabase.from("seller_stores").select("owner_id").eq("owner_id", context.userId).maybeSingle();
    if (!store) throw new Error("Buka toko dulu di Seller Center");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bot } = await supabaseAdmin.from("seller_hub_bot").select("username, is_active").eq("id", 1).maybeSingle();
    if (!bot?.is_active) throw new Error("Bot Marketku Seller Center belum aktif");
    const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    await supabaseAdmin.from("seller_hub_link_codes").delete().eq("owner_id", context.userId);
    const { error } = await supabaseAdmin.from("seller_hub_link_codes").insert({ code, owner_id: context.userId, expires_at: new Date(Date.now() + HUB_LINK_MINUTES * 60_000).toISOString() });
    if (error) throw new Error("Gagal membuat link");
    return { url: `https://t.me/${bot.username}?start=${hubLinkParam(code)}` };
  });

export const unlinkMyHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("seller_hub_links").delete().eq("owner_id", context.userId);
    return { ok: true };
  });
