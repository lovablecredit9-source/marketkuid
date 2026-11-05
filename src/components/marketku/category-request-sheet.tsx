import { useRef, useState } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadProductImage } from "@/lib/products";
import { SellerSheet } from "@/components/marketku/seller-ui";
import { FieldLabel, fieldCls } from "@/components/marketku/product-form";

/** "Ajukan Kategori Baru" like panel.marketku.id: name (wajib) + optional icon, reviewed by admin. */
export function CategoryRequestSheet({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId: string }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;
  const valid = name.trim().length >= 2;

  const close = (v: boolean) => { if (!busy) { onOpenChange(v); if (!v) { setName(""); setFile(null); } } };
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const icon_path = file ? await uploadProductImage(userId, file) : null;
      const { error } = await supabase.from("category_requests").insert({ owner_id: userId, name: name.trim(), icon_path });
      if (error) throw error;
      toast.success("Kategori diajukan. Menunggu persetujuan admin.");
      setBusy(false); close(false);
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Gagal mengajukan kategori");
    }
  };

  return (
    <SellerSheet open={open} onOpenChange={close} title="Ajukan Kategori Baru"
      footer={<>
        <span />
        <div className="flex gap-2">
          <button type="button" onClick={() => close(false)} className="rounded-lg border bg-card px-4 py-2.5 text-sm font-semibold">Batal</button>
          <button type="button" disabled={!valid || busy} onClick={submit}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:bg-muted-foreground/60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ajukan
          </button>
        </div>
      </>}>
      <FieldLabel required>Nama kategori</FieldLabel>
      <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Contoh: AI Tools" className={`${fieldCls} text-base`} />
      <p className="mb-2 mt-5 text-sm font-semibold">Ikon kategori</p>
      <div className="flex items-center gap-4">
        <button type="button" aria-label="Pilih ikon" onClick={() => inputRef.current?.click()}
          className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-dashed text-muted-foreground">
          {preview ? <img src={preview} alt="Ikon kategori" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5" />}
        </button>
        {file ? (
          <button type="button" onClick={() => setFile(null)} className="flex items-center gap-1 text-xs text-muted-foreground"><X className="h-3.5 w-3.5" /> Hapus ikon</button>
        ) : <span className="text-xs text-muted-foreground">Opsional. JPG/PNG.</span>}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size <= 2 * 1024 * 1024) setFile(f); else if (f) toast.error("Maksimal 2 MB"); e.target.value = ""; }} />
      </div>
    </SellerSheet>
  );
}
