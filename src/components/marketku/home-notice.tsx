import { useEffect, useState } from "react";
import { X } from "lucide-react";
import popupImg from "@/assets/home/popup-pesanan.webp.asset.json";
import { supportWaUrl } from "@/lib/support";

const KEY = "mk_home_notice_hidden_v1";

/** Pop up "Pemberitahuan" di beranda, seperti marketku.id. */
export function HomeNotice() {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1" || sessionStorage.getItem(KEY) === "1") return;
    } catch { /* ignore */ }
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => {
    try {
      if (dontShow) localStorage.setItem(KEY, "1");
      sessionStorage.setItem(KEY, "1");
    } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="mk-notice-title" className="fixed inset-0 z-[35] flex items-center justify-center px-[18px] py-4">
      <div className="mk-notice-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[3px]" onClick={close} />
      <section className="mk-notice-card relative w-full max-w-[358px] overflow-hidden rounded-[18px] border border-border bg-card shadow-2xl">
        <button type="button" aria-label="Tutup popup" onClick={close}
          className="absolute right-4 top-4 z-10 grid h-6 w-6 place-items-center text-foreground/45">
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <img src={popupImg.url} alt="Pesanan belum dikirim? Laporkan dalam 1 jam" className="block aspect-[2.84/1] w-full object-cover" />
        <div className="px-5 pb-6 pt-5 text-center">
          <h2 id="mk-notice-title" className="text-[17px] font-bold text-foreground">Pemberitahuan</h2>
          <p className="mx-auto mt-2 max-w-[272px] whitespace-pre-line text-[13.5px] leading-[20px] text-muted-foreground">
            {"Apabila pesanan belum dikirim oleh seller dalam waktu 1 jam, segera ajukan laporkan pesanan untuk menjaga keamanan dana Anda.\n\nJika tidak ada laporan yang diajukan, sistem akan secara otomatis meneruskan dana kepada seller setelah 5 jam. Setelah dana diteruskan, pengajuan pengembalian dana (refund) tidak dapat dilakukan."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <a href={supportWaUrl("Halo admin Marketku, saya ingin melaporkan pesanan.")} target="_blank" rel="noreferrer"
              className="grid h-[41px] place-items-center rounded-xl bg-primary text-[14px] font-bold text-primary-foreground">
              Whatsapp admin
            </a>
            <button type="button" onClick={close}
              className="h-[41px] rounded-xl bg-primary/10 text-[14px] font-bold text-primary">
              Nanti saja
            </button>
          </div>
          <label className="mt-3.5 inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Jangan tampilkan lagi
          </label>
        </div>
      </section>
    </div>
  );
}
