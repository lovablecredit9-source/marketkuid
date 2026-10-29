import { createFileRoute } from "@tanstack/react-router";

/** Constant-time string compare (no early exit on the first differing char). */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length || !a.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/telegram/$botId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.botId)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bot } = await supabaseAdmin.from("telegram_bots").select("*").eq("id", params.botId).maybeSingle();
        if (!bot) return new Response("Not found", { status: 404 });
        // Telegram echoes the secret we registered with setWebhook; reject anything else.
        if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "", bot.webhook_secret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!bot.is_active) return Response.json({ ok: true, ignored: "inactive" });

        let update: { update_id?: unknown };
        try { update = (await request.json()) as { update_id?: unknown }; } catch { return new Response("Bad request", { status: 400 }); }
        if (typeof update.update_id !== "number") return Response.json({ ok: true, ignored: true });

        // Telegram retries deliveries; handle each update once.
        const { error: dup } = await supabaseAdmin.from("telegram_bot_updates").insert({ bot_id: bot.id, update_id: update.update_id });
        if (dup) return Response.json({ ok: true, duplicate: true });

        const { handleUpdate } = await import("@/lib/telegram-bot.server");
        try {
          await handleUpdate(supabaseAdmin, bot, update as Parameters<typeof handleUpdate>[2], new URL(request.url).origin);
        } catch (e) {
          console.error("Telegram update failed", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
