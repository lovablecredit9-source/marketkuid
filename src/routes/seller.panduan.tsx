import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { BookOpen, ChevronRight, RotateCcw } from "lucide-react";
import { pageMeta } from "@/lib/meta";
import { GUIDES } from "@/lib/panduan";
import { SellerCard, SellerPageTitle } from "@/components/marketku/seller-ui";
import { startTour } from "@/components/marketku/tour";

export const Route = createFileRoute("/seller/panduan")({
  head: () => pageMeta("Panduan Seller — Marketku", "Panduan langkah demi langkah untuk berjualan di Marketku."),
  component: Panduan,
});

function Panduan() {
  const match = useMatchRoute();
  if (match({ to: "/seller/panduan/$slug" })) return <Outlet />;
  return (
    <>
      <SellerPageTitle icon={BookOpen} title="Panduan" desc="Pelajari cara mengelola tokomu" />
      <button onClick={() => { localStorage.removeItem("marketku-tour:seller-dashboard"); startTour(); }} className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-accent/50 p-4 text-left text-sm font-semibold text-primary">
        <RotateCcw className="h-4 w-4" /> Putar ulang tur halaman ini
      </button>
      <div className="space-y-2">
        {GUIDES.map((g) => (
          <Link key={g.slug} to="/seller/panduan/$slug" params={{ slug: g.slug }}>
            <SellerCard className="mb-2 flex items-center gap-3 p-4 transition active:scale-[0.99]">
              <div className="flex-1"><p className="font-semibold">{g.title}</p><p className="text-xs text-muted-foreground">{g.summary}</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </SellerCard>
          </Link>
        ))}
      </div>
    </>
  );
}
