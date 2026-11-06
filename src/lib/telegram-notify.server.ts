import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { tg } from "@/lib/telegram-bot.server";
import { LOW_STOCK, notifyText, type NotifyKind } from "@/lib/telegram";

type Admin = SupabaseClient<Database>;

/**
 * Sends queued seller notifications (filled by database triggers on orders/disputes)
 * through each seller's own bot to the seller's linked Telegram account.
 */
export async function drainNotifications(admin: Admin, site: string, limit = 25) {
  const { data: rows } = await admin.from("telegram_notifications")
    .select("id, bot_id, chat_id, kind, order_id, attempts")
    .is("sent_at", null).lt("attempts", 5).order("created_at").limit(limit);
  if (!rows?.length) return { sent: 0 };

  const botIds = [...new Set(rows.map((r) => r.bot_id))];
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((x): x is string => !!x))];
  const [{ data: bots }, { data: orders }, { data: items }] = await Promise.all([
    admin.from("telegram_bots").select("id, token, is_active").in("id", botIds),
    orderIds.length ? admin.from("orders").select("id, order_no, total, subtotal, discount, payment_method, buyer_name, buyer_note, status").in("id", orderIds) : Promise.resolve({ data: [] }),
    orderIds.length ? admin.from("order_items").select("order_id, product_id, variant_id, product_name, variant_name, qty, unit_price").in("order_id", orderIds) : Promise.resolve({ data: [] }),
  ]);
  const botMap = new Map((bots ?? []).map((b) => [b.id, b]));
  const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));

  let sent = 0;
  for (const r of rows) {
    const bot = botMap.get(r.bot_id);
    const o = r.order_id ? orderMap.get(r.order_id) : undefined;
    if (!bot?.is_active || (r.order_id && !o)) {
      await admin.from("telegram_notifications").update({ sent_at: new Date().toISOString(), error: "skipped" }).eq("id", r.id);
      continue;
    }
    const its = (items ?? []).filter((i) => i.order_id === r.order_id);
    const text = notifyText(r.kind as NotifyKind, {
      orderNo: o?.order_no ?? 0, total: Number(o?.total ?? 0), gross: Number(o?.subtotal ?? 0) - Number(o?.discount ?? 0),
      method: o?.payment_method ?? null, buyer: o?.buyer_name ?? null, note: o?.buyer_note ?? null,
      items: its.map((i) => ({ name: i.product_name, variant: i.variant_name, qty: i.qty, price: Number(i.unit_price) })),
    });
    const res = await tg(bot.token, "sendMessage", {
      chat_id: r.chat_id, text, parse_mode: "HTML", disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "📋 Buka Pesanan", url: `${site}/seller/pesanan` }]] },
    });
    await admin.from("telegram_notifications").update(
      res.ok ? { sent_at: new Date().toISOString(), attempts: r.attempts + 1 } : { attempts: r.attempts + 1, error: (res.description ?? "gagal").slice(0, 200) },
    ).eq("id", r.id);
    if (!res.ok) continue;
    sent++;

    // Low-stock warning right after a paid order.
    if (r.kind === "order_paid") {
      const pids = [...new Set(its.map((i) => i.product_id).filter((x): x is string => !!x))];
      if (!pids.length) continue;
      const { data: stock } = await admin.rpc("variant_stock", { p_product_ids: pids });
      const st = new Map((stock ?? []).map((s) => [s.variant_id, s.available]));
      for (const i of its) {
        const left = i.variant_id ? st.get(i.variant_id) : undefined;
        if (left == null || left > LOW_STOCK) continue;
        await tg(bot.token, "sendMessage", {
          chat_id: r.chat_id, parse_mode: "HTML",
          text: left === 0
            ? `🚫 <b>Stok Habis</b>\n\n📦 ${esc(i.product_name)} — ${esc(i.variant_name)}\n\nTambah stok agar produk bisa dibeli lagi.`
            : `⚠️ <b>Stok Menipis</b>\n\n📦 ${esc(i.product_name)} — ${esc(i.variant_name)}\n📉 Sisa stok: ${left}\n\nPertimbangkan untuk menambah stok.`,
        });
      }
    }
  }
  return { sent };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
