import { createFileRoute } from "@tanstack/react-router";

function sameSecret(a: string, b: string) {
  if (a.length !== b.length || !a.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Webhook for the platform "Marketku Seller Center" bot; only linked sellers get their own store data. */
export const Route = createFileRoute("/api/public/telegram/seller-center")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bot } = await supabaseAdmin.from("seller_hub_bot").select("*").eq("id", 1).maybeSingle();
        if (!bot) return new Response("Not found", { status: 404 });
        if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "", bot.webhook_secret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!bot.is_active) return Response.json({ ok: true, ignored: "inactive" });
        let update: { update_id?: unknown };
        try { update = (await request.json()) as { update_id?: unknown }; } catch { return new Response("Bad request", { status: 400 }); }
        if (typeof update.update_id !== "number") return Response.json({ ok: true, ignored: true });
        const { error: dup } = await supabaseAdmin.from("seller_hub_updates").insert({ update_id: update.update_id });
        if (dup) return Response.json({ ok: true, duplicate: true });

        const { siteBase } = await import("@/lib/telegram-bot.server");
        const { handleHubUpdate, drainHubNotifications } = await import("@/lib/seller-hub.server");
        const site = siteBase();
        try { await handleHubUpdate(supabaseAdmin, bot, update as Parameters<typeof handleHubUpdate>[2], site); }
        catch (e) { console.error("Seller hub update failed", e); }
        try { await drainHubNotifications(supabaseAdmin, site, 5); } catch (e) { console.error("Seller hub drain failed", e); }
        return Response.json({ ok: true });
      },
    },
  },
});
