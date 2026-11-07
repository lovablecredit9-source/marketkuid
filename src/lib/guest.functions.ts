import { createServerFn } from "@tanstack/react-start";
import { guestContactError } from "@/lib/guest";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const msg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan");

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Finds or creates the hidden buyer account used for one guest email. */
async function shadowBuyer(email: string, whatsapp: string) {
  const db = await admin();
  const found = await db.from("guest_buyers").select("user_id").eq("email", email).maybeSingle();
  if (found.data) return found.data.user_id;
  const id = crypto.randomUUID();
  const { data, error } = await db.auth.admin.createUser({
    email: `tamu-${id}@guest.marketku.invalid`,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { full_name: `Tamu ${email.split("@")[0]!.slice(0, 20)}`, whatsapp },
  });
  if (error || !data.user) throw new Error("Gagal membuat pesanan tamu");
  const ins = await db.from("guest_buyers").insert({ email, user_id: data.user.id });
  if (ins.error) {
    await db.auth.admin.deleteUser(data.user.id);
    const again = await db.from("guest_buyers").select("user_id").eq("email", email).maybeSingle();
    if (again.data) return again.data.user_id;
    throw new Error("Gagal membuat pesanan tamu");
  }
  return data.user.id;
}

/** Places an order without signing in. Returns the secret link token for the order page. */
export const guestCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: { items?: unknown; email?: unknown; whatsapp?: unknown; telegram?: unknown; note?: unknown; voucher?: unknown }) => {
    const items = Array.isArray(d?.items) ? d.items.slice(0, 50).map((x) => ({ variant_id: s((x as { variant_id?: unknown })?.variant_id, 40), qty: Math.floor(Number((x as { qty?: unknown })?.qty) || 0) })) : [];
    if (!items.length || items.some((i) => !UUID.test(i.variant_id) || i.qty < 1 || i.qty > 1000)) throw new Error("Produk tidak valid");
    const c = { email: s(d?.email, 120).toLowerCase(), whatsapp: s(d?.whatsapp, 20).replace(/[^\d+]/g, ""), telegram: s(d?.telegram, 33) };
    const err = guestContactError(c);
    if (err) throw new Error(err);
    return { items, ...c, note: s(d?.note, 500), voucher: s(d?.voucher, 20) };
  })
  .handler(async ({ data }) => {
    try {
      const db = await admin();
      const buyer = await shadowBuyer(data.email, data.whatsapp);
      const { data: cid, error } = await db.rpc("guest_place_order", {
        p_buyer: buyer, p_email: data.email, p_telegram: data.telegram, p_items: data.items, p_whatsapp: data.whatsapp, p_note: data.note, p_voucher: data.voucher,
      });
      if (error || !cid) return { ok: false as const, error: error?.message ?? "Gagal membuat pesanan" };
      const g = await db.from("guest_checkouts").select("token").eq("checkout_id", cid).single();
      if (g.error) return { ok: false as const, error: "Gagal membuat pesanan" };
      return { ok: true as const, token: g.data.token };
    } catch (e) {
      console.error("guestCheckout", e);
      return { ok: false as const, error: msg(e) };
    }
  });

/** Reads one guest order by its secret token: status, payment options and delivered items. */
export const guestOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: unknown }) => {
    const token = s(d?.token, 40);
    if (!UUID.test(token)) throw new Error("Link pesanan tidak valid");
    return { token };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const g = await db.from("guest_checkouts").select("checkout_id, email, whatsapp, telegram, created_at").eq("token", data.token).maybeSingle();
    if (!g.data) return null;
    const cid = g.data.checkout_id;
    const [orders, pays, methods] = await Promise.all([
      db.from("orders").select("id, order_no, status, store_name, subtotal, discount, unique_code, total, paid_at, expires_at, created_at, buyer_note, order_items(id, product_id, product_name, variant_name, qty, line_total, delivered, image_path)").eq("checkout_id", cid).order("created_at"),
      db.from("order_payments").select("id, status, admin_note, amount, method_label, created_at").eq("checkout_id", cid).order("created_at", { ascending: false }),
      db.from("payment_methods").select("id, kind, provider, account_number, account_name, qr_path, is_active, sort").eq("is_active", true).order("sort"),
    ]);
    const paths = [...new Set((methods.data ?? []).map((m) => m.qr_path).filter((p): p is string => !!p))];
    const qr: Record<string, string> = {};
    if (paths.length) {
      const r = await db.storage.from("payment-assets").createSignedUrls(paths, 3600);
      for (const x of r.data ?? []) if (x.path && x.signedUrl) qr[x.path] = x.signedUrl;
    }
    // Delivered files become short-lived download links; codes stay as text.
    const list = await Promise.all((orders.data ?? []).map(async (o) => ({
      ...o,
      order_items: await Promise.all(o.order_items.map(async (i) => ({
        ...i,
        delivered: await Promise.all((o.paid_at ? i.delivered : []).map(async (d) => {
          if (!d.startsWith("file:")) return { text: d };
          const path = d.slice(5);
          const name = path.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "") ?? "file";
          const u = await db.storage.from("product-files").createSignedUrl(path, 900, { download: name });
          return { file: name, url: u.data?.signedUrl ?? null };
        })),
      }))),
    })));
    return {
      checkout: cid, email: g.data.email, whatsapp: g.data.whatsapp, telegram: g.data.telegram,
      orders: list, payments: pays.data ?? [],
      methods: (methods.data ?? []).map((m) => ({ ...m, qr_url: m.qr_path ? qr[m.qr_path] ?? null : null })),
    };
  });

/** Uploads a guest's transfer proof and sends it to admin review. */
export const guestSubmitProof = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: unknown; method?: unknown; file?: unknown; type?: unknown }) => {
    const token = s(d?.token, 40), method = s(d?.method, 40), type = s(d?.type, 20);
    if (!UUID.test(token) || !UUID.test(method)) throw new Error("Data tidak valid");
    if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error("Format harus JPG, PNG, atau WebP");
    const file = typeof d?.file === "string" ? d.file : "";
    if (!file || file.length > 7_000_000) throw new Error("Ukuran foto maksimal 5 MB");
    return { token, method, type, file };
  })
  .handler(async ({ data }) => {
    try {
      const db = await admin();
      const g = await db.from("guest_checkouts").select("buyer_id").eq("token", data.token).maybeSingle();
      if (!g.data) return { ok: false as const, error: "Pesanan tidak ditemukan" };
      const bytes = Uint8Array.from(atob(data.file), (c) => c.charCodeAt(0));
      const ext = data.type.split("/")[1]!.replace("jpeg", "jpg");
      const path = `${g.data.buyer_id}/${crypto.randomUUID()}.${ext}`;
      const up = await db.storage.from("payment-assets").upload(path, bytes, { contentType: data.type });
      if (up.error) return { ok: false as const, error: "Gagal upload bukti" };
      const { error } = await db.rpc("guest_submit_payment", { p_token: data.token, p_proof: path, p_method: data.method });
      if (error) { await db.storage.from("payment-assets").remove([path]); return { ok: false as const, error: error.message }; }
      return { ok: true as const };
    } catch (e) {
      console.error("guestSubmitProof", e);
      return { ok: false as const, error: msg(e) };
    }
  });
