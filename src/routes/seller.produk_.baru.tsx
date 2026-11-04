import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, Fragment, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Camera, ImageIcon, Infinity as InfinityIcon, Plus, Send, ShieldCheck, Percent, Gift, ShoppingBag, Trash2, X, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import {
  PRODUCT_TYPES, MAX_PHOTOS, emptyVariant, fmtThousands, digits, parsePrice, stockLines, validateInfo, validateDetail, CODE_SUBTYPES, stockFormat,
  validateVariants, warrantyLabel, useCategories, useImageUrls, uploadProductImage, categoryPath,
  type ProductType, type CodeSubtype, type StockMode, type VariantDraft, type Warranty, type Discount, type Bonus,
} from "@/lib/products";
import { BonusSheet, DiskonSheet, ErrorBox, FieldLabel, FloatInput, FloatTextarea, GaransiSheet, KategoriSheet, fieldCls } from "@/components/marketku/product-form";
import { soon } from "@/components/marketku/shell";
import { SellerLoading } from "@/components/marketku/loading";

export const Route = createFileRoute("/seller/produk_/baru")({
  validateSearch: (s: Record<string, unknown>): { edit?: string } => (typeof s["edit"] === "string" ? { edit: s["edit"] } : {}),
  head: () => ({
    meta: [
      { title: "Tambah Produk — Seller Center Marketku" },
      { name: "description", content: "Tambah produk digital baru ke toko Marketku kamu." },
      { property: "og:title", content: "Tambah Produk — Seller Center Marketku" },
      { property: "og:description", content: "Form tambah produk Seller Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductWizard,
});

type StepKey = "info" | "foto" | "detail" | "varian" | "stok";
const stepLabel: Record<StepKey, string> = { info: "Info", foto: "Foto", detail: "Detail", varian: "Varian", stok: "Stok" };
type SheetState = { kind: "garansi" | "diskon" | "bonus"; idx: number; n: number } | null;

function ProductWizard() {
  const { edit } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cats = useCategories();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<ProductType | "">("");
  const [requireNote, setRequireNote] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [guide, setGuide] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [contact, setContact] = useState("");
  const [estimate, setEstimate] = useState("");
  const [codeSubtype, setCodeSubtype] = useState<CodeSubtype | "">("");
  const [stockMode, setStockMode] = useState<StockMode>("normal");
  const [customFields, setCustomFields] = useState<string[]>([""]);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [removed, setRemoved] = useState<string[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const variantFileRef = useRef<HTMLInputElement>(null);
  const variantImgIdx = useRef(0);

  const existing = useQuery({
    queryKey: ["product_edit", edit],
    enabled: !!edit && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, product_variants(*)").eq("id", edit!).single();
      if (error) throw error;
      return data;
    },
  });
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    const p = existing.data;
    if (!p || loadedFor.current === p.id) return;
    loadedFor.current = p.id;
    setName(p.name); setDesc(p.description); setType(p.product_type as ProductType); setRequireNote(p.require_buyer_note);
    setCategoryId(p.category_id); setGuide(p.usage_guide); setShowGuide(!!p.usage_guide); setPhotos(p.images);
    setContact(p.seller_contact ?? ""); setEstimate(p.work_estimate ?? "");
    setCodeSubtype((p.code_subtype as CodeSubtype | null) ?? ""); setStockMode((p.stock_mode as StockMode) ?? "normal");
    setCustomFields(p.custom_fields?.length ? p.custom_fields : [""]);
    const vs = [...p.product_variants].sort((a, b) => a.sort - b.sort).map<VariantDraft>((v) => ({
      id: v.id, name: v.name, image_url: v.image_url, price: fmtThousands(String(v.price)), lifetime: v.lifetime,
      duration_value: v.duration_value ? String(v.duration_value) : "", duration_unit: (v.duration_unit as VariantDraft["duration_unit"]) ?? "hari",
      warranty: v.warranty as Warranty | null, discount: v.discount as Discount | null, bonus: v.bonus as Bonus | null,
      quota: "", stock: "",
    }));
    if (vs.length) setVariants(vs);
  }, [existing.data]);

  const needsDetail = type === "preorder" || type === "otp" || type === "gsuite";
  const steps: StepKey[] = needsDetail ? ["info", "foto", "detail", "varian", "stok"] : ["info", "foto", "varian", "stok"];
  const cur: StepKey = steps[Math.min(step, steps.length - 1)] ?? "info";
  const isLast = step === steps.length - 1;
  const imgUrls = useImageUrls([...photos, ...variants.map((v) => v.image_url ?? "")]);
  const catName = categoryId ? categoryPath(cats.data ?? [], categoryId).map((c) => c.name).join(" › ") || undefined : undefined;

  const setV = (i: number, patch: Partial<VariantDraft>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const validate = (k: StepKey) => {
    if (k === "info") {
      const e = validateInfo({ name, type, category_id: categoryId });
      if (type === "code" && !codeSubtype) e.splice(e.length - (categoryId ? 0 : 1), 0, "Pilih subtype kode");
      return e;
    }
    if (k === "foto") return photos.length ? [] : ["Tambahkan minimal satu foto produk sebelum melanjutkan."];
    if (k === "detail") return type === "gsuite" ? ["Pilih minimal 1 Workspace Profile"] : validateDetail(contact, estimate, type === "preorder");
    if (k === "stok" && type === "custom" && !customFields.some((f) => f.trim())) return ["Isi minimal 1 nama field stok kustom"];
    if (k === "varian") return validateVariants(variants);
    return [];
  };
  const next = () => {
    const e = validate(cur);
    setErrors(e);
    if (e.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (isLast) void publish(); else { setStep(step + 1); window.scrollTo({ top: 0 }); }
  };
  const back = () => { setErrors([]); if (step === 0) navigate({ to: "/seller/produk" }); else setStep(step - 1); };

  const onPickPhotos = async (files: FileList | null) => {
    if (!files || !user) return;
    const room = MAX_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.error(`Maksimal ${MAX_PHOTOS} foto`);
    setUploading(true);
    try {
      for (const f of list) {
        const path = await uploadProductImage(user.id, f);
        setPhotos((p) => [...p, path]);
      }
      setErrors([]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal upload foto"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const onPickVariantImage = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !user) return;
    try { const path = await uploadProductImage(user.id, f); setV(variantImgIdx.current, { image_url: path }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal upload foto"); }
    finally { if (variantFileRef.current) variantFileRef.current.value = ""; }
  };

  const publish = async () => {
    if (!user || !type || saving) return;
    setSaving(true);
    try {
      const row = {
        owner_id: user.id, name: name.trim(), description: desc.trim(), product_type: type, require_buyer_note: requireNote,
        category_id: categoryId, usage_guide: showGuide ? guide.trim() : "", images: photos,
        seller_contact: type === "preorder" || type === "otp" ? contact.trim() : null, work_estimate: type === "preorder" ? estimate.trim() : null,
        code_subtype: type === "code" && codeSubtype ? codeSubtype : null, stock_mode: type === "preorder" ? "normal" : stockMode,
        custom_fields: type === "custom" ? customFields.map((f) => f.trim()).filter(Boolean).slice(0, 6) : [],
      };
      let productId = edit;
      if (edit) {
        const { error } = await supabase.from("products").update(row).eq("id", edit);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert({ ...row, status: "active" }).select("id").single();
        if (error) throw error;
        productId = data.id;
      }
      if (removed.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", removed);
        if (error) throw error;
      }
      for (const [i, v] of variants.entries()) {
        const vr = {
          product_id: productId!, owner_id: user.id, name: v.name.trim(), image_url: v.image_url, price: parsePrice(v.price),
          lifetime: v.lifetime, duration_value: v.lifetime ? null : Number(digits(v.duration_value)), duration_unit: v.lifetime ? null : v.duration_unit,
          warranty: v.warranty as unknown as Json, discount: v.discount as unknown as Json, bonus: v.bonus as unknown as Json,
          preorder_quota: type === "preorder" && Number(digits(v.quota)) > 0 ? Number(digits(v.quota)) : null, sort: i,
        };
        let variantId = v.id;
        if (v.id) {
          const { error } = await supabase.from("product_variants").update(vr).eq("id", v.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("product_variants").insert(vr).select("id").single();
          if (error) throw error;
          variantId = data.id;
        }
        const items = type === "preorder"
          ? Array.from({ length: Math.min(Number(digits(v.quota)) || 0, 1000) }, () => "pre_order_slot")
          : stockLines(v.stock).slice(0, 1000);
        if (items.length && (type !== "preorder" || !v.id)) {
          const { error } = await supabase.from("product_stock").insert(items.map((content) => ({ product_id: productId!, variant_id: variantId!, owner_id: user.id, content })));
          if (error) throw error;
        }
      }
      await qc.invalidateQueries({ queryKey: ["my_products"] });
      await qc.invalidateQueries({ queryKey: ["category_counts"] });
      toast.success(edit ? "Produk berhasil diperbarui!" : "Produk berhasil dipublish!");
      navigate({ to: "/seller/produk" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan produk");
    } finally { setSaving(false); }
  };

  if (edit && existing.isLoading) return <SellerLoading label="Memuat produk" />;

  return (
    <div className="rounded-2xl border bg-card">
      {/* Stepper */}
      <div className="flex items-start px-4 pb-2 pt-5">
        {steps.map((k, i) => (
          <Fragment key={k}>
            {i > 0 && <span className={`mt-[5px] h-px flex-1 ${i <= step ? "bg-foreground" : "bg-border"}`} />}
            <button type="button" disabled={i > step} onClick={() => { setErrors([]); setStep(i); }} className="flex w-12 flex-col items-center gap-2">
              <span className={`h-3 w-3 rounded-full transition ${i <= step ? "bg-foreground" : "bg-muted-foreground/40"}`} />
              <span className={`text-xs ${i === step ? "font-semibold text-foreground" : "text-foreground/80"}`}>{stepLabel[k]}</span>
            </button>
          </Fragment>
        ))}
      </div>

      <div className="space-y-5 px-5 pb-6 pt-4">
        {cur === "info" && (
          <>
            <Head title="Info Produk" desc="Informasi dasar produk yang akan dilihat pembeli." />
            <ErrorBox title="Harap lengkapi field berikut" items={errors} />
            <div><FieldLabel required>Nama produk</FieldLabel>
              <FloatInput label="Contoh: ChatGPT Plus 1 Bulan" value={name} maxLength={120} missing={errors.length > 0} onChange={(e) => setName(e.target.value)} /></div>
            <div><FieldLabel>Deskripsi</FieldLabel>
              <FloatTextarea label="Jelaskan produk secara singkat..." value={desc} maxLength={2000} rows={3} onChange={(e) => setDesc(e.target.value)} /></div>
            <div><FieldLabel required>Jenis produk</FieldLabel>
              <select value={type} disabled={!!edit} onChange={(e) => { setType(e.target.value as ProductType); setErrors([]); }}
                className={`${fieldCls} appearance-none bg-[length:16px] text-base`}>
                <option value="">Pilih jenis produk</option>
                {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">Menentukan format stok dan cara pengiriman ke pembeli.</p></div>
            {type === "code" && (
              <div className="mk-pop"><FieldLabel required>Subtype kode</FieldLabel>
                <select value={codeSubtype} onChange={(e) => { setCodeSubtype(e.target.value as CodeSubtype); setErrors([]); }}
                  className={`${fieldCls} appearance-none text-base ${errors.length && !codeSubtype ? "mk-missing-plain" : ""}`}>
                  <option value="">Pilih subtype</option>
                  {CODE_SUBTYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></div>
            )}
            <div className="flex items-center gap-4 rounded-xl border p-4">
              <div className="flex-1">
                <p className="text-sm font-semibold">Wajibkan catatan pembeli</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Pembeli harus mengisi instruksi atau informasi tambahan sebelum checkout.</p>
              </div>
              <button type="button" role="switch" aria-checked={requireNote} aria-label="Wajibkan catatan pembeli" onClick={() => setRequireNote(!requireNote)}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition ${requireNote ? "bg-primary" : "bg-muted"}`}>
                <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-foreground transition-all ${requireNote ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            <div><FieldLabel required>Kategori</FieldLabel>
              <button type="button" onClick={() => setCatOpen(true)} className={`${fieldCls} flex items-center justify-between text-left text-base`}>
                <span className={catName ? "" : "text-foreground/80"}>{catName ?? "Pilih kategori produk"}</span>
                <span className="text-sm font-semibold text-primary">{catName ? "Ganti" : "Pilih"}</span>
              </button>
              <button type="button" onClick={() => soon("Ajukan kategori baru")} className="mt-3 flex items-center gap-1.5 px-4 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Ajukan kategori baru</button>
            </div>
            {showGuide ? (
              <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Panduan penggunaan</p>
                <button type="button" aria-label="Hapus panduan" onClick={() => { setShowGuide(false); setGuide(""); }}><X className="h-4 w-4 text-muted-foreground" /></button></div>
                <textarea value={guide} maxLength={3000} onChange={(e) => setGuide(e.target.value)} rows={4} placeholder="Langkah-langkah memakai produk setelah dibeli..." className={`${fieldCls} resize-none`} /></div>
            ) : (
              <button type="button" onClick={() => setShowGuide(true)} className="flex items-center gap-1.5 px-4 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Tambah panduan penggunaan</button>
            )}
          </>
        )}

        {cur === "foto" && (
          <>
            <div>
              <h2 className="text-xl font-bold">Foto Produk</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Maksimal {MAX_PHOTOS} foto. Foto pertama menjadi gambar utama. <span className="text-destructive">Wajib diisi.</span></p>
            </div>
            <ErrorBox items={errors} />
            <div className="rounded-2xl border bg-background/40 p-4">
              {photos.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <div key={p} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                      {imgUrls.data?.[p] && <img src={imgUrls.data[p]} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />}
                      {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">Utama</span>}
                      <button type="button" aria-label="Hapus foto" onClick={() => setPhotos(photos.filter((x) => x !== p))}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/80"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-primary/30 py-9 text-center transition active:scale-[0.99]">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <span className="flex items-center gap-3 text-muted-foreground"><Camera className="h-5 w-5" /><Plus className="h-4 w-4" /></span>}
                  <span className="text-sm text-muted-foreground">{uploading ? "Mengunggah..." : "Klik untuk upload foto"}</span>
                  <span className="text-xs">JPG, PNG, atau WebP</span>
                </button>
              )}
              <p className="mt-4 text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS} foto</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void onPickPhotos(e.target.files)} />
            </div>
          </>
        )}

        {cur === "detail" && (
          <>
            <Head title="Detail Lanjutan" desc={type === "otp" ? "Konfigurasi kontak seller untuk koordinasi pengiriman OTP." : type === "gsuite" ? "Pilih Workspace Profile yang akan dipakai untuk provisioning akun." : "Konfigurasi kontak dan durasi pengerjaan untuk produk pre-order."} />
            {type === "gsuite" ? (
              <div><FieldLabel required>Workspace Profile</FieldLabel>
                <p className="rounded-lg border border-tone-amber/40 bg-tone-amber/10 p-3 text-sm leading-relaxed text-tone-amber">Belum ada Workspace Profile terverifikasi. Buat dan verifikasi di halaman <b>Workspace</b> terlebih dahulu.</p>
                {errors.length > 0 && <p className="mt-2 text-xs text-destructive">{errors[0]}</p>}</div>
            ) : (
              <>
                <div><FieldLabel required>Kontak seller</FieldLabel>
                  <FloatInput label="@username_telegram atau 08123456789" missing={errors.length > 0} value={contact} maxLength={60} onChange={(e) => setContact(e.target.value)} />
                  {errors.includes("Kontak seller wajib diisi") && <p className="mt-1.5 text-xs text-destructive">Kontak seller wajib diisi</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{type === "otp" ? "Digunakan untuk koordinasi pengiriman OTP." : "Pembeli akan diarahkan ke kontak ini setelah bayar."}</p></div>
                {type === "preorder" && (
                  <div><FieldLabel required>Estimasi durasi pengerjaan</FieldLabel>
                    <FloatInput label="Contoh: 1-3 hari kerja" missing={errors.length > 0} value={estimate} maxLength={60} onChange={(e) => setEstimate(e.target.value)} />
                    {errors.includes("Estimasi durasi wajib diisi") && <p className="mt-1.5 text-xs text-destructive">Estimasi durasi wajib diisi</p>}</div>
                )}
              </>
            )}
          </>
        )}

        {cur === "varian" && (
          <>
            <Head title="Varian Produk" desc="Buat satu atau lebih varian (durasi, harga, garansi, dan lainnya)." />
            <ErrorBox title="Harap lengkapi field berikut" items={errors} />
            <button type="button" onClick={() => { if (variants.length >= 20) { toast.error("Maksimal 20 varian"); return; } setVariants([...variants, emptyVariant()]); setActiveIdx(variants.length); }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Tambah opsi produk
            </button>
            <div className="space-y-4 border-t pt-4">
              {variants.map((v, i) => (
                <VariantCard key={i} v={v} idx={i} active={i === activeIdx} canDelete={variants.length > 1}
                  img={v.image_url ? imgUrls.data?.[v.image_url] : undefined}
                  onActivate={() => setActiveIdx(i)}
                  onChange={(p) => setV(i, p)}
                  onImage={() => { variantImgIdx.current = i; variantFileRef.current?.click(); }}
                  onSheet={(kind) => setSheet({ kind, idx: i, n: Date.now() })}
                  onDelete={() => {
                    if (v.id) setRemoved([...removed, v.id]);
                    setVariants(variants.filter((_, j) => j !== i));
                    setActiveIdx(Math.max(0, Math.min(activeIdx, variants.length - 2)));
                  }} />
              ))}
            </div>
            <input ref={variantFileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void onPickVariantImage(e.target.files)} />
          </>
        )}

        {cur === "stok" && (
          <>
            <Head title="Stok Produk" desc={edit ? "Tambahkan stok baru jika perlu. Klik Simpan untuk menyelesaikan." : "Masukkan stok awal produk. Klik Publikasi untuk menyelesaikan."} />
            {type === "preorder" ? (
              <>
                <div className="flex flex-col items-center py-4 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-xl border text-tone-pink"><ShoppingBag className="h-6 w-6" /></span>
                  <p className="mt-4 font-semibold">Produk Pre Order</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pembeli diarahkan menghubungi seller setelah bayar. Kuota opsional — kosongkan untuk tak terbatas.</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">KUOTA PRE-ORDER PER VARIAN</p>
                  <div className="mt-3 space-y-3">
                    {variants.map((v, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <p className="mb-3 text-sm font-semibold">{v.name || `Varian ${i + 1}`}</p>
                        {v.id ? <p className="text-xs text-muted-foreground">Tambah slot dari tab Stok.</p> : (
                          <FloatInput label="∞" alwaysFloat inputMode="numeric" placeholder="Tak terbatas" value={v.quota}
                            onChange={(e) => setV(i, { quota: digits(e.target.value).slice(0, 4) })} className="[&>input]:border-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground">Isi angka untuk membatasi jumlah pre-order. Kosong = tak terbatas.</p>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["unlimited", "reusable"] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={stockMode === m} onClick={() => setStockMode(stockMode === m ? "normal" : m)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition active:scale-95 ${stockMode === m ? "border-primary bg-primary/10 text-primary" : "text-foreground/80"}`}>
                      {m === "unlimited" ? <InfinityIcon className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}{m === "unlimited" ? "Unlimited" : "Reusable"}
                    </button>
                  ))}
                </div>
                {stockMode !== "normal" && (
                  <p className="mk-pop rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                    {stockMode === "unlimited" ? "Stok tidak pernah habis — input stok opsional." : "1 stok dijual berulang setelah masa aktif habis."}
                  </p>
                )}
                {type === "custom" && (
                  <div className="rounded-xl border p-4">
                    <div className="mb-1 flex items-center justify-between"><p className="text-sm font-semibold">Field stok kustom<span className="text-destructive"> *</span></p>
                      <span className="text-xs text-muted-foreground">{customFields.filter((f) => f.trim()).length}/6 field</span></div>
                    <p className="mb-3 text-xs text-muted-foreground">Tentukan nama field (mis. API Key, Refresh Token). Tombol + di sebelah untuk menambah.</p>
                    <div className="space-y-2">
                      {customFields.map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <FloatInput label={`Field ${i + 1}`} value={f} maxLength={30} missing={errors.length > 0 && i === 0}
                            onChange={(e) => setCustomFields(customFields.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1" />
                          {customFields.length > 1 && <button type="button" aria-label="Hapus field" onClick={() => setCustomFields(customFields.filter((_, j) => j !== i))}><X className="h-4 w-4 text-muted-foreground" /></button>}
                        </div>
                      ))}
                    </div>
                    {customFields.length < 6 && <button type="button" onClick={() => setCustomFields([...customFields, ""])} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Tambah field</button>}
                  </div>
                )}
                {variants.map((v, i) => {
                  const fmt = stockFormat(type, customFields);
                  const n = stockLines(v.stock).length;
                  return (
                  <div key={i} className="rounded-xl border p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-semibold">{fmt.title}{variants.length > 1 ? ` · ${v.name || `Varian ${i + 1}`}` : ""}</p>
                      <span className="text-xs text-muted-foreground">{n} stok</span>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">{fmt.hint}</p>
                    <FloatTextarea label={fmt.example} value={v.stock} rows={4} onChange={(e) => setV(i, { stock: e.target.value })} className="[&_textarea]:font-mono [&_textarea]:text-xs" />
                    <p className="mt-2 text-xs text-muted-foreground">{n ? `${n} stok siap dijual.` : "Belum ada stok."}</p>
                  </div>
                  );
                })}
              </div>
            )}
            <div className="border-t pt-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4" /> Tampilkan di Bot</p>
              <p className="mt-2 text-sm text-muted-foreground">Pilih bot Telegram yang akan menampilkan produk ini.</p>
              <p className="mt-2 text-sm leading-relaxed text-tone-amber">Belum ada bot terhubung. Hubungkan bot di halaman Bot terlebih dahulu.</p>
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-[68px] z-10 flex items-center justify-between rounded-b-2xl border-t bg-card px-5 py-4">
        <button type="button" onClick={back} className="flex items-center gap-2 px-2 py-2 font-semibold text-foreground/85 transition active:scale-95">
          {step > 0 && <ArrowLeft className="h-4 w-4" />}{step === 0 ? "Batal" : "Kembali"}
        </button>
        <button type="button" onClick={next} disabled={saving || uploading}
          className="flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 font-semibold text-background transition focus:ring-2 focus:ring-primary active:scale-95 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isLast && <Send className="h-4 w-4" />}
          {isLast ? (edit ? "Simpan" : "Publikasi") : "Lanjut"}
        </button>
      </div>

      <KategoriSheet open={catOpen} onOpenChange={setCatOpen} value={categoryId} onPick={(id) => { setCategoryId(id); setErrors([]); }} />
      {sheet?.kind === "garansi" && (
        <GaransiSheet key={sheet.n} open onOpenChange={(o) => !o && setSheet(null)} value={variants[sheet.idx]?.warranty ?? null} onSave={(w) => setV(sheet.idx, { warranty: w })} />
      )}
      {sheet?.kind === "diskon" && (
        <DiskonSheet key={sheet.n} open onOpenChange={(o) => !o && setSheet(null)} value={variants[sheet.idx]?.discount ?? null} onSave={(d) => setV(sheet.idx, { discount: d })} />
      )}
      {sheet?.kind === "bonus" && (
        <BonusSheet key={sheet.n} open onOpenChange={(o) => !o && setSheet(null)} value={variants[sheet.idx]?.bonus ?? null} onSave={(b) => setV(sheet.idx, { bonus: b })} />
      )}
    </div>
  );
}

function Head({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Chip({ children, on, tone, onClick }: { children: ReactNode; on: boolean; tone: "primary" | "success" | "amber" | "purple"; onClick: () => void }) {
  const onCls = { primary: "border-primary bg-primary/10 text-primary ring-1 ring-primary", success: "border-success/50 bg-success/10 text-success", amber: "border-tone-amber/50 bg-tone-amber/10 text-tone-amber", purple: "border-tone-purple/50 bg-tone-purple/10 text-tone-purple" }[tone];
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition active:scale-95 ${on ? onCls : "bg-muted/30 text-foreground/85"}`}>
      {children}
    </button>
  );
}

function VariantCard({ v, idx, active, canDelete, img, onActivate, onChange, onImage, onSheet, onDelete }: {
  v: VariantDraft; idx: number; active: boolean; canDelete: boolean; img?: string | undefined;
  onActivate: () => void; onChange: (p: Partial<VariantDraft>) => void; onImage: () => void;
  onSheet: (k: "garansi" | "diskon" | "bonus") => void; onDelete: () => void;
}) {
  const price = parsePrice(v.price);
  const qty = stockLines(v.stock).length;
  return (
    <div className={`overflow-hidden rounded-xl border ${active ? "border-primary/60" : ""}`}>
      <div className="flex items-center gap-3 border-b p-3">
        <button type="button" aria-label="Foto varian" onClick={onImage} className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
          {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5" strokeWidth={1.6} />}
        </button>
        <FloatInput label={`Nama produk ${idx + 1}`} value={v.name} maxLength={80} onFocus={onActivate} onChange={(e) => onChange({ name: e.target.value })} className="flex-1" />
        {canDelete && <button type="button" aria-label="Hapus varian" onClick={onDelete} className="grid h-9 w-9 place-items-center text-muted-foreground transition active:scale-90"><Trash2 className="h-5 w-5" /></button>}
      </div>
      {active ? (
        <>
          <div className="border-b p-3">
            <div className="flex overflow-hidden rounded-lg border bg-muted/30">
              <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
                <span className="text-sm text-muted-foreground">Rp</span>
                <input inputMode="numeric" aria-label="Harga" value={v.price} onChange={(e) => onChange({ price: fmtThousands(e.target.value).slice(0, 15) })} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none" />
              </label>
              {v.lifetime ? (
                <span className="flex items-center gap-1.5 border-l px-4 text-sm font-semibold text-primary"><InfinityIcon className="h-4 w-4" /> Lifetime</span>
              ) : (
                <>
                  <input inputMode="numeric" aria-label="Durasi" value={v.duration_value} onChange={(e) => onChange({ duration_value: digits(e.target.value).slice(0, 4) })} className="w-20 border-l bg-transparent px-3 text-base outline-none" />
                  <select aria-label="Satuan durasi" value={v.duration_unit} onChange={(e) => onChange({ duration_unit: e.target.value as VariantDraft["duration_unit"] })} className="w-28 border-l bg-transparent px-3 text-base outline-none">
                    <option value="hari">Hari</option><option value="bulan">Bulan</option><option value="tahun">Tahun</option>
                  </select>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            <Chip on={v.lifetime} tone="primary" onClick={() => onChange({ lifetime: !v.lifetime })}><InfinityIcon className="h-4 w-4" /> Tanpa durasi</Chip>
            <Chip on={!!v.warranty} tone="success" onClick={() => onSheet("garansi")}><ShieldCheck className="h-4 w-4" /> {v.warranty ? warrantyLabel(v.warranty) : "Garansi"}</Chip>
            <Chip on={!!v.discount} tone="amber" onClick={() => onSheet("diskon")}><Percent className="h-4 w-4" /> {v.discount ? `Diskon ${v.discount.percent}%` : "Diskon"}</Chip>
            <Chip on={!!v.bonus} tone="purple" onClick={() => onSheet("bonus")}><Gift className="h-4 w-4" /> {v.bonus ? `Bonus ${v.bonus.buy}+${v.bonus.get}` : "Bonus"}</Chip>
          </div>
        </>
      ) : (
        <button type="button" onClick={onActivate} className="w-full px-4 py-3 text-left text-sm">
          <b>Rp {price.toLocaleString("id-ID")}</b> <span className="text-muted-foreground">{qty} · {v.lifetime ? "Lifetime" : v.duration_value ? `${v.duration_value} ${v.duration_unit}` : "-"}</span>
        </button>
      )}
    </div>
  );
}
