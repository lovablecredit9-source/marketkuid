import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings, X, Search, Store, User, Lock, Landmark, Link2, MonitorSmartphone, KeyRound, RotateCcw, Save, Bell,
  CircleCheck, AlertTriangle, Send, Phone, Camera, ImagePlus, Trash2, Mail, Loader2,
} from "lucide-react";
import { uploadStoreImage, useImageUrls } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSellerStore } from "@/lib/seller";
import { pageMeta } from "@/lib/meta";
import { passwordRules, slugify, validateBank, validateStoreProfile } from "@/lib/seller-settings";
import { SellerCard, SellerInput } from "@/components/marketku/seller-ui";

const TABS = [
  { key: "profil", label: "Profil Toko", icon: Store },
  { key: "akun", label: "Informasi Akun", icon: User },
  { key: "keamanan", label: "Keamanan", icon: Lock },
  { key: "keuangan", label: "Keuangan", icon: Landmark },
  { key: "koneksi", label: "Koneksi", icon: Link2 },
  { key: "sesi", label: "Sesi", icon: MonitorSmartphone },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export const Route = createFileRoute("/seller/pengaturan")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } =>
    TABS.some((t) => t.key === s['tab']) ? { tab: s['tab'] as TabKey } : {},
  head: () => pageMeta("Pengaturan Seller — Marketku", "Atur profil toko, akun, keamanan, rekening, dan koneksi."),
  component: Pengaturan,
});

function Pengaturan() {
  const { tab = "profil" } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const tabs = TABS.filter((t) => !q.trim() || t.label.toLowerCase().includes(q.trim().toLowerCase()));
  const go = (t: TabKey) => navigate({ to: "/seller/pengaturan", search: { tab: t }, replace: true });

  return (
    <>
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="flex-1 text-lg font-bold">Pengaturan Seller</h2>
        <button aria-label="Tutup" onClick={() => navigate({ to: "/seller" })} className="grid h-10 w-10 place-items-center rounded-xl border bg-card"><X className="h-5 w-5" /></button>
      </div>
      <label className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pengaturan" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
      </label>
      <div className="-mx-3 flex gap-1 overflow-x-auto px-3">
        {tabs.map(({ key, label, icon: I }) => (
          <button key={key} onClick={() => go(key)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${tab === key ? "bg-primary text-primary-foreground" : "text-foreground/80"}`}>
            <I className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "profil" && <ProfilToko />}
      {tab === "akun" && <InfoAkun />}
      {tab === "keamanan" && <Keamanan />}
      {tab === "keuangan" && <Keuangan />}
      {tab === "koneksi" && <Koneksi />}
      {tab === "sesi" && <Sesi />}
    </>
  );
}

function Head({ title, desc }: { title: string; desc: string }) {
  return <div className="pt-2"><h3 className="text-lg font-bold">{title}</h3><p className="text-sm text-muted-foreground">{desc}</p></div>;
}
function Labeled({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-primary">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function useStore() {
  const { user } = useAuth();
  const store = useSellerStore(user?.id);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["seller_store", user?.id] });
  return { user, store: store.data, refresh };
}

function ProfilToko() {
  const { user, store, refresh } = useStore();
  const init = () => ({
    store_name: store?.store_name ?? "", slug: store?.slug || slugify(store?.store_name ?? ""), description: store?.description ?? "",
    contact_name: store?.contact_name ?? "", contact_phone: store?.contact_phone ?? "", telegram_username: store?.telegram_username ?? "",
  });
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF(init()); }, [store?.owner_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const errs = validateStoreProfile(f);
    if (errs.length) { toast.error(errs[0]); return; }
    setSaving(true);
    const { error } = await supabase.from("seller_stores").update({
      store_name: f.store_name.trim(), slug: f.slug, description: f.description.trim() || null,
      contact_name: f.contact_name.trim() || null, contact_phone: f.contact_phone.trim() || null,
      telegram_username: f.telegram_username.replace(/^@/, "").trim() || null,
    }).eq("owner_id", user!.id);
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "Slug toko sudah dipakai toko lain" : "Gagal menyimpan profil"); return; }
    toast.success("Profil toko disimpan");
    void refresh();
  };
  const media = useStoreMediaEditor(user?.id ?? "", store?.avatar_path ?? null, store?.banner_path ?? null, refresh);
  if (!store) return null;
  const busy = media.busy;
  return (
    <>
      <div className="flex items-start gap-3 pt-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-card text-primary"><User className="h-5 w-5" /></span>
        <div><h3 className="text-xl font-bold leading-tight">Profil Seller</h3><p className="text-sm text-muted-foreground">Identitas, kontak, media, dan notifikasi toko.</p></div>
      </div>
      <SellerCard className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          <label aria-label="Ganti foto profil toko" className={`group relative grid h-24 w-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border bg-background transition active:scale-95 ${busy ? "pointer-events-none" : ""}`}>
            {media.avatarUrl ? <img src={media.avatarUrl} alt="Foto profil toko" className="h-full w-full object-cover" /> : <User className="h-7 w-7 text-muted-foreground" />}
            <span className={`absolute inset-0 grid place-items-center bg-background/70 transition ${busy === "avatar" ? "opacity-100" : "opacity-0 group-active:opacity-100"}`}>
              {busy === "avatar" ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Camera className="h-6 w-6" />}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={media.pick("avatar")} />
          </label>
          <div className="min-w-0">
            <p className="truncate font-bold uppercase">{store.store_name}</p>
            {store.telegram_username && <p className="truncate text-muted-foreground">@{store.telegram_username}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">Aktif</span>
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{store.is_open ? "Toko buka" : "Toko tutup"}</span>
              <span className="text-sm text-muted-foreground">Klik foto untuk ganti</span>
            </div>
            {store.avatar_path && <button disabled={!!busy} onClick={() => void media.replace("avatar", null)} className="mt-1 text-xs font-semibold text-destructive disabled:opacity-60">Hapus foto profil</button>}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-foreground/80">Foto Banner Toko</p>
          <div className="relative">
            <label className={`relative grid aspect-[3/1] min-h-32 w-full cursor-pointer place-items-center overflow-hidden rounded-xl border bg-background transition active:scale-[0.99] ${busy ? "pointer-events-none" : ""}`}>
              {media.bannerUrl
                ? <img src={media.bannerUrl} alt="Banner toko" className="h-full w-full object-cover" />
                : <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground"><ImagePlus className="h-7 w-7" />Klik untuk upload banner toko</span>}
              {busy === "banner" && <span className="absolute inset-0 grid place-items-center bg-background/70"><Loader2 className="h-6 w-6 animate-spin text-primary" /></span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={media.pick("banner")} />
            </label>
            {store.banner_path && <button aria-label="Hapus banner" disabled={!!busy} onClick={() => void media.replace("banner", null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-background/80 text-destructive backdrop-blur disabled:opacity-60"><Trash2 className="h-4 w-4" /></button>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Rekomendasi 1200×400px untuk tampilan toko marketku.id</p>
        </div>

        <p className="pt-1 text-sm font-semibold tracking-wide text-muted-foreground">IDENTITAS</p>
        <FloatField label="Nama Toko *" value={f.store_name} maxLength={40} onChange={(v) => set("store_name", v)} />
        <div>
          <FloatField label="Slug Toko" value={f.slug} maxLength={40} onChange={(v) => set("slug", slugify(v, true))} />
          <p className="mt-1 text-xs text-muted-foreground">marketku.id/{f.slug || "slug-toko"}</p>
        </div>
        <FloatField label="Deskripsi Toko" textarea value={f.description} maxLength={500} onChange={(v) => set("description", v)} />

        <p className="pt-1 text-sm font-semibold tracking-wide text-muted-foreground">KONTAK <span className="font-normal">(opsional)</span></p>
        <FloatField icon={User} label="Nama Kontak (opsional)" value={f.contact_name} maxLength={60} onChange={(v) => set("contact_name", v)} />
        <FloatField icon={Phone} label="No. WhatsApp / Telepon (opsional)" inputMode="tel" value={f.contact_phone} onChange={(v) => set("contact_phone", v.replace(/[^\d]/g, ""))} />
        <FloatField icon={Mail} label="Username Telegram" value={f.telegram_username} onChange={(v) => set("telegram_username", v.replace(/[^A-Za-z0-9_@]/g, ""))} />
        <div className="rounded-xl border bg-background p-4 text-sm"><b className="block">Kontak bersifat opsional</b><span className="mt-1 block leading-relaxed text-muted-foreground">Jika diisi, gunakan awalan 628xxxx agar admin dapat menghubungi kamu.</span></div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button onClick={() => setF(init())} className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm font-semibold text-muted-foreground transition active:scale-95"><RotateCcw className="h-4 w-4" /> Reset</button>
          <button disabled={saving} onClick={() => void save()} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Profil"}</button>
        </div>
      </SellerCard>
    </>
  );
}

function FloatField({ label, value, onChange, icon: I, textarea, maxLength, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; icon?: typeof User; textarea?: boolean; maxLength?: number; inputMode?: "tel" | "text";
}) {
  const pad = I ? "pl-12" : "pl-5";
  const field = `peer w-full rounded-xl border bg-transparent ${pad} pr-4 text-base outline-none transition focus:border-primary [&:not(:placeholder-shown)]:border-primary`;
  const float = "peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-primary";
  return (
    <label className="relative block">
      {textarea
        ? <textarea placeholder=" " rows={3} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} className={`${field} resize-y py-4`} />
        : <input placeholder=" " value={value} maxLength={maxLength} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} className={`${field} h-14`} />}
      {I && <I className={`pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground ${textarea ? "top-4" : "top-1/2 -translate-y-1/2"}`} />}
      <span className={`pointer-events-none absolute max-w-[calc(100%-4rem)] -translate-y-1/2 truncate whitespace-nowrap ${I ? "left-11" : "left-4"} bg-card px-1 text-[15px] text-muted-foreground transition-all ${textarea ? "top-6" : "top-1/2"} ${float}`}>{label}</span>
    </label>
  );
}

function useStoreMediaEditor(userId: string, avatar: string | null, banner: string | null, onChanged: () => unknown) {
  const urls = useImageUrls([avatar ?? "", banner ?? ""]);
  const [busy, setBusy] = useState<"avatar" | "banner" | null>(null);

  const replace = async (kind: "avatar" | "banner", file: File | null) => {
    if (!userId) return;
    const old = kind === "avatar" ? avatar : banner;
    setBusy(kind);
    try {
      const path = file ? await uploadStoreImage(userId, file, kind) : null;
      const { error } = await supabase.from("seller_stores").update(kind === "avatar" ? { avatar_path: path } : { banner_path: path }).eq("owner_id", userId);
      if (error) {
        if (path) await supabase.storage.from("product-images").remove([path]);
        throw new Error("Gagal menyimpan foto");
      }
      if (old) await supabase.storage.from("product-images").remove([old]);
      toast.success(file ? (kind === "avatar" ? "Foto profil toko diperbarui" : "Banner toko diperbarui") : "Foto dihapus");
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah foto");
    } finally {
      setBusy(null);
    }
  };
  const pick = (kind: "avatar" | "banner") => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (f) void replace(kind, f);
  };
  return { busy, replace, pick, avatarUrl: avatar ? urls.data?.[avatar] : undefined, bannerUrl: banner ? urls.data?.[banner] : undefined };
}

function InfoAkun() {
  const { user, store } = useStore();
  const profile = useQuery({
    queryKey: ["profile", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("full_name, username, created_at").eq("id", user!.id).maybeSingle()).data,
  });
  const rows: [string, string][] = [
    ["Email", user?.email ?? "-"],
    ["Username", profile.data?.username ?? "-"],
    ["Bergabung", new Date(profile.data?.created_at ?? user?.created_at ?? Date.now()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
    ["Slug Toko", store?.slug ? `/${store.slug}` : "Belum diatur"],
  ];
  return (
    <>
      <Head title="Informasi Akun" desc="Email dan username" />
      <div className="divide-y">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-4"><span className="text-foreground/80">{k}</span><span className="truncate font-medium">{v}</span></div>)}
      </div>
    </>
  );
}

function Keamanan() {
  const { user } = useStore();
  const [f, setF] = useState({ old: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const rules = passwordRules(f.old, f.next, f.confirm);
  const save = async () => {
    if (!rules.every((r) => r.ok)) { toast.error("Password baru belum memenuhi syarat"); return; }
    setSaving(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: f.old });
    if (authErr) { setSaving(false); toast.error("Password lama salah"); return; }
    const { error } = await supabase.auth.updateUser({ password: f.next });
    setSaving(false);
    if (error) { toast.error("Gagal mengganti password"); return; }
    toast.success("Password berhasil diganti");
    setF({ old: "", next: "", confirm: "" });
  };
  return (
    <>
      <Head title="Keamanan Akun" desc="Password akun" />
      <p className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Ganti Password</p>
      <SellerInput type="password" autoComplete="current-password" value={f.old} onChange={(e) => setF({ ...f, old: e.target.value })} placeholder="Password Lama" />
      <SellerInput type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} placeholder="Password Baru" />
      <ul className="space-y-1 text-xs">
        {rules.map((r) => <li key={r.label} className={r.ok ? "text-success" : "text-muted-foreground"}>• {r.label}</li>)}
      </ul>
      <SellerInput type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} placeholder="Konfirmasi Password Baru" />
      <div className="flex justify-end">
        <button disabled={saving} onClick={() => void save()} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60">{saving ? "Menyimpan..." : "Simpan Password"}</button>
      </div>
    </>
  );
}

const PROVIDERS = { bank: ["BCA", "BRI", "BNI", "Mandiri", "BSI", "CIMB Niaga", "Permata"], ewallet: ["DANA", "OVO", "GoPay", "ShopeePay", "LinkAja"] } as const;

function Keuangan() {
  const { user, store, refresh } = useStore();
  const locked = !!store?.bank_number;
  const [f, setF] = useState({ type: "ewallet" as "bank" | "ewallet", provider: "DANA", number: "", holder: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (store?.bank_number) setF({ type: (store.bank_type as "bank" | "ewallet") ?? "bank", provider: store.bank_provider ?? "", number: store.bank_number, holder: store.bank_holder ?? "" });
  }, [store?.bank_number]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const errs = validateBank(f);
    if (errs.length) { toast.error(errs[0]); return; }
    setSaving(true);
    const { error } = await supabase.from("seller_stores").update({ bank_type: f.type, bank_provider: f.provider, bank_number: f.number, bank_holder: f.holder.trim() }).eq("owner_id", user!.id);
    setSaving(false);
    if (error) { toast.error(error.message.includes("admin") ? "Rekening hanya bisa diubah melalui admin" : "Gagal menyimpan rekening"); return; }
    toast.success("Rekening disimpan");
    void refresh();
  };
  const sel = "w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-70";
  return (
    <>
      <Head title="Data Rekening" desc="Rekening pencairan" />
      <Labeled label="Jenis rekening">
        <select disabled={locked} value={f.type} onChange={(e) => { const t = e.target.value as "bank" | "ewallet"; setF({ ...f, type: t, provider: PROVIDERS[t][0] }); }} className={sel}>
          <option value="bank">Bank</option><option value="ewallet">E-wallet</option>
        </select>
      </Labeled>
      <Labeled label={f.type === "bank" ? "Nama bank" : "Provider e-wallet"}>
        <select disabled={locked} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} className={sel}>
          {PROVIDERS[f.type].map((p) => <option key={p}>{p}</option>)}
        </select>
      </Labeled>
      <Labeled label={f.type === "bank" ? "Nomor rekening" : "Nomor e-wallet"}><SellerInput disabled={locked} inputMode="numeric" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value.replace(/\D/g, "").slice(0, 20) })} /></Labeled>
      <Labeled label="Nama sesuai rekening"><SellerInput disabled={locked} value={f.holder} maxLength={60} onChange={(e) => setF({ ...f, holder: e.target.value })} /></Labeled>
      <div className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {locked ? "Rekening sudah tersimpan. Untuk mengubahnya, hubungi admin." : "Pastikan data benar. Setelah disimpan, rekening hanya dapat diubah melalui admin."}
      </div>
      {!locked && <button disabled={saving} onClick={() => void save()} className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60">{saving ? "Menyimpan..." : "Simpan Rekening"}</button>}
    </>
  );
}

function Koneksi() {
  const { user, store, refresh } = useStore();
  const toggle = async () => {
    const { error } = await supabase.from("seller_stores").update({ notify_orders: !store?.notify_orders }).eq("owner_id", user!.id);
    if (error) { toast.error("Gagal menyimpan"); return; }
    void refresh();
  };
  if (!store) return null;
  return (
    <>
      <Head title="Koneksi" desc="Telegram dan WhatsApp" />
      <SellerCard className={`flex items-center gap-3 p-4 ${store.telegram_username ? "border-success/40 bg-success/10" : ""}`}>
        <span className={`grid h-10 w-10 place-items-center rounded-lg ${store.telegram_username ? "bg-success/15 text-success" : "bg-accent text-primary"}`}>{store.telegram_username ? <CircleCheck className="h-5 w-5" /> : <Send className="h-5 w-5" />}</span>
        <div>
          <p className={`font-semibold ${store.telegram_username ? "text-success" : ""}`}>{store.telegram_username ? "Username Telegram tersimpan" : "Telegram belum diisi"}</p>
          <p className="text-sm text-muted-foreground">{store.telegram_username ? `@${store.telegram_username}` : "Isi username Telegram di tab Profil Toko"}</p>
        </div>
      </SellerCard>
      <SellerCard className="flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary"><Phone className="h-5 w-5" /></span>
        <div><p className="font-semibold">WhatsApp kontak</p><p className="text-sm text-muted-foreground">{store.contact_phone || "Belum diisi"}</p></div>
      </SellerCard>
      <SellerCard className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border"><Bell className="h-5 w-5" /></span>
          <p className="flex-1 font-semibold">Notif pesanan masuk</p>
          <button role="switch" aria-checked={store.notify_orders} aria-label="Notif pesanan masuk" onClick={() => void toggle()}
            className={`flex h-7 w-12 items-center rounded-full p-0.5 transition ${store.notify_orders ? "bg-primary" : "bg-muted"}`}>
            <span className={`h-6 w-6 rounded-full bg-card transition ${store.notify_orders ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Saat aktif, kamu dapat notif setiap ada pesanan baru. Matikan kalau merasa terganggu.</p>
        <p className="mt-2 flex gap-1 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Pesanan tipe pre-order dan dispute tetap dikirim meski toggle ini mati, untuk mencegah delay penting.</p>
      </SellerCard>
    </>
  );
}

function Sesi() {
  const [device, setDevice] = useState("Perangkat ini");
  useEffect(() => {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
    setDevice(`${browser}${os ? ` di ${os}` : ""}`);
  }, []);
  return (
    <>
      <Head title="Sesi" desc="Perangkat yang login" />
      <SellerCard className="flex gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border"><MonitorSmartphone className="h-5 w-5" /></span>
        <div>
          <p className="font-semibold">{device} <span className="ml-1 text-xs font-normal text-success">Saat ini</span></p>
          <p className="text-xs text-muted-foreground">Aktif sekarang</p>
        </div>
      </SellerCard>
      <p className="text-xs text-muted-foreground">Keluar dari menu profil untuk mengakhiri sesi di perangkat ini.</p>
    </>
  );
}
