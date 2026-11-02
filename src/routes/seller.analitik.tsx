import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Award, Clock, CreditCard, DollarSign, PieChart as PieIcon, RefreshCw, ShoppingCart, Target, TrendingUp, Users, Wifi, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth";
import { SellerCard } from "@/components/marketku/seller-ui";
import { PageTour, type TourStep } from "@/components/marketku/tour";
import { ORDER_LABEL } from "@/lib/market";
import { useSellerOrders, type SellerOrder } from "@/lib/seller-orders";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/seller/analitik")({
  head: () => pageMeta("Analitik — Seller Center Marketku", "Grafik pendapatan, pesanan, metode pembayaran, kategori dan jam sibuk toko kamu."),
  component: Analitik,
});

const RANGES = [{ v: 7, a: "7", b: "Hari" }, { v: 30, a: "30", b: "Hari" }, { v: 90, a: "90", b: "Hari" }, { v: 365, a: "1", b: "Tahun" }] as const;
const PALETTE = ["var(--ana-blue)", "var(--ana-sky)", "var(--ana-green)", "var(--ana-violet)", "var(--ana-amber)"];
const tour: TourStep[] = [
  { title: "Analitik toko", desc: "Halaman ini menampilkan performa bisnismu secara menyeluruh.", target: "ana-head" },
  { title: "Atur tampilan", desc: "Atur rentang waktu, ekspor data, dan segarkan angka dari sini.", target: "ana-range" },
  { title: "Selesai", desc: "Pantau tren ini berkala untuk ambil keputusan jualan." },
];

/** Short rupiah like panel.marketku.id: Rp 43rb, Rp 1,2jt, Rp 100 */
function rpShort(n: number) {
  const v = Math.round(n);
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (v >= 1000) return `Rp ${Math.round(v / 1000)}rb`;
  return `Rp ${v}`;
}
const net = (o: SellerOrder) => Number(o.subtotal) - Number(o.discount);
const isRevenue = (o: SellerOrder) => ["paid", "processing", "completed"].includes(o.status);

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function Analitik() {
  const { user } = useAuth();
  const orders = useSellerOrders(user?.id);
  const [days, setDays] = useState<number>(30);
  const all = orders.data ?? [];

  const d = useMemo(() => {
    const now = Date.now();
    const since = now - days * 86400000;
    const prevSince = since - days * 86400000;
    const cur = all.filter((o) => new Date(o.created_at).getTime() >= since);
    const prev = all.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= prevSince && t < since; });
    const sum = (list: SellerOrder[]) => list.filter(isRevenue).reduce((a, o) => a + net(o), 0);
    const paid = cur.filter(isRevenue);
    const revenue = sum(cur);
    const buyers = new Set(cur.map((o) => o.buyer_id)).size;
    const avg = paid.length ? revenue / paid.length : 0;
    const prevPaid = prev.filter(isRevenue);
    const prevAvg = prevPaid.length ? sum(prev) / prevPaid.length : 0;

    // daily / bucketed series
    const buckets = days > 90 ? 12 : days;
    const step = (days * 86400000) / buckets;
    const series = Array.from({ length: buckets }, (_, i) => {
      const start = since + i * step;
      const list = cur.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= start && t < start + step; });
      const dt = new Date(start + step - 1);
      return {
        label: days > 90 ? dt.toLocaleDateString("id-ID", { month: "short" }) : dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        revenue: list.filter(isRevenue).reduce((a, o) => a + net(o), 0),
        orders: list.length,
      };
    });

    const methods = new Map<string, number>();
    for (const o of cur) { const k = (o.payment_method || "Lainnya").toUpperCase(); methods.set(k, (methods.get(k) ?? 0) + 1); }
    const methodList = [...methods.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const best = new Map<string, { name: string; cat: string; revenue: number; qty: number }>();
    const cats = new Map<string, { revenue: number; count: number }>();
    for (const o of paid) for (const i of o.order_items) {
      const cat = (i as { products?: { product_categories?: { name?: string } | null } | null }).products?.product_categories?.name ?? "Lainnya";
      const k = i.product_id ?? i.product_name;
      const b = best.get(k) ?? { name: i.product_name, cat, revenue: 0, qty: 0 };
      best.set(k, { ...b, revenue: b.revenue + Number(i.line_total), qty: b.qty + i.qty });
      const c = cats.get(cat) ?? { revenue: 0, count: 0 };
      cats.set(cat, { revenue: c.revenue + Number(i.line_total), count: c.count + 1 });
    }
    const catTotal = [...cats.values()].reduce((a, c) => a + c.revenue, 0);
    const catList = [...cats.entries()].map(([name, c]) => ({ name, value: c.revenue, count: c.count, pct: catTotal ? Math.round((c.revenue / catTotal) * 100) : 0 })).sort((a, b) => b.value - a.value);

    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, orders: 0, revenue: 0 }));
    for (const o of cur) { const h = new Date(o.created_at).getHours(); hours[h]!.orders++; if (isRevenue(o)) hours[h]!.revenue += net(o); }
    const peak = hours.reduce((a, b) => (b.orders > a.orders ? b : a), hours[0]!);

    return {
      revenue, revenueTrend: pct(revenue, sum(prev)),
      total: cur.length, ordersTrend: pct(cur.length, prev.length), maxOrder: paid.reduce((a, o) => Math.max(a, net(o)), 0),
      buyers, buyersTrend: pct(buyers, new Set(prev.map((o) => o.buyer_id)).size),
      avg, avgTrend: pct(avg, prevAvg), minOrder: paid.length ? Math.min(...paid.map(net)) : 0,
      series, methodList, bestList: [...best.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10), catList, hours, peak,
      byStatus: Object.keys(ORDER_LABEL).map((k) => ({ k, n: cur.filter((o) => o.status === k).length })).filter((x) => x.n > 0),
      count: cur.length,
    };
  }, [all, days]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div data-tour="ana-head" className="min-w-0">
          <h1 className="text-[17px] font-bold leading-tight">Analitik toko</h1>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Analisis performa toko Anda secara mendalam</p>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ana-green)_15%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ana-green)]">
          <Wifi className="h-3 w-3" /> Live
        </span>
      </div>

      <div data-tour="ana-range" className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1 rounded-lg border p-1">
          {RANGES.map((r) => (
            <button key={r.v} onClick={() => setDays(r.v)} className={`rounded-md py-1 text-[11px] leading-tight ${days === r.v ? "border bg-card font-semibold text-foreground" : "text-muted-foreground"}`}>
              {r.a}<br />{r.b}
            </button>
          ))}
        </div>
        <button aria-label="Segarkan" onClick={() => orders.refetch()} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-card">
          <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <Kpi label="Total Pendapatan" value={rpShort(d.revenue)} sub={`Avg order: ${rpShort(d.avg)}`} trend={d.revenueTrend} icon={DollarSign} color="var(--ana-green)" />
      <Kpi label="Total Pesanan" value={String(d.total)} sub={`Max: ${rpShort(d.maxOrder)}`} trend={d.ordersTrend} icon={ShoppingCart} color="var(--ana-sky)" />
      <Kpi label="Pelanggan Aktif" value={String(d.buyers)} trend={d.buyersTrend} icon={Users} color="var(--ana-violet)" />
      <Kpi label="Rata-rata order" value={rpShort(d.avg)} sub={`Min: ${rpShort(d.minOrder)}`} icon={Target} color="var(--ana-violet)" />

      <Section icon={TrendingUp} title="Pendapatan & Pesanan">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.series} margin={{ top: 6, right: 0, left: 4, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--ana-grid)" }} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis yAxisId="r" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={rpShort} width={54} />
              <YAxis yAxisId="o" orientation="right" allowDecimals={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={22} />
              <Tooltip content={<Tip money="revenue" />} />
              <Line yAxisId="o" type="monotone" dataKey="orders" name="Pesanan" stroke="var(--ana-green)" strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue" stroke="var(--ana-blue)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-[10px]">
          <span className="text-[var(--ana-green)]">-○- Pesanan</span>
          <span className="text-[var(--ana-blue)]">-○- Revenue</span>
        </div>
      </Section>

      <Section icon={CreditCard} title="Metode Pembayaran">
        {d.methodList.length === 0 ? <Empty /> : (
          <>
            <Donut data={d.methodList} />
            <div className="mx-auto mt-2 w-fit space-y-2">
              {d.methodList.map((m, i) => {
                const p = Math.round((m.value / d.count) * 100);
                return (
                  <div key={m.name} className="text-[11px]">
                    <div className="flex items-center gap-2"><Dot c={PALETTE[i % 5]!} /><b>{m.name}</b><span className="text-muted-foreground">{m.value} ({p}%)</span></div>
                    <div className="ml-5 mt-1 h-1 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${p}%`, background: PALETTE[i % 5] }} /></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Section>

      <Section icon={Award} title="Produk Terlaris">
        {d.bestList.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-[10px]">
              <thead><tr className="text-left text-muted-foreground"><th className="w-4 py-1.5 font-medium">#</th><th className="font-medium">Produk</th><th className="text-right font-medium">Pendapatan</th></tr></thead>
              <tbody>
                {d.bestList.map((b, i) => (
                  <tr key={b.name + i} className="border-t">
                    <td className="py-2 align-top">{i + 1}</td>
                    <td className="max-w-[170px] py-2 pr-2"><p className="truncate font-bold uppercase">{b.name}</p><p className="text-muted-foreground">{b.cat}</p></td>
                    <td className="py-2 text-right font-bold text-[var(--ana-green)]">{rpShort(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon={PieIcon} title="Pendapatan per Kategori">
        {d.catList.length === 0 ? <Empty /> : (
          <>
            <Donut data={d.catList} />
            <div className="mx-auto mt-2 w-fit space-y-1.5 text-[11px]">
              {d.catList.map((c, i) => (
                <div key={c.name} className="grid grid-cols-[12px_auto_auto_auto] items-center gap-2">
                  <Dot c={PALETTE[i % 5]!} /><b className="pr-2">{c.name}</b><b className="text-right">{c.pct}%</b><span className="text-muted-foreground">({c.count})</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section icon={Clock} title="Jam Sibuk Transaksi">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.hours} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="var(--ana-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} interval={1} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "color-mix(in oklab, var(--foreground) 60%, transparent)" }} content={<Tip />} />
              <Bar dataKey="orders" name="Pesanan" fill="var(--ana-blue)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-[var(--ana-amber)]" />
          {d.peak.orders === 0 ? "Belum ada transaksi pada periode ini." : <>Jam tersibuk: <b className="text-foreground">{d.peak.hour}</b> ({d.peak.orders} pesanan, {rpShort(d.peak.revenue)})</>}
        </p>
      </Section>

      <Section icon={ShoppingCart} title="Status Pesanan">
        {d.byStatus.length === 0 ? <Empty /> : (
          <div className="space-y-2">
            {d.byStatus.map((x) => (
              <div key={x.k} className="flex items-center gap-3 text-[11px]">
                <span className="w-20 text-muted-foreground">{ORDER_LABEL[x.k]}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-[var(--ana-blue)]" style={{ width: `${(x.n / d.count) * 100}%` }} /></span>
                <b className="w-5 text-right">{x.n}</b>
              </div>
            ))}
          </div>
        )}
      </Section>

      <PageTour id="seller-analitik" steps={tour} panel />
    </div>
  );
}

function Kpi({ label, value, sub, trend, icon: I, color }: { label: string; value: string; sub?: string; trend?: number; icon: typeof DollarSign; color: string }) {
  const up = (trend ?? 0) >= 0;
  return (
    <SellerCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-[19px] font-bold leading-none">{value}</p>
          {sub && <p className="mt-1.5 text-[10px] text-muted-foreground">{sub}</p>}
          {trend !== undefined && (
            <p className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${up ? "text-[var(--ana-green)]" : "text-destructive"}`}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(trend)}% vs periode lalu
            </p>
          )}
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}>
          <I className="h-4 w-4" />
        </span>
      </div>
    </SellerCard>
  );
}

function Section({ icon: I, title, children }: { icon: typeof DollarSign; title: string; children: React.ReactNode }) {
  return (
    <SellerCard className="p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold"><I className="h-4 w-4" /> {title}</h3>
      {children}
    </SellerCard>
  );
}

function Donut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="mx-auto h-36 w-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="100%" stroke="var(--card)" strokeWidth={1} startAngle={90} endAngle={-270} isAnimationActive={false}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % 5]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Tip({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; dataKey: string }[]; label?: string; money?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-[11px] shadow-lg">
      <p className="mb-1 font-bold">{label}</p>
      {payload.map((p) => <p key={p.dataKey} className="text-muted-foreground">{p.name}: <b className="text-foreground">{p.dataKey === money ? rpShort(p.value) : p.value}</b></p>)}
    </div>
  );
}

const Dot = ({ c }: { c: string }) => <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />;
const Empty = () => <p className="py-6 text-center text-[11px] text-muted-foreground">Belum ada data pada periode ini.</p>;
