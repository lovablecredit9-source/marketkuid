/** Client-safe helpers for the Seller Center login-session history. */

export type ClientDeviceInfo = {
  model?: string | null;
  platform?: string | null;
  platformVersion?: string | null;
  mobile?: boolean | null;
  browser?: string | null;
  batteryLevel?: number | null; // 0-100
  batteryCharging?: boolean | null;
  networkType?: string | null; // wifi | cellular | ethernet | ...
  networkEffective?: string | null; // 4g | 3g ...
  networkDownlink?: number | null; // Mbps
  touchPoints?: number | null;
  webdriver?: boolean | null;
  timezone?: string | null;
  screen?: string | null;
};

const CARRIERS: [RegExp, string][] = [
  [/telkomsel|telekomunikasi selular/i, "Telkomsel"],
  [/indosat|ooredoo|im3|im2/i, "Indosat Ooredoo (IM3)"],
  [/hutchison|\bh3i\b|\btri\b|three/i, "Tri (3)"],
  [/\baxis\b/i, "AXIS"],
  [/xl ?axiata|excelcomindo|\bxl\b/i, "XL Axiata"],
  [/smartfren|smart telecom|mobile-8/i, "Smartfren"],
  [/byu|by\.u/i, "by.U"],
  [/indihome|telkom indonesia|pt telkom|telekomunikasi indonesia/i, "IndiHome (Telkom)"],
  [/biznet/i, "Biznet"],
  [/first media|link net|linknet/i, "First Media"],
  [/myrepublic/i, "MyRepublic"],
  [/iconnet|icon\+|pln/i, "ICONNET (PLN)"],
  [/cbn/i, "CBN"],
  [/mnc|oxygen/i, "MNC Play / Oxygen"],
];

/** Maps an IP's ISP/organization name to a friendly Indonesian carrier/provider label. */
export function carrierFromIsp(isp: string | null | undefined): string | null {
  const s = String(isp ?? "").trim();
  if (!s) return null;
  for (const [re, name] of CARRIERS) if (re.test(s)) return name;
  return s;
}

const MOBILE_ONLY = new Set(["Telkomsel", "Indosat Ooredoo (IM3)", "Tri (3)", "AXIS", "XL Axiata", "Smartfren", "by.U"]);
export const isCellularCarrier = (c: string | null | undefined) => !!c && MOBILE_ONLY.has(c);

/** Network label: WiFi / Data Seluler (+carrier) / Kabel. Falls back to the ISP when the browser hides it. */
export function networkLabel(type: string | null | undefined, carrier: string | null | undefined): string {
  const t = String(type ?? "").toLowerCase();
  if (t === "wifi") return carrier ? `WiFi · ${carrier}` : "WiFi";
  if (t === "cellular") return carrier ? `Data Seluler · ${carrier}` : "Data Seluler";
  if (t === "ethernet") return carrier ? `Kabel LAN · ${carrier}` : "Kabel LAN";
  if (isCellularCarrier(carrier)) return `Data Seluler · ${carrier}`;
  return carrier ? `Internet · ${carrier}` : "Tidak diketahui";
}

/** A session counts as a real phone only with mobile hints, touch input and no automation flag. */
export function isRealPhone(i: Pick<ClientDeviceInfo, "mobile" | "touchPoints" | "webdriver">, ua: string): boolean {
  if (i.webdriver || /HeadlessChrome|Playwright|PhantomJS|Puppeteer/i.test(ua)) return false;
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(ua);
  return (i.mobile === true || mobileUa) && (i.touchPoints ?? 0) > 0;
}

/** OS name + version from the UA, preferring the real Client Hints version (UA strings freeze Android at 10). */
export function osFrom(ua: string, platform?: string | null, platformVersion?: string | null) {
  const u = String(ua ?? "");
  const p = String(platform ?? "");
  const pv = String(platformVersion ?? "").trim();
  if (/Android/i.test(p) || /Android/.test(u)) {
    const v = pv ? pv.replace(/(\.0)+$/, "") : (/Android\s([\d.]+)/.exec(u)?.[1] ?? null);
    return { name: "Android", version: v };
  }
  if (/iPhone|iPad|iPod/.test(u)) return { name: "iOS", version: /OS\s([\d_]+)/.exec(u)?.[1]?.replace(/_/g, ".") ?? null };
  if (/Windows/i.test(p) || /Windows NT/.test(u)) return { name: "Windows", version: null };
  if (/mac/i.test(p) || /Mac OS X/.test(u)) return { name: "macOS", version: null };
  if (/Linux/.test(u)) return { name: "Linux", version: null };
  return { name: "Tidak diketahui", version: null };
}

/** Device model from Client Hints, falling back to the UA ("K" is Chrome's frozen placeholder). */
export function modelFrom(ua: string, hintModel?: string | null): string | null {
  const m = String(hintModel ?? "").trim();
  if (m && m !== "K") return m.slice(0, 80);
  const a = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(ua)?.[1]?.trim();
  if (a && a !== "K") return a.slice(0, 80);
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  return null;
}

const VENDORS: [RegExp, string][] = [
  [/^SM-|samsung|galaxy/i, "Samsung"], [/^(CPH|RMX)|oppo/i, "OPPO"], [/^RMX|realme/i, "realme"],
  [/^V\d{4}|vivo/i, "vivo"], [/redmi|poco|xiaomi|^M\d{4}|^2\d{3}[A-Z0-9]{4,}/i, "Xiaomi"],
  [/infinix|^X6\d{2}/i, "Infinix"], [/tecno/i, "TECNO"], [/^Pixel/i, "Google"], [/iPhone|iPad/i, "Apple"],
  [/nokia/i, "Nokia"], [/huawei|^(ELE|VOG|ANE)-/i, "Huawei"], [/asus|^ASUS/i, "ASUS"], [/oneplus/i, "OnePlus"],
];
export function vendorFrom(model: string | null | undefined): string | null {
  const m = String(model ?? "");
  if (!m) return null;
  for (const [re, v] of VENDORS) if (re.test(m)) return v;
  return null;
}

export function batteryLabel(level: number | null | undefined, charging: boolean | null | undefined) {
  if (level == null) return "Tidak tersedia";
  return `${Math.round(level)}%${charging ? " · Mengisi daya" : ""}`;
}

/** Collects what the browser exposes about this device (Chrome Android gives model, Android version, battery, network). */
export async function collectDeviceInfo(): Promise<ClientDeviceInfo> {
  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean; platform?: string; brands?: { brand: string; version: string }[]; getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>> };
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
    connection?: { type?: string; effectiveType?: string; downlink?: number };
  };
  const info: ClientDeviceInfo = {
    mobile: nav.userAgentData?.mobile ?? null,
    platform: nav.userAgentData?.platform ?? null,
    touchPoints: nav.maxTouchPoints ?? 0,
    webdriver: !!nav.webdriver,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    screen: `${screen.width}×${screen.height}`,
    networkType: nav.connection?.type ?? null,
    networkEffective: nav.connection?.effectiveType ?? null,
    networkDownlink: typeof nav.connection?.downlink === "number" ? nav.connection.downlink : null,
  };
  try {
    const h = await nav.userAgentData?.getHighEntropyValues?.(["model", "platformVersion", "fullVersionList"]);
    if (h) {
      info.model = (h["model"] as string) || null;
      info.platformVersion = (h["platformVersion"] as string) || null;
      const list = (h["fullVersionList"] as { brand: string; version: string }[] | undefined) ?? [];
      const b = list.find((x) => !/Not.?A.?Brand|Chromium/i.test(x.brand)) ?? list.find((x) => /Chromium/i.test(x.brand));
      if (b) info.browser = `${b.brand} ${b.version.split(".")[0]}`;
    }
  } catch { /* hints refused */ }
  try {
    const bat = await nav.getBattery?.();
    if (bat) { info.batteryLevel = Math.round(bat.level * 100); info.batteryCharging = bat.charging; }
  } catch { /* battery API blocked */ }
  return info;
}
