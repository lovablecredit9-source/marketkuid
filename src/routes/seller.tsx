import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Store } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSellerStore } from "@/lib/seller";
import { SellerBottomNav, SellerHeader, SellerMenuSheet, useSellerTheme } from "@/components/marketku/seller-ui";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller Center — Marketku" },
      { name: "description", content: "Kelola toko, produk, saldo, dan transaksi di Seller Center Marketku." },
      { property: "og:title", content: "Seller Center — Marketku" },
      { property: "og:description", content: "Dashboard penjual Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerLayout,
});

function Gate({ children }: { children: ReactNode }) {
  return <div className="seller-panel flex min-h-screen items-center justify-center px-6 text-center">{children}</div>;
}

function SellerLayout() {
  const { user, ready } = useAuth();
  const store = useSellerStore(user?.id);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useSellerTheme();

  if (!ready || (user && store.isLoading)) return <Gate><p className="text-muted-foreground">Memuat...</p></Gate>;
  if (!user || !store.data) {
    return (
      <Gate>
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6">
          <Store className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-xl font-bold">{user ? "Kamu belum punya toko" : "Masuk dulu ke akunmu"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user ? "Buka akun seller dari halaman Akun untuk memakai Seller Center." : "Seller Center hanya untuk akun yang sudah membuka toko."}</p>
          <Link to={user ? "/akun" : "/login"} className="mt-5 inline-flex w-full justify-center rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 font-bold text-primary-foreground">
            {user ? "Ke halaman Akun" : "Masuk"}
          </Link>
        </div>
      </Gate>
    );
  }

  return (
    <div className="seller-panel min-h-screen">
      <div className="mx-auto min-h-screen max-w-md">
        <SellerHeader store={store.data} email={user.email ?? ""} onMenu={() => setMenu(true)} theme={theme} onTheme={setTheme} />
        <main className="space-y-4 px-3 pb-28 pt-3"><Outlet /></main>
        <SellerBottomNav onMenu={() => setMenu(true)} menuOpen={menu} />
        <SellerMenuSheet open={menu} onOpenChange={setMenu} />
      </div>
    </div>
  );
}
