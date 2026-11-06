import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { pageBase, siteBase, tg } from "@/lib/telegram-bot.server";
import { AUTH_CODE_MINUTES, AUTH_MAX_ATTEMPTS, AUTH_RESEND_SECONDS, describeUA, loginCodeText, loginOkText, normalizeTgUsername, verifyInitData } from "@/lib/auth-bot";

type Admin = SupabaseClient<Database>;
export type AuthBotRow = Database["public"]["Tables"]["auth_bot"]["Row"];
type TgUser = { id: number; first_name?: string; username?: string; is_bot?: boolean };
type Update = { update_id: number; message?: { chat: { id: number; type: string }; from?: TgUser; text?: string } };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const randomCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 900000));

export async function registerAuthWebhook(bot: Pick<AuthBotRow, "token" | "webhook_secret">) {
  const site = pageBase();
  const r = await tg<boolean>(bot.token, "setWebhook", {
    url: `${siteBase()}/api/public/telegram/auth`, secret_token: bot.webhook_secret, allowed_updates: ["message"], drop_pending_updates: true,
  });
  if (r.ok) {
    await tg(bot.token, "setMyCommands", { commands: [{ command: "start", description: "Aktifkan kode login Seller Center" }] });
    await tg(bot.token, "setMyDescription", { description: "Auth Marketku.id — bot resmi untuk kode login Seller Center Marketku dan pemberitahuan setiap kali akunmu login. Tekan Start, lalu masuk di Seller Center pakai username Telegram kamu." });
    await tg(bot.token, "setMyShortDescription", { short_description: "Kode login & keamanan akun Seller Center Marketku" });
    await tg(bot.token, "setChatMenuButton", { menu_button: { type: "web_app", text: "Seller Center", web_app: { url: `${site}/seller` } } });
  }
  return r;
}

export async function getAuthBot(admin: Admin) {
  const { data } = await admin.from("auth_bot").select("*").eq("id", 1).maybeSingle();
  return data;
}

/** Seller account for a Telegram user: Seller Center bot link first, else the store's Telegram username. */
export async function ownerForTg(admin: Admin, tgUserId: number, username: string | null) {
  const { data: hub } = await admin.from("seller_hub_links").select("owner_id").eq("tg_user_id", tgUserId).maybeSingle();
  if (hub) return hub.owner_id;
  const u = username ? normalizeTgUsername(username) : null;
  if (!u) return null;
  const { data: stores } = await admin.from("seller_stores").select("owner_id, telegram_username").ilike("telegram_username", `%${u.replace(/_/g, "\\_")}`).limit(10);
  const hit = (stores ?? []).find((s) => normalizeTgUsername(s.telegram_username ?? "") === u);
  return hit?.owner_id ?? null;
}

export async function handleAuthUpdate(admin: Admin, bot: AuthBotRow, update: Update, _site: string) {
  const site = pageBase();
  const m = update.message;
  if (!m?.from || m.chat.type !== "private" || m.from.is_bot) return;
  const from = m.from;
  await admin.from("auth_bot_chats").upsert({ tg_user_id: from.id, tg_username: from.username?.toLowerCase() ?? null, first_name: from.first_name?.slice(0, 60) ?? null, started_at: new Date().toISOString() });
  const name = esc(from.first_name ?? "Seller");
  if (!from.username) {
    await tg(bot.token, "sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", text: `🤖 <b>Auth Marketku.id</b>\n\nHalo ${name}! Akun Telegram kamu belum punya <b>username</b>.\nAtur dulu di Telegram → Pengaturan → Username, lalu tekan /start lagi.` });
    return;
  }
  const owner = await ownerForTg(admin, from.id, from.username);
  await tg(bot.token, "sendMessage", {
    chat_id: m.chat.id, parse_mode: "HTML", disable_web_page_preview: true,
    text: `🤖 <b>Auth Marketku.id</b>\n\nHalo ${name}! Bot ini khusus mengirim <b>kode login Seller Center</b> dan pemberitahuan setiap kali akunmu login.\n\n👤 Username: <b>@${esc(from.username)}</b>\n${owner ? "✅ Terhubung ke toko Marketku." : "⚠️ Belum terhubung ke toko. Isi username Telegram ini di Seller Center → Pengaturan → Profil Toko, atau hubungkan bot Marketku Seller Center."}\n\nBuka Seller Center → <b>Telegram</b>, masukkan username di atas, lalu tekan <b>Kirim Kode Login</b>.`,
    reply_markup: { inline_keyboard: [[{ text: "🖥 Buka Seller Center", url: `${site}/seller` }]] },
  });
}

export async function requestLoginCode(admin: Admin, rawUsername: string, _site: string) {
  const site = pageBase();
  const bot = await getAuthBot(admin);
  if (!bot?.is_active) throw new Error("Login Telegram sedang tidak tersedia");
  const u = normalizeTgUsername(rawUsername);
  if (!u) throw new Error("Username Telegram tidak valid");
  const { data: chat } = await admin.from("auth_bot_chats").select("tg_user_id, tg_username").eq("tg_username", u).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!chat) throw new Error(`Wajib /start dulu di @${bot.username}`);
  const owner = await ownerForTg(admin, chat.tg_user_id, chat.tg_username);
  if (!owner) throw new Error("Username Telegram ini belum terhubung ke toko Marketku");
  const { data: last } = await admin.from("auth_login_codes").select("created_at").eq("tg_user_id", chat.tg_user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const wait = last ? AUTH_RESEND_SECONDS - Math.floor((Date.now() - new Date(last.created_at).getTime()) / 1000) : 0;
  if (wait > 0) throw new Error(`Tunggu ${wait} detik sebelum minta kode lagi`);
  const code = randomCode();
  const magic = randomHex(32);
  await admin.from("auth_login_codes").update({ used_at: new Date().toISOString() }).eq("tg_user_id", chat.tg_user_id).is("used_at", null);
  const { error } = await admin.from("auth_login_codes").insert({
    user_id: owner, tg_user_id: chat.tg_user_id, code_hash: await sha(code), magic_hash: await sha(magic),
    expires_at: new Date(Date.now() + AUTH_CODE_MINUTES * 60_000).toISOString(),
  });
  if (error) { console.error("auth code insert", error); throw new Error("Gagal membuat kode login"); }
  const r = await tg(bot.token, "sendMessage", {
    chat_id: chat.tg_user_id, parse_mode: "HTML", text: loginCodeText(code),
    reply_markup: { inline_keyboard: [[{ text: "🔗 Login Otomatis", url: `${site}/seller?magic=${magic}` }]] },
  });
  if (!r.ok) throw new Error(`Bot tidak bisa mengirim pesan. Tekan /start lagi di @${bot.username}`);
  return { bot: bot.username };
}

export async function sessionFor(admin: Admin, userId: string) {
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) throw new Error("Akun tidak ditemukan");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) { console.error("generateLink", error); throw new Error("Gagal membuat sesi login"); }
  return { email, token_hash: data.properties.hashed_token };
}

async function notifyLogin(admin: Admin, tgUserId: number, account: string, meta: { ip: string; ua: string }, via: string) {
  const bot = await getAuthBot(admin);
  if (!bot?.is_active) return;
  const { device, browser } = describeUA(meta.ua);
  await tg(bot.token, "sendMessage", { chat_id: tgUserId, parse_mode: "HTML", text: loginOkText({ account, ip: meta.ip || "-", device, browser, at: new Date(), via }) });
}

async function accountLabel(admin: Admin, userId: string) {
  const { data } = await admin.from("profiles").select("username").eq("id", userId).maybeSingle();
  return (data as { username?: string } | null)?.username ?? "Seller Marketku";
}

export async function verifyLoginCode(admin: Admin, input: { username?: string; code?: string; magic?: string }, meta: { ip: string; ua: string }) {
  const now = new Date().toISOString();
  let row: Database["public"]["Tables"]["auth_login_codes"]["Row"] | null = null;
  if (input.magic) {
    const { data } = await admin.from("auth_login_codes").select("*").eq("magic_hash", await sha(input.magic)).maybeSingle();
    row = data;
  } else {
    const u = normalizeTgUsername(input.username ?? "");
    if (!u) throw new Error("Username Telegram tidak valid");
    const { data: chat } = await admin.from("auth_bot_chats").select("tg_user_id").eq("tg_username", u).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (chat) {
      const { data } = await admin.from("auth_login_codes").select("*").eq("tg_user_id", chat.tg_user_id).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      row = data;
    }
    if (row && row.code_hash !== (await sha(String(input.code ?? "")))) {
      const attempts = row.attempts + 1;
      await admin.from("auth_login_codes").update({ attempts, used_at: attempts >= AUTH_MAX_ATTEMPTS ? now : null }).eq("id", row.id);
      throw new Error(attempts >= AUTH_MAX_ATTEMPTS ? "Terlalu banyak percobaan. Minta kode baru" : `Kode salah. Sisa ${AUTH_MAX_ATTEMPTS - attempts} percobaan`);
    }
  }
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) throw new Error("Kode/link login sudah kedaluwarsa. Minta kode baru");
  const { data: claimed } = await admin.from("auth_login_codes").update({ used_at: now }).eq("id", row.id).is("used_at", null).select("id").maybeSingle();
  if (!claimed) throw new Error("Kode/link login sudah dipakai");
  const s = await sessionFor(admin, row.user_id);
  await notifyLogin(admin, row.tg_user_id, await accountLabel(admin, row.user_id), meta, input.magic ? "Link Login Otomatis" : "Kode Telegram");
  return { token_hash: s.token_hash };
}

/** Telegram Mini App sign-in: initData signed by the Seller Center or Auth bot proves the Telegram account. */
export async function miniAppSession(admin: Admin, initData: string, meta: { ip: string; ua: string }) {
  const [{ data: hub }, auth] = await Promise.all([admin.from("seller_hub_bot").select("token, is_active").eq("id", 1).maybeSingle(), getAuthBot(admin)]);
  let user: Awaited<ReturnType<typeof verifyInitData>> = null;
  for (const t of [hub?.is_active ? hub.token : null, auth?.is_active ? auth.token : null]) {
    if (!t || user) continue;
    user = await verifyInitData(initData, t);
  }
  if (!user) throw new Error("Data Mini App tidak valid");
  const owner = await ownerForTg(admin, user.id, user.username);
  if (!owner) throw new Error("Telegram ini belum terhubung ke toko Marketku");
  const s = await sessionFor(admin, owner);
  const { data: started } = await admin.from("auth_bot_chats").select("tg_user_id").eq("tg_user_id", user.id).maybeSingle();
  if (started) await notifyLogin(admin, user.id, await accountLabel(admin, owner), meta, "Telegram Mini App");
  return { token_hash: s.token_hash };
}
