import { createFileRoute } from "@tanstack/react-router";

function sameSecret(a: string, b: string) {
  if (a.length !== b.length || !a.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Webhook for the "Auth Marketku" login bot: records who pressed /start so codes can be delivered. */
export const Route = createFileRoute("/api/public/telegram/auth")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bot } = await supabaseAdmin.from("auth_bot").select("*").eq("id", 1).maybeSingle();
        if (!bot) return new Response("Not found", { status: 404 });
        if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "", bot.webhook_secret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!bot.is_active) return Response.json({ ok: true, ignored: "inactive" });
        let update: { update_id?: unknown };
        try { update = (await request.json()) as { update_id?: unknown }; } catch { return new Response("Bad request", { status: 400 }); }
        if (typeof update.update_id !== "number") return Response.json({ ok: true, ignored: true });
        const { error: dup } = await supabaseAdmin.from("auth_bot_updates").insert({ update_id: update.update_id });
        if (dup) return Response.json({ ok: true, duplicate: true });
        const { siteBase } = await import("@/lib/telegram-bot.server");
        const { handleAuthUpdate } = await import("@/lib/auth-bot.server");
        try { await handleAuthUpdate(supabaseAdmin, bot, update as Parameters<typeof handleAuthUpdate>[2], siteBase()); }
        catch (e) { console.error("Auth bot update failed", e); }
        return Response.json({ ok: true });
      },
    },
  },
});
