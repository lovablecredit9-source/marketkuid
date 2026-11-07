import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthLayout, AuthTitle, Field, GradientButton } from "@/components/marketku/auth";
import { supabase } from "@/integrations/supabase/client";
import { authErrorText } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Atur Password Baru — Marketku" },
      { name: "description", content: "Buat password baru untuk akun Marketku kamu." },
      { property: "og:title", content: "Atur Password Baru — Marketku" },
      { property: "og:description", content: "Buat password baru untuk akun Marketku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const valid = pass.length >= 8 && pass === confirm;

  const submit = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) { toast.error(authErrorText(error.message)); return; }
    toast.success("Password berhasil diganti");
    navigate({ to: "/akun", replace: true });
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthTitle title="Atur password baru" desc="Buat password baru minimal 8 karakter." />
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (valid && !loading) void submit(); }}>
          <Field label="Password baru" icon={KeyRound} name="pass" password placeholder="Min. 8 karakter" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password"
            status="error" message={pass && pass.length < 8 ? "Password minimal 8 karakter." : undefined} />
          <Field label="Konfirmasi password" icon={KeyRound} name="confirm" password placeholder="Ulangi password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
            status="error" message={confirm && confirm !== pass ? "Password konfirmasi belum sama." : undefined} />
          <GradientButton type="submit" disabled={!valid || loading}>{loading ? "Menyimpan..." : "Simpan password"}</GradientButton>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
