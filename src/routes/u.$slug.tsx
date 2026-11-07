import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/meta";

// marketku.id-style store links (/u/nama-toko) open the store page.
export const Route = createFileRoute("/u/$slug")({
  staticData: { sitemap: false },
  beforeLoad: ({ params }) => { throw redirect({ to: "/toko/$slug", params: { slug: params.slug }, replace: true }); },
  head: () => pageMeta("Toko — Marketku", "Lihat profil toko di Marketku."),
});
