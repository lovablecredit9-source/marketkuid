/** Official Marketku help line (WhatsApp 0857-6930-2532). */
export const SUPPORT_WA_NUMBER = "6285769302532";
export function supportWaUrl(text = "Halo Marketku, saya butuh bantuan.") {
  return `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(text)}`;
}
