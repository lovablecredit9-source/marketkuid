import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: false },
  beforeLoad: () => { throw redirect({ to: "/privasi", replace: true }); },
  head: () => pageMeta("Kebijakan Privasi — Marketku", "Kebijakan privasi Marketku."),
});
