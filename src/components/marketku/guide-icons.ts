import { Sparkles, Bot, Package, ShoppingBag, Wallet, Percent, Cloud, Settings, HelpCircle } from "lucide-react";
import type { GuideCategory } from "@/lib/panduan";

export const GUIDE_ICONS: Record<GuideCategory["icon"], typeof Bot> = {
  sparkles: Sparkles, bot: Bot, box: Package, bag: ShoppingBag, wallet: Wallet, percent: Percent, cloud: Cloud, settings: Settings, help: HelpCircle,
};
