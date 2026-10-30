import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, LogOut, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { clearSellerLocks } from "@/lib/chat";
import { banDaysLeft, banUntilLabel, useMyBans, type MyBan } from "@/lib/admin";
import { supportWaUrl } from "@/lib/support";

/** Active account ban of the signed-in user (null when none). */
export function useAccountBan(): MyBan | null {
  const { user } = useAuth();
  const bans = useMyBans(user?.id);
  return bans.data?.find((b) => b.kind === "account") ?? null;
}

/** Full-page notice shown to a banned buyer instead of the app content. */
export function BanScreen({ ban }: { ban: MyBan }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const left = banDaysLeft(ban.banned_until);
  const out = async () => {
    await qc.cancelQueries(); qc.clear(); clearSellerLocks();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
  return (
    <div className="mk-fade-in px-5 py-16 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/15 text-destructive"><Ban className="h-8 w-8" /></span>
      <h1 className="mt-4 text-xl font-bold">Akun kamu diblokir</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {ban.banned_until ? `Blokir berlaku ${banUntilLabel(ban.banned_until)}${left !== null ? ` (${left} hari lagi)` : ""}.` : "Blokir ini berlaku permanen."}
      </p>
      {ban.reason && <p className="mx-auto mt-3 max-w-xs rounded-xl border bg-card p-3 text-sm">Alasan: {ban.reason}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Selama diblokir kamu tidak bisa belanja, top up, atau mengirim pesan.</p>
      <div className="mx-auto mt-6 grid max-w-xs gap-2">
        <a href={supportWaUrl("Halo admin Marketku, akun saya diblokir. Mohon bantuannya.")} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"><MessageCircle className="h-4 w-4" /> Hubungi Admin</a>
        <button onClick={() => void out()} className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold text-destructive"><LogOut className="h-4 w-4" /> Keluar</button>
      </div>
    </div>
  );
}

/** Seller Center banner for an account or store ban. */
export function SellerBanBanner() {
  const { user } = useAuth();
  const bans = useMyBans(user?.id);
  const ban = bans.data?.find((b) => b.kind === "account") ?? bans.data?.find((b) => b.kind === "store");
  if (!ban) return null;
  const left = banDaysLeft(ban.banned_until);
  return (
    <div className="flex gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
      <Ban className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div>
        <p className="font-bold text-destructive">{ban.kind === "account" ? "Akun kamu diblokir" : "Toko kamu diblokir"} • {ban.banned_until ? `${left} hari lagi` : "Permanen"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Produk tidak tampil dan tidak bisa dibeli {banUntilLabel(ban.banned_until).toLowerCase()}.{ban.reason ? ` Alasan: ${ban.reason}` : ""}</p>
      </div>
    </div>
  );
}
