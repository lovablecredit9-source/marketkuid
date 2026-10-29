import bannerJualan from "@/assets/home/banner-jualan.jpg.asset.json";
import bannerKinetik from "@/assets/home/banner-kinetik.jpg.asset.json";
import catLainnya from "@/assets/home/cat-lainnya.png.asset.json";
import catAiTools from "@/assets/home/cat-ai-tools.png.asset.json";
import secAi from "@/assets/home/sec-ai.png.asset.json";
import secAppPremium from "@/assets/home/sec-app-premium.png.asset.json";
import ai9router from "@/assets/home/ai-9router.png.asset.json";
import aiChatgpt from "@/assets/home/ai-chatgpt.png.asset.json";
import aiKiro from "@/assets/home/ai-kiro.png.asset.json";
import aiGemini from "@/assets/home/ai-gemini.png.asset.json";
import appCapcut from "@/assets/home/app-capcut.png.asset.json";
import appCanva from "@/assets/home/app-canva.png.asset.json";
import appSpotify from "@/assets/home/app-spotify.png.asset.json";
import appGetcontact from "@/assets/home/app-getcontact.png.asset.json";

/** Home banners supplied by the owner. `to` is where a tap leads. */
export const HOME_BANNERS = [
  { src: bannerJualan.url, alt: "Yuk Jualan di Marketku.id — Daftar Seller Sekarang", to: "/akun" as const },
  { src: bannerKinetik.url, alt: "Kinetik AI — AI Crypto Trading System", to: "/cari" as const, q: "Kinetik" },
];

/** Image icons for categories that have one; others fall back to a line icon. */
export const CATEGORY_IMAGES: Record<string, string> = {
  Lainnya: catLainnya.url,
  "AI Tools": catAiTools.url,
};

/** Brand shortcut groups on the home page; tapping a brand searches for it. */
export const BRAND_GROUPS = [
  {
    title: "AI",
    icon: secAi.url,
    category: "AI Tools",
    brands: [
      { name: "9router", img: ai9router.url },
      { name: "ChatGPT", img: aiChatgpt.url },
      { name: "Kiro", img: aiKiro.url },
      { name: "Gemini", img: aiGemini.url },
    ],
  },
  {
    title: "App Premium",
    icon: secAppPremium.url,
    category: "Aplikasi",
    brands: [
      { name: "Capcut", img: appCapcut.url },
      { name: "Canva", img: appCanva.url },
      { name: "Spotify", img: appSpotify.url },
      { name: "Get Contact", img: appGetcontact.url },
    ],
  },
];
