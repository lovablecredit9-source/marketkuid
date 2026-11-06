import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Scheduled every minute: sends queued order notifications to sellers' Telegram. */
export const Route = createFileRoute("/api/public/telegram/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { drainNotifications } = await import("@/lib/telegram-notify.server");
        const { siteBase } = await import("@/lib/telegram-bot.server");
        const r = await drainNotifications(supabaseAdmin, siteBase());
        return Response.json({ ok: true, ...r });
      },
    },
  },
});
