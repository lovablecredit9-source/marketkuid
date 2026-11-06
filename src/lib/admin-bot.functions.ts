import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isBotToken } from "@/lib/telegram";
import { ADMIN_LINK_MINUTES, adminLinkParam } from "@/lib/admin-bot";

/** Verifies the caller is an admin (as the user, via has_role) before any privileged work. */
async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Khusus admin");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getAdminBot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("admin_bot").select("username, name, is_active, webhook_ok, webhook_at, created_at").eq("id", 1).maybeSingle();
    const { data: admins } = await admin.from("admin_bot_admins").select("tg_user_id, tg_name, user_id, linked_at").order("linked_at");
    const { count } = await admin.from("admin_tg_notifications").select("id", { count: "exact", head: true }).not("sent_at", "is", null);
    return {
      bot,
      admins: (admins ?? []).map((a) => ({ id: String(a.tg_user_id), name: a.tg_name, mine: a.user_id === context.userId, linked_at: a.linked_at })),
      sent: count ?? 0,
    };
  });

export const connectAdminBot = createServerFn({ method: "POST" })
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
    const { data: shop } = await admin.from("telegram_bots").select("id").eq("tg_bot_id", me.result.id).maybeSingle();
    if (shop) throw new Error("Bot ini sudah dipakai sebagai bot toko. Buat bot baru khusus admin");
    const { data: old } = await admin.from("admin_bot").select("token").eq("id", 1).maybeSingle();
    if (old && old.token !== data.token) await tg(old.token, "deleteWebhook", { drop_pending_updates: true });
    const row = {
      id: 1, tg_bot_id: me.result.id, username: me.result.username, name: me.result.first_name.slice(0, 60),
      token: data.token, webhook_secret: randomSecret(), is_active: true, created_by: context.userId,
    };
    const { error } = await admin.from("admin_bot").upsert(row);
    if (error) { console.error("admin_bot upsert", error); throw new Error("Gagal menyimpan bot"); }
    const { registerAdminWebhook } = await import("@/lib/admin-bot.server");
    const hook = await registerAdminWebhook(row);
    await admin.from("admin_bot").update({ webhook_ok: hook.ok, webhook_at: new Date().toISOString() }).eq("id", 1);
    return { username: me.result.username, webhook: hook.ok, message: hook.ok ? null : hook.description ?? null };
  });

export const setAdminBotActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { active: boolean }) => ({ active: !!d?.active }))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("admin_bot").select("*").eq("id", 1).maybeSingle();
    if (!bot) throw new Error("Bot admin belum dipasang");
    const { tg } = await import("@/lib/telegram-bot.server");
    const { registerAdminWebhook } = await import("@/lib/admin-bot.server");
    const r = data.active ? await registerAdminWebhook(bot) : await tg(bot.token, "deleteWebhook", { drop_pending_updates: true });
    if (!r.ok) throw new Error(`Telegram menolak: ${r.description ?? "coba lagi"}`);
    await admin.from("admin_bot").update({ is_active: data.active, webhook_ok: data.active, webhook_at: new Date().toISOString() }).eq("id", 1);
    return { ok: true };
  });

export const deleteAdminBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("admin_bot").select("token").eq("id", 1).maybeSingle();
    if (bot) {
      const { tg } = await import("@/lib/telegram-bot.server");
      await tg(bot.token, "deleteWebhook", { drop_pending_updates: true });
    }
    await admin.from("admin_bot").delete().eq("id", 1);
    await admin.from("admin_bot_admins").delete().neq("tg_user_id", 0);
    return { ok: true };
  });

export const createAdminBotLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { data: bot } = await admin.from("admin_bot").select("username").eq("id", 1).maybeSingle();
    if (!bot) throw new Error("Pasang bot admin dulu");
    const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await admin.from("admin_bot_links").insert({ code, user_id: context.userId, expires_at: new Date(Date.now() + ADMIN_LINK_MINUTES * 60_000).toISOString() });
    if (error) throw new Error("Gagal membuat link");
    return { url: `https://t.me/${bot.username}?start=${adminLinkParam(code)}` };
  });

export const unlinkAdminTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => { if (!/^\d{1,20}$/.test(String(d?.id ?? ""))) throw new Error("ID tidak valid"); return { id: String(d.id) }; })
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.supabase, context.userId);
    const { error } = await admin.from("admin_bot_admins").delete().eq("tg_user_id", Number(data.id));
    if (error) throw new Error("Gagal memutus");
    const { data: bot } = await admin.from("admin_bot").select("token").eq("id", 1).maybeSingle();
    if (bot) {
      const { setAdminMenuButton } = await import("@/lib/admin-bot.server");
      await setAdminMenuButton(bot.token, Number(data.id), false);
    }
    return { ok: true };
  });

/** Public: Telegram Mini App of the admin bot signs in only linked admins (initData is verified server-side). */
export const adminMiniAppLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => {
    const initData = String(d?.initData ?? "");
    if (!initData || initData.length > 4096 || !initData.includes("hash=")) throw new Error("Data Mini App tidak valid");
    return { initData };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { adminMiniAppSession } = await import("@/lib/admin-bot.server");
    const meta = {
      ip: (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "").split(",")[0]!.trim(),
      ua: (getRequestHeader("user-agent") ?? "").slice(0, 400),
    };
    return adminMiniAppSession(supabaseAdmin, data.initData, meta);
  });
