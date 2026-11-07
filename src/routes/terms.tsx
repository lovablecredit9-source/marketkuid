import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/terms")({
  beforeLoad: () => { throw redirect({ to: "/syarat", replace: true }); },
  head: () => pageMeta("Syarat & Ketentuan — Marketku", "Syarat dan ketentuan penggunaan Marketku."),
});
