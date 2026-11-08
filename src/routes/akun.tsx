import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  Settings, RefreshCw, ArrowUpRight, Coins, ShoppingBag, Heart, ShoppingCart, Gift, MessageCircle, Clock,
  ShieldAlert, ShieldCheck, Bell, Moon, HelpCircle, Send, Store, LogOut, Wallet, Sparkles, ExternalLink,
  Package, CircleCheck, GitCompareArrows,
} from "lucide-react";
import { AppShell, MenuRow, Section, soon, toggleDark } from "@/components/marketku/shell";
import { SellerSheet } from "@/components/marketku/seller-sheet";
import { LoadingLine } from "@/components/marketku/loading";
import { BUYER_WELCOME, SELLER_WELCOME, WelcomeTour } from "@/components/marketku/welcome-tour";
import { supabase } from "@/integrations/supabase/client";
import { clearSellerLocks } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { toneClass, useSellerStore, type Tone } from "@/lib/seller";
import { useWallet } from "@/lib/wallet";
import { useMyProducts } from "@/lib/products";
import { useSellerOrders } from "@/lib/seller-orders";
import { useSellerBalance, useSellerHolds } from "@/components/marketku/seller-holds";

export const Route = createFileRoute("/akun")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Akun Saya — Marketku" },
      { name: "description", content: "Kelola profil, saldo, dan pengaturan akun Marketku." },
      { property: "og:title", content: "Akun Saya — Marketku" },
      { property: "og:description", content: "Profil dan saldo akun Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // /akun?jualan=1 (from "Jadi Seller") opens the "Mulai Jualan" sheet right away.
  validateSearch: (s: Record<string, unknown>): { jualan?: 1 } => (s["jualan"] === 1 || s["jualan"] === "1" ? { jualan: 1 } : {}),
  component: Akun,
});

function Stat({ icon: I, value, label, full }: { icon: typeof Coins; value: number; label: string; full?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-3 shadow-sm ${full ? "col-span-2" : ""}`}>
      <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-primary"><I className="h-3.5 w-3.5" /></span>
      <p className="mk-acc-mono mt-2 text-base font-bold">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Tile({ icon: I, label, tone, onClick }: { icon: typeof Coins; label: string; tone: Tone; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-xl border bg-card py-2.5 text-xs font-semibold shadow-sm transition active:scale-95">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneClass[tone]}`}><I className="h-4 w-4" /></span>
      {label}
    </button>
  );
}

function AkunLoading() {
  return (
    <AppShell title="Akun Saya">
      <div className="relative min-h-[70vh] overflow-hidden px-6 pt-20">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-40 h-[22rem] w-[40rem] rounded-[50%] border border-primary/10" />
        <div aria-hidden className="pointer-events-none absolute -left-10 top-48 h-[20rem] w-[36rem] rounded-[50%] border border-primary/10" />
        <LoadingLine label="Memuat profil & saldo..." className="relative text-sm" />
      </div>
    </AppShell>
  );
}

function Akun() {
  const { user, ready } = useAuth();
  if (!ready) return <AkunLoading />;
  if (user) return <AkunDashboard user={user} />;
  return (
    <AppShell title="Akun Saya">
      <div className="relative overflow-hidden px-4 pt-16">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-40 h-[22rem] w-[40rem] rounded-[50%] border border-primary/10" />
        <div aria-hidden className="pointer-events-none absolute -left-10 top-48 h-[20rem] w-[36rem] rounded-[50%] border border-primary/10" />
        <div className="relative">
          <ShieldCheck className="ml-4 h-7 w-7 text-primary lg:mx-auto" />
          <h1 className="mt-5 text-center text-[17px] font-bold">Masuk dulu untuk membuka akunmu</h1>
          <p className="mt-2 text-center text-sm text-foreground/80">Setelah login, kamu bisa lihat saldo, ringkasan pesanan, dan aktivitas wishlist.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/login" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95">Masuk</Link>
            <Link to="/register" className="rounded-xl border border-primary/40 bg-card px-6 py-2.5 text-sm font-bold text-primary transition active:scale-95">Buat akun</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const VIEW_KEY = "marketku-akun-view";

function AkunDashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sellerOpen, setSellerOpen] = useState(false);
  const [tour, setTour] = useState(false);
  const [view, setView] = useState<"buyer" | "seller">("seller");

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "buyer" || saved === "seller") setView(saved);
  }, []);
  const switchView = (v: "buyer" | "seller") => {
    setView(v);
    window.localStorage.setItem(VIEW_KEY, v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, username, created_at").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  const store = useSellerStore(user.id);
  const wallet = useWallet(user.id);
  const counts = useQuery({
    queryKey: ["buyer_counts", user.id],
    queryFn: async () => {
      const [o, w] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id),
        supabase.from("wishlists").select("product_id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      return { orders: o.count ?? 0, wishlist: w.count ?? 0 };
    },
  });

  const name = profile.data?.full_name || user.email?.split("@")[0] || "Pengguna";
  const isSeller = !!store.data;
  const { jualan } = Route.useSearch();
  useEffect(() => {
    if (!jualan || store.isLoading) return;
    if (store.data) switchView("seller"); else setSellerOpen(true);
    navigate({ to: "/akun", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jualan, store.isLoading, store.data]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearSellerLocks();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const logoutBtn = (
    <button onClick={() => void signOut()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 py-2.5 text-sm font-semibold text-destructive transition active:scale-[0.98]">
      <LogOut className="h-4 w-4" /> Keluar
    </button>
  );

  if (profile.isPending || store.isPending) return <AkunLoading />;

  if (isSeller && view === "seller") {
    return (
      <AppShell title="Akun Saya" className="mk-acc-serif">
        <SellerAccount storeName={store.data!.store_name} onBuyer={() => switchView("buyer")} onCenter={() => navigate({ to: "/seller" })} onTour={() => setTour(true)} />
        <div className="px-4 pt-3">{logoutBtn}</div>
        <WelcomeTour id="seller-account" steps={SELLER_WELCOME} open={tour} onOpenChange={setTour} />
      </AppShell>
    );
  }

  const joined = new Date(profile.data?.created_at ?? user.created_at)
    .toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();

  return (
    <AppShell title="Akun Saya" className="mk-acc-serif">
      <div className="space-y-3 px-4 pt-3">
        <section className="rounded-xl border bg-gradient-to-br from-card via-card to-accent/70 p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary mk-acc-heading text-base font-bold text-primary-foreground shadow-md shadow-primary/30">{name.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="mk-acc-heading truncate text-base font-bold">{name}</h1>
                <span className="rounded-full border border-primary/30 bg-accent px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">MEMBER</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <span className="mt-1.5 inline-block rounded-full border bg-card px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground">GABUNG {joined}</span>
            </div>
          </div>
          <button onClick={() => navigate({ to: "/akun/pengaturan" })} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-accent/60 py-2 text-xs font-semibold text-primary transition active:scale-[0.98]">
            <Settings className="h-3.5 w-3.5" /> Atur Profil
          </button>
        </section>

        {profile.data?.username && (
          <button onClick={() => soon("Profil publik")} className="rounded-full border border-dashed border-primary/40 bg-accent/40 px-3 py-1.5 text-xs font-semibold text-primary">
            Lihat profil publik @{profile.data.username}
          </button>
        )}

        <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-accent/60 to-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> SALDO MARKETKU</p>
            <button aria-label="Muat ulang" onClick={() => wallet.refetch()} className="grid h-7 w-7 place-items-center rounded-md border bg-card"><RefreshCw className={`h-3.5 w-3.5 ${wallet.isFetching ? "animate-spin" : ""}`} /></button>
          </div>
          <p className="mt-2 mk-acc-mono text-xl">Rp {(wallet.data ?? 0).toLocaleString("id-ID")}</p>
          <button onClick={() => navigate({ to: "/topup" })} className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">Lihat riwayat & tarik dana <ArrowUpRight className="h-3 w-3" /></button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => soon("Tarik Saldo")} className="rounded-xl bg-primary/50 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20">Tarik Saldo</button>
            <button onClick={() => navigate({ to: "/topup" })} className="rounded-xl border bg-card py-2 text-xs font-semibold">Top Up</button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Saldo otomatis kembali ke akunmu kalau order dibatalkan atau di-refund.</p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Stat icon={Coins} value={0} label="TOKEN" />
          <Stat icon={ShoppingBag} value={counts.data?.orders ?? 0} label="TOTAL ORDER" />
          <Stat icon={Heart} value={counts.data?.wishlist ?? 0} label="WISHLIST" full />
        </div>

        <section className="rounded-xl border bg-card p-3 shadow-sm">
          <h3 className="mb-2 text-[10px] font-bold tracking-widest text-muted-foreground">BELANJA</h3>
          <div className="grid grid-cols-3 gap-2">
            <Tile icon={ShoppingBag} tone="amber" label="Pesanan" onClick={() => navigate({ to: "/riwayat" })} />
            <Tile icon={Heart} tone="pink" label="Wishlist" onClick={() => navigate({ to: "/wishlist" })} />
            <Tile icon={ShoppingCart} tone="cyan" label="Keranjang" onClick={() => navigate({ to: "/keranjang" })} />
            <Tile icon={Gift} tone="amber" label="Voucher" onClick={() => soon("Voucher")} />
            <Tile icon={MessageCircle} tone="green" label="Pesan" onClick={() => navigate({ to: "/pesan" })} />
            <Tile icon={Clock} tone="blue" label="Riwayat" onClick={() => navigate({ to: "/riwayat" })} />
            <Tile icon={ShieldAlert} tone="amber" label="Dispute" onClick={() => navigate({ to: "/dispute" })} />
            <Tile icon={Store} tone="blue" label="Toko Diikuti" onClick={() => navigate({ to: "/toko-diikuti" })} />
            <Tile icon={GitCompareArrows} tone="cyan" label="Bandingkan" onClick={() => navigate({ to: "/bandingkan" })} />
            <Tile icon={Gift} tone="pink" label="Undang Teman" onClick={() => navigate({ to: "/referral" })} />
          </div>
        </section>

        <Section title="AKUN">
          <MenuRow icon={Settings} tone="slate" title="Pengaturan Akun" desc="Nama, email, no HP, dan password" onClick={() => navigate({ to: "/akun/pengaturan" })} />
          <MenuRow icon={Bell} tone="blue" title="Notifikasi" desc="Atur preferensi email & push" />
          <MenuRow icon={Moon} tone="blue" title="Tema Gelap" desc="Aktifkan mode gelap" onClick={() => toggleDark()} />
        </Section>

        <Section title="BANTUAN">
          <MenuRow icon={Sparkles} tone="amber" title="Lihat Welcome Tour" desc="Panduan singkat memakai akun Marketku" onClick={() => setTour(true)} />
          <MenuRow icon={HelpCircle} tone="cyan" title="Pusat Bantuan" desc="FAQ & panduan pengguna" onClick={() => navigate({ to: "/bantuan" })} />
          <MenuRow icon={Send} tone="green" title="Hubungi Kami" desc="Kirim pesan ke tim support" onClick={() => navigate({ to: "/kontak" })} />
        </Section>

        {isSeller ? (
          <BigCard tone="green" icon={Store} title="Lihat akun seller saya" desc={`Kelola toko ${store.data!.store_name}, produk, dan pesanan.`} onClick={() => switchView("seller")} />
        ) : (
          <BigCard tone="amber" icon={Sparkles} title="Mulai Jualan di Marketku" desc="Tingkatkan akun jadi seller dan buka tokomu sendiri." onClick={() => setSellerOpen(true)} />
        )}

        {logoutBtn}
      </div>
      <WelcomeTour id="buyer-account" steps={BUYER_WELCOME} open={tour} onOpenChange={setTour} />
      <SellerSheet open={sellerOpen} onOpenChange={setSellerOpen} userId={user.id} ownerName={name}
        onCreated={() => { switchView("seller"); setTour(true); void queryClient.invalidateQueries({ queryKey: ["seller_store", user.id] }); }} />
    </AppShell>
  );
}

function BigCard({ tone, icon: I, title, desc, onClick }: { tone: "amber" | "green"; icon: typeof Store; title: string; desc: string; onClick: () => void }) {
  const box = tone === "amber" ? "border-tone-amber/40 bg-tone-amber/5" : "border bg-card";
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition active:scale-[0.98] ${box}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${toneClass[tone]}`}><I className="h-4 w-4" /></span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 rotate-45 text-muted-foreground" />
    </button>
  );
}

const revenueTabs = [
  { key: "tersedia", label: "Tersedia", hint: "Bisa langsung ditarik", action: "Tarik dana" },
  { key: "tertahan", label: "Tertahan", hint: "Menunggu pesanan selesai", action: "Tarik dana" },
  { key: "credits", label: "Credits", hint: "Saldo potongan komisi & markup", action: "Top up credit" },
] as const;

function SellerAccount({ storeName, onBuyer, onCenter, onTour }: { storeName: string; onBuyer: () => void; onCenter: () => void; onTour: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof revenueTabs)[number]["key"]>("tersedia");
  const active = revenueTabs.find((t) => t.key === tab)!;
  const { user } = useAuth();
  const qc = useQueryClient();
  const balance = useSellerBalance(user?.id);
  const holds = useSellerHolds(user?.id);
  const credits = useQuery({
    queryKey: ["seller_credits", user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_credits").select("balance").eq("owner_id", user!.id).maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
    },
  });
  const orders = useSellerOrders(user?.id);
  const products = useMyProducts(user?.id);
  const all = orders.data ?? [];
  const since = Date.now() - 30 * 864e5;
  const activeProducts = (products.data ?? []).filter((p) => p.status === "active").length;
  const newOrders = all.filter((o) => o.status === "paid" || o.status === "processing").length;
  const done30 = all.filter((o) => o.status === "completed" && new Date(o.created_at).getTime() >= since).length;
  const held = (holds.data ?? []).reduce((s, h) => s + Number(h.amount), 0);
  const amount = tab === "tersedia" ? Number(balance.data ?? 0) : tab === "tertahan" ? held : Number(credits.data ?? 0);
  const refresh = () => {
    for (const k of ["seller_credits", "seller_orders"]) void qc.invalidateQueries({ queryKey: [k] });
    void balance.refetch(); void holds.refetch(); void products.refetch();
  };
  return (
    <div className="space-y-3 px-5 pt-3">
      <section className="rounded-xl border bg-gradient-to-br from-card via-card to-accent/70 p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-tone-green to-primary text-primary-foreground shadow-md"><Store className="h-6 w-6" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="mk-acc-heading truncate text-lg font-bold">{storeName}</h1>
              <span className="h-2.5 w-2.5 rounded-full bg-success ring-2 ring-success/30" aria-label="Aktif" />
            </div>
            <span className="mt-1.5 inline-block rounded-md border bg-card px-2 py-0.5 text-xs text-muted-foreground">Status: <b className="font-semibold text-foreground">Seller</b></span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => navigate({ to: "/seller/pengaturan" })} className="flex items-center justify-center gap-2 rounded-full border border-success/50 bg-success/10 py-2 text-xs font-semibold text-tone-green transition active:scale-95">
            <Settings className="h-3.5 w-3.5" /> Atur Toko
          </button>
          <button onClick={onCenter} className="flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-accent py-2 text-xs font-semibold text-primary transition active:scale-95">
            <ExternalLink className="h-3.5 w-3.5" /> Seller Center
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-success/40 bg-gradient-to-br from-success/10 to-card p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> REVENUE TOKO</p>
          <button aria-label="Muat ulang" onClick={refresh} className="grid h-7 w-7 place-items-center rounded-md border bg-card transition active:rotate-180"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-2 inline-flex rounded-lg border bg-muted/60 p-0.5">
          {revenueTabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-3 mk-acc-mono text-2xl font-bold">Rp {amount.toLocaleString("id-ID")}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">{active.hint} <ArrowUpRight className="h-3 w-3" /></p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => navigate({ to: "/seller/withdraw" })} className="rounded-xl bg-primary/50 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition active:scale-95">Tarik dana</button>
          <button onClick={() => navigate({ to: "/seller/saldo" })} className="rounded-xl border bg-card py-2 text-xs font-semibold transition active:scale-95">Top up credit</button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Saldo terjadwal otomatis pindah ke "Tersedia" begitu pesanan selesai.</p>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Package} value={activeProducts} label="PRODUK AKTIF" />
        <Stat icon={Clock} value={newOrders} label="PESANAN BARU" />
        <Stat icon={CircleCheck} value={done30} label="SELESAI 30H" />
      </div>

      <Section title="AKUN">
        <MenuRow icon={Settings} tone="slate" title="Pengaturan Akun" desc="Nama, email, no HP, dan password" onClick={() => navigate({ to: "/akun/pengaturan" })} />
        <MenuRow icon={Moon} tone="blue" title="Tema Gelap" desc="Aktifkan mode gelap" onClick={() => toggleDark()} />
      </Section>

      <Section title="BANTUAN">
        <MenuRow icon={Sparkles} tone="amber" title="Lihat Welcome Tour" desc="Panduan singkat memakai dashboard seller" onClick={onTour} />
        <MenuRow icon={HelpCircle} tone="cyan" title="Pusat Bantuan Seller" desc="Panduan onboarding, kebijakan, & kasus khusus" onClick={() => navigate({ to: "/seller/panduan" })} />
        <MenuRow icon={Send} tone="green" title="Hubungi Tim Marketku" desc="Kontak langsung untuk masalah toko" onClick={() => navigate({ to: "/kontak" })} />
      </Section>

      <BigCard tone="green" icon={ShoppingBag} title="Lihat akun pembeli saya" desc="Buka dashboard buyer untuk belanja, wishlist, dan riwayat order." onClick={onBuyer} />
    </div>
  );
}
