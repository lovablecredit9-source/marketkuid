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
import cat_netflix from "@/assets/cat/cat-netflix.svg.asset.json";
import cat_roblox from "@/assets/cat/cat-roblox.svg.asset.json";
import cat_github from "@/assets/cat/cat-github.svg.asset.json";
import cat_gmail from "@/assets/cat/cat-gmail.svg.asset.json";
import cat_instagram from "@/assets/cat/cat-instagram.svg.asset.json";
import cat_apple from "@/assets/cat/cat-apple.svg.asset.json";
import cat_notion from "@/assets/cat/cat-notion.svg.asset.json";
import cat_x from "@/assets/cat/cat-x.svg.asset.json";
import cat_zoom from "@/assets/cat/cat-zoom.svg.asset.json";
import cat_duolingo from "@/assets/cat/cat-duolingo.svg.asset.json";
import cat_claude from "@/assets/cat/cat-claude.svg.asset.json";
import cat_google from "@/assets/cat/cat-google.svg.asset.json";
import cat_youtube from "@/assets/cat/cat-youtube.svg.asset.json";
import cat_telegram from "@/assets/cat/cat-telegram.svg.asset.json";
import cat_tiktok from "@/assets/cat/cat-tiktok.svg.asset.json";

/** Home banners supplied by the owner. `to` is where a tap leads. */
export const HOME_BANNERS = [
  { src: bannerJualan.url, alt: "Yuk Jualan di Marketku.id — Daftar Seller Sekarang", to: "/akun" as const },
  { src: bannerKinetik.url, alt: "Kinetik AI — AI Crypto Trading System", to: "/cari" as const, q: "Kinetik" },
];

/** Image icons for categories that have one; others fall back to a line icon. */
export const CATEGORY_IMAGES: Record<string, string> = {
  Lainnya: catLainnya.url,
  "AI Tools": catAiTools.url,
  "Lain-lain": catLainnya.url,
  "App Premium": secAppPremium.url,
  Aplikasi: secAppPremium.url,
  "Netflix": cat_netflix.url,
  "Roblox": cat_roblox.url,
  "Github": cat_github.url,
  "Gmail": cat_gmail.url,
  "Instagram": cat_instagram.url,
  "Apple": cat_apple.url,
  "Notion": cat_notion.url,
  "X (Twitter)": cat_x.url,
  "Zoom": cat_zoom.url,
  "Duolingo": cat_duolingo.url,
  "Claude": cat_claude.url,
  "Google": cat_google.url,
  "Youtube": cat_youtube.url,
  "Telegram": cat_telegram.url,
  "Akun TikTok": cat_tiktok.url,
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
    category: "App Premium",
    brands: [
      { name: "Capcut", img: appCapcut.url },
      { name: "Canva", img: appCanva.url },
      { name: "Spotify", img: appSpotify.url },
      { name: "Get Contact", img: appGetcontact.url },
    ],
  },
];

import gameRoblox from "@/assets/game/game-roblox.webp.asset.json";
import gameFreeFire from "@/assets/game/game-free-fire.webp.asset.json";
import gameMobileLegends from "@/assets/game/game-mobile-legends.webp.asset.json";
import gamePubg from "@/assets/game/game-pubg.webp.asset.json";
import partnerRouter from "@/assets/partners/partner-router.png.asset.json";
import partnerLossnode from "@/assets/partners/partner-lossnode.png.asset.json";

/** "Jelajahi Game" tabs on the home page, in marketku.id's order, each with its tab icon. */
export const HOME_GAMES = [
  { name: "Roblox", icon: gameRoblox.url },
  { name: "Free Fire", icon: gameFreeFire.url },
  { name: "Mobile Legends", icon: gameMobileLegends.url },
  { name: "PUBG", icon: gamePubg.url },
] as const;

/** Footer "Mitra Marketku" partner logos. */
export const PARTNERS = [
  { name: "Marketku Router", img: partnerRouter.url, href: "https://router.marketku.id" },
  { name: "LossNode", img: partnerLossnode.url, href: "https://lossnode.com" },
] as const;
