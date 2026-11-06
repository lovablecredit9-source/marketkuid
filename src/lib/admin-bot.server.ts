import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { pageBase, siteBase, signedImage, tg } from "@/lib/telegram-bot.server";
import { verifyInitData } from "@/lib/auth-bot";
import {
  ADMIN_COMMANDS, ADMIN_KEYBOARD, ADMIN_MINI_DENIED, ADMIN_TAB, adminActionFromText, adminNotifyText, canOpenAdminMiniApp, parseAdminLink,
  type AdminMenuAction, type AdminNotifyKind,
} from "@/lib/admin-bot";

type Admin = SupabaseClient<Database>;
export type AdminBotRow = Database["public"]["Tables"]["admin_bot"]["Row"];

type TgUser = { id: number; first_name?: string; username?: string };
type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: TgUser; text?: string };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number }; message_id: number } };
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const when = (s: string) => new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
/** Banner lives in private storage (dev host blocks static files); Telegram fetches it via a signed URL. */
export const ADMIN_BANNER_PATH = "system/tg-admin-banner.jpg";
const panel = (site: string, tab?: string) => `${site}/admin${tab ? `?tab=${tab}` : ""}`;
/** Mini App entry: published host (dev host is auth-walled for Telegram's in-app browser). */
export const adminMiniUrl = () => `${pageBase()}/admin/login`;

/** Admin Mini App button only in linked admins' chats; everyone else keeps the plain commands menu. */
export async function setAdminMenuButton(token: string, chatId: number, isAdmin: boolean) {
  return tg(token, "setChatMenuButton", {
    chat_id: chatId,
    menu_button: isAdmin ? { type: "web_app", text: "Admin Console", web_app: { url: adminMiniUrl() } } : { type: "commands" },
  });
}

async function syncAdminMenuButtons(admin: Admin, token: string) {
  await tg(token, "setChatMenuButton", { menu_button: { type: "commands" } });
  const { data: rows } = await admin.from("admin_bot_admins").select("tg_user_id, user_id");
  for (const r of rows ?? []) {
    const { data: ok } = await admin.from("user_roles").select("role").eq("user_id", r.user_id).eq("role", "admin").maybeSingle();
    await setAdminMenuButton(token, r.tg_user_id, !!ok);
  }
}

export async function registerAdminWebhook(bot: Pick<AdminBotRow, "token" | "webhook_secret">) {
  const r = await tg<boolean>(bot.token, "setWebhook", {
    url: `${siteBase()}/api/public/telegram/admin`,
    secret_token: bot.webhook_secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (r.ok) {
    await tg(bot.token, "setMyCommands", { commands: ADMIN_COMMANDS });
    await tg(bot.token, "setMyDescription", { description: "Marketku Center — bot khusus admin Marketku: notifikasi deposit, withdraw, bukti bayar, dispute, kategori & toko baru." });
    await tg(bot.token, "setMyShortDescription", { short_description: "Bot admin Marketku Center" });
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await syncAdminMenuButtons(supabaseAdmin, bot.token);
    } catch (e) { console.error("admin menu buttons", e); }
  }
  return r;
}

async function counts(admin: Admin) {
  const c = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const [dep, pay, wd, dis, cat, stores, users, ordersToday] = await Promise.all([
    c(admin.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
    c(admin.from("order_payments").select("id", { count: "exact", head: true }).eq("status", "pending")),
    c(admin.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
    c(admin.from("order_disputes").select("id", { count: "exact", head: true }).in("status", ["terbuka", "ditinjau"])),
    c(admin.from("category_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
    c(admin.from("seller_stores").select("owner_id", { count: "exact", head: true })),
    c(admin.from("profiles").select("id", { count: "exact", head: true })),
    c(admin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", day)),
  ]);
  return { dep, pay, wd, dis, cat, stores, users, ordersToday };
}

const menuInline = (site: string, k: Awaited<ReturnType<typeof counts>>) => ({
  inline_keyboard: [
    [{ text: `💰 Deposit (${k.dep})`, callback_data: "a:deposit" }, { text: `🧾 Bayar Order (${k.pay})`, callback_data: "a:bayar" }],
    [{ text: `🏦 Withdraw (${k.wd})`, callback_data: "a:withdraw" }, { text: `⚠️ Dispute (${k.dis})`, callback_data: "a:dispute" }],
    [{ text: `🗂 Kategori (${k.cat})`, callback_data: "a:kategori" }, { text: "🏪 Toko Baru", callback_data: "a:toko" }],
    [{ text: "🔄 Refresh", callback_data: "a:home" }],
    [{ text: "📱 Buka Mini App Admin", web_app: { url: adminMiniUrl() } }],
    [{ text: "🖥 Buka Admin Console", url: panel(site) }],
  ],
});

const back = (site: string, tab?: string) => ({
  inline_keyboard: [
    ...(tab ? [[{ text: "🖥 Buka di Admin Console", url: panel(site, tab) }]] : []),
    [{ text: "⬅️ Kembali", callback_data: "a:home" }],
  ],
});

async function section(admin: Admin, action: AdminMenuAction, site: string): Promise<{ text: string; markup: unknown; photo?: string | undefined }> {
  if (action === "home") {
    const k = await counts(admin);
    const waiting = k.dep + k.pay + k.wd + k.dis + k.cat;
    const text = `🛡 <b>MARKETKU CENTER</b>\n<i>Panel admin Marketku</i>\n\n`
      + `📌 <b>Perlu ditindak: ${waiting}</b>\n`
      + `├ 💰 Deposit menunggu: <b>${k.dep}</b>\n├ 🧾 Bukti bayar order: <b>${k.pay}</b>\n├ 🏦 Withdraw menunggu: <b>${k.wd}</b>\n├ ⚠️ Dispute aktif: <b>${k.dis}</b>\n└ 🗂 Pengajuan kategori: <b>${k.cat}</b>\n\n`
      + `📈 <b>Platform</b>\n├ 👥 Pengguna: <b>${k.users}</b>\n├ 🏪 Toko: <b>${k.stores}</b>\n└ 🛒 Pesanan 24 jam: <b>${k.ordersToday}</b>\n\n`
      + `🕒 ${when(new Date().toISOString())} WIB`;
    return { text, markup: menuInline(site, k), photo: (await signedImage(admin, ADMIN_BANNER_PATH)) ?? undefined };
  }
  if (action === "help") {
    return {
      text: `❓ <b>Bantuan Marketku Center</b>\n\nBot ini mengirim notifikasi otomatis saat ada:\n• Deposit / top up credits baru\n• Bukti bayar order (QRIS/e-wallet)\n• Penarikan saldo seller\n• Dispute pesanan\n• Pengajuan kategori baru\n• Toko baru dibuka\n\nPerintah: ${ADMIN_COMMANDS.map((c) => `/${c.command}`).join(" ")}\n\nPersetujuan tetap dilakukan di Admin Console agar bukti bisa dicek dengan teliti.`,
      markup: back(site),
    };
  }
  const list = async (): Promise<string[]> => {
    switch (action) {
      case "deposit": {
        const { data } = await admin.from("deposit_requests").select("amount, method_label, purpose, created_at").eq("status", "pending").order("created_at").limit(8);
        return (data ?? []).map((r) => `• <b>${rp(Number(r.amount))}</b> · ${esc(r.method_label ?? "-")} · ${r.purpose === "credits" ? "Credits" : "Saldo"}\n   🕒 ${when(r.created_at)}`);
      }
      case "bayar": {
        const { data } = await admin.from("order_payments").select("amount, method_label, created_at").eq("status", "pending").order("created_at").limit(8);
        return (data ?? []).map((r) => `• <b>${rp(Number(r.amount))}</b> · ${esc(r.method_label)}\n   🕒 ${when(r.created_at)}`);
      }
      case "withdraw": {
        const { data } = await admin.from("withdrawal_requests").select("amount, net, bank_provider, same_day, created_at").eq("status", "pending").order("created_at").limit(8);
        return (data ?? []).map((r) => `• <b>${rp(Number(r.net))}</b> (dari ${rp(Number(r.amount))}) · ${esc(r.bank_provider)}${r.same_day ? " · Same day" : ""}\n   🕒 ${when(r.created_at)}`);
      }
      case "dispute": {
        const { data } = await admin.from("order_disputes").select("code, status, created_at").in("status", ["terbuka", "ditinjau"]).order("created_at").limit(8);
        return (data ?? []).map((r) => `• <b>${esc(r.code)}</b> · ${r.status === "ditinjau" ? "Ditinjau admin" : "Terbuka"}\n   🕒 ${when(r.created_at)}`);
      }
      case "kategori": {
        const { data } = await admin.from("category_requests").select("name, created_at").eq("status", "pending").order("created_at").limit(8);
        return (data ?? []).map((r) => `• <b>${esc(r.name)}</b>\n   🕒 ${when(r.created_at)}`);
      }
      case "toko": {
        const { data } = await admin.from("seller_stores").select("store_name, is_open, created_at").order("created_at", { ascending: false }).limit(8);
        return (data ?? []).map((r) => `• <b>${esc(r.store_name)}</b> · ${r.is_open ? "🟢 Buka" : "🔴 Tutup"}\n   🕒 ${when(r.created_at)}`);
      }
    }
  };
  const titles: Record<string, string> = {
    deposit: "💰 <b>Deposit Menunggu</b>", bayar: "🧾 <b>Bukti Bayar Order</b>", withdraw: "🏦 <b>Withdraw Menunggu</b>",
    dispute: "⚠️ <b>Dispute Aktif</b>", kategori: "🗂 <b>Pengajuan Kategori</b>", toko: "🏪 <b>Toko Terbaru</b>",
  };
  const rows = await list();
  const text = `${titles[action]}\n\n${rows.length ? rows.join("\n\n") : "✅ Tidak ada yang menunggu. Semua beres!"}`;
  return { text, markup: back(site, action) };
}

async function reply(token: string, chatId: number, s: { text: string; markup: unknown; photo?: string | undefined }, editId?: number) {
  if (editId) {
    // Photo messages can't become text; replace the message instead.
    await tg(token, "deleteMessage", { chat_id: chatId, message_id: editId });
  }
  if (s.photo && s.text.length <= 1024) {
    const r = await tg(token, "sendPhoto", { chat_id: chatId, photo: s.photo, caption: s.text, parse_mode: "HTML", reply_markup: s.markup });
    if (r.ok) return;
  }
  await tg(token, "sendMessage", { chat_id: chatId, text: s.text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: s.markup });
}

export async function handleAdminUpdate(admin: Admin, bot: AdminBotRow, update: Update, site: string) {
  const from = update.message?.from ?? update.callback_query?.from;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (!from || !chatId) return;
  if (update.message && update.message.chat.type !== "private") return;

  const text = update.message?.text?.trim() ?? "";
  const startParam = /^\/start(?:@\w+)?\s+(\S+)/.exec(text)?.[1];
  const linkCode = startParam ? parseAdminLink(startParam) : null;

  if (linkCode) {
    const { data: link } = await admin.from("admin_bot_links").select("*").eq("code", linkCode).maybeSingle();
    await admin.from("admin_bot_links").delete().eq("code", linkCode);
    const valid = link && new Date(link.expires_at).getTime() > Date.now();
    const { data: isAdm } = valid ? await admin.from("user_roles").select("role").eq("user_id", link.user_id).eq("role", "admin").maybeSingle() : { data: null };
    if (!valid || !isAdm) {
      await tg(bot.token, "sendMessage", { chat_id: chatId, text: "⛔ Link tidak valid atau sudah kedaluwarsa. Buat link baru dari Admin Console → Bot." });
      return;
    }
    const name = [from.first_name, from.username ? `@${from.username}` : null].filter(Boolean).join(" ").slice(0, 80);
    await admin.from("admin_bot_admins").upsert({ tg_user_id: from.id, user_id: link.user_id, tg_name: name, linked_at: new Date().toISOString() });
    await setAdminMenuButton(bot.token, chatId, true);
    await tg(bot.token, "sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `✅ <b>Telegram terhubung sebagai admin Marketku</b>\n\nMulai sekarang notifikasi deposit, withdraw, bukti bayar, dispute, kategori dan toko baru dikirim ke sini.`,
      reply_markup: { keyboard: ADMIN_KEYBOARD, resize_keyboard: true, is_persistent: true },
    });
    await reply(bot.token, chatId, await section(admin, "home", site));
    return;
  }

  const { data: me } = await admin.from("admin_bot_admins").select("user_id").eq("tg_user_id", from.id).maybeSingle();
  const { data: stillAdmin } = me ? await admin.from("user_roles").select("role").eq("user_id", me.user_id).eq("role", "admin").maybeSingle() : { data: null };
  if (!stillAdmin) {
    if (me) await setAdminMenuButton(bot.token, chatId, false);
    if (update.callback_query) await tg(bot.token, "answerCallbackQuery", { callback_query_id: update.callback_query.id, text: "Khusus admin", show_alert: true });
    else await tg(bot.token, "sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: "🛡 <b>Marketku Center</b>\n\nBot ini khusus admin Marketku. Hubungkan akun lewat Admin Console → tab Bot → <b>Hubungkan Telegram saya</b>.",
      reply_markup: { inline_keyboard: [[{ text: "🌐 Buka Marketku", url: site }]] },
    });
    return;
  }

  if (update.callback_query) {
    const cq = update.callback_query;
    await tg(bot.token, "answerCallbackQuery", { callback_query_id: cq.id });
    const action = (cq.data ?? "").replace(/^a:/, "") as AdminMenuAction;
    const valid: AdminMenuAction[] = ["home", "deposit", "bayar", "withdraw", "dispute", "kategori", "toko", "help"];
    if (!valid.includes(action)) return;
    await reply(bot.token, chatId, await section(admin, action, site), cq.message?.message_id);
    return;
  }

  const action = adminActionFromText(text);
  if (text.startsWith("/start")) {
    await tg(bot.token, "sendMessage", { chat_id: chatId, text: "👋 Selamat datang kembali, admin!", reply_markup: { keyboard: ADMIN_KEYBOARD, resize_keyboard: true, is_persistent: true } });
  }
  await reply(bot.token, chatId, await section(admin, action ?? "home", site));
}

/** Sends queued admin notifications (filled by database triggers) to every linked admin. */
export async function drainAdminNotifications(admin: Admin, site: string, limit = 25) {
  const { data: bot } = await admin.from("admin_bot").select("*").eq("id", 1).maybeSingle();
  if (!bot?.is_active) return { sent: 0 };
  const { data: rows } = await admin.from("admin_tg_notifications").select("*").is("sent_at", null).lt("attempts", 5).order("created_at").limit(limit);
  if (!rows?.length) return { sent: 0 };
  const { data: admins } = await admin.from("admin_bot_admins").select("tg_user_id");
  let sent = 0;
  for (const r of rows) {
    const kind = r.kind as AdminNotifyKind;
    const text = adminNotifyText(kind, r.amount == null ? null : Number(r.amount), r.label);
    const markup = { inline_keyboard: [[{ text: "🖥 Proses di Admin Console", url: panel(site, ADMIN_TAB[kind]) }], [{ text: "📊 Ringkasan", callback_data: "a:home" }]] };
    let ok = false; let err = "";
    for (const a of admins ?? []) {
      const res = await tg(bot.token, "sendMessage", { chat_id: a.tg_user_id, text, parse_mode: "HTML", reply_markup: markup });
      if (res.ok) ok = true; else err = (res.description ?? "gagal").slice(0, 200);
    }
    await admin.from("admin_tg_notifications").update(
      ok || !admins?.length ? { sent_at: new Date().toISOString(), attempts: r.attempts + 1 } : { attempts: r.attempts + 1, error: err },
    ).eq("id", r.id);
    if (ok) sent++;
  }
  return { sent };
}

/** Telegram Mini App sign-in for Admin Console: initData signed by the admin bot, linked Telegram account, admin role re-checked. */
export async function adminMiniAppSession(admin: Admin, initData: string, meta: { ip: string; ua: string }) {
  const { data: bot } = await admin.from("admin_bot").select("token, is_active").eq("id", 1).maybeSingle();
  if (!bot?.is_active) throw new Error("Mini App admin sedang tidak aktif");
  const user = await verifyInitData(initData, bot.token);
  if (!user) throw new Error(ADMIN_MINI_DENIED);
  const { data: link } = await admin.from("admin_bot_admins").select("user_id").eq("tg_user_id", user.id).maybeSingle();
  const { data: role } = link ? await admin.from("user_roles").select("role").eq("user_id", link.user_id).eq("role", "admin").maybeSingle() : { data: null };
  if (!canOpenAdminMiniApp(link?.user_id, !!role)) throw new Error(ADMIN_MINI_DENIED);
  const { sessionFor } = await import("@/lib/auth-bot.server");
  const s = await sessionFor(admin, link!.user_id);
  const { describeUA } = await import("@/lib/auth-bot");
  const { device, browser } = describeUA(meta.ua);
  await tg(bot.token, "sendMessage", {
    chat_id: user.id, parse_mode: "HTML",
    text: `🔐 <b>Login Admin Console</b>\n\n📱 Lewat: Telegram Mini App\n💻 ${esc(device)} · ${esc(browser)}\n🌐 IP: ${esc(meta.ip || "-")}\n🕒 ${when(new Date().toISOString())} WIB\n\nBukan kamu? Putuskan Telegram ini di Admin Console → Bot.`,
  });
  return { token_hash: s.token_hash };
}
