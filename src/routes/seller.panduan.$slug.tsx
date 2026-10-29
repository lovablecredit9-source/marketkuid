import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { findGuide } from "@/lib/panduan";
import { SellerCard } from "@/components/marketku/seller-ui";

export const Route = createFileRoute("/seller/panduan/$slug")({
  loader: ({ params }) => {
    const guide = findGuide(params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => {
    const t = `${loaderData?.title ?? "Panduan"} — Panduan Seller Marketku`;
    const d = loaderData?.summary ?? "Panduan seller Marketku.";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] };
  },
  notFoundComponent: () => <p className="py-10 text-center text-muted-foreground">Panduan tidak ditemukan.</p>,
  component: Guide,
});

function Guide() {
  const g = Route.useLoaderData();
  return (
    <>
      <Link to="/seller/panduan" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Semua panduan</Link>
      <h2 className="text-xl font-bold">{g.title}</h2>
      <p className="text-sm text-muted-foreground">{g.summary}</p>
      <SellerCard className="p-4">
        <ol className="space-y-4">
          {g.steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </SellerCard>
    </>
  );
}
