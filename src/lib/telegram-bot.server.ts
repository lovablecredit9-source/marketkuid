import { getRequestHeader, getRequestHost } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  BOT_ACTIONS, DEFAULT_GATE, SELLER_ACTIONS, SELLER_KEYBOARD, actionFromText, clampQty, fillGate, keyboardOrDefault,
  parseOwnerLink, parseReferral, referralCode, sellerActionFromText, sellerNet,
  type BotAction, type ForceJoin, type SellerAction,
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

const PUBLISHED_SITE = "https://marketkuid.lovable.app";
/** Pages people open from Telegram (Mini App, login links): the dev host only serves webhooks, its pages are private. */
export function pageBase() {
  const site = siteBase();
  return /^https:\/\/project--[0-9a-f-]+-dev\./.test(site) ? PUBLISHED_SITE : site;
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
  }).then(async (r) => {
    if (r.ok) {
      await tg(bot.token, "setMyCommands", {
        commands: [
          { command: "start", description: "Menu utama toko" },
          { command: "produk", description: "Lihat kategori & produk" },
          { command: "pesanan", description: "Riwayat pesanan saya" },
          { command: "bantuan", description: "Bantuan & kontak admin" },
        ],
      });
    }
    return r;
  });
}

/** Removes the optional `style` colour field from keyboards (fallback for older Telegram API behaviour). */
function stripStyle(markup: unknown): unknown {
  if (Array.isArray(markup)) return markup.map(stripStyle);
  if (markup && typeof markup === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(markup)) if (k !== "style") o[k] = stripStyle(v);
    return o;
  }
  return markup;
}

/** Short-lived signed URL for an image in the private product-images bucket (Telegram downloads it once). */
export async function signedImage(admin: Admin, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await admin.storage.from("product-images").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/* ---------------- webhook update handling ---------------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rp = (n: number) => `Rp ${Number(n).toLocaleString("id-ID")}`;

type TgUser = { id: number; first_name?: string; username?: string };
type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: TgUser; text?: string };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number } } };
};

type Product = {
  id: string; name: string; images: string[] | null; category_id: string | null; product_type: string;
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

  const send = async (text: string, markup?: unknown) => {
    const body = { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
    const r = await T("sendMessage", { ...body, ...(markup ? { reply_markup: markup } : {}) });
    if (!r.ok && markup) return T("sendMessage", { ...body, reply_markup: stripStyle(markup) });
    return r;
  };
  /** Photo card (store banner / product image) with caption + buttons; falls back to text. */
  const sendPhoto = async (path: string | null | undefined, caption: string, markup?: unknown) => {
    const photo = await signedImage(admin, path);
    if (photo && caption.length <= 1024) {
      const body = { chat_id: chatId, photo, caption, parse_mode: "HTML" };
      let r = await T("sendPhoto", { ...body, ...(markup ? { reply_markup: markup } : {}) });
      if (!r.ok && markup) r = await T("sendPhoto", { ...body, reply_markup: stripStyle(markup) });
      if (r.ok) return r;
    }
    return send(caption, markup);
  };
  const edit = async (text: string, markup: unknown) => {
    const mid = cq?.message?.message_id;
    if (!mid) return send(text, markup);
    const r = await T("editMessageText", { chat_id: chatId, message_id: mid, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
    if (r.ok || /not modified/i.test(r.description ?? "")) return r;
    // The card is a photo message: edit its caption instead.
    if (text.length <= 1024) {
      const c = await T("editMessageCaption", { chat_id: chatId, message_id: mid, caption: text, parse_mode: "HTML", reply_markup: markup });
      if (c.ok || /not modified/i.test(c.description ?? "")) return c;
    }
    return send(text, markup);
  };
  const isOwner = bot.owner_tg_id != null && Number(bot.owner_tg_id) === from.id;
  const sellerKb = () => ({
    keyboard: SELLER_KEYBOARD.map((row) => row.map((a) => ({ text: SELLER_ACTIONS[a].text, ...(SELLER_ACTIONS[a].style ? { style: SELLER_ACTIONS[a].style } : {}) }))),
    resize_keyboard: true, is_persistent: true,
  });
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

  // Seller links their own Telegram account from Seller Center: /start own_<code>.
  const ownCode = startParam ? parseOwnerLink(startParam) : null;
  if (ownCode) {
    const valid = bot.owner_link_code === ownCode && !!bot.owner_link_expires && new Date(bot.owner_link_expires) > new Date();
    if (!valid) { await send("⛔ Link sudah kedaluwarsa. Buat link baru dari Seller Center → Bot Telegram."); return; }
    await admin.from("telegram_bots").update({
      owner_tg_id: from.id, owner_tg_name: (from.username ? `@${from.username}` : from.first_name ?? "").slice(0, 64) || null,
      owner_linked_at: new Date().toISOString(), owner_link_code: null, owner_link_expires: null,
    }).eq("id", bot.id);
    await send("✅ <b>Telegram terhubung ke toko kamu!</b>\n\nMulai sekarang notifikasi pesanan baru, pembayaran, pesanan selesai, laporan masalah dan stok menipis dikirim otomatis ke chat ini.\n\nTekan 📊 Dashboard untuk melihat ringkasan toko.", sellerKb());
    return;
  }

  // Force-subscribe gate.
  const fj = (bot.force_join ?? {}) as ForceJoin;
  if (fj.enabled && fj.chat && !isOwner) {
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
    admin.from("seller_stores").select("store_name, slug, is_open, avatar_path, banner_path").eq("owner_id", bot.owner_id).maybeSingle(),
    admin.from("products").select("id, name, images, category_id, product_type, product_categories(name), product_variants(id, name, price, sort)")
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
    await sendPhoto(
      store?.banner_path ?? store?.avatar_path,
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
    const pre = p.product_type === "preorder";
    const lines = vs.map((v, i) => `${i + 1}. ${esc(v.name)} - ${rp(Number(v.price))}${pre ? "" : ` (stok ${st.get(v.id) ?? 0})`}`).join("\n");
    const buttons = vs.map((v) => {
      const out = !pre && (st.get(v.id) ?? 0) <= 0;
      return [{ text: `${out ? "🚫" : "🛒"} ${v.name.slice(0, 28)} · ${rp(Number(v.price))}${out ? " (habis)" : ""}`, callback_data: out ? "noop" : `v:${v.id}:1` }];
    });
    await sendPhoto(p.images?.[0], `📦 <b>${esc(p.name)}</b>\n\nPilih varian yang diinginkan sebelum checkout:\n\n${lines || "Belum ada varian."}`, {
      inline_keyboard: [...buttons, [{ text: "🌐 Lihat di Marketku", url: `${site}/produk/${p.id}` }], [{ text: "← Kembali", callback_data: "home" }]],
    });
  };

  /** Order card: quantity −/+ and a pay button that opens checkout with the chosen variant. */
  const orderCard = async (variantId: string, qtyIn: number) => {
    const p = products.find((x) => x.product_variants.some((v) => v.id === variantId));
    const v = p?.product_variants.find((x) => x.id === variantId);
    if (!p || !v) { await send("Varian tidak ditemukan atau sudah tidak aktif."); return; }
    if (store && !store.is_open) { await send("⛔ Toko sedang tutup. Coba lagi nanti ya."); return; }
    const pre = p.product_type === "preorder";
    let stock: number | null = null;
    if (!pre) {
      const { data } = await admin.rpc("variant_stock", { p_product_ids: [p.id] });
      stock = data?.find((s) => s.variant_id === v.id)?.available ?? 0;
      if (stock <= 0) { await edit(`🚫 <b>${esc(p.name)}</b>\n\nStok varian <b>${esc(v.name)}</b> sedang habis.`, { inline_keyboard: [[{ text: "← Kembali", callback_data: `p:${p.id}` }]] }); return; }
    }
    const qty = clampQty(qtyIn, stock);
    const total = qty * Number(v.price);
    await edit(
      `⚙️ <b>Mode Pesanan</b>\n━━━━━━━━━━━━━━━\n📦 <b>${esc(p.name)}</b>\n🏷 Varian: ${esc(v.name)}\n💵 Harga: ${rp(Number(v.price))}${stock != null ? `\n📊 Stok: ${stock}` : "\n⏳ Pre-order (diproses seller)"}\n🔢 Jumlah: <b>${qty}</b>\n━━━━━━━━━━━━━━━\n💰 Total: <b>${rp(total)}</b>\n\n💳 Bayar pakai Saldo Marketku, QRIS atau e-wallet. Catatan untuk seller bisa diisi di halaman checkout.`,
      {
        inline_keyboard: [
          [{ text: "➖", callback_data: `v:${v.id}:${qty - 1}` }, { text: String(qty), callback_data: "noop" }, { text: "➕", callback_data: `v:${v.id}:${qty + 1}` }],
          [{ text: `⚡ Bayar Sekarang - ${rp(total)}`, url: `${site}/checkout?items=${v.id}:${qty}`, style: "success" }],
          [{ text: "← Kembali", callback_data: `p:${p.id}` }],
        ],
      },
    );
  };

  /* ---------- seller (linked owner) menu ---------- */
  async function sellerDashboardFor() {
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 3600_000);
    const dayStart = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
    const weekStart = new Date(dayStart.getTime() - 6 * 86400_000);
    const monthStart = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000);
    const since = new Date(Math.min(weekStart.getTime(), monthStart.getTime())).toISOString();
    const [{ data: paid }, { data: wallet }, { data: credits }, { count: allProducts }, { data: credited }] = await Promise.all([
      admin.from("orders").select("id, subtotal, discount, paid_at, status").eq("seller_id", bot.owner_id).not("paid_at", "is", null).gte("paid_at", since).in("status", ["paid", "processing", "completed"]),
      admin.from("wallets").select("balance").eq("user_id", bot.owner_id).maybeSingle(),
      admin.from("seller_credits").select("balance").eq("owner_id", bot.owner_id).maybeSingle(),
      admin.from("products").select("id", { count: "exact", head: true }).eq("owner_id", bot.owner_id).neq("status", "deleted"),
      admin.from("wallet_ledger").select("ref_id").eq("user_id", bot.owner_id).eq("kind", "sale").gte("created_at", since),
    ]);
    const rows = paid ?? [];
    const sum = (from: Date) => {
      const xs = rows.filter((o) => new Date(o.paid_at!) >= from);
      return `${xs.length} pesanan · ${rp(xs.reduce((a, o) => a + Number(o.subtotal) - Number(o.discount), 0))}`;
    };
    const done = new Set((credited ?? []).map((x) => x.ref_id));
    const held = rows.filter((o) => !done.has(o.id)).reduce((a, o) => a + sellerNet(Number(o.subtotal) - Number(o.discount)), 0);
    const { data: stock } = products.length ? await admin.rpc("variant_stock", { p_product_ids: products.map((p) => p.id) }) : { data: [] };
    const totalStock = (stock ?? []).reduce((a, s) => a + Number(s.available), 0);
    await send(
      `🏪 <b>${esc(storeName)}</b>\n━━━━━━━━━━━━━━━\n📅 <b>Hari Ini</b>\n${sum(dayStart)}\n\n🗓 <b>7 Hari</b>\n${sum(weekStart)}\n\n📆 <b>Bulan Ini</b>\n${sum(monthStart)}\n━━━━━━━━━━━━━━━\n💰 ${rp(Number(wallet?.balance ?? 0))} tersedia\n🔒 ${rp(held)} tertahan\n🪙 ${rp(Number(credits?.balance ?? 0))} credits\n\n📦 ${products.length}/${allProducts ?? products.length} produk aktif · ${totalStock.toLocaleString("id-ID")} stok`,
      { inline_keyboard: [[{ text: "🧾 Pesanan Terbaru", callback_data: "s:order" }, { text: "📦 Produk", callback_data: "s:prod" }], [{ text: "🖥 Buka Seller Center", url: `${site}/seller` }]] },
    );
  }

  const sellerProducts = async (asEdit = false) => {
    const { data: all } = await admin.from("products").select("id, name, status").eq("owner_id", bot.owner_id).in("status", ["active", "draft"]).order("created_at", { ascending: false }).limit(20);
    const list = all ?? [];
    const { data: stock } = list.length ? await admin.rpc("variant_stock", { p_product_ids: list.map((p) => p.id) }) : { data: [] };
    const { data: vrows } = list.length ? await admin.from("product_variants").select("id, product_id, price").in("product_id", list.map((p) => p.id)) : { data: [] };
    const st = new Map((stock ?? []).map((s) => [s.variant_id, Number(s.available)]));
    const body = list.length
      ? list.map((p) => {
        const vs = (vrows ?? []).filter((v) => v.product_id === p.id);
        const price = vs.length ? Math.min(...vs.map((v) => Number(v.price))) : 0;
        const s = vs.reduce((a, v) => a + (st.get(v.id) ?? 0), 0);
        return `${p.status === "active" ? "🟢" : "⚪️"} <b>${esc(p.name)}</b>\n${rp(price)} · Stok: ${s}`;
      }).join("\n\n")
      : "Belum ada produk.";
    const kb = {
      inline_keyboard: [
        ...list.map((p) => [{ text: `${p.status === "active" ? "🔴 Off" : "🟢 On"} · ${p.name.slice(0, 24)}`, callback_data: `t:${p.id}` }]),
        [{ text: "➕ Kelola Produk", url: `${site}/seller/produk` }],
      ],
    };
    const text = `📦 <b>Produk — ${list.length} item</b>\n━━━━━━━━━━━━━━━\n\n${body}`;
    return asEdit ? edit(text, kb) : send(text, kb);
  };

  const sellerOrders = async () => {
    const { data } = await admin.from("orders").select("id, order_no, status, total, created_at, order_items(product_name, qty)").eq("seller_id", bot.owner_id).order("created_at", { ascending: false }).limit(8);
    const label: Record<string, string> = { pending: "⏳ Menunggu bayar", paid: "💳 Dibayar", processing: "📦 Diproses", completed: "✅ Selesai", cancelled: "❌ Batal", refunded: "↩️ Refund", failed: "❌ Gagal" };
    const rows = (data ?? []) as unknown as { order_no: number; status: string; total: number; created_at: string; order_items: { product_name: string; qty: number }[] }[];
    const body = rows.length
      ? rows.map((o) => `${label[o.status] ?? o.status} · <code>M-${o.order_no}</code>\n${esc(o.order_items[0]?.product_name ?? "-")} · ${o.order_items.reduce((a, i) => a + i.qty, 0)}x · ${rp(Number(o.total))}\n🕒 ${new Date(o.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`).join("\n\n")
      : "Belum ada pesanan.";
    return send(`🧾 <b>Pesanan — ${rows.length}</b>\n━━━━━━━━━━━━━━━\n\n${body}`, { inline_keyboard: [[{ text: "📋 Semua Pesanan", url: `${site}/seller/transaksi` }]] });
  };

  const sellerFinance = async () => {
    const { data: wallet } = await admin.from("wallets").select("balance").eq("user_id", bot.owner_id).maybeSingle();
    const { data: led } = await admin.from("wallet_ledger").select("amount, note, created_at").eq("user_id", bot.owner_id).order("created_at", { ascending: false }).limit(5);
    const mut = (led ?? []).map((l) => `${Number(l.amount) >= 0 ? "➕" : "➖"} ${rp(Math.abs(Number(l.amount)))} · ${esc((l.note ?? "").slice(0, 40))}`).join("\n") || "Belum ada mutasi.";
    return send(`💰 <b>Keuangan</b>\n━━━━━━━━━━━━━━━\n\n💵 ${rp(Number(wallet?.balance ?? 0))} tersedia\n\n📜 <b>Mutasi terakhir</b>\n${mut}`, {
      inline_keyboard: [[{ text: "💸 Tarik Saldo", url: `${site}/seller/withdraw` }, { text: "📜 Pendapatan", url: `${site}/seller/pendapatan` }]],
    });
  };

  const runSeller = async (a: SellerAction) => {
    switch (a) {
      case "s_dash": return sellerDashboardFor();
      case "s_prod": return sellerProducts();
      case "s_order": return sellerOrders();
      case "s_fin": return sellerFinance();
      case "s_buyer": return welcome();
      case "s_help":
        return send("⚙️ <b>Menu Lainnya</b>\n━━━━━━━━━━━━━━━\n\n✨ Yang bisa dilakukan di bot ini:\n\n📊 Lihat statistik penjualan\n📦 Aktif/nonaktifkan produk\n🧾 Pantau pesanan terbaru\n💰 Cek saldo & mutasi\n🔔 Notifikasi otomatis (pesanan baru, dibayar, selesai, laporan, stok menipis)\n\n📌 Perintah:\n/start — Menu seller\n/produk — Menu pembeli", {
          inline_keyboard: [[{ text: "🖥 Buka Seller Center", url: `${site}/seller` }]],
        });
    }
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
    if (d.startsWith("v:")) {
      const [, vid, q] = d.split(":");
      if (vid && /^[0-9a-f-]{36}$/i.test(vid)) return orderCard(vid, Number(q) || 1);
      return;
    }
    if (d.startsWith("s:") || d.startsWith("t:")) {
      if (!isOwner) return send("⛔ Menu ini khusus pemilik toko.");
      if (d === "s:order") return sellerOrders();
      if (d === "s:prod") return sellerProducts();
      const pid = d.slice(2);
      if (d.startsWith("t:") && /^[0-9a-f-]{36}$/i.test(pid)) {
        const { data: p } = await admin.from("products").select("id, status").eq("id", pid).eq("owner_id", bot.owner_id).maybeSingle();
        if (!p) return send("Produk tidak ditemukan.");
        const { error } = await admin.from("products").update({ status: p.status === "active" ? "draft" : "active" }).eq("id", p.id).eq("owner_id", bot.owner_id);
        if (error) return send(`Gagal mengubah produk: ${esc(error.message)}`);
        return sellerProducts(true);
      }
      return;
    }
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
  if (isOwner) {
    if (text === "/start" || text.startsWith("/start ")) {
      await send("🧑‍💼 <b>Menu Seller</b> — pilih menu di bawah untuk kelola toko.\n🔔 Notifikasi pesanan masuk otomatis ke chat ini.", sellerKb());
      return sellerDashboardFor();
    }
    const sa = sellerActionFromText(text);
    if (sa) return runSeller(sa);
  }
  if (text.startsWith("/start")) return welcome();
  if (text === "/produk") return catalog();
  const a = actionFromText(text);
  if (a) return runAction(a);
  return send("Ketik /start untuk membuka menu toko.", replyKb());
}
