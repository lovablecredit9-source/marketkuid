import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { pageBase, siteBase, tg } from "@/lib/telegram-bot.server";
import { sellerNet } from "@/lib/telegram";
import { HUB_COMMANDS, HUB_KEYBOARD, hubActionFromText, hubOrderCaption, parseHubLink, type HubAction, type HubKind } from "@/lib/seller-hub";
import { chatCard, dashboardCard, depositCard, orderCard, type OrderCardKind } from "@/lib/seller-hub-cards.server";

type Admin = SupabaseClient<Database>;
export type HubBotRow = Database["public"]["Tables"]["seller_hub_bot"]["Row"];
type TgUser = { id: number; first_name?: string; username?: string };
type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: TgUser; text?: string };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number }; message_id: number } };
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const when = (s: string) => new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const LINE = "━━━━━━━━━━━━━━━";

/** Telegram's coloured `style` buttons; retried without them when a client/API rejects the field. */
function stripStyle(m: unknown): unknown {
  if (Array.isArray(m)) return m.map(stripStyle);
  if (m && typeof m === "object") return Object.fromEntries(Object.entries(m).filter(([k]) => k !== "style").map(([k, v]) => [k, stripStyle(v)]));
  return m;
}
async function call(token: string, method: string, body: Record<string, unknown>) {
  const r = await tg(token, method, body);
  if (!r.ok && body["reply_markup"] && /style|button/i.test(r.description ?? "")) return tg(token, method, { ...body, reply_markup: stripStyle(body["reply_markup"]) });
  return r;
}

export async function sendPng(token: string, chatId: number, png: Uint8Array, caption: string, markup?: unknown) {
  const send = async (m: unknown) => {
    const fd = new FormData();
    fd.set("chat_id", String(chatId));
    fd.set("caption", caption);
    fd.set("parse_mode", "HTML");
    if (m) fd.set("reply_markup", JSON.stringify(m));
    fd.set("photo", new Blob([png as BlobPart], { type: "image/png" }), "marketku.png");
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: fd });
      return (await r.json()) as { ok: boolean; description?: string };
    } catch (e) { console.error("sendPhoto failed", e); return { ok: false, description: "Tidak bisa menghubungi Telegram" }; }
  };
  let r = await send(markup);
  if (!r.ok && markup && /style|button/i.test(r.description ?? "")) r = await send(stripStyle(markup));
  return r;
}

export async function registerHubWebhook(bot: Pick<HubBotRow, "token" | "webhook_secret">) {
  const r = await tg<boolean>(bot.token, "setWebhook", {
    url: `${siteBase()}/api/public/telegram/seller-center`,
    secret_token: bot.webhook_secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (r.ok) {
    await tg(bot.token, "setMyCommands", { commands: HUB_COMMANDS });
    await tg(bot.token, "setMyDescription", { description: "Marketku Seller Center — dashboard toko & notifikasi realtime: pesanan baru, pembayaran, pembatalan, habis waktu, chat pembeli dan deposit." });
    await tg(bot.token, "setMyShortDescription", { short_description: "Dashboard & notifikasi seller Marketku" });
    await tg(bot.token, "setChatMenuButton", { menu_button: { type: "web_app", text: "Seller Center", web_app: { url: `${pageBase()}/seller` } } });
  }
  return r;
}

const replyKb = () => ({ keyboard: HUB_KEYBOARD, resize_keyboard: true, is_persistent: true });

/* ---------------- sections ---------------- */

async function storeOf(admin: Admin, owner: string) {
  const { data } = await admin.from("seller_stores").select("store_name, slug, is_open, telegram_username, description, created_at").eq("owner_id", owner).maybeSingle();
  return data;
}

async function dashboard(admin: Admin, owner: string) {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const dayStart = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
  const weekStart = new Date(dayStart.getTime() - 6 * 86400_000);
  const monthStart = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000);
  const since = new Date(Math.min(weekStart.getTime(), monthStart.getTime())).toISOString();
  const [{ data: paid }, { data: wallet }, { data: credits }, { data: prods }, { data: credited }] = await Promise.all([
    admin.from("orders").select("id, subtotal, discount, paid_at").eq("seller_id", owner).not("paid_at", "is", null).gte("paid_at", since).in("status", ["paid", "processing", "completed"]),
    admin.from("wallets").select("balance").eq("user_id", owner).maybeSingle(),
    admin.from("seller_credits").select("balance").eq("owner_id", owner).maybeSingle(),
    admin.from("products").select("id, status, view_count").eq("owner_id", owner).neq("status", "deleted"),
    admin.from("wallet_ledger").select("ref_id").eq("user_id", owner).eq("kind", "sale").gte("created_at", since),
  ]);
  const rows = paid ?? [];
  const agg = (from: Date): [number, number] => {
    const xs = rows.filter((o) => new Date(o.paid_at!) >= from);
    return [xs.length, xs.reduce((a, o) => a + Number(o.subtotal) - Number(o.discount), 0)];
  };
  const done = new Set((credited ?? []).map((x) => x.ref_id));
  const held = rows.filter((o) => !done.has(o.id)).reduce((a, o) => a + sellerNet(Number(o.subtotal) - Number(o.discount)), 0);
  const all = prods ?? [];
  const active = all.filter((p) => p.status === "active");
  const { data: stock } = active.length ? await admin.rpc("variant_stock", { p_product_ids: active.map((p) => p.id) }) : { data: [] };
  return {
    today: agg(dayStart), week: agg(weekStart), month: agg(monthStart),
    available: Number(wallet?.balance ?? 0), held, credits: Number(credits?.balance ?? 0),
    products: `${active.length}/${all.length}`, stock: (stock ?? []).reduce((a, s) => a + Number(s.available), 0),
    views: all.reduce((a, p) => a + Number(p.view_count ?? 0), 0),
  };
}

type Out = { text: string; markup?: unknown; png?: Uint8Array | undefined };

async function section(admin: Admin, owner: string, action: HubAction, site: string): Promise<Out> {
  const store = await storeOf(admin, owner);
  const name = store?.store_name ?? "Toko";
  const open = (path: string, label: string) => [{ text: label, url: `${site}${path}` }];
  switch (action) {
    case "dash": {
      const d = await dashboard(admin, owner);
      const f = (v: [number, number]) => `${v[0]} pesanan · ${rp(v[1])}`;
      const text = [
        `🏪 <b>${esc(name)}</b>`, LINE,
        "┌─ 🔵 <b>Hari Ini</b>", `│  ${f(d.today)}`,
        "├─ 🟣 <b>7 Hari</b>", `│  ${f(d.week)}`,
        "├─ 🟠 <b>Bulan Ini</b>", `│  ${f(d.month)}`,
        "├─ 📦 <b>Toko</b>", `│  ${d.products} produk aktif · ${d.stock.toLocaleString("id-ID")} stok`, `│  👁 Dilihat ${d.views.toLocaleString("id-ID")}x`,
        "├─ 💰 <b>Saldo</b>", `│  ${rp(d.available)} tersedia`, `│  ${rp(d.held)} tertahan`, `│  ${rp(d.credits)} credits`,
        "└──────────────", "",
        "👇 Pilih menu di bawah untuk mulai kelola toko.", "<i>Notifikasi pesanan masuk otomatis ke chat ini.</i>",
      ].join("\n");
      let png: Uint8Array | undefined;
      try { png = await dashboardCard({ store: name, ...d, at: new Date() }); } catch (e) { console.error("dashboard card", e); }
      return {
        text, png,
        markup: { inline_keyboard: [
          [{ text: "📋 Pesanan Baru", callback_data: "h:new", style: "primary" }, { text: "🏆 Produk Laris", callback_data: "h:laris", style: "primary" }],
          [{ text: "📢 Broadcast", url: `${site}/seller/bot`, style: "success" }],
          [{ text: "🖥 Seller Panel", url: `${site}/seller`, style: "primary" }],
        ] },
      };
    }
    case "prod": case "laris": {
      const q = admin.from("products").select("id, name, status, sold_count, view_count").eq("owner_id", owner).in("status", ["active", "draft"]).limit(12);
      const { data } = action === "laris" ? await q.order("sold_count", { ascending: false }) : await q.order("created_at", { ascending: false });
      const list = data ?? [];
      const { data: stock } = list.length ? await admin.rpc("variant_stock", { p_product_ids: list.map((p) => p.id) }) : { data: [] };
      const { data: vs } = list.length ? await admin.from("product_variants").select("id, product_id, price").in("product_id", list.map((p) => p.id)) : { data: [] };
      const st = new Map((stock ?? []).map((s) => [s.variant_id, Number(s.available)]));
      const body = list.map((p, i) => {
        const v = (vs ?? []).filter((x) => x.product_id === p.id);
        const price = v.length ? Math.min(...v.map((x) => Number(x.price))) : 0;
        const s = v.reduce((a, x) => a + (st.get(x.id) ?? 0), 0);
        return `${action === "laris" ? `${i + 1}.` : p.status === "active" ? "🟢" : "⚪️"} <b>${esc(p.name)}</b>\n${rp(price)} · Stok ${s} · Terjual ${p.sold_count} · 👁 ${p.view_count}`;
      }).join("\n\n");
      return { text: `${action === "laris" ? "🏆 <b>Produk Laris</b>" : `📦 <b>Produk — ${list.length}</b>`}\n${LINE}\n\n${body || "Belum ada produk."}`, markup: { inline_keyboard: [open("/seller/produk", "➕ Kelola Produk"), [{ text: "⬅️ Dashboard", callback_data: "h:dash" }]] } };
    }
    case "order":
      return ordersPage(admin, owner, "all", 1, site);
    case "new": {
      let q = admin.from("orders").select("order_no, status, total, created_at, expires_at, order_items(product_name, qty)").eq("seller_id", owner).order("created_at", { ascending: false }).limit(8);
      if (action === "new") q = q.in("status", ["pending", "paid", "processing"]);
      const { data } = await q;
      const label: Record<string, string> = { pending: "⏳ Belum dibayar", paid: "💳 Dibayar", processing: "📦 Diproses", completed: "✅ Selesai", cancelled: "❌ Batal", refunded: "↩️ Refund", failed: "❌ Gagal" };
      const rows = (data ?? []) as unknown as { order_no: number; status: string; total: number; created_at: string; expires_at: string | null; order_items: { product_name: string; qty: number }[] }[];
      const body = rows.map((o) => {
        const st = o.status === "pending" && o.expires_at && new Date(o.expires_at) < new Date() ? "⌛ Habis waktu" : label[o.status] ?? o.status;
        return `${st} · <code>M-${o.order_no}</code>\n${esc(o.order_items[0]?.product_name ?? "-")} · ${o.order_items.reduce((a, i) => a + i.qty, 0)}x · <b>${rp(Number(o.total))}</b>\n🕒 ${when(o.created_at)}`;
      }).join("\n\n");
      return { text: `${action === "new" ? "📋 <b>Pesanan Baru / Aktif</b>" : "📋 <b>Pesanan Terbaru</b>"}\n${LINE}\n\n${body || "Belum ada pesanan."}`, markup: { inline_keyboard: [open("/seller/transaksi", "📋 Semua Pesanan"), [{ text: "⬅️ Dashboard", callback_data: "h:dash" }]] } };
    }
    case "fin": {
      const d = await dashboard(admin, owner);
      const { data: led } = await admin.from("wallet_ledger").select("amount, note, created_at").eq("user_id", owner).order("created_at", { ascending: false }).limit(6);
      const mut = (led ?? []).map((l) => `${Number(l.amount) >= 0 ? "➕" : "➖"} ${rp(Math.abs(Number(l.amount)))} · ${esc((l.note ?? "").slice(0, 36))}\n   🕒 ${when(l.created_at)}`).join("\n") || "Belum ada mutasi.";
      return { text: `💰 <b>Keuangan</b>\n${LINE}\n💵 ${rp(d.available)} tersedia\n🔒 ${rp(d.held)} tertahan\n💳 ${rp(d.credits)} credits\n\n📜 <b>Mutasi terakhir</b>\n${mut}`, markup: { inline_keyboard: [[{ text: "💸 Tarik Saldo", url: `${site}/seller/withdraw`, style: "success" }, { text: "📈 Pendapatan", url: `${site}/seller/pendapatan` }], [{ text: "💳 Top Up Credits", url: `${site}/seller/saldo` }]] } };
    }
    case "voucher": {
      const { data } = await admin.from("seller_vouchers").select("code, name, value_type, value, used_count, usage_limit, is_active, ends_at").eq("owner_id", owner).order("created_at", { ascending: false }).limit(8);
      const body = (data ?? []).map((v) => `${v.is_active ? "🟢" : "⚪️"} <code>${esc(v.code)}</code> · ${esc(v.name)}\n${v.value_type === "percent" ? `${Number(v.value)}%` : rp(Number(v.value))} · Dipakai ${v.used_count}${v.usage_limit ? `/${v.usage_limit}` : ""}${v.ends_at ? ` · s/d ${when(v.ends_at)}` : ""}`).join("\n\n");
      return { text: `🎟 <b>Voucher Toko</b>\n${LINE}\n\n${body || "Belum ada voucher."}`, markup: { inline_keyboard: [open("/seller/voucher", "➕ Kelola Voucher")] } };
    }
    case "garansi": {
      const { data } = await admin.from("warranty_claims").select("code, product_name, reason, status, created_at").eq("seller_id", owner).order("created_at", { ascending: false }).limit(8);
      const lb: Record<string, string> = { pending: "⏳ Menunggu", approved: "✅ Disetujui", rejected: "❌ Ditolak" };
      const body = (data ?? []).map((c) => `${lb[c.status] ?? c.status} · <code>${esc(c.code)}</code>\n${esc(c.product_name)} — ${esc(c.reason.slice(0, 60))}\n🕒 ${when(c.created_at)}`).join("\n\n");
      return { text: `🛡 <b>Klaim Garansi</b>\n${LINE}\n\n${body || "Belum ada klaim garansi."}`, markup: { inline_keyboard: [open("/seller/garansi", "🛡 Proses Klaim")] } };
    }
    case "profil": {
      const { count } = await admin.from("store_follows").select("user_id", { count: "exact", head: true }).eq("seller_id", owner);
      return {
        text: `🏪 <b>${esc(name)}</b>\n${LINE}\n${store?.is_open ? "🟢 Toko buka" : "🔴 Toko tutup"}\n👥 ${count ?? 0} pengikut\n${store?.telegram_username ? `✈️ @${esc(store.telegram_username)}\n` : ""}📅 Sejak ${store ? when(store.created_at) : "-"}\n\n${esc((store?.description ?? "").slice(0, 300)) || "<i>Belum ada deskripsi toko.</i>"}`,
        markup: { inline_keyboard: [...(store?.slug ? [open(`/toko/${store.slug}`, "🌐 Kunjungi Toko")] : []), open("/seller/pengaturan", "⚙️ Pengaturan Toko")] },
      };
    }
    case "broadcast":
      return { text: `📢 <b>Broadcast</b>\n\nKirim pesan/promo ke semua pembeli bot toko kamu dari Seller Center.`, markup: { inline_keyboard: [open("/seller/bot", "📢 Buka Broadcast")] } };
    case "more":
    default:
      return {
        text: `⚙️ <b>Lainnya</b>\n\nBot <b>Marketku Seller Center</b> mengirim notifikasi bergambar otomatis:\n• 🛒 Pesanan baru (belum dibayar)\n• ✅ Pembayaran berhasil\n• ❌ Pesanan dibatalkan\n• ⌛ Pesanan habis waktu\n• 💬 Chat baru dari pembeli\n• 💳 Deposit / top up credits\n\nAkun ini terhubung ke toko <b>${esc(name)}</b>.`,
        markup: { inline_keyboard: [open("/seller", "🖥 Seller Panel"), [{ text: "🔌 Putuskan Telegram", callback_data: "h:unlink", style: "danger" }]] },
      };
  }
}

const FILTER_LABEL: Record<OrderFilter, string> = { all: "📊 Semua", done: "🟢 Selesai", pending: "🟡 Pending", paid: "🟠 Dibayar" };
const STATUS_ICON: Record<string, string> = { pending: "⏳", paid: "💳", processing: "📦", completed: "✅", cancelled: "❌", refunded: "↩️", failed: "❌" };

/** Paginated order list: 5 per page, order buttons, Next/Prev and status filters (like the original bot). */
async function ordersPage(admin: Admin, owner: string, filter: OrderFilter, page: number, site: string): Promise<Out> {
  const statuses = ORDER_FILTER_STATUSES[filter];
  let cq = admin.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", owner);
  if (statuses) cq = cq.in("status", statuses);
  const { count } = await cq;
  const total = count ?? 0;
  const pages = pageCount(total);
  const p = Math.min(Math.max(1, page), pages);
  let q = admin.from("orders").select("order_no, status, total, created_at, order_items(product_name, qty)").eq("seller_id", owner)
    .order("created_at", { ascending: false }).range((p - 1) * ORDER_PAGE_SIZE, p * ORDER_PAGE_SIZE - 1);
  if (statuses) q = q.in("status", statuses);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { order_no: number; status: string; total: number; created_at: string; order_items: { product_name: string; qty: number }[] }[];
  const body = rows.map((o) => {
    const name = o.order_items[0]?.product_name ?? "-";
    return `${STATUS_ICON[o.status] ?? "•"} <b>${esc(name.length > 22 ? `${name.slice(0, 22)}…` : name)}</b>\n${o.order_items.reduce((a, i) => a + i.qty, 0)}x · ${rp(Number(o.total))} · ${when(o.created_at)}`;
  }).join("\n\n");
  const nav = [
    ...(p > 1 ? [{ text: "« Prev", callback_data: `o:${filter}:${p - 1}` }] : []),
    ...(p < pages ? [{ text: "Next »", callback_data: `o:${filter}:${p + 1}` }] : []),
  ];
  const fb = (f: OrderFilter) => ({ text: FILTER_LABEL[f], callback_data: `o:${f}:1`, ...(f === filter ? { style: "primary" } : {}) });
  return {
    text: `📋 <b>Pesanan — ${total}</b>${filter !== "all" ? ` · ${FILTER_LABEL[filter].slice(3)}` : ""}\n${LINE}\n\n${body || "Belum ada pesanan."}\n\n📄 ${p}/${pages}`,
    markup: { inline_keyboard: [
      ...rows.map((o) => [{ text: `🔍 M-${o.order_no}`, callback_data: `od:${o.order_no}` }]),
      ...(nav.length ? [nav] : []),
      [fb("all"), fb("done")], [fb("pending"), fb("paid")],
      [{ text: "🖥 Semua di Seller Panel", url: `${site}/seller/transaksi` }],
    ] },
  };
}

async function orderDetail(admin: Admin, owner: string, orderNo: number, site: string): Promise<Out> {
  const { data: o } = await admin.from("orders").select("id, order_no, status, total, payment_method, buyer_name, buyer_note, created_at, paid_at, expires_at").eq("seller_id", owner).eq("order_no", orderNo).maybeSingle();
  if (!o) return { text: "⚠️ Pesanan tidak ditemukan." };
  const { data: items } = await admin.from("order_items").select("product_name, variant_name, qty, unit_price").eq("order_id", o.id);
  const lb: Record<string, string> = { pending: "⏳ Menunggu pembayaran", paid: "💳 Dibayar", processing: "📦 Diproses", completed: "✅ Selesai", cancelled: "❌ Dibatalkan", refunded: "↩️ Refund", failed: "❌ Gagal" };
  const its = (items ?? []).map((i) => `      •  ${esc(i.product_name)}${i.variant_name ? ` — ${esc(i.variant_name)}` : ""}\n         ${i.qty}x · ${rp(Number(i.unit_price))}`).join("\n");
  return {
    text: [
      `🧾 <b>Detail Pesanan</b>`, LINE,
      `🆔 Order: <code>M-${o.order_no}</code>`, `📌 Status: ${lb[o.status] ?? o.status}`,
      `👤 Pembeli: ${esc(o.buyer_name ?? "Pembeli")}`, `💳 Metode: ${esc(hubMethod(o.payment_method))}`,
      `🕒 Dibuat: ${when(o.created_at)}`, ...(o.paid_at ? [`✅ Dibayar: ${when(o.paid_at)}`] : []),
      ...(o.status === "pending" && o.expires_at ? [`⏰ Batas bayar: ${when(o.expires_at)}`] : []),
      "", "📦 <b>Item</b>", its || "-", "", `💰 Total: <b>${rp(Number(o.total))}</b>`,
      ...(o.buyer_note ? ["", `📝 Catatan: ${esc(o.buyer_note.slice(0, 300))}`] : []),
    ].join("\n"),
    markup: { inline_keyboard: [
      [{ text: "📋 Buka di Seller Panel", url: `${site}/seller/transaksi`, style: "primary" }],
      [{ text: "← Kembali", callback_data: "o:all:1" }],
    ] },
  };
}

async function deliver(token: string, chatId: number, o: Out): Promise<{ ok: boolean; description?: string; messageId?: number }> {
  if (o.png && o.text.length <= 1024) {
    const r = (await sendPng(token, chatId, o.png, o.text, o.markup)) as { ok: boolean; description?: string; result?: { message_id: number } };
    if (r.ok) return { ok: true, messageId: r.result?.message_id };
  }
  const r = (await call(token, "sendMessage", { chat_id: chatId, text: o.text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: o.markup })) as { ok: boolean; description?: string; result?: { message_id: number } };
  return { ok: r.ok, description: r.description, messageId: r.result?.message_id };
}

/** Seller replied (Telegram reply) to a chat notice → post the text into that conversation as the seller. */
async function replyToBuyer(admin: Admin, token: string, owner: string, chatId: number, replyTo: number, body: string) {
  const { data: n } = await admin.from("seller_hub_notifications").select("ref_id").eq("owner_id", owner).eq("kind", "chat")
    .eq("tg_chat_id", chatId).eq("tg_message_id", replyTo).maybeSingle();
  if (!n?.ref_id) return false;
  const { data: m } = await admin.from("messages").select("conversation_id").eq("id", n.ref_id).maybeSingle();
  if (!m) return false;
  const { data: conv } = await admin.from("conversations").select("seller_id, buyer_name").eq("id", m.conversation_id).maybeSingle();
  if (!conv || conv.seller_id !== owner) return false;
  const { error } = await admin.from("messages").insert({ conversation_id: m.conversation_id, sender_id: owner, body: body.slice(0, 2000) });
  await tg(token, "sendMessage", {
    chat_id: chatId, reply_to_message_id: replyTo, parse_mode: "HTML",
    text: error ? `⚠️ Gagal mengirim balasan: ${esc(error.message)}` : `✅ Balasan terkirim ke <b>${esc(conv.buyer_name || "pembeli")}</b>.`,
  });
  return true;
}

export async function handleHubUpdate(admin: Admin, bot: HubBotRow, update: Update, site: string) {
  const from = update.message?.from ?? update.callback_query?.from;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (!from || !chatId) return;
  if (update.message && update.message.chat.type !== "private") return;
  const text = update.message?.text?.trim() ?? "";
  const startParam = /^\/start(?:@\w+)?\s+(\S+)/.exec(text)?.[1];
  const code = startParam ? parseHubLink(startParam) : null;

  if (code) {
    const { data: link } = await admin.from("seller_hub_link_codes").select("*").eq("code", code).maybeSingle();
    await admin.from("seller_hub_link_codes").delete().eq("code", code);
    const store = link && new Date(link.expires_at).getTime() > Date.now() ? await storeOf(admin, link.owner_id) : null;
    if (!link || !store) {
      await tg(bot.token, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text: "⚠️ Link sudah kedaluwarsa. Buka Seller Center → Bot Telegram → <b>Hubungkan Marketku Seller Center</b> lagi." });
      return;
    }
    const tgName = [from.first_name, from.username ? `@${from.username}` : null].filter(Boolean).join(" ").slice(0, 80);
    await admin.from("seller_hub_links").delete().eq("tg_user_id", from.id);
    await admin.from("seller_hub_links").upsert({ owner_id: link.owner_id, tg_user_id: from.id, tg_name: tgName, linked_at: new Date().toISOString() });
    await call(bot.token, "sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `✅ <b>Terhubung ke Marketku Seller Center</b>\n\nToko: <b>${esc(store.store_name)}</b>\nNotifikasi pesanan, pembayaran, pembatalan, habis waktu, chat pembeli dan deposit akan dikirim ke sini lengkap dengan gambar.`,
      reply_markup: replyKb(),
    });
    await deliver(bot.token, chatId, await section(admin, link.owner_id, "dash", site));
    return;
  }

  const { data: me } = await admin.from("seller_hub_links").select("owner_id").eq("tg_user_id", from.id).maybeSingle();
  if (!me) {
    if (update.callback_query) await tg(bot.token, "answerCallbackQuery", { callback_query_id: update.callback_query.id, text: "Hubungkan akun dulu", show_alert: true });
    else await tg(bot.token, "sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: "🏪 <b>Marketku Seller Center</b>\n\nBot khusus seller Marketku. Hubungkan toko kamu lewat Seller Center → <b>Bot Telegram</b> → <b>Hubungkan Marketku Seller Center</b>.",
      reply_markup: { inline_keyboard: [[{ text: "🖥 Buka Seller Center", url: `${site}/seller/bot` }]] },
    });
    return;
  }

  if (update.callback_query) {
    const cq = update.callback_query;
    const action = (cq.data ?? "").replace(/^h:/, "") as HubAction;
    if (action === "unlink") {
      await admin.from("seller_hub_links").delete().eq("tg_user_id", from.id);
      await tg(bot.token, "answerCallbackQuery", { callback_query_id: cq.id, text: "Telegram diputuskan" });
      await tg(bot.token, "sendMessage", { chat_id: chatId, text: "🔌 Telegram diputuskan dari toko. Notifikasi berhenti.", reply_markup: { remove_keyboard: true } });
      return;
    }
    await tg(bot.token, "answerCallbackQuery", { callback_query_id: cq.id });
    const ok: HubAction[] = ["dash", "prod", "order", "fin", "voucher", "garansi", "profil", "broadcast", "more", "new", "laris"];
    if (!ok.includes(action)) return;
    await deliver(bot.token, chatId, await section(admin, me.owner_id, action, site));
    return;
  }

  const action = hubActionFromText(text) ?? "dash";
  if (text.startsWith("/start")) await call(bot.token, "sendMessage", { chat_id: chatId, text: "👋 Selamat datang kembali di Marketku Seller Center!", reply_markup: replyKb() });
  await deliver(bot.token, chatId, await section(admin, me.owner_id, action, site));
}

/* ---------------- notifications ---------------- */

/** Pending orders past their pay deadline get a one-time "habis waktu" notice (expiry is derived, not a status). */
async function enqueueExpired(admin: Admin) {
  const { data: links } = await admin.from("seller_hub_links").select("owner_id");
  const owners = (links ?? []).map((l) => l.owner_id);
  if (!owners.length) return;
  const now = new Date();
  const { data: orders } = await admin.from("orders").select("id, seller_id").eq("status", "pending").in("seller_id", owners)
    .lt("expires_at", now.toISOString()).gt("expires_at", new Date(now.getTime() - 86400_000).toISOString()).limit(50);
  if (!orders?.length) return;
  const { data: have } = await admin.from("seller_hub_notifications").select("order_id").eq("kind", "order_expired").in("order_id", orders.map((o) => o.id));
  const seen = new Set((have ?? []).map((h) => h.order_id));
  const rows = orders.filter((o) => !seen.has(o.id)).map((o) => ({ owner_id: o.seller_id, kind: "order_expired", order_id: o.id }));
  if (rows.length) await admin.from("seller_hub_notifications").insert(rows);
}

export async function drainHubNotifications(admin: Admin, site: string, limit = 15) {
  const { data: bot } = await admin.from("seller_hub_bot").select("*").eq("id", 1).maybeSingle();
  if (!bot?.is_active) return { sent: 0 };
  await enqueueExpired(admin);
  const { data: rows } = await admin.from("seller_hub_notifications").select("*").is("sent_at", null).lt("attempts", 5).order("created_at").limit(limit);
  if (!rows?.length) return { sent: 0 };
  let sent = 0;
  for (const r of rows) {
    const mark = (ok: boolean, err?: string) => admin.from("seller_hub_notifications").update(
      ok ? { sent_at: new Date().toISOString(), attempts: r.attempts + 1 } : { attempts: r.attempts + 1, error: (err ?? "gagal").slice(0, 200) },
    ).eq("id", r.id);
    const { data: link } = await admin.from("seller_hub_links").select("tg_user_id").eq("owner_id", r.owner_id).maybeSingle();
    if (!link) { await mark(true); continue; }
    const store = (await storeOf(admin, r.owner_id))?.store_name ?? "Toko";
    let out: Out | null = null;
    try { out = await buildNotice(admin, r.kind as HubKind, r.order_id, r.ref_id, store, site); }
    catch (e) { console.error("hub notice build", e); }
    if (!out) { await mark(true); continue; }
    const res = await deliver(bot.token, Number(link.tg_user_id), out);
    await mark(res.ok, res.description);
    if (res.ok) sent++;
  }
  return { sent };
}

async function buildNotice(admin: Admin, kind: HubKind, orderId: string | null, refId: string | null, store: string, site: string): Promise<Out | null> {
  const dashBtn = { text: "📊 Dashboard", callback_data: "h:dash" };
  if (kind === "chat" && refId) {
    const { data: m } = await admin.from("messages").select("body, attachment_path, product_id, conversation_id, created_at").eq("id", refId).maybeSingle();
    if (!m) return null;
    const [{ data: conv }, { data: prod }] = await Promise.all([
      admin.from("conversations").select("buyer_name").eq("id", m.conversation_id).maybeSingle(),
      m.product_id ? admin.from("products").select("name").eq("id", m.product_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const buyer = conv?.buyer_name || "Pembeli";
    const png = await chatCard({ store, buyer, message: m.body ?? "", product: prod?.name ?? null, photo: !!m.attachment_path, at: new Date(m.created_at) });
    return {
      png,
      text: `💬 <b>Chat Baru dari ${esc(buyer)}</b>\n\n${esc((m.body || (m.attachment_path ? "📷 Foto" : "")).slice(0, 600))}${prod?.name ? `\n\n📦 ${esc(prod.name)}` : ""}`,
      markup: { inline_keyboard: [[{ text: "💬 Balas Chat", url: `${site}/seller/chat/${m.conversation_id}`, style: "primary" }], [dashBtn]] },
    };
  }
  if (kind === "deposit" && refId) {
    const { data: d } = await admin.from("deposit_requests").select("amount, method_label, purpose, status, created_at, reviewed_at").eq("id", refId).maybeSingle();
    if (!d) return null;
    const png = await depositCard({ store, amount: Number(d.amount), method: d.method_label, purpose: d.purpose, status: d.status, at: new Date(d.reviewed_at ?? d.created_at) });
    const lb: Record<string, string> = { pending: "⏳ Menunggu admin", approved: "✅ Disetujui", rejected: "❌ Ditolak" };
    return {
      png,
      text: `💳 <b>Deposit ${d.purpose === "credits" ? "Seller Credits" : "Saldo"}</b>\n\n💰 <b>${rp(Number(d.amount))}</b>\n🏦 ${esc(d.method_label ?? "-")}\n📌 ${lb[d.status] ?? d.status}`,
      markup: { inline_keyboard: [[{ text: "💳 Lihat Credits", url: `${site}/seller/saldo` }], [dashBtn]] },
    };
  }
  if (!orderId) return null;
  const [{ data: o }, { data: items }] = await Promise.all([
    admin.from("orders").select("order_no, total, payment_method, buyer_name, buyer_note, created_at, paid_at, updated_at, expires_at").eq("id", orderId).maybeSingle(),
    admin.from("order_items").select("product_name, variant_name, qty, unit_price").eq("order_id", orderId),
  ]);
  if (!o) return null;
  const its = items ?? [];
  const first = its[0];
  const qty = its.reduce((a, i) => a + i.qty, 0);
  const product = first ? `${first.product_name}${its.length > 1 ? ` +${its.length - 1}` : ""}` : "-";
  const at = new Date(kind === "order_new" ? o.created_at : kind === "order_paid" ? o.paid_at ?? o.updated_at : kind === "order_expired" ? o.expires_at ?? o.updated_at : o.updated_at);
  const png = await orderCard({
    kind: kind as OrderCardKind, store, orderNo: o.order_no, product: first?.product_name ?? "-", variant: first?.variant_name ?? "-",
    qty, unit: Number(first?.unit_price ?? 0), total: Number(o.total), method: o.payment_method, buyer: o.buyer_name, note: o.buyer_note,
    at, expiresAt: o.expires_at ? new Date(o.expires_at) : null,
  });
  return {
    png,
    text: hubOrderCaption(kind, { orderNo: o.order_no, total: Number(o.total), product, qty, buyer: o.buyer_name, method: o.payment_method }),
    markup: { inline_keyboard: [[{ text: "📋 Detail Pesanan", url: `${site}/seller/transaksi`, style: "primary" }], [dashBtn, { text: "🆕 Pesanan Aktif", callback_data: "h:new" }]] },
  };
}
