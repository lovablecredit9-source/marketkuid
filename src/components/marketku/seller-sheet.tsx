import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const validStoreName = (v: string) => v.trim().length >= 3 && v.trim().length <= 40;
export const normalizeTelegram = (v: string) => v.trim().replace(/^@/, "");
export const validTelegram = (v: string) => v === "" || /^[A-Za-z0-9_]{5,32}$/.test(v);

export function SellerSheet({ open, onOpenChange, userId, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [tg, setTg] = useState("");
  const [loading, setLoading] = useState(false);
  const telegram = normalizeTelegram(tg);
  const nameOk = validStoreName(name);
  const tgOk = validTelegram(telegram);

  const submit = async () => {
    if (!nameOk || !tgOk || loading) return;
    setLoading(true);
    const { error } = await supabase.from("seller_stores").insert({
      owner_id: userId,
      store_name: name.trim(),
      telegram_username: telegram || null,
    });
    setLoading(false);
    if (error) return toast.error(error.code === "23505" ? "Kamu sudah punya toko." : "Gagal membuat toko. Coba lagi.");
    toast.success("Toko berhasil dibuat");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-3xl border-t bg-card pb-8 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom">
          <div className="flex items-center justify-between border-b px-5 py-5">
            <Dialog.Title className="text-xl font-bold">Mulai Jualan di Marketku</Dialog.Title>
            <Dialog.Close aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full transition active:scale-90"><X className="h-6 w-6" /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Isi nama toko untuk membuka akun seller.</Dialog.Description>
          <form className="space-y-5 px-5 pt-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="space-y-2">
              <label htmlFor="store_name" className="block text-sm font-semibold">Nama toko</label>
              <input id="store_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nama toko kamu" autoFocus
                className="w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
              {name && !nameOk && <p className="text-sm text-destructive">Nama toko 3–40 karakter.</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="store_tg" className="block text-sm font-semibold">Username Telegram (opsional)</label>
              <input id="store_tg" value={tg} onChange={(e) => setTg(e.target.value)} maxLength={33} placeholder="username"
                className="w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
              <p className={`text-sm ${tgOk ? "text-muted-foreground" : "text-destructive"}`}>
                {tgOk ? "Isi jika punya, untuk notifikasi & link bot. Tanpa @" : "Username Telegram 5–32 karakter: huruf, angka, atau _."}
              </p>
            </div>
            <button type="submit" disabled={!nameOk || !tgOk || loading}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-primary-glow py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.98] disabled:opacity-55 disabled:shadow-none">
              {loading ? "Membuat toko..." : "Buka Toko"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
