import { useState, type ReactNode, type InputHTMLAttributes } from "react";
import { AlertTriangle, Check, Folder, Search, Trash2, ShieldCheck, Percent, Gift, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SellerSheet } from "@/components/marketku/seller-ui";
import { digits, warrantyLabel, useCategories, childCategories, categoryPath, type Bonus, type Discount, type Warranty, type WarrantyMode } from "@/lib/products";
import { categoryIcon } from "@/lib/category-icons";

export const fieldCls =
  "w-full rounded-lg border bg-muted/40 px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary";

/** Input with a small label sitting on the top border once it has a value. */
export function FloatInput({ label, value, className = "", alwaysFloat, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; value: string; alwaysFloat?: boolean }) {
  const floated = alwaysFloat || value !== "";
  return (
    <div className={`relative ${className}`}>
      <input {...rest} value={value} placeholder={floated ? rest.placeholder : label} className={`${fieldCls} ${floated ? "text-base" : ""}`} />
      {floated && <span className="pointer-events-none absolute -top-2 left-3 bg-card px-1 text-[11px] font-medium leading-none text-primary">{label}</span>}
    </div>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return <p className="mb-2 text-sm font-semibold">{children}{required && <span className="text-destructive"> *</span>}</p>;
}

export function ErrorBox({ title, items }: { title?: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {title ? (
        <>
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> {title}</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-11">{items.map((e) => <li key={e}>{e}</li>)}</ul>
        </>
      ) : (
        <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {items[0]}</p>
      )}
    </div>
  );
}

function SheetFooter({ onDisable, onDone, canDisable }: { onDisable: () => void; onDone: () => void; canDisable: boolean }) {
  return (
    <>
      <button onClick={onDisable} disabled={!canDisable}
        className="flex items-center gap-2 rounded-lg bg-destructive/15 px-4 py-2.5 text-sm font-semibold text-destructive transition active:scale-95 disabled:opacity-50">
        <Trash2 className="h-4 w-4" /> Nonaktifkan
      </button>
      <button onClick={onDone} className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition active:scale-95">
        <Check className="h-4 w-4" /> Selesai
      </button>
    </>
  );
}

function Segmented<T extends string>({ value, options, onChange, activeCls }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; activeCls: string }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`rounded-lg border py-2.5 text-sm font-semibold transition active:scale-95 ${value === o.v ? activeCls : "bg-muted/30 text-foreground/80"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const num = (s: string) => Number(digits(s) || "0");

export function GaransiSheet({ open, onOpenChange, value, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; value: Warranty | null; onSave: (w: Warranty | null) => void }) {
  const [mode, setMode] = useState<WarrantyMode>(value?.mode ?? "hari");
  const [days, setDays] = useState(String(value?.days ?? 7));
  const [max, setMax] = useState(String(value?.max_claims ?? 0));
  const draft: Warranty = { mode, days: mode === "login" ? null : num(days), max_claims: num(max) };
  const done = () => {
    if (mode !== "login" && !(num(days) > 0)) { toast.error("Durasi garansi minimal 1 hari"); return; }
    onSave(draft); onOpenChange(false);
  };
  return (
    <SellerSheet open={open} onOpenChange={onOpenChange} title="Pengaturan Garansi"
      footer={<SheetFooter canDisable={!!value} onDisable={() => { onSave(null); onOpenChange(false); }} onDone={done} />}>
      <p className="flex items-center gap-2 font-semibold text-success"><ShieldCheck className="h-4 w-4" /> {warrantyLabel(draft)}</p>
      <p className="mb-2 mt-4 text-sm text-foreground/85">Mode garansi</p>
      <Segmented value={mode} onChange={setMode} activeCls="border-success/60 bg-success/15 text-success"
        options={[{ v: "hari", label: "Hari" }, { v: "login", label: "Login" }, { v: "backfree", label: "Backfree" }]} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-2 text-sm text-foreground/85">Durasi (hari)</p>
          {mode === "login"
            ? <input disabled placeholder="Hari" className={`${fieldCls} opacity-70`} />
            : <FloatInput label="Hari" alwaysFloat inputMode="numeric" value={days} onChange={(e) => setDays(digits(e.target.value).slice(0, 4))} />}
        </div>
        <div>
          <p className="mb-2 text-sm text-foreground/85">Maks klaim</p>
          <FloatInput label="0 = unlimited" alwaysFloat inputMode="numeric" value={max} onChange={(e) => setMax(digits(e.target.value).slice(0, 4))} />
        </div>
      </div>
      {mode === "login" && <p className="mt-4 text-sm text-success">Mode <b>Login</b>: garansi khusus kendala login akun.</p>}
      {mode === "backfree" && <p className="mt-4 text-sm text-success">Mode <b>Backfree</b>: berlaku penuh selama periode garansi.</p>}
      <p className="mt-4 text-sm text-muted-foreground">Maks klaim <b className="text-foreground">0</b> berarti tidak ada batas.</p>
    </SellerSheet>
  );
}

export function DiskonSheet({ open, onOpenChange, value, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; value: Discount | null; onSave: (d: Discount | null) => void }) {
  const [min, setMin] = useState(String(value?.min_order ?? 1));
  const [kind, setKind] = useState<Discount["kind"]>(value?.kind ?? "reguler");
  const [pct, setPct] = useState(value ? String(value.percent) : "");
  const [max, setMax] = useState(String(value?.max_per_user ?? 0));
  const done = () => {
    if (!(num(min) > 0)) { toast.error("Minimum pesanan minimal 1"); return; }
    if (!(num(pct) >= 1 && num(pct) <= 90)) { toast.error("Diskon harus 1–90%"); return; }
    onSave({ min_order: num(min), kind, percent: num(pct), max_per_user: num(max) }); onOpenChange(false);
  };
  return (
    <SellerSheet open={open} onOpenChange={onOpenChange} title="Pengaturan Diskon"
      footer={<SheetFooter canDisable={!!value} onDisable={() => { onSave(null); onOpenChange(false); }} onDone={done} />}>
      <p className="flex items-center gap-2 font-semibold text-tone-amber"><Percent className="h-4 w-4" /> Diskon</p>
      <p className="mb-2 mt-4 text-sm text-foreground/85">Minimum pesanan (wajib)</p>
      <input inputMode="numeric" value={min} onChange={(e) => setMin(digits(e.target.value).slice(0, 5))} className={`${fieldCls} text-base`} />
      <div className="mt-4">
        <Segmented value={kind} onChange={setKind} activeCls="border-tone-amber/60 bg-tone-amber/15 text-tone-amber"
          options={[{ v: "reguler", label: "Reguler" }, { v: "bulk", label: "Bulk" }]} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-2 text-sm text-foreground/85">Diskon (%)</p>
          <input inputMode="numeric" placeholder="Mis. 10" value={pct} onChange={(e) => setPct(digits(e.target.value).slice(0, 2))} className={fieldCls} />
        </div>
        <div>
          <p className="mb-2 text-sm text-foreground/85">Maks per user</p>
          <FloatInput label="0 = unlimited" alwaysFloat inputMode="numeric" value={max} onChange={(e) => setMax(digits(e.target.value).slice(0, 4))} />
        </div>
      </div>
    </SellerSheet>
  );
}

export function BonusSheet({ open, onOpenChange, value, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; value: Bonus | null; onSave: (b: Bonus | null) => void }) {
  const [buy, setBuy] = useState(String(value?.buy ?? 10));
  const [get, setGet] = useState(String(value?.get ?? 1));
  const done = () => {
    if (!(num(buy) > 0 && num(get) > 0)) { toast.error("Isi jumlah beli dan bonus"); return; }
    onSave({ buy: num(buy), get: num(get) }); onOpenChange(false);
  };
  return (
    <SellerSheet open={open} onOpenChange={onOpenChange} title="Pengaturan Bonus"
      footer={<SheetFooter canDisable={!!value} onDisable={() => { onSave(null); onOpenChange(false); }} onDone={done} />}>
      <p className="flex items-center gap-2 font-semibold text-tone-purple"><Gift className="h-4 w-4" /> Bonus — Beli X dapat Y</p>
      <div className="mt-4 flex items-end gap-3">
        <div className="flex-1"><p className="mb-2 text-sm text-foreground/85">Beli</p>
          <input inputMode="numeric" value={buy} onChange={(e) => setBuy(digits(e.target.value).slice(0, 4))} className={`${fieldCls} text-base`} /></div>
        <span className="pb-3 text-muted-foreground">→</span>
        <div className="flex-1"><p className="mb-2 text-sm text-foreground/85">Dapat</p>
          <input inputMode="numeric" value={get} onChange={(e) => setGet(digits(e.target.value).slice(0, 4))} className={`${fieldCls} text-base`} /></div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Contoh: beli {num(buy) || "X"} pcs, pembeli dapat {num(get) || "Y"} pcs tambahan gratis.</p>
    </SellerSheet>
  );
}

export function KategoriSheet({ open, onOpenChange, value, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; value: string | null; onPick: (id: string) => void }) {
  const cats = useCategories();
  const all = cats.data ?? [];
  const [q, setQ] = useState("");
  const [parent, setParent] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const path = categoryPath(all, parent);
  const kids = (id: string) => all.filter((c) => c.parent_id === id).length;
  const list = term
    ? all.filter((c) => c.name.toLowerCase().includes(term)).sort((a, b) => a.name.localeCompare(b.name, "id"))
    : childCategories(all, parent);
  const choose = (id: string) => {
    if (kids(id) > 0) { setParent(id); setQ(""); return; }
    onPick(id); onOpenChange(false);
  };
  return (
    <SellerSheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setQ(""); setParent(null); } }} title="Pilih kategori produk">
      <div className="flex items-center rounded-lg border bg-muted/30">
        <Search className="mx-3 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kategori" className="min-w-0 flex-1 border-l bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      <nav aria-label="Jalur kategori" className="mt-4 flex flex-wrap items-center gap-1 border-b-2 border-foreground/20 pb-3 pl-2 text-sm">
        <button type="button" onClick={() => { setParent(null); setQ(""); }} className={path.length ? "font-medium text-primary" : "font-semibold text-primary"}>Kategori</button>
        {path.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            {i === path.length - 1
              ? <span className="text-foreground">{c.name}</span>
              : <button type="button" onClick={() => setParent(c.id)} className="text-foreground/85">{c.name}</button>}
          </span>
        ))}
      </nav>
      <div key={`${parent}-${term}`} className="mk-fade-in mt-3 max-h-[52vh] overflow-y-auto rounded-xl border">
        {cats.isLoading && <div className="grid place-items-center p-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!cats.isLoading && list.length === 0 && <p className="p-4 text-sm text-muted-foreground">Kategori tidak ditemukan.</p>}
        {list.map((c) => {
          const n = kids(c.id);
          const img = categoryIcon(c.name);
          return (
            <button type="button" key={c.id} onClick={() => choose(c.id)}
              className={`flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 transition active:bg-accent ${value === c.id ? "bg-primary/10" : ""}`}>
              {img
                ? <img src={img} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border bg-background/50"><Folder className="h-5 w-5" strokeWidth={1.6} /></span>}
              <span className="min-w-0 flex-1 truncate font-semibold">
                {c.name}
                {term && c.parent_id && <span className="block truncate text-xs font-normal text-muted-foreground">{categoryPath(all, c.parent_id).map((p) => p.name).join(" › ")}</span>}
              </span>
              {value === c.id && <Check className="h-4 w-4 text-primary" />}
              {n > 0 && <><span className="text-sm text-muted-foreground">{n}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></>}
            </button>
          );
        })}
      </div>
    </SellerSheet>
  );
}
