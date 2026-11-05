/** Mirrors create_credit_topup limits so sellers see the error before uploading proof. */
export const CREDIT_TOPUP_MIN = 1000;
export const CREDIT_TOPUP_MAX = 10_000_000;

export function creditTopupError(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < CREDIT_TOPUP_MIN) return "Minimal top up credits Rp1.000";
  if (amount > CREDIT_TOPUP_MAX) return "Maksimal top up credits Rp10.000.000";
  return null;
}
