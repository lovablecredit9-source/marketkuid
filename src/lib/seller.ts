import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSellerStore(userId: string | undefined) {
  return useQuery({
    queryKey: ["seller_store", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("seller_stores")
        .select("store_name, telegram_username, created_at")
        .eq("owner_id", userId!)
        .maybeSingle();
      return data;
    },
  });
}

export const toneClass = {
  amber: "bg-tone-amber/10 text-tone-amber",
  pink: "bg-tone-pink/10 text-tone-pink",
  cyan: "bg-tone-cyan/10 text-tone-cyan",
  green: "bg-tone-green/10 text-tone-green",
  blue: "bg-tone-blue/10 text-tone-blue",
  slate: "bg-tone-slate/10 text-tone-slate",
} as const;
export type Tone = keyof typeof toneClass;
