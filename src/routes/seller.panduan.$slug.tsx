import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle, Lightbulb } from "lucide-react";
import { categoryOf, findGuide, type Block } from "@/lib/panduan";
import { GUIDE_ICONS as ICONS } from "@/components/marketku/guide-icons";

export const Route = createFileRoute("/seller/panduan/$slug")({
  loader: ({ params }) => {
    const guide = findGuide(params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => {
    const t = `${loaderData?.title ?? "Panduan"} — Panduan Seller Marketku`;
    const d = `Panduan seller Marketku: ${loaderData?.title ?? ""}.`;
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] };
  },
  notFoundComponent: () => <p className="py-10 text-center text-muted-foreground">Panduan tidak ditemukan.</p>,
  component: Guide,
});

function Render({ b }: { b: Block }) {
  if ("h" in b) return <h4 className="pt-2 font-bold">{b.h}</h4>;
  if ("p" in b) return <p className="text-sm leading-relaxed text-foreground/90">{b.p}</p>;
  if ("ol" in b) return <ol className="space-y-1.5">{b.ol.map((x, i) => <li key={x} className="flex gap-3 text-sm"><span className="w-4 shrink-0 font-semibold text-primary">{i + 1}</span><span>{x}</span></li>)}</ol>;
  if ("ul" in b) return <ul className="space-y-1.5">{b.ul.map((x) => <li key={x} className="flex gap-3 text-sm"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><span>{x}</span></li>)}</ul>;
  if ("code" in b) return <pre className="overflow-x-auto rounded-lg border bg-background/60 p-3 font-mono text-xs leading-relaxed text-foreground/80">{b.code}</pre>;
  if ("table" in b) return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="bg-background/60 text-muted-foreground"><tr>{b.table.head.map((h) => <th key={h} className="px-3 py-2 font-semibold uppercase tracking-wider">{h}</th>)}</tr></thead>
        <tbody>{b.table.rows.map((r) => <tr key={r.join()} className="border-t">{r.map((c, i) => <td key={i} className={`px-3 py-2 ${i === 0 ? "font-semibold" : "text-foreground/85"}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  if ("tip" in b) return <p className="flex gap-2 rounded-lg border-l-2 border-warning bg-warning/10 p-3 text-sm"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span><b>Tips:</b> {b.tip}</span></p>;
  return <p className="flex gap-2 rounded-lg border-l-2 border-destructive bg-destructive/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{b.warn}</span></p>;
}

function Guide() {
  const g = Route.useLoaderData();
  const c = categoryOf(g.category);
  const I = c ? ICONS[c.icon] : null;
  return (
    <>
      <Link to="/seller/panduan" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      <article className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-4">
          {c && <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${c.tone}`}>{I && <I className="h-3 w-3" />}{c.title}</span>}
          <h2 className="mt-3 text-lg font-bold">{g.title}</h2>
        </div>
        <div className="space-y-3 p-4">{g.body.map((b, i) => <Render key={i} b={b} />)}</div>
      </article>
    </>
  );
}
