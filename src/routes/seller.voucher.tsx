import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Percent, Plus, Sparkles, Tag, ShoppingBag, Gift, Copy, Pencil, Trash2, Users, Clock, Check, Hash, Zap, CircleCheck,
  ArrowLeft, ArrowRight, Send, X, Calendar, ShieldCheck,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/meta";
import {
  VOUCHER_KINDS, emptyVoucher, normalizeCode, randomCode, validateVoucherStep, voucherPayload,
  type VoucherDraft, type VoucherKind,
} from "@/lib/voucher";
import { Chips, SellerCard, SellerInput } from "@/components/marketku/seller-ui";
import { PageTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/voucher")({
  head: () => pageMeta("Voucher & Promo Toko — Seller Center Marketku", "Buat dan kelola kode promo eksklusif untuk tokomu."),
  component: VoucherPage,
});

type Row = {
  id: string; kind: string; code: string; name: string; description: string | null; value_type: string; value: number;
  max_discount: number | null; usage_limit: number | null; per_user_limit: number; min_spend: number; min_qty: number;
  starts_at: string | null; ends_at: string | null; is_active: boolean; used_count: number;
};

const kindIcon: Record<string, typeof Tag> = { diskon: Tag, diskon_produk: ShoppingBag, bonus: Gift };
const kindLabel = (k: string) => VOUCHER_KINDS.find((x) => x.value === k)?.label ?? k;
const fmtValue = (r: { value_type: string; value: number }) =>
  r.value_type === "percent" ? `${Number(r.value).toFixed(2)}%` : `Rp ${Number(r.value).toLocaleString("id-ID")}`;

const tour = [
  { title: "Buat promo", desc: "Klik untuk membuat voucher diskon lewat wizard.", target: "v-create" },
  { title: "Saring jenis", desc: "Filter promo berdasarkan jenisnya.", target: "v-chips" },
  { title: "Cari promo", desc: "Temukan promo lewat kode atau nama.", target: "v-search" },
  { title: "Daftar promo", desc: "Aktifkan, edit, atau salin kode promo dari kartu.", target: "v-list" },
  { title: "Selesai", desc: "Bagikan kode promo ke pembeli untuk menarik transaksi." },
];

function VoucherPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | VoucherKind>("all");
  const [editing, setEditing] = useState<Row | null | "new">(null);

  const list = useQuery({
    queryKey: ["seller_vouchers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_vouchers").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });
  const rows = list.data ?? [];
  const shown = useMemo(() => rows.filter((r) =>
    (kind === "all" || r.kind === kind) && (!q.trim() || `${r.code} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, kind, q]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["seller_vouchers", user?.id] });

  const toggle = async (r: Row) => {
    const { error } = await supabase.from("seller_vouchers").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) { toast.error("Gagal mengubah status promo"); return; }
    void refresh();
  };
  const remove = async (r: Row) => {
    if (!window.confirm("Yakin ingin menghapus promo ini?")) return;
    const { error } = await supabase.from("seller_vouchers").delete().eq("id", r.id);
    if (error) { toast.error("Gagal menghapus promo"); return; }
    toast.success("Promo dihapus");
    void refresh();
  };

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-card text-primary"><Percent className="h-5 w-5" /></span>
        <div>
          <h2 className="text-xl font-bold">Promo Toko</h2>
          <p className="text-xs text-muted-foreground">{rows.length} promo · {rows.filter((r) => r.is_active).length} aktif</p>
        </div>
      </div>
      <button data-tour="v-create" onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95">
        <Plus className="h-4 w-4" /> Buat Promo
      </button>
      <div data-tour="v-search"><SellerInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode/nama..." /></div>
      <div data-tour="v-chips">
        <Chips value={kind} onChange={setKind} items={[
          { value: "all", label: "Semua", icon: Sparkles }, { value: "diskon", label: "Diskon", icon: Tag },
          { value: "diskon_produk", label: "Diskon Produk", icon: ShoppingBag }, { value: "bonus", label: "Bonus", icon: Gift },
        ]} />
      </div>

      <div data-tour="v-list" className="space-y-3">
        {list.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Memuat promo...</p>
        : shown.length === 0 ? (
          <SellerCard className="flex flex-col items-center px-6 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-foreground text-primary"><Sparkles className="h-6 w-6" /></span>
            <p className="mt-3 font-semibold">Belum ada promo</p>
            <p className="mt-1 text-sm text-muted-foreground">Buat kode promo eksklusif untuk toko Anda</p>
            <button onClick={() => setEditing("new")} className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95"><Plus className="h-4 w-4" /> Buat Promo Pertama</button>
          </SellerCard>
        ) : shown.map((r) => {
          const I = kindIcon[r.kind] ?? Tag;
          return (
            <SellerCard key={r.id} className="p-4">
              <div className="flex items-center gap-2">
                <p className="font-mono text-base font-bold tracking-wider">{r.code}</p>
                <button aria-label="Salin kode" onClick={() => { void navigator.clipboard.writeText(r.code); toast.success("Kode disalin"); }} className="text-muted-foreground"><Copy className="h-4 w-4" /></button>
                <button role="switch" aria-checked={r.is_active} aria-label="Aktifkan promo" onClick={() => void toggle(r)}
                  className={`ml-auto flex h-7 w-12 items-center rounded-full p-0.5 transition ${r.is_active ? "bg-success" : "bg-muted"}`}>
                  <span className={`h-6 w-6 rounded-full bg-card shadow transition ${r.is_active ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <p className="mt-1 text-xs uppercase text-muted-foreground">{r.name}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-primary"><I className="h-3 w-3" />{kindLabel(r.kind)}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{r.used_count} / {r.usage_limit ?? "∞"}</span>
              </div>
              <div className="mt-3 rounded-xl bg-accent/60 p-3">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">{r.value_type === "percent" ? "PERSENTASE" : "NOMINAL"}</p>
                <p className="text-xl font-bold text-primary">{fmtValue(r)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Min belanja: <b className="text-foreground">{r.min_spend > 0 ? `Rp ${Number(r.min_spend).toLocaleString("id-ID")}` : "Tanpa minimum"}</b></p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Exp: <b className="text-foreground">{r.ends_at ? new Date(r.ends_at).toLocaleDateString("id-ID") : "Tanpa batas"}</b></p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setEditing(r)} className="flex items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-sm font-semibold text-primary transition active:scale-95"><Pencil className="h-4 w-4" /> Edit</button>
                <button onClick={() => void remove(r)} className="flex items-center justify-center gap-2 rounded-xl bg-destructive/15 py-2.5 text-sm font-semibold text-destructive transition active:scale-95"><Trash2 className="h-4 w-4" /> Hapus</button>
              </div>
            </SellerCard>
          );
        })}
      </div>

      {editing && user && (
        <VoucherWizard ownerId={user.id} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />
      )}
      <PageTour id="seller-voucher" steps={tour} panel />
    </>
  );
}

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromRow = (r: Row): VoucherDraft => ({
  kind: r.kind as VoucherKind, code: r.code, name: r.name, description: r.description ?? "", value_type: r.value_type as "percent" | "nominal",
  value: String(r.value), max_discount: r.max_discount ? String(r.max_discount) : "", usage_limit: r.usage_limit ? String(r.usage_limit) : "",
  per_user_limit: String(r.per_user_limit), min_spend: String(r.min_spend), min_qty: String(r.min_qty),
  starts_at: toLocal(r.starts_at), ends_at: toLocal(r.ends_at), is_active: r.is_active,
});

const stepIcons = [Zap, Hash, Tag, Calendar, Check];

function VoucherWizard({ ownerId, row, onClose, onSaved }: { ownerId: string; row: Row | null; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [d, setD] = useState<VoucherDraft>(() => (row ? fromRow(row) : emptyVoucher()));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof VoucherDraft>(k: K, v: VoucherDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const errors = validateVoucherStep(step, d);

  const next = () => {
    if (errors.length) { toast.error(errors[0]); return; }
    setStep((s) => Math.min(5, s + 1));
  };
  const save = async () => {
    setSaving(true);
    const payload = voucherPayload(d);
    const { error } = row
      ? await supabase.from("seller_vouchers").update(payload).eq("id", row.id)
      : await supabase.from("seller_vouchers").insert({ ...payload, owner_id: ownerId });
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "Kode promo sudah dipakai di tokomu" : "Gagal menyimpan promo");
      return;
    }
    toast.success(row ? "Promo diperbarui" : "Promo berhasil dibuat");
    onSaved();
  };

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="seller-panel fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="seller-panel fixed inset-x-0 bottom-0 top-[12vh] z-50 mx-auto flex max-w-md flex-col rounded-t-2xl border bg-card shadow-2xl animate-in slide-in-from-bottom">
          <div className="flex items-center gap-3 border-b px-4 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-foreground text-primary"><Percent className="h-5 w-5" /></span>
            <div className="flex-1">
              <Dialog.Title className="font-bold">{row ? "Edit Promo" : "Buat Promo Baru"}</Dialog.Title>
              <p className="text-xs text-muted-foreground">Langkah {step} dari 5</p>
            </div>
            <Dialog.Close aria-label="Tutup" className="grid h-10 w-10 place-items-center rounded-xl bg-background/60"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <div className="flex items-center px-6 py-4">
            {stepIcons.map((I, i) => (
              <div key={i} className="flex flex-1 items-center last:flex-none">
                <span className={`grid h-8 w-8 place-items-center rounded-full border-2 transition ${i + 1 < step ? "border-primary bg-primary text-primary-foreground" : i + 1 === step ? "border-primary bg-card text-primary ring-4 ring-primary/20" : "bg-background text-muted-foreground"}`}>
                  {i + 1 < step ? <Check className="h-4 w-4" /> : <I className="h-3.5 w-3.5" />}
                </span>
                {i < 4 && <span className={`mx-1 h-0.5 flex-1 ${i + 1 < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            {step === 1 && (
              <>
                <h3 className="text-lg font-bold">Pilih Tipe Promo</h3>
                <p className="text-sm text-muted-foreground">Tentukan jenis promosi yang paling sesuai untuk strategi Anda</p>
                <div className="grid grid-cols-3 gap-2">
                  {VOUCHER_KINDS.map((k) => {
                    const I = kindIcon[k.value] ?? Tag; const on = d.kind === k.value;
                    return (
                      <button key={k.value} onClick={() => set("kind", k.value)}
                        className={`relative rounded-xl border p-3 text-left transition active:scale-95 ${on ? "border-primary bg-accent" : "bg-background/40"}`}>
                        {on && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                        <I className={`h-5 w-5 ${on ? "text-primary" : ""}`} />
                        <p className={`mt-2 text-sm font-semibold ${on ? "text-primary" : ""}`}>{k.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{k.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h3 className="text-lg font-bold">Informasi Promo</h3>
                <p className="text-sm text-muted-foreground">Kode unik dan nama yang mudah diingat</p>
                <div className="flex gap-2">
                  <SellerInput value={d.code} onChange={(e) => set("code", normalizeCode(e.target.value))} placeholder="Kode promo (misal: HEMAT50)" className="font-mono" />
                  <button aria-label="Buat kode acak" onClick={() => set("code", randomCode())} className="grid w-12 shrink-0 place-items-center rounded-xl bg-primary-foreground text-primary"><Sparkles className="h-5 w-5" /></button>
                </div>
                <SellerInput value={d.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="Nama promo (misal: Diskon Hari Raya)" />
                <textarea value={d.description} maxLength={200} onChange={(e) => set("description", e.target.value)} placeholder="Deskripsi promo..." rows={4}
                  className="w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary" />
                <p className="text-xs text-muted-foreground">Opsional — deskripsi singkat promo</p>
              </>
            )}
            {step === 3 && (
              <>
                <h3 className="flex items-center gap-2 text-lg font-bold"><Tag className="h-4 w-4 text-primary" /> Pengaturan Diskon</h3>
                <p className="text-sm text-muted-foreground">Konfigurasi nilai dan detail</p>
                <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/40 p-1">
                  {(["percent", "nominal"] as const).map((t) => (
                    <button key={t} onClick={() => set("value_type", t)}
                      className={`rounded-lg py-2.5 text-sm font-semibold transition ${d.value_type === t ? "border border-primary bg-accent text-primary" : "text-muted-foreground"}`}>
                      {t === "percent" ? "% Persentase (%)" : "Nominal (Rp)"}
                    </button>
                  ))}
                </div>
                <SellerInput inputMode="numeric" value={d.value} onChange={(e) => set("value", e.target.value.replace(/[^\d.]/g, ""))} placeholder="Nilai diskon" />
                <p className="text-xs text-muted-foreground">{d.value_type === "percent" ? "Angka 1-100" : "Dalam rupiah"}</p>
                {d.value_type === "percent" && (
                  <>
                    <SellerInput inputMode="numeric" value={d.max_discount} onChange={(e) => set("max_discount", e.target.value.replace(/\D/g, ""))} placeholder="Maks diskon (Rp) — opsional" />
                    <p className="text-xs text-muted-foreground">Kosongkan jika tidak ada batas</p>
                  </>
                )}
              </>
            )}
            {step === 4 && (
              <>
                <h3 className="text-lg font-bold">Aturan & Batasan</h3>
                <p className="text-sm text-muted-foreground">Batas penggunaan, syarat, dan periode berlaku</p>
                <Box icon={Users} title="Batas Penggunaan">
                  <div className="grid grid-cols-2 gap-2">
                    <Field hint="Kosong = tak terbatas"><SellerInput inputMode="numeric" value={d.usage_limit} onChange={(e) => set("usage_limit", e.target.value.replace(/\D/g, ""))} placeholder="Total penggunaan" /></Field>
                    <Field label="Per user" hint="Default 1× per user"><SellerInput inputMode="numeric" value={d.per_user_limit} onChange={(e) => set("per_user_limit", e.target.value.replace(/\D/g, ""))} /></Field>
                  </div>
                </Box>
                <Box icon={ShoppingBag} title="Syarat Minimum">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Min belanja (Rp)" hint="0 = tanpa minimum"><SellerInput inputMode="numeric" value={d.min_spend} onChange={(e) => set("min_spend", e.target.value.replace(/\D/g, ""))} /></Field>
                    <Field label="Min qty" hint="Jumlah item minimal"><SellerInput inputMode="numeric" value={d.min_qty} onChange={(e) => set("min_qty", e.target.value.replace(/\D/g, ""))} /></Field>
                  </div>
                </Box>
                <Box icon={Calendar} title="Periode Berlaku">
                  <div className="grid grid-cols-2 gap-2">
                    <Field hint="Kosong = mulai sekarang"><SellerInput type="datetime-local" value={d.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
                    <Field hint="Kosong = tanpa batas"><SellerInput type="datetime-local" value={d.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
                  </div>
                </Box>
                <button role="switch" aria-checked={d.is_active} onClick={() => set("is_active", !d.is_active)} className="flex items-center gap-3 text-left">
                  <span className={`flex h-8 w-14 items-center rounded-full p-1 transition ${d.is_active ? "bg-success" : "bg-muted"}`}>
                    <span className={`grid h-6 w-6 place-items-center rounded-full bg-card transition ${d.is_active ? "translate-x-6" : ""}`}>{d.is_active && <Check className="h-3.5 w-3.5 text-success" />}</span>
                  </span>
                  <span><span className={`block font-semibold ${d.is_active ? "text-success" : ""}`}>{d.is_active ? "Aktif" : "Nonaktif"}</span><span className="text-xs text-muted-foreground">Promo langsung bisa digunakan</span></span>
                </button>
              </>
            )}
            {step === 5 && (
              <>
                <h3 className="text-lg font-bold">Review & Konfirmasi</h3>
                <p className="text-sm text-muted-foreground">Pastikan semua data benar sebelum menyimpan</p>
                <div className="divide-y rounded-xl border bg-background/40 text-sm">
                  {[
                    ["Kode", <span key="c" className="font-mono">{d.code}</span>],
                    ["Nama", d.name.toUpperCase()],
                    ["Tipe", <span key="t" className="text-primary">{kindLabel(d.kind)}</span>],
                    ["Nilai", <span key="v" className="text-primary">{d.value_type === "percent" ? `${d.value}%` : `Rp ${Number(d.value).toLocaleString("id-ID")}`}</span>],
                    ["Batas Total", d.usage_limit || "∞"],
                    ["Per User", d.per_user_limit],
                    ["Status", <span key="s" className={d.is_active ? "text-success" : "text-muted-foreground"}>● {d.is_active ? "Aktif" : "Nonaktif"}</span>],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between px-4 py-3"><span className="text-muted-foreground">{k}</span><span className="font-semibold">{v}</span></div>
                  ))}
                </div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Kode promo berlaku khusus produk tokomu.</p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t px-4 py-4">
            <button disabled={step === 1} onClick={() => setStep((s) => s - 1)} className="flex items-center gap-2 rounded-xl border bg-background/60 px-4 py-3 text-sm font-semibold transition active:scale-95 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Kembali</button>
            {step < 5 ? (
              <button onClick={next} className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition active:scale-95 ${errors.length ? "border border-primary text-muted-foreground" : "bg-primary text-primary-foreground"}`}>Lanjut <ArrowRight className="h-4 w-4" /></button>
            ) : (
              <button disabled={saving} onClick={() => void save()} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60">
                {row ? <CircleCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />} {saving ? "Menyimpan..." : row ? "Simpan Promo" : "Buat Promo"}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Box({ icon: I, title, children }: { icon: typeof Tag; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><I className="h-4 w-4 text-primary" /> {title}</p>
      {children}
    </div>
  );
}
function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[10px] text-primary">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
