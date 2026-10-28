import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo-marketku.png.asset.json";
import { BottomNav } from "./shell";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-accent to-transparent" />
        <div className="absolute -left-40 top-1/3 h-[34rem] w-[34rem] rounded-full border border-primary/15" />
        <div className="absolute -right-48 top-1/4 h-[38rem] w-[38rem] rounded-full border border-primary-glow/25" />
      </div>
      <main className="relative flex min-h-screen flex-col justify-center px-4 pb-32 pt-10">{children}</main>
      <BottomNav />
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card px-4 pb-8 pt-6 shadow-xl shadow-primary/5">
      <div className="flex justify-center border-b pb-4">
        <img src={logo.url} alt="Marketku" className="h-12 w-auto" />
      </div>
      <div className="pt-5">{children}</div>
    </div>
  );
}

export function AuthTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-5 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string | undefined;
  icon: ComponentType<{ className?: string }>;
  hint?: ReactNode | undefined;
  status?: "error" | "ok" | undefined;
  message?: string | undefined;
  password?: boolean;
};

export function Field({ label, icon: Icon, hint, status, message, password, id, ...rest }: FieldProps) {
  const [show, setShow] = useState(false);
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-2">
      {label && <label htmlFor={inputId} className="block text-sm font-semibold">{label}</label>}
      <div className="flex items-center gap-3 rounded-xl border border-input bg-card px-4 py-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Icon className="h-5 w-5 shrink-0 text-primary" />
        <input
          id={inputId}
          {...rest}
          type={password ? (show ? "text" : "password") : rest.type}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {password && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Lihat password"} className="text-muted-foreground">
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
      {message && <p className={`text-sm ${status === "error" ? "text-destructive" : "text-success"}`}>{message}</p>}
      {hint && <p className="text-sm text-foreground/80">{hint}</p>}
    </div>
  );
}

export function GradientButton({ children, disabled, onClick, type = "button" }: { children: ReactNode; disabled?: boolean | undefined; onClick?: (() => void) | undefined; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-glow py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.98] disabled:opacity-55 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-2xl border bg-card py-3.5 font-semibold transition active:scale-[0.98]">
      {children}
    </button>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 border-t pt-6 text-center text-base">{children}</div>;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
