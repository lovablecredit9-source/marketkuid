import { useEffect, useMemo, useState } from "react";
import { Award, Calculator, Check, Copy, Crown, Flame, Heart, ListTodo, Lock, MessageSquareText, PieChart, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { rpSeller, SellerCard } from "@/components/marketku/seller-ui";
import { SELLER_FEE_PERCENT } from "@/components/marketku/seller-holds";
import { parseRupiah } from "@/lib/seller-insights";
import { achievements, loyalBuyers, peakTimes, profitCalc, promoCaption, statusBreakdown, WEEKDAYS } from "@/lib/seller-growth";

type O = Parameters<typeof loyalBuyers>[0][number];

/* ---------- Pencapaian ---------- */
export function Achievements(props: Parameters<typeof achievements>[0]) {
  const list = achievements(props);
  const done = list.filter((a) => a.done).length;
  return (
    <SellerCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Award className="h-4 w-4 text-warning" /> Pencapaian Toko</h3>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">{done}/{list.length}</span>
      </div>
      <div className="seller-ach-scroll flex gap-2.5 overflow-x-auto p-3">
        {list.map((a, i) => (
          <div key={a.key} style={{ animationDelay: `${i * 60}ms` }}
            className={`seller-ach relative w-[128px] shrink-0 overflow-hidden rounded-xl border p-3 ${a.done ? "seller-ach--done" : "bg-background/40"}`}>
            <span className={`grid h-9 w-9 place-items-center rounded-full ${a.done ? "seller-ach-medal" : "bg-muted text-muted-foreground"}`}>
              {a.done ? <Crown className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </span>
            <p className="mt-2 truncate text-[12.5px] font-semibold">{a.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{a.desc}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${a.done ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.round((a.current / a.goal) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </SellerCard>
  );
}

/* ---------- Status + jam ramai ---------- */
const SEG = [
  { k: "selesai", label: "Selesai", cls: "bg-success" },
  { k: "proses", label: "Diproses", cls: "bg-primary" },
  { k: "menunggu", label: "Menunggu bayar", cls: "bg-warning" },
  { k: "batal", label: "Batal/gagal", cls: "bg-destructive" },
] as const;

export function OrderInsights({ orders }: { orders: O[] }) {
  const s = statusBreakdown(orders);
  const p = peakTimes(orders);
  const maxH = Math.max(1, ...p.hours);
  const maxD = Math.max(1, ...p.days);
  return (
    <SellerCard className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><PieChart className="h-4 w-4 text-primary" /> Status Pesanan</h3>
      {s.total === 0 ? <p className="mt-2 text-xs text-muted-foreground">Belum ada pesanan. Grafik akan terisi otomatis saat pesanan masuk.</p> : (
        <>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {SEG.map((g) => s[g.k] > 0 && <span key={g.k} className={`${g.cls} seller-grow h-full`} style={{ width: `${(s[g.k] / s.total) * 100}%` }} />)}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {SEG.map((g) => (
              <span key={g.k} className="flex items-center gap-1.5 text-[11.5px]">
                <span className={`h-2 w-2 rounded-full ${g.cls}`} /> <span className="text-muted-foreground">{g.label}</span>
                <span className="ml-auto font-semibold tabular-nums">{s[g.k]}</span>
              </span>
            ))}
          </div>
        </>
      )}

      <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-warning" /> Jam & Hari Ramai</h3>
      {p.total === 0 ? <p className="mt-2 text-xs text-muted-foreground">Muncul setelah ada pesanan yang dibayar. Berguna untuk tahu kapan waktu terbaik promosi.</p> : (
        <>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Paling ramai jam <b className="text-foreground">{String(p.bestHour).padStart(2, "0")}.00–{String(((p.bestHour ?? 0) + 1) % 24).padStart(2, "0")}.00</b> dan hari <b className="text-foreground">{WEEKDAYS[p.bestDay ?? 0]}</b>. Kirim promo sedikit sebelum jam itu.
          </p>
          <div className="mt-3 flex h-16 items-end gap-[2px]" aria-label="Pesanan per jam">
            {p.hours.map((v, h) => (
              <span key={h} title={`${h}.00 · ${v} pesanan`} className={`seller-grow-y flex-1 rounded-t ${h === p.bestHour ? "bg-warning" : v ? "bg-primary/60" : "bg-muted"}`}
                style={{ height: `${Math.max(6, (v / maxH) * 100)}%`, animationDelay: `${h * 15}ms` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {p.days.map((v, d) => (
              <div key={d} className="text-center">
                <div className="flex h-10 items-end overflow-hidden rounded-md bg-muted/60">
                  <span className={`seller-grow-y w-full ${d === p.bestDay ? "bg-warning" : "bg-primary/50"}`} style={{ height: `${(v / maxD) * 100}%` }} />
                </div>
                <span className="mt-1 block text-[10px] text-muted-foreground">{WEEKDAYS[d]!.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </SellerCard>
  );
}

/* ---------- Pelanggan setia ---------- */
export function LoyalBuyers({ orders }: { orders: O[] }) {
  const list = loyalBuyers(orders);
  return (
    <SellerCard>
      <div className="border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Heart className="h-4 w-4 text-destructive" /> Pelanggan Setia</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Pembeli yang sudah belanja 2 kali atau lebih.</p>
      </div>
      {list.length === 0 ? <p className="px-4 py-4 text-xs text-muted-foreground">Belum ada pembeli yang belanja lagi. Coba beri voucher khusus untuk pembeli lama.</p> : (
        <div className="divide-y">
          {list.map((b, i) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? "seller-ach-medal" : "bg-primary/15 text-primary"}`}>{b.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{b.name}</span>
                <span className="block text-[11px] text-muted-foreground">{b.orders} pesanan · terakhir {new Date(b.last).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{rpSeller(b.spend)}</span>
            </div>
          ))}
        </div>
      )}
    </SellerCard>
  );
}

/* ---------- Alat jualan (kalkulator, caption, catatan) ---------- */
type Prod = { id: string; name: string; slug: string | null; status: string; product_variants?: { price: number }[] | null };
type Tab = "hitung" | "caption" | "catatan";
const TABS: { k: Tab; label: string; icon: typeof Calculator }[] = [
  { k: "hitung", label: "Hitung Untung", icon: Calculator },
  { k: "caption", label: "Caption Promo", icon: MessageSquareText },
  { k: "catatan", label: "Catatan", icon: ListTodo },
];

export function SellerTools({ uid, store, products }: { uid: string; store: { store_name: string; slug: string | null; owner_id: string }; products: Prod[] }) {
  const [tab, setTab] = useState<Tab>("hitung");
  const idx = TABS.findIndex((t) => t.k === tab);
  return (
    <SellerCard className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Alat Jualan</h3>
      </div>
      <div className="relative m-3 grid grid-cols-3 rounded-xl bg-muted/60 p-1">
        <span className="seller-tab-pill absolute inset-y-1 left-1 rounded-lg" style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${idx * 100}%)` }} />
        {TABS.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)}
            className={`relative z-10 flex items-center justify-center gap-1 rounded-lg py-2 text-[11.5px] font-semibold transition-colors ${tab === t.k ? "text-primary-foreground" : "text-muted-foreground"}`}>
            <t.icon className="h-3.5 w-3.5" /> <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>
      <div key={tab} className="seller-fade px-4 pb-4">
        {tab === "hitung" && <ProfitTool />}
        {tab === "caption" && <CaptionTool store={store} products={products} />}
        {tab === "catatan" && <NotesTool uid={uid} />}
      </div>
    </SellerCard>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center rounded-xl border bg-background px-3 focus-within:border-primary">
        <span className="text-xs text-muted-foreground">Rp</span>
        <input inputMode="numeric" value={value ? value.toLocaleString("id-ID") : ""} onChange={(e) => onChange(parseRupiah(e.target.value))} placeholder="0" className="w-full bg-transparent px-2 py-2.5 text-sm outline-none" />
      </div>
    </label>
  );
}

function ProfitTool() {
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const r = profitCalc(price, cost, SELLER_FEE_PERCENT);
  const row = (k: string, v: string, cls = "") => <div className="flex justify-between text-xs"><span className="text-muted-foreground">{k}</span><span className={`font-semibold tabular-nums ${cls}`}>{v}</span></div>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <MoneyInput label="Harga jual" value={price} onChange={setPrice} />
        <MoneyInput label="Modal per item" value={cost} onChange={setCost} />
      </div>
      <div className="mt-3 space-y-1.5 rounded-xl border bg-background/40 p-3">
        {row(`Potongan admin ${SELLER_FEE_PERCENT}%`, `−${rpSeller(r.fee)}`, "text-destructive")}
        {row("Kamu terima", rpSeller(r.received))}
        <div className="my-1 border-t" />
        {row("Untung bersih", rpSeller(r.profit), r.profit >= 0 ? "text-success" : "text-destructive")}
        {row("Margin", `${r.margin}%`, r.profit >= 0 ? "text-success" : "text-destructive")}
      </div>
      {price > 0 && r.profit < 0 && <p className="mt-2 text-[11px] text-destructive">Harga ini rugi. Naikkan harga jual atau turunkan modal.</p>}
    </div>
  );
}

function CaptionTool({ store, products }: { store: { store_name: string; slug: string | null; owner_id: string }; products: Prod[] }) {
  const list = products.filter((p) => p.status === "active");
  const [pid, setPid] = useState(list[0]?.id ?? "");
  const [tone, setTone] = useState<"santai" | "promo" | "singkat">("promo");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const p = list.find((x) => x.id === pid) ?? list[0];
  const text = useMemo(() => {
    if (!p) return "";
    const price = Math.min(...(p.product_variants ?? []).map((v) => Number(v.price)).filter((n) => n > 0), Infinity);
    const toko = store.slug ?? store.owner_id;
    const url = p.slug ? `${origin}/produk/${toko}/${p.slug}` : `${origin}/produk/${p.id}`;
    return promoCaption({ name: p.name, price: Number.isFinite(price) ? price : 0, store: store.store_name, url, tone });
  }, [p, tone, origin, store]);
  if (!list.length) return <p className="text-xs text-muted-foreground">Tambah produk aktif dulu untuk membuat caption promosi.</p>;
  const copy = async () => { await navigator.clipboard.writeText(text); toast.success("Caption disalin"); };
  return (
    <div>
      <select value={p?.id} onChange={(e) => setPid(e.target.value)} aria-label="Pilih produk" className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
        {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <div className="mt-2 flex gap-1.5">
        {(["promo", "santai", "singkat"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTone(t)} className={`seller-tap rounded-full border px-3 py-1 text-[11.5px] font-medium capitalize ${tone === t ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border bg-background/40 p-3 font-sans text-[12px] leading-relaxed">{text}</pre>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => void copy()} className="seller-tap flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground"><Copy className="h-3.5 w-3.5" /> Salin</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="seller-tap flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold"><MessageSquareText className="h-3.5 w-3.5 text-success" /> WhatsApp</a>
        <a href={`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="seller-tap flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold"><Send className="h-3.5 w-3.5 text-primary" /> Telegram</a>
      </div>
    </div>
  );
}

type Note = { id: string; text: string; done: boolean };
const notesKey = (uid: string) => `mk_seller_notes_${uid}`;

function NotesTool({ uid }: { uid: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    try { setNotes(JSON.parse(window.localStorage.getItem(notesKey(uid)) ?? "[]")); } catch { setNotes([]); }
  }, [uid]);
  const save = (n: Note[]) => { setNotes(n); window.localStorage.setItem(notesKey(uid), JSON.stringify(n)); };
  const add = () => {
    const t = draft.trim(); if (!t) return;
    save([{ id: crypto.randomUUID(), text: t.slice(0, 140), done: false }, ...notes].slice(0, 30)); setDraft("");
  };
  const left = notes.filter((n) => !n.done).length;
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="contoh: restock akun Netflix" aria-label="Catatan baru" className="flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        <button aria-label="Tambah catatan" className="seller-tap grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </form>
      {notes.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Catat tugas toko kamu di sini. Hanya tersimpan di perangkat ini.</p> : (
        <>
          <p className="mt-3 text-[11px] text-muted-foreground">{left} tugas belum selesai</p>
          <ul className="mt-1.5 space-y-1.5">
            {notes.map((n) => (
              <li key={n.id} className="seller-fade flex items-center gap-2 rounded-xl border bg-background/40 px-2.5 py-2">
                <button type="button" aria-label={n.done ? "Tandai belum" : "Tandai selesai"} onClick={() => save(notes.map((x) => x.id === n.id ? { ...x, done: !x.done } : x))}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${n.done ? "border-success bg-success text-primary-foreground" : ""}`}>
                  {n.done && <Check className="h-3 w-3" />}
                </button>
                <span className={`min-w-0 flex-1 break-words text-[12.5px] ${n.done ? "text-muted-foreground line-through" : ""}`}>{n.text}</span>
                <button type="button" aria-label="Hapus catatan" onClick={() => save(notes.filter((x) => x.id !== n.id))} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground active:scale-90"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
