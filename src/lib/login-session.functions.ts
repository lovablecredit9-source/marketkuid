import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { describeUA } from "@/lib/auth-bot";
import { carrierFromIsp, isRealPhone, modelFrom, osFrom, vendorFrom, type ClientDeviceInfo } from "@/lib/login-session";

const str = (v: unknown, n = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
const VIA = new Set(["password", "telegram_code", "telegram_link", "mini_app", "seller_switch"]);

type Geo = { city?: string; region?: string; country?: string; isp?: string };

async function lookupIp(ip: string): Promise<Geo> {
  if (!ip || /^(127\.|10\.|192\.168\.|::1|fc|fd)/.test(ip)) return {};
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,connection`, { signal: AbortSignal.timeout(3500) });
    const j = (await r.json()) as { success?: boolean; city?: string; region?: string; country?: string; connection?: { isp?: string; org?: string } };
    if (!j.success) return {};
    return { city: j.city, region: j.region, country: j.country, isp: j.connection?.isp || j.connection?.org };
  } catch (e) {
    console.error("ip lookup", e);
    return {};
  }
}

/** Records one Seller Center sign-in with device, battery, network, IP, location and provider. */
export const recordSellerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { via?: string; info?: ClientDeviceInfo }) => ({
    via: VIA.has(String(d?.via)) ? String(d.via) : "password",
    info: (d?.info && typeof d.info === "object" ? d.info : {}) as ClientDeviceInfo,
  }))
  .handler(async ({ data, context }) => {
    const ua = (getRequestHeader("user-agent") ?? "").slice(0, 400);
    const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "").split(",")[0]!.trim();
    const i = data.info;
    const geo = await lookupIp(ip);
    const os = osFrom(ua, str(i.platform), str(i.platformVersion, 20));
    const model = modelFrom(ua, str(i.model));
    const nt = str(i.networkType, 20);
    const row = {
      user_id: context.userId,
      via: data.via,
      device_model: model,
      device_vendor: vendorFrom(model),
      os_name: os.name,
      os_version: os.version,
      browser: str(i.browser, 60) ?? describeUA(ua).browser,
      is_mobile: i.mobile === true || /Android|iPhone|iPad/i.test(ua),
      is_real_device: isRealPhone(i, ua),
      automation: !!i.webdriver || /HeadlessChrome|Playwright|Puppeteer/i.test(ua),
      battery_level: num(i.batteryLevel, 0, 100),
      battery_charging: typeof i.batteryCharging === "boolean" ? i.batteryCharging : null,
      network_type: nt,
      network_effective: str(i.networkEffective, 10),
      network_downlink: num(i.networkDownlink, 0, 10000),
      ip: ip || null,
      city: str(geo.city), region: str(geo.region),
      country: str(geo.country) ?? str(getRequestHeader("cf-ipcountry"), 4),
      isp: str(geo.isp, 120), carrier: carrierFromIsp(geo.isp),
      timezone: str(i.timezone, 60), screen: str(i.screen, 20), user_agent: ua,
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ins, error } = await supabaseAdmin.from("seller_login_sessions").insert(row).select("id").single();
    if (error) { console.error("record session", error); throw new Error("Gagal mencatat sesi login"); }
    return { id: ins.id };
  });

/** Updates "terakhir aktif" for the caller's own current session. */
export const touchSellerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: /^[0-9a-f-]{36}$/i.test(String(d?.id)) ? String(d.id) : "" }))
  .handler(async ({ data, context }) => {
    if (!data.id) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("seller_login_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });
