/** Referral helpers shared by register, the Undang Teman page and admin. Rules live server-side (claim_referral / referral_reward_on_sale). */

export const REFERRAL_CODE_RE = /^[A-Z0-9]{4,16}$/;
const PENDING_KEY = "mk_pending_ref";

export type ReferralRules = {
  is_enabled: boolean;
  referrer_reward: number;
  referee_reward: number;
  min_order: number;
  max_rewards_per_referrer: number;
  claim_window_days: number;
};

/** Uppercase, strip spaces/symbols ("mk ab-12" → "MKAB12"). */
export const normalizeReferralCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

export const isReferralCode = (s: string) => REFERRAL_CODE_RE.test(s);

export const referralLink = (origin: string, code: string) => `${origin.replace(/\/$/, "")}/register?ref=${encodeURIComponent(code)}`;

export const referralShareText = (link: string) =>
  `Yuk belanja produk digital di Marketku! Daftar pakai link undangan aku: ${link}`;

/** Plain-language list of the admin-set rules shown to buyers. */
export function referralRuleLines(r: ReferralRules): string[] {
  const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
  const lines = [
    `Teman kamu memasukkan kode maksimal ${r.claim_window_days} hari setelah daftar, sebelum pesanan pertamanya.`,
    `Hadiah diberikan setelah pesanan teman minimal ${rp(r.min_order)} selesai dan dana diteruskan ke seller.`,
  ];
  if (r.referrer_reward > 0) lines.push(`Kamu dapat ${rp(r.referrer_reward)} Saldo Marketku per teman yang memenuhi syarat.`);
  if (r.referee_reward > 0) lines.push(`Teman kamu dapat bonus ${rp(r.referee_reward)} Saldo Marketku.`);
  lines.push(`Maksimal ${r.max_rewards_per_referrer} hadiah per akun. Pesanan dari toko kamu sendiri tidak dihitung.`);
  return lines;
}

export function rememberPendingReferral(code: string) {
  try { if (isReferralCode(code)) localStorage.setItem(PENDING_KEY, code); } catch { /* storage blocked */ }
}
export function readPendingReferral(): string | null {
  try { const v = localStorage.getItem(PENDING_KEY); return v && isReferralCode(v) ? v : null; } catch { return null; }
}
export function clearPendingReferral() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ }
}

export const REFERRAL_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Menunggu pesanan", tone: "bg-warning/15 text-warning-foreground" },
  rewarded: { label: "Hadiah diterima", tone: "bg-success/15 text-success" },
  rejected: { label: "Tidak memenuhi syarat", tone: "bg-destructive/10 text-destructive" },
};
