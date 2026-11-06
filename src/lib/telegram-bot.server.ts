import { getRequestHeader, getRequestHost } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  BOT_ACTIONS, DEFAULT_GATE, actionFromText, fillGate, keyboardOrDefault, parseReferral, referralCode,
  type BotAction, type ForceJoin,
} from "@/lib/telegram";

type Admin = SupabaseClient<Database>;
export type BotRow = Database["public"]["Tables"]["telegram_bots"]["Row"];

const FALLBACK_SITE = "https://project--a13f80fc-ebe9-469a-a500-99e31971129d-dev.lovable.app";

/** Public base URL Telegram can reach (the auth-walled preview host is mapped to the stable dev host). */
export function siteBase() {
  const raw = getRequestHeader("x-forwarded-host") ?? getRequestHost() ?? "";
  const host = raw.split(",")[0]!.trim();
  const m = /^id-preview--([0-9a-f-]+)\.(.+)$/.exec(host);
  if (m) return `https://project--${m[1]}-dev.${m[2]}`;
  if (!host || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host)) return FALLBACK_SITE;
  return `https://${host}`;
}

export type TgResult<T> = { ok: boolean; result?: T; description?: string };
export async function tg<T = unknown>(token: string, method: string, body: Record<string, unknown> = {}): Promise<TgResult<T>> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    return (await r.json()) as TgResult<T>;
  } catch (e) {
    console.error(`Telegram ${method} failed`, e);
    return { ok: false, description: "Tidak bisa menghubungi Telegram" };
  }
}

export const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function registerWebhook(bot: Pick<BotRow, "id" | "token" | "webhook_secret">) {
  return tg<boolean>(bot.token, "setWebhook", {
    url: `${siteBase()}/api/public/telegram/${bot.id}`,
    secret_token: bot.webhook_secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

/* ---------------- webhook update handling ---------------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rp = (n: number) => `Rp ${Number(n).toLocaleString("id-ID")}`;

type TgUser = { id: number; first_name?: string; username?: string };
type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: TgUser; text?: string };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number } } };
};

type Product = {
  id: string; name: string; category_id: string | null; product_type: string;
  product_categories: { name: string } | null;
  product_variants: { id: string; name: string; price: number; sort: number; is_active?: boolean }[];
};

export async function handleUpdate(admin: Admin, bot: BotRow, update: Update, site: string) {
  const T = (method: string, body: Record<string, unknown>) => tg(bot.token, method, body);
  const cq = update.callback_query;
  const msg = update.message;
  const from = cq?.from ?? msg?.from;
  const chatId = cq?.message?.chat.id ?? msg?.chat.id;
  if (!from || chatId == null) return;
  if (msg && msg.chat.type !== "private") return;
  if (cq) await T("answerCallbackQuery", { callback_query_id: cq.id });

  const send = (text: string, markup?: unknown) =>
    T("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
  const replyKb = () => ({
    keyboard: keyboardOrDefault(bot.keyboard).map((row) => row.map((a) => ({ text: BOT_ACTIONS[a] }))),
    resize_keyboard: true, is_persistent: true,
  });

  // Remember the buyer (and who referred them on first /start).
  const text = msg?.text?.trim() ?? "";
  const startParam = text.startsWith("/start") ? text.slice(6).trim() : "";
  const ref = startParam ? parseReferral(startParam) : null;
  const { data: known } = await admin.from("telegram_bot_users").select("tg_user_id").eq("bot_id", bot.id).eq("tg_user_id", from.id).maybeSingle();
  if (!known) {
    await admin.from("telegram_bot_users").insert({
      bot_id: bot.id, tg_user_id: from.id, first_name: from.first_name?.slice(0, 64) ?? null, username: from.username?.slice(0, 64) ?? null,
      referred_by: ref && ref !== from.id ? ref : null,
    });
  }

  // Force-subscribe gate.
  const fj = (bot.force_join ?? {}) as ForceJoin;
  if (fj.enabled && fj.chat) {
    const m = await tg<{ status: string }>(bot.token, "getChatMember", { chat_id: fj.chat, user_id: from.id });
    const joined = !m.ok || ["creator", "administrator", "member", "restricted"].includes(m.result?.status ?? "");
    if (!joined) {
      const link = fj.invite || (fj.chat.startsWith("@") ? `https://t.me/${fj.chat.slice(1)}` : "");
      const gate = fillGate(fj.message?.trim() || DEFAULT_GATE, {
        nama: esc(from.first_name ?? "Kak"), username: from.username ? `@${esc(from.username)}` : "-", channel: esc(fj.title || fj.chat), bot: `@${esc(bot.username)}`,
      });
      await send(gate, { inline_keyboard: [...(link ? [[{ text: `📢 Join ${fj.title || "Channel"}`, url: link }]] : []), [{ text: "✅ Saya sudah join", callback_data: "joined" }]] });
      return;
    }
  }

  const [{ data: store }, { data: prodRows }] = await Promise.all([
    admin.from("seller_stores").select("store_name, slug, is_open").eq("owner_id", bot.owner_id).maybeSingle(),
    admin.from("products").select("id, name, category_id, product_type, product_categories(name), product_variants(id, name, price, sort)")
      .eq("owner_id", bot.owner_id).eq("status", "active").order("created_at", { ascending: false }).limit(60),
  ]);
  const products = (prodRows ?? []) as unknown as Product[];
  const storeName = store?.store_name ?? bot.name;
  const minPrice = (p: Product) => (p.product_variants.length ? Math.min(...p.product_variants.map((v) => Number(v.price))) : 0);
  const pairs = <X,>(xs: X[], n = 2) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

  const catalog = async () => {
    if (!products.length) { await send("📦 Toko ini belum punya produk aktif. Coba lagi nanti ya."); return; }
    if (bot.buyer_mode === 2) {
      await send("🛍 <b>Pilih produk:</b>", { inline_keyboard: pairs(products.slice(0, 40).map((p) => ({ text: p.name.slice(0, 40), callback_data: `p:${p.id}` }))) });
      return;
    }
    if (bot.buyer_mode === 3) {
      const list = products.slice(0, 30);
      const lines = list.map((p, i) => `${i + 1}. ${esc(p.name)} — mulai ${rp(minPrice(p))}`).join("\n");
      await send(`🛍 <b>Daftar Produk</b>\n\n${lines}\n\nPilih nomor produk:`, { inline_keyboard: pairs(list.map((p, i) => ({ text: String(i + 1), callback_data: `p:${p.id}` })), 5) });
      return;
    }
    const cats = new Map<string, string>();
    for (const p of products) cats.set(p.category_id ?? "none", p.product_categories?.name ?? "Lainnya");
    await send(`🏪 <b>${esc(storeName)}</b>\n\n🛍 Pilih kategori produk:`, { inline_keyboard: pairs([...cats].map(([id, name]) => ({ text: name, callback_data: `c:${id}` }))) });
  };

  const welcome = async () => {
    const { count: refs } = await admin.from("telegram_bot_users").select("tg_user_id", { count: "exact", head: true }).eq("bot_id", bot.id).eq("referred_by", from.id);
    const cats = new Map<string, string>();
    for (const p of products) cats.set(p.category_id ?? "none", p.product_categories?.name ?? "Lainnya");
    const inline = products.length
      ? pairs([...cats].map(([id, name]) => ({ text: `📦 ${name}`, callback_data: `c:${id}` })))
      : [[{ text: "📦 Belum ada produk", callback_data: "noop" }]];
    await send(
      `🏪 <b>Selamat datang di ${esc(storeName)}</b>${store && !store.is_open ? "\n⛔ <i>Toko sedang tutup</i>" : ""}\n━━━━━━━━━━━━━━━\n┌─ 👋 Halo, <b>${esc(from.first_name ?? "Kak")}</b>\n├─ 📦 ${products.length} produk aktif\n├─ 👥 ${refs ?? 0} referral\n└──────────────\n\n🛍 Pilih kategori produk di bawah:`,
      { inline_keyboard: inline },
    );
    await send("📱 <i>Gunakan menu bantuan jika ada kendala.</i>", replyKb());
  };

  const showProduct = async (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) { await send("Produk tidak ditemukan atau sudah tidak aktif."); return; }
    const { data: stock } = await admin.rpc("variant_stock", { p_product_ids: [p.id] });
    const st = new Map((stock ?? []).map((s) => [s.variant_id, s.available]));
    const vs = [...p.product_variants].sort((a, b) => a.sort - b.sort);
    const lines = vs.map((v, i) => `${i + 1}. ${esc(v.name)} - ${rp(Number(v.price))}${p.product_type === "preorder" ? "" : ` (stok ${st.get(v.id) ?? 0})`}`).join("\n");
    await send(`📦 <b>${esc(p.name)}</b>\n\nPilih varian yang diinginkan sebelum checkout:\n\n${lines || "Belum ada varian."}`, {
      inline_keyboard: [[{ text: "🛒 Beli di Marketku", url: `${site}/produk/${p.id}` }], [{ text: "← Kembali", callback_data: "home" }]],
    });
  };

  const runAction = async (a: BotAction) => {
    switch (a) {
      case "start": return welcome();
      case "kategori": return catalog();
      case "renew":
        await send("🔄 Untuk perpanjang akun, beli lagi varian yang sama dari daftar produk.");
        return catalog();
      case "kurir": return send("✅ Bot terhubung dan berjalan normal.");
      case "pesanan":
        return send("📋 Riwayat pesanan tersimpan di akun Marketku kamu.", { inline_keyboard: [[{ text: "📋 Buka Riwayat Pesanan", url: `${site}/riwayat` }]] });
      case "topup":
        return send("💰 <b>TOP UP SALDO</b>\n\nTop up Saldo Marketku lewat QRIS atau e-wallet di web Marketku. Saldo bisa langsung dipakai checkout.", {
          inline_keyboard: [[{ text: "💰 Top Up di Marketku", url: `${site}/topup` }], [{ text: "← Kembali", callback_data: "menu" }]],
        });
      case "tarik":
        return send("💸 <b>Tarik Saldo</b>\n\nPenarikan saldo hanya untuk seller dan diajukan dari Seller Center di web Marketku.", {
          inline_keyboard: [[{ text: "← Kembali", callback_data: "menu" }]],
        });
      case "garansi":
        return send("🛡 <b>GARANSI</b>\n\nKlaim garansi dari halaman pesanan di Marketku. Siapkan nomor pesanan dan bukti kendala.", { inline_keyboard: [[{ text: "🛡 Ajukan Klaim", url: `${site}/riwayat` }], [{ text: "← Kembali", callback_data: "menu" }]] });
      case "promo": {
        const { data: vs } = await admin.from("seller_vouchers").select("code, name, ends_at").eq("owner_id", bot.owner_id).eq("is_active", true).limit(10);
        const live = (vs ?? []).filter((v) => !v.ends_at || new Date(v.ends_at) > new Date());
        const body = live.length ? live.map((v) => `🎫 <code>${esc(v.code)}</code> — ${esc(v.name)}`).join("\n") : "📭 <i>Belum ada promo aktif saat ini.</i>";
        return send(`🎫 <b>PROMO</b>\n━━━━━━━━━━━━\n\n${body}\n\n━━━━━━━━━━━━\n💡 <i>Pakai kode promo saat checkout di Marketku.</i>`, { inline_keyboard: [[{ text: "← Kembali", callback_data: "menu" }]] });
      }
      case "referral": {
        const { count } = await admin.from("telegram_bot_users").select("tg_user_id", { count: "exact", head: true }).eq("bot_id", bot.id).eq("referred_by", from.id);
        const code = referralCode(from.id);
        return send(`🎁 <b>Program Referral</b>\n\n📋 Kode Referral Anda: <code>${code}</code>\n\n🔗 Link Referral:\nhttps://t.me/${esc(bot.username)}?start=ref_${code}\n\n👥 Total Referral: ${count ?? 0} orang\n\n━━━━━━━━━━━━━━━━━━━\n🎁 Bagikan link di atas untuk mengajak teman belanja di toko ini.`, { inline_keyboard: [[{ text: "🏠 Menu Utama", callback_data: "menu" }]] });
      }
      case "bantuan": {
        const btns = [
          ...(bot.admin_username ? [[{ text: "💬 Chat Admin", url: `https://t.me/${bot.admin_username}` }]] : []),
          ...(bot.admin_wa ? [[{ text: "📞 WhatsApp Admin", url: `https://wa.me/${bot.admin_wa}` }]] : []),
          [{ text: "🏠 Menu Utama", callback_data: "menu" }],
        ];
        return send(
          "🙋 <b>BANTUAN</b>\n\n📌 <b>Cara Berbelanja:</b>\n1. Pilih kategori produk\n2. Pilih produk yang diinginkan\n3. Pilih varian\n4. Tekan Beli di Marketku lalu bayar via QRIS\n5. Produk dikirim otomatis di halaman pesanan\n\n📌 <b>Masalah & Bantuan:</b>\nHubungi admin untuk bantuan lebih lanjut.",
          { inline_keyboard: btns },
        );
      }
    }
  };

  if (cq?.data) {
    const d = cq.data;
    if (d === "noop") return;
    if (d === "home" || d === "joined" || d === "menu") return d === "home" ? catalog() : welcome();
    if (d.startsWith("p:")) return showProduct(d.slice(2));
    if (d.startsWith("c:")) {
      const id = d.slice(2);
      const list = products.filter((p) => (p.category_id ?? "none") === id);
      if (!list.length) return send("Belum ada produk di kategori ini.");
      return send(`🛍 <b>${esc(list[0]!.product_categories?.name ?? "Produk")}</b>\n\nPilih produk:`, {
        inline_keyboard: [...pairs(list.map((p) => ({ text: p.name.slice(0, 40), callback_data: `p:${p.id}` }))), [{ text: "← Kembali", callback_data: "home" }]],
      });
    }
    return;
  }
  if (text.startsWith("/start")) return welcome();
  const a = actionFromText(text);
  if (a) return runAction(a);
  return send("Ketik /start untuk membuka menu toko.", replyKb());
}
